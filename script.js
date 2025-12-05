// Configuration
const USE_SVG = true; // Set to false to use PNG overlays instead

// Get canvas dimensions based on actual video stream
function getCanvasDimensions() {
    // Use actual video dimensions when available
    if (video.videoWidth > 0 && video.videoHeight > 0) {
        // Use video dimensions directly, capped to reasonable max
        const maxDim = 1920;
        const width = Math.min(video.videoWidth, maxDim);
        const height = Math.min(video.videoHeight, maxDim);
        return { width, height };
    }
    // Fallback: portrait default for mobile-first
    return { width: 1080, height: 1920 };
}

let CANVAS_WIDTH = 1080;
let CANVAS_HEIGHT = 1920;

// Asset paths
const ASSETS = {
    logo_rrc: 'assets/Asset 2.svg',
    logo_rrc_png: 'assets/Asset 2.png',
    text_event: 'assets/annual gathering final.svg',
    text_event_png: 'assets/Asset 3.png',
    box_3d: 'assets/Asset 4.svg',
    box_3d_png: 'assets/Asset 4 (1).png',
    gradient: 'assets/Asset 5.svg',
    gradient_png: 'assets/Asset 5.png' // PNG fallback for gradient
};

// DOM elements
const video = document.getElementById('video');
const snapBtn = document.getElementById('snap-btn');
const snapText = document.getElementById('snap-text');
const snapLoading = document.getElementById('snap-loading');
const cameraView = document.getElementById('camera-section');
const resultSection = document.getElementById('result-section');
const resultPreview = document.getElementById('result-preview');
const downloadBtn = document.getElementById('download-btn');
const errorMessage = document.getElementById('error-message');
const overlayPreview = document.getElementById('overlay-preview');
const previewWrapper = document.querySelector('.preview-wrapper');
const previewContainer = document.getElementById('preview-container');
const flipCameraBtn = document.getElementById('flip-camera-btn');
const toastContainer = document.getElementById('toast-container');

let stream = null;
let overlayImages = {};
let currentPhotoURL = null; // Store current photo URL for cleanup
let shouldMirrorCamera = true; // Track if current camera should be mirrored (true for front camera)
let currentFacingMode = 'user'; // Default to front camera (compliant with no-persistence requirement)
let lastOrientationAngle = null; // Track last orientation to detect real changes
let isLoadingCamera = false; // Prevent concurrent camera initializations
let orientationMQ = null; // Store MediaQueryList reference for proper cleanup

// Show toast notification (mobile-friendly alternative to alert)
function showToast(message, type = 'error', duration = 4000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);

    // Auto-dismiss after duration
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// Stop any existing streams
function stopExistingStreams() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
        video.srcObject = null;
    }
}

// Update preview wrapper - let it flex naturally, no aspect-ratio constraints
function updatePreviewAspectRatio() {
    // Remove any inline styles that might have been set
    previewWrapper.style.removeProperty('aspect-ratio');
    previewWrapper.style.removeProperty('height');
    previewWrapper.style.removeProperty('width');
    // Wrapper stays at flex: 1 with min-height: 70vh from CSS
    // object-fit: cover on video handles the aspect ratio
}

// Detect camera facing mode and update mirror state
function updateCameraMirrorState() {
    if (!stream) return;

    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return;

    const settings = videoTrack.getSettings();
    const facingMode = settings.facingMode;
    const trackLabel = (videoTrack.label || '').toLowerCase();

    // Default to mirrored (front camera experience)
    shouldMirrorCamera = true;

    // Explicit environment/back cameras should not mirror
    if (facingMode === 'environment' ||
        trackLabel.includes('back') ||
        trackLabel.includes('rear') ||
        trackLabel.includes('environment')) {
        shouldMirrorCamera = false;
    }

    // Toggle CSS class for video mirroring
    if (shouldMirrorCamera) {
        video.classList.add('mirrored');
    } else {
        video.classList.remove('mirrored');
    }

    console.log('Camera facing mode:', facingMode, 'Label:', trackLabel, '- Mirror:', shouldMirrorCamera);
}

// Get current orientation angle (cross-browser)
function getCurrentOrientation() {
    if (screen.orientation && screen.orientation.angle !== undefined) {
        return screen.orientation.angle;
    } else if (window.orientation !== undefined) {
        return window.orientation;
    }
    return 0; // Fallback
}

