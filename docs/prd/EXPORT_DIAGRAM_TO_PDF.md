# How to Export Campaign Factory Diagram to PDF

Quick reference guide for exporting the mermaid diagram to PDF for sharing.

## Quick Method (Recommended)

### Using Mermaid Live Editor

**Option A: Use the standalone .mmd file (Easiest)**
1. **Open:** `docs/prd/campaign-factory-diagram.mmd`
2. **Copy all contents** (Cmd/Ctrl+A, then Cmd/Ctrl+C)
3. **Go to:** https://mermaid.live
4. **Paste** into the editor (Cmd/Ctrl+V)
5. **Export:**
   - **PNG:** Actions → Download PNG (high quality, good for presentations)
   - **SVG:** Actions → Download SVG (vector, best quality, scalable)
   - **PDF:** Download SVG, then:
     - Upload to https://cloudconvert.com/svg-to-pdf
     - Or open SVG in browser → Print → Save as PDF

**Option B: Use the markdown file**
1. **Open:** `docs/prd/campaign-factory-flow-diagram.md`
2. **Copy the mermaid code block** (lines 67-238, everything between ` ```mermaid` and ` ``` `)
3. **Go to:** https://mermaid.live
4. **Paste** the code into the editor
5. **Export** as above

## Alternative Methods

### Method 2: VS Code Extension

1. Install **"Markdown PDF"** extension (by yzane)
2. Open `campaign-factory-flow-diagram.md`
3. Right-click → **"Markdown PDF: Export (pdf)"**
4. Diagram will be included in the PDF

### Method 3: GitHub + Browser Print

1. Push file to GitHub repository
2. View file on GitHub (diagram renders automatically)
3. Use browser Print (Cmd/Ctrl+P)
4. Select "Save as PDF"
5. Adjust margins/settings as needed

### Method 4: Command Line (mermaid-cli) - Fastest for Developers

```bash
# Install globally
npm install -g @mermaid-js/mermaid-cli

# Export standalone .mmd file to PDF (recommended)
mmdc -i docs/prd/campaign-factory-diagram.mmd \
     -o campaign-factory-diagram.pdf \
     -b transparent \
     -w 2400 \
     -H 1800

# Or export from markdown file
mmdc -i docs/prd/campaign-factory-flow-diagram.md \
     -o campaign-factory-diagram.pdf \
     -b transparent \
     -w 2400 \
     -H 1800
```

### Method 5: VS Code Preview + Screenshot

1. Open file in VS Code
2. Open preview (Cmd+Shift+V)
3. Wait for diagram to render
4. Use screenshot tool or browser DevTools to capture
5. Convert image to PDF if needed

## Tips for Best Quality

- **For presentations:** Use SVG format (scalable, crisp at any size)
- **For documents:** PNG at 2x resolution (2400px width)
- **For printing:** PDF with vector graphics (SVG-based)
- **For sharing:** PDF is usually best (single file, professional)

## File Location

The diagram code is in:
- `docs/prd/campaign-factory-flow-diagram.md` (lines 30-143)
- `docs/prd/campaign-factory-from-intel-prd.md` (section 6.1)

Both contain the same diagram code.

