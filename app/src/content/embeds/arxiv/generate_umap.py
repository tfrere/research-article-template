#!/usr/bin/env python3
"""
UMAP Generator for arXiv papers
Creates 2D and 3D projections with density-weighted centroids
"""

import json
import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.decomposition import TruncatedSVD
import umap
import os
import shutil
from datetime import datetime
from collections import Counter

def load_papers(filename="arxiv_monthly_papers.json"):
    """Load papers from JSON file"""
    if not os.path.exists(filename):
        print(f"❌ File {filename} not found!")
        print("💡 Run fetch_arxiv_api.py first")
        return None
    
    with open(filename, 'r', encoding='utf-8') as f:
        papers = json.load(f)
    
    print(f"📚 {len(papers)} papers loaded from {filename}")
    return papers

def preprocess_papers(papers, sample_rate=5):
    """Preprocess papers and sample if necessary"""
    print(f"🔄 Preprocessing papers...")
    
    # Filter papers with missing data
    valid_papers = []
    for paper in papers:
        if (paper.get('title') and 
            paper.get('summary') and 
            paper.get('primary_category')):
            valid_papers.append(paper)
    
    print(f"✅ {len(valid_papers)} valid papers after filtering")
    
    # Sampling for performance (1 out of N)
    if sample_rate > 1:
        sampled_papers = valid_papers[::sample_rate]
        print(f"📊 Sampling 1/{sample_rate}: {len(sampled_papers)} papers retained")
        return sampled_papers
    
    return valid_papers

def create_embeddings(papers, max_features=5000, n_components=50):
    """Create TF-IDF + SVD embeddings of papers"""
    print(f"🔢 Creating embeddings (max_features={max_features}, n_components={n_components})")
    
    # Combine title and summary
    texts = []
    for paper in papers:
        title = paper.get('title', '').strip()
        summary = paper.get('summary', '').strip()
        combined = f"{title} {summary}"
        texts.append(combined)
    
    # TF-IDF
    print("  📝 TF-IDF vectorization...")
    tfidf = TfidfVectorizer(
        max_features=max_features,
        stop_words='english',
        ngram_range=(1, 2),
        min_df=2,
        max_df=0.95
    )
    
    tfidf_matrix = tfidf.fit_transform(texts)
    print(f"  ✅ TF-IDF: {tfidf_matrix.shape}")
    
    # Dimensionality reduction with SVD
    print(f"  🔄 SVD reduction to {n_components} dimensions...")
    svd = TruncatedSVD(n_components=n_components, random_state=42)
    embeddings = svd.fit_transform(tfidf_matrix)
    
    print(f"  ✅ Final embeddings: {embeddings.shape}")
    print(f"  📊 Explained variance: {svd.explained_variance_ratio_.sum():.3f}")
    
    return embeddings

def map_to_families(papers):
    """Map categories to 9 main scientific families"""
    
    # Mapping to 9 scientific families
    domain_to_family = {
        'cs': 'Computer Science',
        'math': 'Mathematics', 
        'physics': 'Physics',
        'stat': 'Statistics',
        'q-bio': 'Biology',
        'eess': 'Engineering',
        'astro-ph': 'Astrophysics',
        'cond-mat': 'Condensed Matter',
        'nucl': 'Nuclear Physics'
    }
    
    families = []
    for paper in papers:
        primary_cat = paper.get('primary_category', '')
        if primary_cat:
            domain = primary_cat.split('.')[0]
            family = domain_to_family.get(domain, 'Other')
        else:
            family = 'Other'
        families.append(family)
    
    family_counts = Counter(families)
    print(f"📊 Distribution by family:")
    for family, count in family_counts.most_common():
        print(f"   {family}: {count} papers")
    
    return families

def generate_umap_projection(embeddings, families, n_neighbors=50, min_dist=0.1, spread=0.5, n_components=2):
    """Generate UMAP projection"""
    print(f"🎯 UMAP projection (n_neighbors={n_neighbors}, min_dist={min_dist}, spread={spread}, n_components={n_components})")
    
    # Configuration UMAP
    reducer = umap.UMAP(
        n_neighbors=n_neighbors,
        min_dist=min_dist, 
        spread=spread,
        n_components=n_components,
        random_state=42,
        metric='cosine'
    )
    
    # Projection
    projection = reducer.fit_transform(embeddings)
    print(f"✅ Projection UMAP: {projection.shape}")
    
    return projection

