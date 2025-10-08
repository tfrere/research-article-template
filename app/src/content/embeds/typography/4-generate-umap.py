#!/usr/bin/env python3
"""
UMAP generator for typography fonts
Based on pixel matrices from generated PNGs
"""

import umap
import numpy as np
import pandas as pd
import json
import os
import glob
from PIL import Image
from sklearn.preprocessing import StandardScaler
from datetime import datetime

# Configuration
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
GENERATED_DIR = os.path.join(SCRIPT_DIR, "generated")
PNGS_DIR = os.path.join(GENERATED_DIR, "pngs")
DATA_DIR = os.path.join(GENERATED_DIR, "data")
OUTPUT_FILENAME = "typography_data.json"
FULL_OUTPUT_PATH = os.path.join(DATA_DIR, OUTPUT_FILENAME)

# UMAP parameters
UMAP_PARAMS = {
    'n_neighbors': 15,
    'min_dist': 1.0,
    'n_components': 2,
    'metric': 'euclidean',
    'random_state': 42
}

def load_png_as_matrix(png_path):
    """
    Loads a PNG and converts it to a normalized pixel matrix

    Returns:
        numpy.array: 1D vector of 1600 dimensions (40x40 flattened)
    """
    try:
        # Load image in grayscale
        img = Image.open(png_path).convert('L')

        # Check dimensions
        if img.size != (40, 40):
            print(f"⚠️  Unexpected size for {png_path}: {img.size}")
            img = img.resize((40, 40))

        # Convert to numpy array and normalize (0-255 → 0-1)
        pixel_matrix = np.array(img, dtype=np.float32) / 255.0

        # Flatten to 1D vector
        pixel_vector = pixel_matrix.flatten()

        return pixel_vector

    except Exception as e:
        print(f"❌ Error loading {png_path}: {e}")
        return None

def extract_font_info_from_filename(filename):
    """
    Extracts font information from filename

    Args:
        filename: filename (e.g., "roboto_a.png")

    Returns:
        dict: font information
    """
    # Remove extension and "_a" suffix
    font_id = filename.replace('.png', '').replace('_a', '')
    font_name = font_id.replace('_', ' ').title()

    # Simple classification based on names
    category = "sans-serif"  # default

    # Classification rules based on names
    serif_keywords = ['times', 'garamond', 'georgia', 'serif', 'baskerville',
                     'caslon', 'merriweather', 'playfair', 'lora', 'crimson',
                     'spectral', 'alegreya', 'cardo', 'vollkorn', 'gentium',
                     'eb garamond', 'cormorant', 'libre baskerville']

    script_keywords = ['script', 'cursive', 'brush', 'hand', 'dancing',
                      'pacifico', 'satisfy', 'allura', 'tangerine', 'caveat',
                      'sacramento', 'kaushan', 'alex brush', 'marck script']

    mono_keywords = ['mono', 'code', 'courier', 'consola', 'inconsolata',
                    'fira code', 'source code', 'jetbrains', 'roboto mono',
                    'space mono', 'ubuntu mono', 'pt mono']

    display_keywords = ['display', 'black', 'ultra', 'bebas', 'anton', 'oswald',
                       'staatliches', 'bangers', 'fredoka', 'righteous',
                       'russo one', 'alfa slab']

    font_lower = font_name.lower()

    if any(keyword in font_lower for keyword in serif_keywords):
        category = "serif"
    elif any(keyword in font_lower for keyword in script_keywords):
        category = "handwriting"
    elif any(keyword in font_lower for keyword in mono_keywords):
        category = "monospace"
    elif any(keyword in font_lower for keyword in display_keywords):
        category = "display"

    # Générer l'URL Google Fonts (utiliser le nom avec majuscules)
    google_fonts_url = f"https://fonts.google.com/specimen/{font_name.replace(' ', '+')}"

    return {
        "name": font_name,
        "id": font_id,
        "family": category,
        "google_fonts_url": google_fonts_url
    }

