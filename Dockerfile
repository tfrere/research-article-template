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

# Conditionally import from Notion if ENABLE_NOTION_IMPORT=true
ARG ENABLE_NOTION_IMPORT=false
ARG NOTION_TOKEN
ARG NOTION_PAGE_ID
# Convert ARG to ENV so they're available to Node.js
ENV NOTION_TOKEN=$NOTION_TOKEN
ENV NOTION_PAGE_ID=$NOTION_PAGE_ID
# Debug: show if variables are set
RUN echo "🔍 Debug: ENABLE_NOTION_IMPORT=$ENABLE_NOTION_IMPORT"
RUN echo "🔍 Debug: NOTION_TOKEN=${NOTION_TOKEN:+SET (${#NOTION_TOKEN} chars)}${NOTION_TOKEN:-NOT SET}"
RUN echo "🔍 Debug: NOTION_PAGE_ID=${NOTION_PAGE_ID:+SET}${NOTION_PAGE_ID:-NOT SET}"
RUN if [ "$ENABLE_NOTION_IMPORT" = "true" ]; then \
    echo "🔄 Notion importer enabled - running notion:import..."; \
    npm run notion:import; \
    else \
    echo "⏭️  Notion importer disabled - skipping..."; \
    fi

# Ensure `public/data` is a real directory with real files (not a symlink)
# This handles the case where `public/data` is a symlink in the repo, which
# would be broken inside the container after COPY.
RUN set -e; \
    if [ -e public ] && [ ! -d public ]; then rm -f public; fi; \
    mkdir -p public; \
    if [ -L public/data ] || { [ -e public/data ] && [ ! -d public/data ]; }; then rm -f public/data; fi; \
    mkdir -p public/data; \
    cp -a src/content/assets/data/. public/data/

# Build the application
RUN npm run build

# Generate the PDF (light theme, full wait)
RUN npm run export:pdf -- --theme=light --wait=full

# Use an official Nginx runtime as the base image for serving the application
FROM nginx:alpine

# Copy the built application from the build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy a custom Nginx configuration file
COPY nginx.conf /etc/nginx/nginx.conf

# Create necessary directories and set permissions
RUN mkdir -p /var/cache/nginx /var/run /var/log/nginx && \
    chmod -R 777 /var/cache/nginx /var/run /var/log/nginx /etc/nginx/nginx.conf

# Switch to non-root user
USER nginx

# Expose port 8080
EXPOSE 8080

# Command to run the application
CMD ["nginx", "-g", "daemon off;"]
