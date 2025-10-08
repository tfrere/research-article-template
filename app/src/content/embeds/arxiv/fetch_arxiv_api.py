#!/usr/bin/env python3
"""
Script to retrieve papers from the arXiv API
Optimized for natural representation of scientific domains
"""

import requests
import xml.etree.ElementTree as ET
import json
import time
import os
from urllib.parse import quote
from datetime import datetime, timedelta
from collections import Counter
import random

class ArxivFetcher:
    def __init__(self):
        self.base_url = "http://export.arxiv.org/api/query"
        self.delay = 3  # Delay between requests (respecting API limits)
        
    def fetch_by_category(self, categories, max_per_category=500, total_max=15000):
        """Retrieve papers by category with global limit"""
        print(f"🔍 Retrieval by category (max {max_per_category} per cat, {total_max} total)")
        
        all_papers = []
        
        for i, category in enumerate(categories):
            if len(all_papers) >= total_max:
                break
                
            print(f"  [{i+1}/{len(categories)}] {category}...")
            
            # Dynamic calculation of number to retrieve
            remaining = total_max - len(all_papers)
            fetch_count = min(max_per_category, remaining)
            
            papers = self._fetch_category(category, fetch_count)
            all_papers.extend(papers)
            
            print(f"    ✅ {len(papers)} papers retrieved (total: {len(all_papers)})")
            
            # Delay between categories
            if i < len(categories) - 1:
                time.sleep(self.delay)
        
        return all_papers[:total_max]
    
    def fetch_recent_papers(self, days_back=30, max_results=15000):
        """Retrieve recent papers from the last days"""
        print(f"📅 Retrieving papers from the last {days_back} days")
        
        # End date: today
        end_date = datetime.now()
        # Start date: X days ago
        start_date = end_date - timedelta(days=days_back)
        
        # Format arXiv: YYYYMMDDHHMM
        date_query = f"submittedDate:[{start_date.strftime('%Y%m%d%H%M')} TO {end_date.strftime('%Y%m%d%H%M')}]"
        
        return self._fetch_with_query(date_query, max_results)
    
    def _fetch_category(self, category, max_results):
        """Retrieve papers from a specific category"""
        query = f"cat:{category}"
        return self._fetch_with_query(query, max_results)
    
    def _fetch_with_query(self, query, max_results):
        """Generic method to retrieve with a query"""
        papers = []
        start = 0
        batch_size = min(1000, max_results)  # arXiv limits to 1000 per request
        
        while len(papers) < max_results:
            remaining = max_results - len(papers)
            current_batch = min(batch_size, remaining)
            
            params = {
                'search_query': query,
                'start': start,
                'max_results': current_batch,
                'sortBy': 'submittedDate',
                'sortOrder': 'descending'
            }
            
            try:
                response = requests.get(self.base_url, params=params, timeout=30)
                response.raise_for_status()
                
                batch_papers = self._parse_response(response.text)
                if not batch_papers:
                    print(f"    ⚠️  No results for start={start}")
                    break
                
                papers.extend(batch_papers)
                start += len(batch_papers)
                
                print(f"    📄 Batch {len(batch_papers)} papers (total: {len(papers)})")
                
                # Delay between requests
                time.sleep(self.delay)
                
            except Exception as e:
                print(f"    ❌ Error: {e}")
                break
        
        return papers[:max_results]
    
    def _parse_response(self, xml_content):
        """Parse arXiv XML response"""
        papers = []
        
        try:
            root = ET.fromstring(xml_content)
            
            # arXiv Namespace
            ns = {'atom': 'http://www.w3.org/2005/Atom',
                  'arxiv': 'http://arxiv.org/schemas/atom'}
            
            entries = root.findall('atom:entry', ns)
            
            for entry in entries:
                try:
                    # ID arXiv
                    arxiv_id = entry.find('atom:id', ns).text.split('/')[-1]
                    
                    # Titre
                    title = entry.find('atom:title', ns).text.strip()
                    title = ' '.join(title.split())  # Clean spaces
                    
                    # Résumé
                    summary = entry.find('atom:summary', ns).text.strip()
                    summary = ' '.join(summary.split())[:500]  # Limit size
                    
                    # Auteurs
                    authors = []
                    for author in entry.findall('atom:author', ns):
                        name = author.find('atom:name', ns)
                        if name is not None:
                            authors.append(name.text.strip())
                    
                    # Catégories
                    categories = []
                    primary_category = None
                    
                    for category in entry.findall('atom:category', ns):
                        term = category.get('term')
                        if term:
                            categories.append(term)
                    
                    # Primary category
                    primary_cat = entry.find('arxiv:primary_category', ns)
                    if primary_cat is not None:
                        primary_category = primary_cat.get('term')
                    elif categories:
                        primary_category = categories[0]
                    
                    # Publication date
                    published = entry.find('atom:published', ns)
                    published_date = published.text if published is not None else None
                    
                    paper = {
                        'id': arxiv_id,
                        'title': title,
                        'summary': summary,
                        'authors': authors,
                        'categories': categories,
                        'primary_category': primary_category,
                        'published': published_date
                    }
                    
                    papers.append(paper)
                    
                except Exception as e:
                    print(f"    ⚠️  Error parsing entry: {e}")
                    continue
            
        except ET.ParseError as e:
            print(f"❌ XML parsing error: {e}")
        
        return papers

