# Use an official Node runtime as the base image for building the application
FROM node:20 AS build

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json
COPY app/package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY app/ .

# Build the application
RUN npm run build

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
