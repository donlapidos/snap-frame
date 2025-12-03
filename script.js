// Configuration
const USE_SVG = true; // Set to false to use PNG overlays instead

// Get canvas dimensions based on actual video stream
function getCanvasDimensions() {
    // Use actual video dimensions directly when available
    if (video.videoWidth > 0 && video.videoHeight > 0) {
        // Return the camera's real resolution - no rescaling
        // This preserves 4:3, 1:1, 16:9, or any other aspect ratio
        return {
            width: video.videoWidth,
            height: video.videoHeight
        };
    }
    // Fallback only when metadata isn't ready (should rarely happen)
    const isLandscape = window.matchMedia("(orientation: landscape)").matches;
    return isLandscape
        ? { width: 1920, height: 1080 }
        : { width: 1080, height: 1920 };
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
const fullscreenBtn = document.getElementById('fullscreen-btn');
const switchCameraBtn = document.getElementById('switch-camera-btn');

let stream = null;
let overlayImages = {};
let currentPhotoURL = null; // Store current photo URL for cleanup
let availableCameras = []; // Store available video input devices
let currentCameraIndex = 0; // Track current camera
let shouldMirrorCamera = true; // Track if current camera should be mirrored (true for front camera)

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

// Update preview wrapper aspect ratio based on actual video dimensions
function updatePreviewAspectRatio() {
    if (video.videoWidth > 0 && video.videoHeight > 0) {
        const aspectRatio = video.videoWidth + ' / ' + video.videoHeight;
        previewWrapper.style.aspectRatio = aspectRatio;
        console.log('Updated preview aspect ratio to:', aspectRatio);
    }
}

// Detect camera facing mode and update mirror state
function updateCameraMirrorState() {
    if (!stream) return;

    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return;

    const settings = videoTrack.getSettings();
    const facingMode = settings.facingMode;
    const trackLabel = videoTrack.label.toLowerCase();

    // Determine if camera should be mirrored
    if (facingMode === 'user') {
        // Explicit front camera
        shouldMirrorCamera = true;
    } else if (facingMode === 'environment') {
        // Explicit rear camera
        shouldMirrorCamera = false;
    } else {
        // facingMode absent (common on desktop after deviceId switch)
        // Check label for hints first
        if (trackLabel.includes('front') || trackLabel.includes('user')) {
            shouldMirrorCamera = true;
        } else if (trackLabel.includes('back') || trackLabel.includes('rear') || trackLabel.includes('environment')) {
            shouldMirrorCamera = false;
        } else {
            // No clear indication from facingMode or label
            // Default to mirroring if only one camera (likely built-in front camera)
            // Otherwise default to mirroring unless multiple cameras suggest otherwise
            if (availableCameras.length === 1) {
                shouldMirrorCamera = true; // Single camera = likely built-in front camera
            } else {
                // Multiple cameras with ambiguous labels - default to mirroring
                // (safer assumption for built-in cameras; external cameras are less common)
                shouldMirrorCamera = true;
            }
        }
    }

    // Toggle CSS class for video mirroring
    if (shouldMirrorCamera) {
        video.classList.add('mirrored');
    } else {
        video.classList.remove('mirrored');
    }

    console.log('Camera facing mode:', facingMode, 'Label:', trackLabel, 'Count:', availableCameras.length, '- Mirror:', shouldMirrorCamera);
}

// Enumerate available cameras
async function enumerateCameras() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        availableCameras = devices.filter(device => device.kind === 'videoinput');

        // Show switch camera button if multiple cameras available
        if (availableCameras.length > 1) {
            switchCameraBtn.classList.remove('hidden');
        } else {
            switchCameraBtn.classList.add('hidden');
        }

        return availableCameras;
    } catch (error) {
        console.error('Error enumerating cameras:', error);
        return [];
    }
}

// Switch to next available camera
async function switchCamera() {
    if (availableCameras.length <= 1) return;

    // Move to next camera
    currentCameraIndex = (currentCameraIndex + 1) % availableCameras.length;

    // Reinitialize camera with new device
    await initCamera();
}

