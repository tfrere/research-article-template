#!/bin/bash

echo "🚀 Starting full typography pipeline for 300 fonts..."

# Step 1: Download fonts (already running)
echo "Step 1: Downloading fonts... (in progress)"

# Wait for step 1 to complete, then run remaining steps
echo "Step 2: Generating SVGs..."
node 2-generate-svgs.mjs

if [ $? -eq 0 ]; then
    echo "✅ Step 2 completed successfully"

    echo "Step 3: Converting to PNGs..."
    node 3-generate-pngs.mjs

    if [ $? -eq 0 ]; then
        echo "✅ Step 3 completed successfully"

        echo "Step 4: Generating UMAP analysis..."
        poetry run python 4-generate-umap.py

        if [ $? -eq 0 ]; then
            echo "✅ Step 4 completed successfully"

            echo "Step 5: Generating sprite..."
            node 5-generate-sprite.mjs

            if [ $? -eq 0 ]; then
                echo "✅ Step 5 completed successfully"
                echo "🎉 Full pipeline completed with 300 fonts!"

                # Display final stats
                echo "📊 Final results:"
                echo "📁 Fonts: $(ls generated/fonts/ | wc -l) TTF files"
                echo "🎨 SVGs: $(ls generated/svgs/ | wc -l) SVG files"
                echo "🖼️  PNGs: $(ls generated/pngs/ | wc -l) PNG files"
                echo "📄 Data files:"
                ls -la generated/data/
            else
                echo "❌ Step 5 failed"
                exit 1
            fi
        else
            echo "❌ Step 4 failed"
            exit 1
        fi
    else
        echo "❌ Step 3 failed"
        exit 1
    fi
else
    echo "❌ Step 2 failed"
    exit 1
fi