#!/usr/bin/env python3
"""
HTML to Markdown Converter

This script converts HTML files to Markdown format.
Usage: python html_to_md.py input.html [output.md]
If no output file is specified, it will use the input filename with .md extension.
"""

import sys
import os
import argparse
import html2text
import requests
from urllib.parse import urlparse

def is_url(path):
    """Check if the given path is a URL."""
    parsed = urlparse(path)
    return parsed.scheme != '' and parsed.netloc != ''

def convert_html_to_markdown(html_content, **options):
    """Convert HTML content to Markdown."""
    converter = html2text.HTML2Text()
    
    # Configure converter options
    converter.ignore_links = options.get('ignore_links', False)
    converter.ignore_images = options.get('ignore_images', False)
    converter.ignore_tables = options.get('ignore_tables', False)
    converter.body_width = options.get('body_width', 0)  # 0 means no wrapping
    converter.unicode_snob = options.get('unicode_snob', True)  # Use Unicode instead of ASCII
    converter.wrap_links = options.get('wrap_links', False)
    converter.inline_links = options.get('inline_links', True)
    
    # Convert HTML to Markdown
    return converter.handle(html_content)

def main():
    parser = argparse.ArgumentParser(description='Convert HTML to Markdown')
    parser.add_argument('input', help='Input HTML file or URL')
    parser.add_argument('output', nargs='?', help='Output Markdown file (optional)')
    parser.add_argument('--ignore-links', action='store_true', help='Ignore links in the HTML')
    parser.add_argument('--ignore-images', action='store_true', help='Ignore images in the HTML')
    parser.add_argument('--ignore-tables', action='store_true', help='Ignore tables in the HTML')
    parser.add_argument('--body-width', type=int, default=0, help='Wrap text at this width (0 for no wrapping)')
    parser.add_argument('--unicode', action='store_true', help='Use Unicode characters instead of ASCII approximations')
    parser.add_argument('--wrap-links', action='store_true', help='Wrap links in angle brackets')
    parser.add_argument('--reference-links', action='store_true', help='Use reference style links instead of inline links')
    
    args = parser.parse_args()
    
    # Determine input
    if is_url(args.input):
        try:
            response = requests.get(args.input)
            response.raise_for_status()
            html_content = response.text
        except requests.exceptions.RequestException as e:
            print(f"Error fetching URL: {e}", file=sys.stderr)
            return 1
    else:
        try:
            with open(args.input, 'r', encoding='utf-8') as f:
                html_content = f.read()
        except IOError as e:
            print(f"Error reading file: {e}", file=sys.stderr)
            return 1
    
    # Configure conversion options
    options = {
        'ignore_links': args.ignore_links,
        'ignore_images': args.ignore_images,
        'ignore_tables': args.ignore_tables,
        'body_width': args.body_width,
        'unicode_snob': args.unicode,
        'wrap_links': args.wrap_links,
        'inline_links': not args.reference_links,
    }
    
    # Convert HTML to Markdown
    markdown_content = convert_html_to_markdown(html_content, **options)
    
    # Determine output
    if args.output:
        output_file = args.output
    else:
        if is_url(args.input):
            # Generate a filename from the URL
            url_parts = urlparse(args.input)
            base_name = os.path.basename(url_parts.path) or 'index'
            if not base_name.endswith('.html'):
                base_name += '.html'
            output_file = os.path.splitext(base_name)[0] + '.md'
        else:
            # Generate a filename from the input file
            output_file = os.path.splitext(args.input)[0] + '.md'
    
    # Write output
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(markdown_content)
        print(f"Conversion successful! Output saved to: {output_file}")
    except IOError as e:
        print(f"Error writing file: {e}", file=sys.stderr)
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main())