def calculate_density_weighted_centroids(projection, families, families_list):
    """Calculate density-weighted centroids"""
    print("🎯 Calculating density-weighted centroids...")
    
    centroids = {}
    
    for family in families_list:
        # Points of this family
        family_mask = np.array(families) == family
        family_points = projection[family_mask]
        
        if len(family_points) < 30:  # Filter families too small
            continue
            
        if projection.shape[1] == 2:  # 2D
            # Calculate 2D density
            densities = []
            for point in family_points:
                distances = np.linalg.norm(family_points - point, axis=1)
                density = np.sum(distances < np.percentile(distances, 20))  # Local density
                densities.append(density)

            densities = np.array(densities)
            weights = densities / densities.sum()

            # Weighted centroid
            centroid_x = np.sum(family_points[:, 0] * weights)
            centroid_y = np.sum(family_points[:, 1] * weights)
            
            centroids[family] = {
                'x': float(centroid_x),
                'y': float(centroid_y),
                'count': len(family_points)
            }
            
        else:  # 3D
            # Calculate 3D density
            densities = []
            for point in family_points:
                distances = np.linalg.norm(family_points - point, axis=1)
                density = np.sum(distances < np.percentile(distances, 20))
                densities.append(density)

            densities = np.array(densities)
            weights = densities / densities.sum()

            # Weighted centroid
            centroid_x = np.sum(family_points[:, 0] * weights)
            centroid_y = np.sum(family_points[:, 1] * weights) 
            centroid_z = np.sum(family_points[:, 2] * weights)
            
            centroids[family] = {
                'x': float(centroid_x),
                'y': float(centroid_y), 
                'z': float(centroid_z),
                'count': len(family_points)
            }
    
    print(f"✅ {len(centroids)} centroids calculated")
    return centroids

def save_visualization_data(papers, projection, families, centroids, output_prefix):
    """Save visualization data"""
    
    # Prepare data
    viz_data = []
    for i, paper in enumerate(papers):
        if projection.shape[1] == 2:  # 2D
            point = {
                'id': paper.get('id', f'paper_{i}'),
                'title': paper.get('title', ''),
                'summary': paper.get('summary', '')[:200] + '...',
                'authors': ', '.join(paper.get('authors', [])[:3]),  # Max 3 authors
                'category': paper.get('primary_category', ''),
                'family': families[i],
                'x': float(projection[i, 0]),
                'y': float(projection[i, 1])
            }
        else:  # 3D
            point = {
                'id': paper.get('id', f'paper_{i}'),
                'title': paper.get('title', ''),
                'summary': paper.get('summary', '')[:200] + '...',
                'authors': ', '.join(paper.get('authors', [])[:3]),
                'category': paper.get('primary_category', ''),
                'family': families[i],
                'x': float(projection[i, 0]),
                'y': float(projection[i, 1]),
                'z': float(projection[i, 2])
            }
        viz_data.append(point)
    
    # Add centroids
    viz_data_with_centroids = {
        'points': viz_data,
        'centroids': centroids,
        'metadata': {
            'total_papers': len(papers),
            'dimensions': projection.shape[1],
            'families': list(set(families)),
            'generated': datetime.now().isoformat()
        }
    }
    
    # Save
    output_file = f"{output_prefix}.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(viz_data_with_centroids, f, indent=2, ensure_ascii=False)
    
    size_mb = os.path.getsize(output_file) / 1024 / 1024
    print(f"💾 Data saved: {output_file} ({size_mb:.1f} MB)")
    
    return output_file

def main():
    """Main UMAP generation pipeline"""
    print("🚀 ArXiv UMAP Generator")
    print("=" * 40)
    
    # 1. Data loading
    papers = load_papers()
    if not papers:
        return
    
    # 2. Preprocessing
    papers = preprocess_papers(papers, sample_rate=5)  # 1 point out of 5
    
    # 3. Mapping to families
    families = map_to_families(papers)
    families_list = list(set(families))
    
    # 4. Embedding creation
    embeddings = create_embeddings(papers, max_features=3000, n_components=50)
    
    # 5. UMAP projection generation
    
    # UMAP 2D
    print("\n🎯 Generating 2D UMAP...")
    projection_2d = generate_umap_projection(
        embeddings, families,
        n_neighbors=50, min_dist=0.8, spread=1.0, n_components=2
    )
    
    centroids_2d = calculate_density_weighted_centroids(projection_2d, families, families_list)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_2d = save_visualization_data(
        papers, projection_2d, families, centroids_2d,
        f"arxiv_umap_viz_2d_{timestamp}"
    )
    
    # UMAP 3D
    print("\n🎯 Generating 3D UMAP...")
    projection_3d = generate_umap_projection(
        embeddings, families,
        n_neighbors=50, min_dist=0.8, spread=1.0, n_components=3
    )
    
    centroids_3d = calculate_density_weighted_centroids(projection_3d, families, families_list)
    
    output_3d = save_visualization_data(
        papers, projection_3d, families, centroids_3d,
        f"arxiv_umap_viz_3d_{timestamp}"
    )
    
    # Automatic copy to content/assets/data
    import shutil
    source_file = output_2d  # Use 2D by default
    target_dir = "../../assets/data"
    target_file = os.path.join(target_dir, "data.json")
    
    try:
        # Create directory if necessary
        os.makedirs(target_dir, exist_ok=True)
        shutil.copy2(source_file, target_file)
        print(f"\n✅ AUTOMATIC COPY SUCCESSFUL!")
        print(f"📁 {source_file} → {target_file}")
    except Exception as e:
        print(f"\n⚠️  Automatic copy failed: {e}")
    
    print(f"\n🎉 Generation completed!")
    print(f"📁 Files created:")
    for f in [output_2d, output_3d]:
        if os.path.exists(f):
            size = os.path.getsize(f) / 1024 / 1024
            print(f"   - {f} ({size:.1f} MB)")

if __name__ == "__main__":
    main()
