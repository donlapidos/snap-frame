# Snap & Frame - Product Requirements Document

**Version:** 2.0 (Mobile-First Pivot)
**Last Updated:** 2025-12-04
**Status:** Active Development

---

## Product Overview

**Snap & Frame** is a mobile-first camera photo booth web application designed for event attendees to capture and download photos with branded overlay frames.

### Platform

**Mobile-Only Target:**
- iOS Safari (iPhone, iPad)
- Chrome Mobile (Android phones/tablets)
- Edge Mobile (Android)

**⚠️ Important:** This application is **not** optimized for desktop/laptop browsers. All UX decisions, performance optimizations, and testing should focus exclusively on mobile touchscreen devices.

---

## Core User Flow

**Mobile Touch Interaction:**

1. User **taps** "Allow" when prompted for camera access
2. Preview shows live camera feed with overlay (front-facing camera by default)
3. User **taps** flip button (🔄) to switch between front/back cameras
4. User **taps** large snap button at bottom to capture photo
5. Result screen displays captured image with overlays
6. User **taps** "Download Photo" to save to device
7. User **taps** "Retake Photo" to return to camera view

**Key Interaction Model:** All controls use touch gestures, no mouse/keyboard support required.

---

## Platform Specifications

### Orientation Requirements

- **Primary orientation:** Portrait (9:16 aspect ratio)
- **Secondary orientation:** Landscape (16:9 aspect ratio)
- **Auto-rotation:** Camera stream restarts automatically when device rotates
- **Aspect ratio locking:** Preview wrapper maintains video aspect ratio to prevent distortion

**Technical Implementation:**
- Uses `screen.orientation.angle` (with `window.orientation` fallback)
- Detects rotation: 0° (portrait), 90°/270° (landscape)
- Restarts `getUserMedia` stream on orientation change with correct constraints

### Touch-First UI Controls

**Button Placement:**
- All controls positioned at bottom within thumb reach
- Horizontal layout centered above safe-area-inset-bottom
- 20px gap between controls for easy targeting

**Touch Target Sizes:**
- Flip camera button: 48×48px (minimum touch target)
- Fullscreen button: 48×48px (minimum touch target)
- Snap button: 80×80px (primary action, larger target)
- All buttons: Circular with 50% border-radius for consistent feel

**Safe Area Handling:**
- Controls: `bottom: calc(env(safe-area-inset-bottom) + 20px)`
- Avoids notches, home indicators, and navigation bars
- Title: `top: calc(env(safe-area-inset-top) + 12px)`

### iOS-Specific Considerations

**Fullscreen API:**
- ❌ Not supported on iOS Safari (element fullscreen blocked)
- ✅ Fullscreen button automatically hidden on iOS
- ✅ App relies on immersive full-viewport layout instead