def save_papers(papers, filename):
    """Save papers to JSON"""
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(papers, f, indent=2, ensure_ascii=False)
    
    size_mb = os.path.getsize(filename) / 1024 / 1024
    print(f"💾 Saved: {filename} ({len(papers)} papers, {size_mb:.1f} MB)")

def main():
    """Main arXiv data retrieval"""
    print("🚀 ArXiv Data Fetcher - Version Optimisée")
    print("=" * 50)
    
    fetcher = ArxivFetcher()
    
    # Simple approach: 1 month of recent data
    print("\n📅 SIMPLE APPROACH: 1 month of recent data")
    print("🎯 Objective: retrieve everything available from the last month")
    print("⚡ Without representativeness constraint - just natural data")
    
    # Try with different periods to find data
    monthly_papers = None
    for days in [30, 60, 90, 120]:  # 1, 2, 3, 4 months
        print(f"\n🔍 Attempt: {days} days...")
        monthly_papers = fetcher.fetch_recent_papers(days_back=days, max_results=15000)
        if monthly_papers and len(monthly_papers) > 1000:
            print(f"✅ {len(monthly_papers)} papers found over {days} days")
            break
        elif monthly_papers:
            print(f"⚠️  Only {len(monthly_papers)} papers over {days} days")
        else:
            print(f"❌ No papers found over {days} days")
    
    if not monthly_papers:
        print("\n🔄 Fallback: retrieval by popular categories")
        # If no recent data, just take popular categories
        popular_categories = [
            'cs.LG', 'cs.AI', 'cs.CV', 'cs.CL', 'cs.CR', 'cs.RO', 'cs.HC',
            'physics.comp-ph', 'physics.data-an', 'physics.optics',
            'math.ST', 'math.NA', 'math.OC', 'math.PR',
            'stat.ML', 'stat.ME', 'stat.AP',
            'eess.AS', 'eess.IV', 'eess.SP',
            'q-bio.QM', 'q-bio.BM', 'astro-ph.CO'
        ]
        
        monthly_papers = fetcher.fetch_by_category(
            categories=popular_categories,
            max_per_category=500,
            total_max=15000
        )
    
    if monthly_papers:
        save_papers(monthly_papers, "arxiv_monthly_papers.json")
        
        # Statistiques finales
        from collections import Counter
        
        # Check paper structure
        sample_keys = list(monthly_papers[0].keys()) if monthly_papers else []
        category_key = 'primary_category' if 'primary_category' in sample_keys else 'categories'
        
        domains = []
        for paper in monthly_papers:
            if category_key in paper:
                cat = paper[category_key]
                if isinstance(cat, list) and cat:
                    domains.append(cat[0].split('.')[0])
                elif isinstance(cat, str):
                    domains.append(cat.split('.')[0])
        
        domain_counts = Counter(domains)
        
        print(f"\n📊 Natural distribution ({len(monthly_papers)} papers):")
        for domain, count in domain_counts.most_common():
            percentage = count / len(monthly_papers) * 100
            print(f"   {domain}: {count} papers ({percentage:.1f}%)")
    else:
        print("❌ Complete retrieval failure")
    
    print("\n🎉 Retrieval completed!")
    print("📁 Files created:")
    for filename in ["arxiv_monthly_papers.json"]:
        if os.path.exists(filename):
            size = os.path.getsize(filename) / 1024 / 1024  # MB
            print(f"   - {filename} ({size:.1f} MB)")

if __name__ == "__main__":
    main()