// Initialize camera
async function initCamera(facingMode = currentFacingMode) {
    try {
        // Prevent concurrent initializations
        if (isLoadingCamera) return;
        isLoadingCamera = true;

        // Check if getUserMedia is supported
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('getUserMedia not supported');
        }

        // Update current facing mode
        currentFacingMode = facingMode;

        // Stop any existing streams first
        stopExistingStreams();

        // Small delay to ensure camera is released
        await new Promise(resolve => setTimeout(resolve, 100));

        // Track current orientation
        lastOrientationAngle = getCurrentOrientation();

        // Simple constraints - let the browser handle orientation naturally
        // Request portrait dimensions for mobile-first approach
        const constraints = {
            video: {
                facingMode: facingMode,
                width: { ideal: 1080 },
                height: { ideal: 1920 }
            }
        };

        stream = await navigator.mediaDevices.getUserMedia(constraints);

        video.srcObject = stream;

        // Wait for video metadata to be fully loaded
        await new Promise((resolve) => {
            video.onloadedmetadata = () => {
                resolve();
            };
        });

        // Wait for actual video dimensions to be available
        if (video.videoWidth === 0 || video.videoHeight === 0) {
            await new Promise((resolve) => {
                video.onloadeddata = () => {
                    resolve();
                };
            });
        }

        // Update preview aspect ratio to match actual video
        updatePreviewAspectRatio();

        // Detect camera facing mode and update mirror state
        updateCameraMirrorState();

        // Enable full-bleed mode immediately (ensures it's always applied after initCamera)
        // Remove any temporary rotation class and add full-bleed
        previewWrapper.classList.remove('rotating');
        previewWrapper.classList.add('full-bleed');

        // Load overlay assets only if ALL are already cached
        const overlayKeys = USE_SVG
            ? ['logo_rrc', 'text_event', 'box_3d', 'gradient']
            : ['logo_rrc_png', 'text_event_png', 'box_3d_png', 'gradient_png'];
        const allOverlaysLoaded = overlayKeys.every(key => overlayImages[key]);

        if (!allOverlaysLoaded) {
            await loadOverlayAssets();
        }

        // Enable buttons only after everything is ready
        snapBtn.disabled = false;
        flipCameraBtn.disabled = false;

        // Draw preview overlay
        drawPreviewOverlay();

    } catch (error) {
        // Log error for debugging (doesn't expose sensitive info)
        if (error.name) console.error('Camera access error:', error.name);

        // Mobile-friendly error messages
        let errorMsg = 'Camera access issue. ';
        if (error.name === 'NotReadableError') {
            errorMsg += 'Your camera is being used by another app. Please close other camera apps and try again.';
        } else if (error.name === 'NotAllowedError') {
            errorMsg += 'Camera permission was denied. Go to your phone\'s Settings to enable camera access.';
        } else if (error.name === 'NotFoundError') {
            errorMsg += 'No camera was found on your device.';
        } else {
            errorMsg += error.message;
        }

        showError(errorMsg);
    } finally {
        isLoadingCamera = false;
    }
}

// Load overlay assets
async function loadOverlayAssets() {
    const imagesToLoad = USE_SVG
        ? ['logo_rrc', 'text_event', 'box_3d', 'gradient']
        : ['logo_rrc_png', 'text_event_png', 'box_3d_png', 'gradient_png'];

    const promises = imagesToLoad.map(key => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                overlayImages[key] = img;
                resolve();
            };
            img.onerror = (error) => {
                console.warn(`Failed to load ${key}:`, ASSETS[key]);
                // Don't reject - allow app to work with missing assets
                resolve();
            };
            img.src = ASSETS[key];
        });
    });

    await Promise.all(promises);
}