**Viewport Configuration:**
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
```

### Android-Specific Features

**Fullscreen API:**
- ✅ Supported via standard Fullscreen API
- ✅ Fullscreen button visible and functional
- ✅ Auto-hide status bar for immersive kiosk experience

---

## Camera Specifications

### Default Behavior

- **Initial camera:** Front-facing (`facingMode: 'user'`)
- **Camera switching:** Via flip button (🔄)
- **No persistence:** Camera selection resets to front-facing on page reload

### Resolution Constraints

**Fixed Caps for Performance & Battery:**
- Portrait: 1080×1920 (max)
- Landscape: 1920×1080 (max)
- Prevents GPU texture failures on high-res mobile cameras
- Reduces battery drain and mobile data usage

### Camera Flip Flow

**Optimized Switching:**
1. Try `MediaStreamTrack.applyConstraints({ facingMode })` first (instant)
2. Fallback to full `getUserMedia` reinitialization if unsupported
3. Show loading shimmer during hardware delay (intentional feedback)
4. Button disabled during flip to prevent double-taps

**Visual Feedback:**
- Button spins 360° during flip
- Semi-transparent shimmer sweeps across preview
- Button re-enabled when camera ready

### Performance Optimizations

**Battery & Data Conservation:**
- ✅ Camera stream paused when tab hidden (`visibilitychange` event)
- ✅ Stream resumed when tab visible again
- ✅ Overlay assets preloaded once (cached in memory)
- ✅ Blob-based image export (60% less memory than data URLs)

---

## UI Components

### Camera View

**Elements:**
1. **Title:** "Snap & Frame" (top center, absolute positioned)
2. **Preview wrapper:** Full-height container with aspect-ratio lock
3. **Video element:** `object-fit: contain`, mirrored for front camera
4. **Overlay canvas:** Transparent positioned layer for brand assets
5. **Controls wrapper:** Bottom-center horizontal button group
   - Flip camera button (🔄) - left
   - Snap button (primary) - center
   - Fullscreen button (⛶) - right (hidden on iOS)

### Result View

**Elements:**
1. **Title:** "Your Framed Photo"
2. **Preview image:** Captured photo with baked-in overlays
3. **Button group:**
   - "Retake Photo" (blue)
   - "Download Photo" (orange)

### Loading States

**Shimmer Effect:**
- Linear gradient sweep animation (90deg)
- Triggered during camera flip hardware delay
- 1.2s animation duration, infinite loop while loading
- Applied via `.loading` class on preview-wrapper

---

## Non-Goals

### Explicitly Out of Scope

- ❌ Desktop/laptop browser optimization
- ❌ Mouse/keyboard navigation
- ❌ User accounts or login
- ❌ Persistence of any user state (localStorage prohibited)
- ❌ Server-side processing or storage
- ❌ Multi-user session management
- ❌ Photo editing features (crop, filter, adjust)
- ❌ Social media sharing integrations
- ❌ Analytics or tracking

---

## Technical Architecture

### Resolution Approach

**Portrait-First Design:**
- Camera constraints default to portrait orientation
- Uses angle-based detection (0° = portrait, 90°/270° = landscape)
- Stream restart on rotation ensures correct aspect ratio
- No reliance on CSS media queries for camera initialization

### State Management

**Session-Only State:**
- `currentFacingMode`: Tracks active camera (user/environment)
- `lastOrientationAngle`: Detects actual rotation changes
- `stream`: Active MediaStream reference
- `overlayImages`: Cached asset Image objects

**Reset on Reload:**
- All state clears on page refresh
- No localStorage or cookies used
- Browser default camera selection honored

### Asset Management

**Overlay Assets:**
1. Asset 2: RRC & BEYOND logos (top center)
2. Asset 3: Event text "Annual Gathering" (bottom left)
3. Asset 4: 3D box "STRONGER TOGETHER 2025" (bottom right)
4. Asset 5: Semi-transparent gradient overlay (full background)

**Loading Strategy:**
- All assets preloaded during `initCamera()`
- Snap button disabled until assets ready
- SVG primary, PNG fallback
- Missing assets don't block functionality

---

## Testing Requirements

### Device Coverage

**Primary Devices:**
- iPhone 13/14/15 (iOS 16+)
- Samsung Galaxy S22/S23 (Android 13+)
- Google Pixel 7/8 (Android 14+)

**Orientation Testing:**
- Portrait → Landscape rotation
- Landscape → Portrait rotation
- Rapid rotation (180° flip)
- Lock rotation and resize window

**Camera Testing:**
- Front camera default load
- Flip to back camera
- Flip back to front camera
- Flip during active photo capture
- Camera switch with overlays active

**Safe Area Testing:**
- iPhone with notch (top safe area)
- iPhone with home indicator (bottom safe area)
- Android with navigation bar

### Performance Benchmarks

**Metrics:**
- Camera initialization: < 2 seconds
- Camera flip (applyConstraints): < 500ms
- Camera flip (full restart): < 2 seconds
- Photo capture: < 1 second
- Shimmer feedback visible during hardware delay

**Battery Impact:**
- Stream paused when tab hidden
- No unnecessary stream restarts
- Resolution capped to 1080×1920

---

## Deployment Considerations

### QA Focus Areas

1. **Mobile-only testing:** No desktop browser validation needed
2. **Touch interactions:** Verify 48px minimum hit targets
3. **Safe-area compliance:** Test on notched devices
4. **Orientation accuracy:** No swapped/rotated preview
5. **iOS limitations:** Confirm fullscreen button hidden

### Marketing Messaging

**Positioning:**
- "Mobile photo booth experience"
- "Tap to capture memories at your event"
- "Works on your phone—no app download required"

**Avoid:**
- References to "clicking" (desktop term)
- Desktop/laptop screenshots
- Keyboard shortcuts or mouse interactions

### Deployment Checklist

- [ ] Test on physical iOS device (Safari)
- [ ] Test on physical Android device (Chrome)
- [ ] Verify HTTPS for camera access
- [ ] Confirm safe-area padding on notched devices
- [ ] Validate orientation restart behavior
- [ ] Check flip button visibility (hidden if one camera)
- [ ] Verify fullscreen button hidden on iOS
- [ ] Test camera pause on tab switch

---

## Revision History

### Version 2.0 (2025-12-04) - Mobile-First Pivot

**Major Changes:**
- Pivoted from desktop to mobile-only platform
- Redesigned UI for touch-first interaction (48px min targets)
- Repositioned controls to bottom within thumb reach
- Added orientation restart logic for rotation accuracy
- Implemented camera flip with shimmer feedback
- Added iOS fullscreen detection and button hiding
- Removed localStorage persistence (spec compliance)
- Fixed load handler bug (Event object passed to initCamera)

**Previous Focus:** Desktop browsers, mouse/keyboard interaction
**Current Focus:** Mobile touchscreen devices, portrait-first orientation

---

## Contact

For questions about this product specification, contact the development team.

**Note:** This document supersedes any previous desktop-focused specifications in Product Description.docx.
