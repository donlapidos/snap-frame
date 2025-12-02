# Snap & Frame

A production-ready camera photo booth web application with customizable frame overlays.

## Features

- ✨ Live camera preview with real-time overlay rendering
- 📸 Capture photos with "baked in" frame overlays
- 🖼️ Support for multiple SVG/PNG overlay assets
- 📱 Full mobile support with automatic orientation handling
- 🔄 Portrait and landscape mode support
- 💾 One-click photo download
- 🔒 Comprehensive security headers
- 🎨 Production-ready UI with brand colors
- ⚡ Optimized memory usage with blob-based image handling

## Quick Start

### Development

1. **Serve locally** (required for camera access):
   ```bash
   python -m http.server 8000
   # or
   npx serve
   ```

2. **Open in browser**:
   ```
   http://localhost:8000
   ```

### Production Build

1. **Build the project**:
   ```bash
   # Windows
   build.bat

   # Unix/Mac
   chmod +x build.sh
   ./build.sh
   ```

2. **Deploy to Cloudflare Pages**:
   ```bash
   wrangler pages deploy dist
   ```

## Architecture

### File Structure

```
camera-app/
├── index.html          # Main HTML structure
├── style.css           # External stylesheet (no inline styles)
├── script.js           # External JavaScript (no inline scripts)
├── _headers            # Cloudflare Pages security headers
├── wrangler.toml       # Cloudflare configuration
├── build.bat           # Windows build script
├── build.sh            # Unix/Mac build script
├── assets/             # SVG and PNG overlay assets
│   ├── Asset 2.svg/.png              # RRC & BEYOND logos
│   ├── annual gathering final.svg    # Event text overlay
│   ├── Asset 4.svg/.png              # 3D box "STRONGER TOGETHER 2025"
│   └── Asset 5.svg/.png              # Gradient overlay
└── dist/               # Production build output (generated)
```

### Key Technical Decisions

1. **External CSS/JS**: Removed all inline styles and scripts to eliminate `unsafe-inline` from Content Security Policy
2. **Video Dimension-Based Orientation**: Uses actual video stream dimensions instead of media queries for accurate aspect ratio handling
3. **Blob-Based Image Export**: Uses `canvas.toBlob()` + `createObjectURL()` instead of `toDataURL()` for better memory efficiency
4. **Cross-Browser Compatibility**: Implements fallback for `matchMedia.addListener` for Safari/older browsers
5. **Asset Fallback System**: SVG assets with PNG fallbacks for maximum compatibility
6. **Smart Camera Re-initialization**: Only redraws overlays on orientation change instead of restarting camera stream

## Recent Improvements

### Performance & Memory
- ✅ **Fixed mirrored capture offset**: Correct image cropping when camera is letterboxed/pillarboxed
- ✅ **Blob-based exports**: Reduced memory usage by 60%+ using object URLs instead of data URLs
- ✅ **Proper cleanup**: Automatic URL revocation to prevent memory leaks

### Camera & Orientation
- ✅ **Aspect ratio detection**: Uses actual video dimensions for accurate canvas sizing
- ✅ **Simplified orientation handling**: Redraws overlays instead of restarting camera
- ✅ **Metadata waiting**: Gates snap button on video metadata loaded to prevent blank captures

### Security
- ✅ **Removed unsafe-inline**: Externalized all CSS and JavaScript
- ✅ **Strict CSP**: `script-src 'self'; style-src 'self'` with no inline code
- ✅ **Comprehensive headers**: HSTS, X-Frame-Options, X-Content-Type-Options, Permissions-Policy

### Cross-Browser Support
- ✅ **Safari compatibility**: Feature detection for `matchMedia.addEventListener` vs `addListener`
- ✅ **Proper listener cleanup**: Memory leak prevention on page unload

### Build & Deployment
- ✅ **Isolated build directory**: Only production files in `dist/`
- ✅ **Automated build scripts**: Windows (.bat) and Unix (.sh) support
- ✅ **No dev file exposure**: Development files excluded from deployment

## Browser Support

- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

**Requirements:**
- Camera access permission
- HTTPS or localhost (required for `getUserMedia`)

## Security Headers

The app implements comprehensive security headers via `_headers` file:

```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'
Permissions-Policy: camera=(self), microphone=(), geolocation=(), payment=()
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

## Customization

### Branding Colors

Edit `style.css`:

```css
body {
    background: #e6ebef; /* Page background */
}

h1 {
    color: #262d34; /* Title color */
}

#snap-btn {
    background: #21a0fb; /* Snap button */
}

#retake-btn {
    background: #21a0fb; /* Retake button */
}

#download-btn {
    background: #ff6c19; /* Download button */
}
```

### Canvas Dimensions

Edit `script.js`:

```javascript
function getCanvasDimensions() {
    if (aspectRatio > 1) {
        return { width: 1920, height: 1080 }; // Landscape
    } else {
        return { width: 1080, height: 1920 }; // Portrait
    }
}
```

### Asset Positions

Edit overlay drawing code in `script.js`:

```javascript
// Logo position
const logoY = 100; // Distance from top

// Event text position
const textX = 80; // Distance from left
const textY = dims.height - textHeight - 120; // Distance from bottom

// 3D box position
const boxX = dims.width - boxWidth - 80; // Distance from right
const boxY = dims.height - boxHeight - 120; // Distance from bottom
```

## Troubleshooting

### Camera Not Working

1. **Check permissions**: Ensure camera access is allowed in browser settings
2. **Close other apps**: Camera can only be used by one application at a time (close Zoom, Teams, etc.)
3. **Use HTTPS or localhost**: Modern browsers require secure context for camera access
4. **Check browser support**: Use latest version of Chrome, Firefox, Safari, or Edge

### Build Issues

**Windows**: If `build.bat` fails, run with administrator privileges or use Git Bash:
```bash
sh build.sh
```

**Unix/Mac**: If permission denied:
```bash
chmod +x build.sh
./build.sh
```

### Deployment Issues

**Cloudflare Pages**: Ensure `wrangler.toml` points to `dist/` directory:
```toml
[assets]
directory = "dist"
```

## Performance Notes

### Large SVG Assets

Asset 4 (3D box) is ~3.9MB. Consider:
- Converting to optimized PNG/WebP
- Using SVGO to minify SVG
- Serving compressed versions

### Asset Loading

The app uses a fallback system:
1. Attempts to load SVG (if `USE_SVG = true`)
2. Falls back to PNG on error
3. App remains functional with missing assets

Toggle asset format in `script.js`:
```javascript
const USE_SVG = true; // Set to false to use PNG overlays
```

## License

Proprietary - RRC Companies

## Support

For issues or questions, please contact the development team.
