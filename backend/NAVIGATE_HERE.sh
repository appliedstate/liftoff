#!/bin/bash
# Navigate to backend directory - copy and paste this entire block

cd "/Users/ericroach/Desktop/Desktop - Eric's MacBook Air/Liftoff/backend"

if [ -f "package.json" ]; then
    echo "✓ Successfully navigated to backend directory"
    echo "Current directory: $(pwd)"
    echo ""
    echo "Now run: npm run dev"
else
    echo "✗ Error: Could not find package.json"
    echo "Current directory: $(pwd)"
    echo ""
    echo "Trying alternative path..."
    cd ~/Desktop
    if [ -d "Desktop - Eric's MacBook Air/Liftoff/backend" ]; then
        cd "Desktop - Eric's MacBook Air/Liftoff/backend"
        echo "✓ Found via alternative path: $(pwd)"
    else
        echo "✗ Could not find backend directory"
        echo "Please check the path manually"
    fi
fi

