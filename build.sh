#!/bin/bash
# Build script for Unix/Mac - Copies production files to dist/

echo "Building Snap & Frame..."

# Create dist directory if it doesn't exist
mkdir -p dist/assets

# Copy production files
echo "Copying files..."
cp index.html dist/
cp style.css dist/
cp script.js dist/
cp _headers dist/

# Copy assets
cp assets/*.svg dist/assets/ 2>/dev/null || true
cp assets/*.png dist/assets/ 2>/dev/null || true

echo "Build complete! Files are in the dist/ directory."
echo ""
echo "To deploy: wrangler pages deploy dist"