// Draw preview overlay on canvas
function drawPreviewOverlay() {
    const canvas = overlayPreview;
    const ctx = canvas.getContext('2d');

    // Set canvas size to match container
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Update canvas dimensions based on actual video
    const dims = getCanvasDimensions();
    CANVAS_WIDTH = dims.width;
    CANVAS_HEIGHT = dims.height;

    // Calculate scaling based on canvas display width
    // Use canvas.width (display size) divided by 1080 as base reference
    const scale = canvas.width / 1080;

    // 1. Draw gradient overlay (full background)
    if (overlayImages.gradient || overlayImages.gradient_png) {
        const gradImg = overlayImages.gradient || overlayImages.gradient_png;
        ctx.globalAlpha = 0.8;
        ctx.drawImage(gradImg, 0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1.0;
    }

    // 2. Draw logos at top (Asset 2 - contains both RRC and BEYOND logos)
    if (overlayImages.logo_rrc || overlayImages.logo_rrc_png) {
        const logoImg = overlayImages.logo_rrc || overlayImages.logo_rrc_png;
        // Position at top center with proper sizing
        const logoWidth = 350 * scale;
        const logoHeight = (logoImg.height / logoImg.width) * logoWidth;
        const logoX = (canvas.width - logoWidth) / 2; // Center horizontally
        const logoY = 100 * scale; // Lowered from 50 to 100
        ctx.drawImage(logoImg, logoX, logoY, logoWidth, logoHeight);
    }

    // 3. Draw event text (bottom left - Asset 3)
    if (overlayImages.text_event || overlayImages.text_event_png) {
        const textImg = overlayImages.text_event || overlayImages.text_event_png;
        const textWidth = 550 * scale; // Increased size
        const textHeight = (textImg.height / textImg.width) * textWidth;
        const textX = 80 * scale;
        const textY = canvas.height - textHeight - (120 * scale);
        ctx.drawImage(textImg, textX, textY, textWidth, textHeight);
    }

    // 4. Draw 3D box (bottom right - Asset 4)
    if (overlayImages.box_3d || overlayImages.box_3d_png) {
        const boxImg = overlayImages.box_3d || overlayImages.box_3d_png;
        const boxWidth = 320 * scale; // Increased size significantly
        const boxHeight = (boxImg.height / boxImg.width) * boxWidth;
        const boxX = canvas.width - boxWidth - (80 * scale);
        const boxY = canvas.height - boxHeight - (120 * scale);
        ctx.drawImage(boxImg, boxX, boxY, boxWidth, boxHeight);
    }
}

// Snap photo
async function snapPhoto() {
    // Disable button during processing
    snapBtn.disabled = true;
    snapText.classList.add('hidden');
    snapLoading.classList.remove('hidden');

    try {
        // Ensure video has valid dimensions
        if (video.videoWidth === 0 || video.videoHeight === 0) {
            // Wait for loadeddata event if dimensions not ready yet
            await new Promise((resolve) => {
                video.addEventListener('loadeddata', resolve, { once: true });
            });
        }

        // Get actual video dimensions (no rescaling, no cropping)
        const dims = getCanvasDimensions();

        // Create canvas for final composition
        const canvas = document.createElement('canvas');
        canvas.width = dims.width;
        canvas.height = dims.height;
        const ctx = canvas.getContext('2d');

        // Draw video at exact dimensions - no offset calculations needed
        // since canvas matches video resolution exactly
        // Mirror only if it's a front-facing camera (to match preview)
        ctx.save();
        if (shouldMirrorCamera) {
            ctx.translate(dims.width, 0);
            ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0, dims.width, dims.height);
        ctx.restore();

        // 1. Draw gradient overlay (full background)
        if (overlayImages.gradient || overlayImages.gradient_png) {
            const gradImg = overlayImages.gradient || overlayImages.gradient_png;
            ctx.globalAlpha = 0.8;
            ctx.drawImage(gradImg, 0, 0, dims.width, dims.height);
            ctx.globalAlpha = 1.0;
        }

        // Calculate scale factor based on canvas width (relative sizing)
        const scaleFactor = dims.width / 1080; // Use 1080 as base reference

        // 2. Draw logos at top center (Asset 2 - both RRC and BEYOND logos)
        if (overlayImages.logo_rrc || overlayImages.logo_rrc_png) {
            const logoImg = overlayImages.logo_rrc || overlayImages.logo_rrc_png;
            const logoWidth = 350 * scaleFactor;
            const logoHeight = (logoImg.height / logoImg.width) * logoWidth;
            const logoX = (dims.width - logoWidth) / 2; // Center horizontally
            const logoY = 100 * scaleFactor;
            ctx.drawImage(logoImg, logoX, logoY, logoWidth, logoHeight);
        }

        // 3. Draw event text at bottom left (Asset 3)
        if (overlayImages.text_event || overlayImages.text_event_png) {
            const textImg = overlayImages.text_event || overlayImages.text_event_png;
            const textWidth = 550 * scaleFactor;
            const textHeight = (textImg.height / textImg.width) * textWidth;
            const textX = 80 * scaleFactor;
            const textY = dims.height - textHeight - (120 * scaleFactor);
            ctx.drawImage(textImg, textX, textY, textWidth, textHeight);
        }

        // 4. Draw 3D box at bottom right (Asset 4)
        if (overlayImages.box_3d || overlayImages.box_3d_png) {
            const boxImg = overlayImages.box_3d || overlayImages.box_3d_png;
            const boxWidth = 320 * scaleFactor;
            const boxHeight = (boxImg.height / boxImg.width) * boxWidth;
            const boxX = dims.width - boxWidth - (80 * scaleFactor);
            const boxY = dims.height - boxHeight - (120 * scaleFactor);
            ctx.drawImage(boxImg, boxX, boxY, boxWidth, boxHeight);
        }

        // Convert to blob for better memory efficiency
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));

        // Revoke previous photo URL if exists
        if (currentPhotoURL) {
            URL.revokeObjectURL(currentPhotoURL);
        }

        // Create object URL for the blob
        currentPhotoURL = URL.createObjectURL(blob);

        // Show result
        resultPreview.src = currentPhotoURL;
        resultSection.classList.add('show');
        cameraView.classList.add('hidden');

        // Keep stream alive for faster retake (don't stop camera)
        // Video element will be hidden but stream stays active

        // Smooth scroll to see result if needed
        setTimeout(() => {
            resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);

    } catch (error) {
        // Log error type only (no sensitive details)
        if (error.name) console.error('Capture error:', error.name);
        showToast('Failed to capture photo. Please try again.');
    } finally {
        // Re-enable button
        snapBtn.disabled = false;
        snapText.classList.remove('hidden');
        snapLoading.classList.add('hidden');
    }
}

