# Use an official Node runtime as the base image for building the application
# Build with Playwright (browsers and deps ready)
FROM mcr.microsoft.com/playwright:v1.55.0-jammy AS build

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json
COPY app/package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY app/ .

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
