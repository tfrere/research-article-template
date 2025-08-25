#!/usr/bin/env python3
import markdown
from pathlib import Path
import sys

def convert_md_to_html(filepath):
   input_path = Path(filepath)
   output_path = input_path.with_suffix('.html')
   
   try:
       with open(input_path, 'r', encoding='utf-8') as md_file:
           text = md_file.read()
           html = markdown.markdown(text)
       
       with open(output_path, 'w', encoding='utf-8', errors='xmlcharrefreplace') as html_file:
           html_file.write(html)
           
       print(f"Converted {input_path} -> {output_path}")
           
   except FileNotFoundError:
       print(f"Error: Could not find file {input_path}")
       sys.exit(1)
   except Exception as e:
       print(f"Error converting file: {e}")
       sys.exit(1)

if __name__ == '__main__':
   if len(sys.argv) != 2:
       print("Usage: python convert.py FILEPATH.md")
       sys.exit(1)
       
   convert_md_to_html(sys.argv[1])