// Download photo (with iOS Share API)
async function downloadPhoto() {
    try {
        // Convert blob URL to actual blob
        const response = await fetch(resultPreview.src);
        const blob = await response.blob();
        const file = new File([blob], 'framed-photo.png', { type: 'image/png' });

        // Try Web Share API first (works on iOS and Android)
        if (navigator.share && navigator.canShare) {
            try {
                if (navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        files: [file],
                        title: 'Framed Photo',
                        text: 'My framed photo'
                    });
                    // Don't show success toast if user shared (could be cancelled)
                    return;
                }
            } catch (error) {
                // If AbortError, user cancelled - don't show error
                if (error.name === 'AbortError') {
                    return;
                }
                console.log('Share failed, falling back:', error);
                // Fall through to download
            }
        }

        // Fallback: traditional download (works on desktop, some Android browsers)
        if (!isIOS()) {
            const link = document.createElement('a');
            link.download = 'framed-photo.png';
            link.href = URL.createObjectURL(blob);
            link.click();
            // Clean up
            setTimeout(() => URL.revokeObjectURL(link.href), 1000);
            showToast('Photo downloaded!', 'success', 2000);
        } else {
            // iOS Safari without Share API support (rare, but fallback)
            showToast('Long-press the image and tap "Save Image"', 'info', 6000);
        }
    } catch (error) {
        console.error('Download error:', error);
        showToast('Failed to save photo. Please try again.', 'error');
    }
}

// Retake photo
async function retakePhoto() {
    // Revoke object URL to free memory
    if (currentPhotoURL) {
        URL.revokeObjectURL(currentPhotoURL);
        currentPhotoURL = null;
    }

    // Hide result section and show camera view
    resultSection.classList.remove('show');
    cameraView.classList.remove('hidden');

    // Clear the result preview
    resultPreview.src = '';

    // No need to restart camera - stream is still active from initial load
    // This makes retakes much faster (no camera boot or asset reload)

    // Smooth scroll back to camera view
    setTimeout(() => {
        cameraView.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
}

// Show error message
function showError(customMessage) {
    if (customMessage) {
        const errorText = errorMessage.querySelector('p');
        if (errorText) {
            errorText.textContent = customMessage;
        }
    }
    errorMessage.classList.add('show');
    document.getElementById('camera-section').style.display = 'none';
}

// Retry camera access
function retryCamera() {
    // Hide error and show camera section (reset to default flex display)
    errorMessage.classList.remove('show');
    document.getElementById('camera-section').style.display = '';

    // Reinitialize camera
    initCamera();
}

// Detect iOS
function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}



// Flip camera with optimized approach
async function flipCamera() {
    if (!stream) return;

    // Disable button and show loading shimmer during flip
    flipCameraBtn.disabled = true;
    flipCameraBtn.classList.add('flipping');
    previewWrapper.classList.add('loading');

    try {
        const videoTrack = stream.getVideoTracks()[0];
        if (!videoTrack) {
            throw new Error('No video track available');
        }

        // Determine new facing mode
        const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';

        // Try optimized approach: applyConstraints (no stream restart)
        try {
            await videoTrack.applyConstraints({
                facingMode: { exact: newFacingMode }
            });

            // Success - update state (no persistence per spec requirements)
            currentFacingMode = newFacingMode;
            updateCameraMirrorState();
            updatePreviewAspectRatio();
            drawPreviewOverlay();

            console.log('Camera flipped using applyConstraints to', newFacingMode);
        } catch (constraintError) {
            // applyConstraints failed, fall back to full reinitialization
            console.log('applyConstraints failed, reinitializing camera:', constraintError.message);

            // Full reinitialization
            await initCamera(newFacingMode);
        }
    } catch (error) {
        console.error('Camera flip error:', error.name);
        showToast('Failed to switch camera. Please try again.');
    } finally {
        // Re-enable button and remove animation classes
        flipCameraBtn.disabled = false;
        previewWrapper.classList.remove('loading');
        // Delay removing class to ensure animation completes
        setTimeout(() => {
            flipCameraBtn.classList.remove('flipping');
        }, 600);
    }
}

// Check available cameras and hide flip button if only one
async function initFlipButton() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');

        if (videoDevices.length <= 1) {
            // Hide flip button if only one camera
            flipCameraBtn.style.display = 'none';
            console.log('Only one camera available - flip button hidden');
        } else {
            flipCameraBtn.style.display = '';
        }
    } catch (error) {
        console.log('Could not enumerate devices:', error);
        // Keep button visible by default if we can't check
    }
}

