# Use an official Node runtime as the base image for building the application
# Build with Playwright (browsers and deps ready)
FROM mcr.microsoft.com/playwright:v1.55.0-jammy AS build

# Install git, git-lfs, and dependencies for Pandoc (only if ENABLE_LATEX_CONVERSION=true)
RUN apt-get update && apt-get install -y git git-lfs wget && apt-get clean

# Install latest Pandoc from GitHub releases (only installed if needed later)
RUN wget -qO- https://github.com/jgm/pandoc/releases/download/3.8/pandoc-3.8-linux-amd64.tar.gz | tar xzf - -C /tmp && \
    cp /tmp/pandoc-3.8/bin/pandoc /usr/local/bin/ && \
    cp /tmp/pandoc-3.8/bin/pandoc-lua /usr/local/bin/ && \
    rm -rf /tmp/pandoc-3.8

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json
COPY app/package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY app/ .

# Conditionally convert LaTeX to MDX if ENABLE_LATEX_CONVERSION=true
ARG ENABLE_LATEX_CONVERSION=false
RUN if [ "$ENABLE_LATEX_CONVERSION" = "true" ]; then \
    echo "🔄 LaTeX importer enabled - running latex:convert..."; \
    npm run latex:convert; \
    else \
    echo "⏭️  LaTeX importer disabled - skipping..."; \
    fi

# Pre-install notion-importer dependencies (for runtime import)
# Note: Notion import is done at RUNTIME (not build time) to access secrets
RUN cd scripts/notion-importer && npm install && cd ../..

# Ensure `public/data` is a real directory with real files (not a symlink)
# This handles the case where `public/data` is a symlink in the repo, which
# would be broken inside the container after COPY.
RUN set -e; \
    if [ -e public ] && [ ! -d public ]; then rm -f public; fi; \
    mkdir -p public; \
    if [ -L public/data ] || { [ -e public/data ] && [ ! -d public/data ]; }; then rm -f public/data; fi; \
    mkdir -p public/data; \
    cp -a src/content/assets/data/. public/data/

# Build the application (with minimal placeholder content)
RUN npm run build

# Generate the PDF (light theme, full wait)
RUN npm run export:pdf -- --theme=light --wait=full

# Generate LaTeX export
RUN npm run export:latex

# Install nginx in the build stage (we'll use this image as final to keep Node.js)
RUN apt-get update && apt-get install -y nginx && apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Create necessary directories and set permissions
RUN mkdir -p /var/cache/nginx /var/run /var/log/nginx /var/lib/nginx/body && \
    chmod -R 777 /var/cache/nginx /var/run /var/log/nginx /var/lib/nginx /etc/nginx/nginx.conf && \
    chmod -R 777 /app

# Expose port 8080
EXPOSE 8080

# Use entrypoint script that handles Notion import if enabled
ENTRYPOINT ["/entrypoint.sh"]
