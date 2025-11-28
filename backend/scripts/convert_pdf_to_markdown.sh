#!/bin/bash
# Convert searchqualityevaluatorguidelines.pdf to markdown
# 
# Prerequisites:
# - macOS: brew install poppler
# - Ubuntu: apt-get install poppler-utils
#
# Usage: ./convert_pdf_to_markdown.sh path/to/searchqualityevaluatorguidelines.pdf

if [ -z "$1" ]; then
  echo "Usage: $0 <path-to-pdf>"
  echo "Example: $0 ~/Downloads/searchqualityevaluatorguidelines.pdf"
  exit 1
fi

PDF_PATH="$1"
OUTPUT_DIR="../docs/search-quality-guidelines"
OUTPUT_FILE="$OUTPUT_DIR/searchqualityevaluatorguidelines.md"

if [ ! -f "$PDF_PATH" ]; then
  echo "Error: PDF file not found: $PDF_PATH"
  exit 1
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Convert PDF to text (preserving layout)
echo "Converting PDF to text..."
pdftotext -layout "$PDF_PATH" "$OUTPUT_FILE.tmp"

# Basic markdown formatting
echo "Formatting as markdown..."
# Add markdown header
echo "# Google Search Quality Evaluator Guidelines" > "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "*Converted from PDF on $(date)*" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Convert to markdown (basic - you may want to manually clean this up)
cat "$OUTPUT_FILE.tmp" >> "$OUTPUT_FILE"

# Clean up temp file
rm "$OUTPUT_FILE.tmp"

echo "✅ Converted PDF to: $OUTPUT_FILE"
echo ""
echo "⚠️  Note: You may want to manually edit the markdown to:"
echo "   - Add proper heading structure (# ## ###)"
echo "   - Fix formatting issues"
echo "   - Ensure sections are clearly separated"