// Event listeners
snapBtn.addEventListener('click', snapPhoto);
downloadBtn.addEventListener('click', downloadPhoto);
document.getElementById('retake-btn').addEventListener('click', retakePhoto);
document.getElementById('retry-btn').addEventListener('click', retryCamera);
flipCameraBtn.addEventListener('click', flipCamera);

// Handle orientation change - restart stream with new constraints
let orientationTimeout;
async function handleOrientationChange() {
    clearTimeout(orientationTimeout);
    orientationTimeout = setTimeout(async () => {
        const newAngle = getCurrentOrientation();

        // Determine orientation types (portrait: 0/180, landscape: ±90)
        const isPortrait = (angle) => angle === 0 || angle === 180 || angle === -180;
        const wasPortrait = lastOrientationAngle !== null && isPortrait(lastOrientationAngle);
        const nowPortrait = isPortrait(newAngle);

        // Only restart if orientation actually changed (portrait <-> landscape)
        if (lastOrientationAngle !== null && wasPortrait !== nowPortrait) {
            console.log('Orientation changed from', lastOrientationAngle, 'to', newAngle, '- restarting stream');

            // Show visual feedback
            showToast('Rotating camera...', 'info', 2000);
            previewWrapper.classList.add('rotating');
            previewWrapper.classList.remove('full-bleed');

            // Restart camera with current facing mode to get proper orientation
            // initCamera will remove 'rotating' class and add 'full-bleed' when done
            await initCamera(currentFacingMode);

            // Update lastOrientationAngle to track the change
            lastOrientationAngle = newAngle;
        } else if (lastOrientationAngle !== newAngle) {
            // Same orientation type but different angle (e.g., 0° -> 180°)
            // Just update the preview and redraw overlays
            updatePreviewAspectRatio();
            if (overlayImages.logo_rrc || overlayImages.logo_rrc_png) {
                drawPreviewOverlay();
            }

            // Update lastOrientationAngle for this case too
            lastOrientationAngle = newAngle;
        }
    }, 300); // Delay to ensure orientation has settled
}

window.addEventListener('resize', handleOrientationChange);
window.addEventListener('orientationchange', handleOrientationChange);

// Also listen for media query changes (with cross-browser support)
if (window.matchMedia) {
    orientationMQ = window.matchMedia('(orientation: portrait)');
    // Use addEventListener if available (modern browsers), otherwise addListener (Safari/older browsers)
    if (orientationMQ.addEventListener) {
        orientationMQ.addEventListener('change', handleOrientationChange);
    } else if (orientationMQ.addListener) {
        orientationMQ.addListener(handleOrientationChange);
    }
}

// Handle visibility change - pause stream when tab is hidden to save battery
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // Tab is hidden - pause video to save battery
        if (stream && video) {
            stream.getVideoTracks().forEach(track => {
                track.enabled = false;
            });
            console.log('Tab hidden - camera paused to save battery');
        }
    } else {
        // Tab is visible again - resume video
        if (stream && video) {
            stream.getVideoTracks().forEach(track => {
                track.enabled = true;
            });
            console.log('Tab visible - camera resumed');
        }
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    stopExistingStreams();
    // Revoke photo URL if exists
    if (currentPhotoURL) {
        URL.revokeObjectURL(currentPhotoURL);
    }
    // Clean up matchMedia listener using stored reference
    if (orientationMQ) {
        if (orientationMQ.removeEventListener) {
            orientationMQ.removeEventListener('change', handleOrientationChange);
        } else if (orientationMQ.removeListener) {
            orientationMQ.removeListener(handleOrientationChange);
        }
    }
});

// Initialize on page load
initFlipButton();
window.addEventListener('load', () => initCamera());
