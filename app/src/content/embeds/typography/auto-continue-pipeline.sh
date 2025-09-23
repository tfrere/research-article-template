#!/bin/bash

# Script to monitor and automatically continue the pipeline

echo "🔍 Pipeline monitoring in progress..."

# Wait for step 1 to complete (check for presence of 300 fonts)
echo "⏳ Waiting for fonts download to complete..."

while true; do
    if [ -d "generated/fonts" ]; then
        font_count=$(ls generated/fonts/*.ttf 2>/dev/null | wc -l)
        echo "📈 Fonts downloaded: $font_count/300"

        if [ "$font_count" -ge 295 ]; then  # We accept 295+ in case some fail
            echo "✅ Download completed! Launching next steps..."
            break
        fi
    else
        echo "📁 generated/fonts directory not yet created..."
    fi

    sleep 5
done

# Step 2: Generate SVGs
echo ""
echo "🎨 Step 2: SVG Generation..."
node 2-generate-svgs.mjs

if [ $? -eq 0 ]; then
    echo "✅ Step 2 completed successfully"
else
    echo "❌ Step 2 Error"
    exit 1
fi

# Step 3: Generate PNGs
echo ""
echo "🖼️  Step 3: Converting to PNGs..."
node 3-generate-pngs.mjs

if [ $? -eq 0 ]; then
    echo "✅ Step 3 completed successfully"
else
    echo "❌ Step 3 Error"
    exit 1
fi

# Step 4: Generate UMAP
echo ""
echo "🗺️  Step 4: UMAP Generation..."
poetry run python 4-generate-umap.py

if [ $? -eq 0 ]; then
    echo "✅ Step 4 completed successfully"
else
    echo "❌ Step 4 Error"
    exit 1
fi

# Step 5: Generate Sprite
echo ""
echo "🎯 Step 5: Sprite Generation..."
node 5-generate-sprite.mjs

if [ $? -eq 0 ]; then
    echo "✅ Step 5 completed successfully"
    echo ""
    echo "🎉 Complete pipeline finished successfully!"

    # Display final statistics
    echo ""
    echo "📊 Final Results:"
    echo "📁 Fonts TTF: $(ls generated/fonts/*.ttf 2>/dev/null | wc -l)"
    echo "🎨 SVGs: $(ls generated/svgs/*.svg 2>/dev/null | wc -l)"
    echo "🖼️  PNGs: $(ls generated/pngs/*.png 2>/dev/null | wc -l)"
    echo "📄 Data files:"
    ls -la generated/data/ 2>/dev/null

    # Check manifest
    if [ -f "generated/data/font_manifest.json" ]; then
        manifest_count=$(jq 'keys | length' generated/data/font_manifest.json 2>/dev/null)
        echo "📝 Fonts in manifest: $manifest_count"
    fi

else
    echo "❌ Step 5 Error"
    exit 1
fi