@echo off
REM Build script for Windows - Copies production files to dist/

echo Building Snap & Frame...

REM Create dist directory if it doesn't exist
if not exist "dist" mkdir "dist"
if not exist "dist\assets" mkdir "dist\assets"

REM Copy production files
echo Copying files...
copy "index.html" "dist\" > nul
copy "style.css" "dist\" > nul
copy "script.js" "dist\" > nul
copy "_headers" "dist\" > nul

REM Copy assets
copy "assets\*.svg" "dist\assets\" > nul
copy "assets\*.png" "dist\assets\" > nul

echo Build complete! Files are in the dist/ directory.
echo.
echo To deploy: wrangler pages deploy dist