// Initialize camera
async function initCamera() {
    try {
        // Check if getUserMedia is supported
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('getUserMedia not supported');
        }

        // Stop any existing streams first
        stopExistingStreams();

        // Small delay to ensure camera is released
        await new Promise(resolve => setTimeout(resolve, 100));

        // Request camera access with orientation-aware constraints
        const isLandscape = window.matchMedia("(orientation: landscape)").matches;

        const constraints = {
            video: {
                // Use specific device if available, otherwise use facingMode
                ...(availableCameras.length > 0 && availableCameras[currentCameraIndex]
                    ? { deviceId: { exact: availableCameras[currentCameraIndex].deviceId } }
                    : { facingMode: 'user' }),
                // Request dimensions that match current orientation
                width: { ideal: isLandscape ? 1920 : 1080 },
                height: { ideal: isLandscape ? 1080 : 1920 },
                aspectRatio: { ideal: isLandscape ? 16/9 : 9/16 }
            }
        };

        stream = await navigator.mediaDevices.getUserMedia(constraints);

        // Enumerate cameras AFTER permission is granted
        await enumerateCameras();

        // Align currentCameraIndex with the actual active device
        const activeTrack = stream.getVideoTracks()[0];
        if (activeTrack && availableCameras.length > 0) {
            const activeDeviceId = activeTrack.getSettings().deviceId;
            const matchingIndex = availableCameras.findIndex(cam => cam.deviceId === activeDeviceId);
            if (matchingIndex !== -1) {
                currentCameraIndex = matchingIndex;
                console.log('Aligned camera index to active device:', currentCameraIndex);
            }
        }

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

        // Load overlay assets
        await loadOverlayAssets();

        // Enable snap button only after everything is ready
        snapBtn.disabled = false;

        // Draw preview overlay
        drawPreviewOverlay();

    } catch (error) {
        // Log error for debugging (doesn't expose sensitive info)
        if (error.name) console.error('Camera access error:', error.name);

        // More detailed error messages
        let errorMsg = 'We couldn\'t access your camera. ';
        if (error.name === 'NotReadableError') {
            errorMsg += 'The camera is currently in use by another application. Please close other apps using the camera and refresh this page.';
        } else if (error.name === 'NotAllowedError') {
            errorMsg += 'Camera access was denied. Please check your browser permissions.';
        } else if (error.name === 'NotFoundError') {
            errorMsg += 'No camera was found on your device.';
        } else {
            errorMsg += error.message;
        }

        showError(errorMsg);
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

        // Stop camera stream to turn off camera
        stopExistingStreams();

        // Smooth scroll to see result if needed
        setTimeout(() => {
            resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);

    } catch (error) {
        // Log error type only (no sensitive details)
        if (error.name) console.error('Capture error:', error.name);
        alert('Failed to capture photo. Please try again.');
    } finally {
        // Re-enable button
        snapBtn.disabled = false;
        snapText.classList.remove('hidden');
        snapLoading.classList.add('hidden');
    }
}

// Download photo
function downloadPhoto() {
    const link = document.createElement('a');
    link.download = 'framed-photo.png';
    link.href = resultPreview.src;
    link.click();
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

    // Restart camera
    await initCamera();

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
    // Hide error and show camera section
    errorMessage.classList.remove('show');
    document.getElementById('camera-section').style.display = 'block';

    // Reinitialize camera
    initCamera();
}

// Toggle fullscreen preview
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        // Enter fullscreen
        if (previewContainer.requestFullscreen) {
            previewContainer.requestFullscreen();
        } else if (previewContainer.webkitRequestFullscreen) {
            // Safari
            previewContainer.webkitRequestFullscreen();
        } else if (previewContainer.mozRequestFullScreen) {
            // Firefox
            previewContainer.mozRequestFullScreen();
        } else if (previewContainer.msRequestFullscreen) {
            // IE/Edge
            previewContainer.msRequestFullscreen();
        }
    } else {
        // Exit fullscreen
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    }
}

// Event listeners
snapBtn.addEventListener('click', snapPhoto);
downloadBtn.addEventListener('click', downloadPhoto);
document.getElementById('retake-btn').addEventListener('click', retakePhoto);
document.getElementById('retry-btn').addEventListener('click', retryCamera);
fullscreenBtn.addEventListener('click', toggleFullscreen);
switchCameraBtn.addEventListener('click', switchCamera);

// Handle orientation change - update preview aspect ratio and redraw overlays
let orientationTimeout;
async function handleOrientationChange() {
    clearTimeout(orientationTimeout);
    orientationTimeout = setTimeout(() => {
        // Update preview aspect ratio to match video
        updatePreviewAspectRatio();

        // Redraw the overlay with new dimensions
        // Video stream automatically adjusts to device rotation
        if (overlayImages.logo_rrc || overlayImages.logo_rrc_png) {
            drawPreviewOverlay();
        }
    }, 300); // Delay to ensure orientation has settled
}

window.addEventListener('resize', handleOrientationChange);
window.addEventListener('orientationchange', handleOrientationChange);

// Also listen for media query changes (with cross-browser support)
if (window.matchMedia) {
    const orientationMQ = window.matchMedia('(orientation: portrait)');
    // Use addEventListener if available (modern browsers), otherwise addListener (Safari/older browsers)
    if (orientationMQ.addEventListener) {
        orientationMQ.addEventListener('change', handleOrientationChange);
    } else if (orientationMQ.addListener) {
        orientationMQ.addListener(handleOrientationChange);
    }
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    stopExistingStreams();
    // Revoke photo URL if exists
    if (currentPhotoURL) {
        URL.revokeObjectURL(currentPhotoURL);
    }
    // Clean up matchMedia listener
    if (window.matchMedia) {
        const orientationMQ = window.matchMedia('(orientation: portrait)');
        if (orientationMQ.removeEventListener) {
            orientationMQ.removeEventListener('change', handleOrientationChange);
        } else if (orientationMQ.removeListener) {
            orientationMQ.removeListener(handleOrientationChange);
        }
    }
});

// Initialize on page load
window.addEventListener('load', initCamera);
