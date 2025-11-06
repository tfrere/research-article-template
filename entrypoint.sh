#!/bin/bash
set -e

echo "🚀 Starting Hugging Face Space..."

# Ensure proper permissions for the app directory at runtime
echo "🔧 Setting up permissions..."
chmod -R 755 /app/src/content/assets 2>/dev/null || echo "⚠️  Could not set permissions (non-critical)"

# Check if Notion import is enabled and token is available
if [ "${ENABLE_NOTION_IMPORT:-false}" = "true" ] && [ -n "$NOTION_TOKEN" ] && [ -n "$NOTION_PAGE_ID" ]; then
    echo "🔄 Notion import enabled - fetching content from Notion..."
    echo "   Page ID: $NOTION_PAGE_ID"
    
    cd /app
    
    # Run notion import
    if npm run notion:import 2>&1; then
        echo "✅ Notion import completed successfully!"
        
        # Rebuild the site with new content
        echo "🔨 Rebuilding site with Notion content..."
        npm run build 2>&1
        
        # Generate PDF
        echo "📄 Generating PDF..."
        npm run export:pdf -- --theme=light --wait=full 2>&1 || echo "⚠️  PDF generation failed (non-critical)"
        
        echo "✅ Site rebuilt and ready!"
    else
        echo "⚠️  Notion import failed - using pre-built content from build time"
    fi
else
    if [ "${ENABLE_NOTION_IMPORT:-false}" = "true" ]; then
        echo "⚠️  Notion import enabled but NOTION_TOKEN or NOTION_PAGE_ID not found"
        echo "   NOTION_TOKEN: ${NOTION_TOKEN:+SET}${NOTION_TOKEN:-NOT SET}"
        echo "   NOTION_PAGE_ID: ${NOTION_PAGE_ID:+SET}${NOTION_PAGE_ID:-NOT SET}"
        echo "   → Using pre-built content from build time"
    else
        echo "⏭️  Notion import disabled - using pre-built content from build time"
    fi
fi

# Start nginx
echo "🌐 Starting nginx on port 8080..."
exec nginx -g 'daemon off;'