def load_all_font_data():
    """
    Loads all font data from PNGs

    Returns:
        tuple: (font_data_list, pixel_matrices)
    """
    print("🔄 Loading font data from PNGs...")

    # Create data folder if necessary
    os.makedirs(DATA_DIR, exist_ok=True)

    # Find all PNG files
    png_pattern = os.path.join(PNGS_DIR, "*_a.png")
    png_files = glob.glob(png_pattern)

    if not png_files:
        raise FileNotFoundError(f"No PNG files found in {PNGS_DIR}")

    print(f"📁 Found {len(png_files)} PNG files")

    font_data_list = []
    pixel_matrices = []

    for i, png_path in enumerate(png_files):
        filename = os.path.basename(png_path)

        # Extract font info
        font_info = extract_font_info_from_filename(filename)

        # Load pixel matrix
        pixel_matrix = load_png_as_matrix(png_path)

        if pixel_matrix is not None:
            font_data_list.append(font_info)
            pixel_matrices.append(pixel_matrix)

            if (i + 1) % 50 == 0:
                print(f"⚡ Processed {i + 1}/{len(png_files)} fonts...")

    print(f"✅ Loaded {len(font_data_list)} fonts successfully")

    # Convert to numpy array
    pixel_matrices = np.array(pixel_matrices)
    print(f"📊 Final matrix: {pixel_matrices.shape} ({pixel_matrices.shape[0]} fonts × {pixel_matrices.shape[1]} pixels)")

    return font_data_list, pixel_matrices

def generate_umap_embedding(pixel_matrices):
    """
    Generates UMAP embeddings from pixel matrices

    Args:
        pixel_matrices: numpy array (n_fonts, 1600)

    Returns:
        numpy.array: 2D UMAP coordinates
    """
    print("🔄 Generating UMAP embeddings...")

    # Normalize data (important for UMAP)
    print("📊 Normalizing data...")
    scaler = StandardScaler()
    normalized_data = scaler.fit_transform(pixel_matrices)

    # Apply UMAP
    print(f"🗺️  Applying UMAP with parameters: {UMAP_PARAMS}")
    reducer = umap.UMAP(**UMAP_PARAMS)
    embedding = reducer.fit_transform(normalized_data)

    print(f"✅ UMAP completed - Embedding shape: {embedding.shape}")
    print(f"📊 X range: [{embedding[:, 0].min():.2f}, {embedding[:, 0].max():.2f}]")
    print(f"📊 Y range: [{embedding[:, 1].min():.2f}, {embedding[:, 1].max():.2f}]")

    return embedding

def save_typography_data(font_data_list, embedding):
    """
    Saves final data in JSON format
    """
    print("💾 Saving data...")

    # Combine font data and UMAP coordinates
    final_data = []
    for i, font_info in enumerate(font_data_list):
        font_data = {
            **font_info,
            "x": float(embedding[i, 0]),
            "y": float(embedding[i, 1])
        }
        final_data.append(font_data)

    # Metadata
    metadata = {
        "generated_at": datetime.now().isoformat(),
        "method": "umap_from_png_pixels",
        "total_fonts": len(final_data),
        "umap_params": UMAP_PARAMS,
        "data_source": "PNG pixel matrices (40x40)"
    }

    # Final structure
    output_data = {
        "metadata": metadata,
        "fonts": final_data
    }

    # Save
    with open(FULL_OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)

    print(f"✅ Data saved to {FULL_OUTPUT_PATH}")

    # Statistics by category
    categories = {}
    for font in final_data:
        cat = font['family']
        categories[cat] = categories.get(cat, 0) + 1

    print("\n📊 Distribution by category:")
    for cat, count in sorted(categories.items()):
        print(f"  {cat}: {count} fonts")

def main():
    """Main function"""
    print("🎨 UMAP generation for typography from pixel matrices\n")

    try:
        # 1. Load font data
        font_data_list, pixel_matrices = load_all_font_data()

        # 2. Generate UMAP embeddings
        embedding = generate_umap_embedding(pixel_matrices)

        # 3. Save results
        save_typography_data(font_data_list, embedding)

        print("\n🎉 UMAP generation completed successfully!")

    except Exception as e:
        print(f"💥 Fatal error: {e}")
        raise

if __name__ == "__main__":
    main()