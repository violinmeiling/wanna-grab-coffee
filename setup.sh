#!/bin/bash

# Coffee Networking Assistant Setup Script
# This script helps you set up the required APIs and permissions

echo "☕ Coffee Networking Assistant Setup"
echo "===================================="
echo ""

# Check if running on macOS
if [[ "$OSYSTEM" != "Darwin" ]]; then
    echo "❌ This app only works on macOS"
    exit 1
fi

# Check Node.js version
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    echo "   Download from: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version $NODE_VERSION detected. Please upgrade to Node.js 18+."
    exit 1
fi

echo "✅ Node.js $(node -v) detected"
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "✅ Created .env file"
else
    echo "✅ .env file already exists"
fi

echo ""

# Install dependencies
echo "📦 Installing dependencies..."
if command -v bun &> /dev/null; then
    echo "Using Bun..."
    bun install
else
    echo "Using npm..."
    npm install
fi

echo ""

# Check for Full Disk Access
echo "🔐 Checking permissions..."
echo ""
echo "⚠️  IMPORTANT: You need to grant Full Disk Access"
echo "   1. Open System Settings → Privacy & Security → Full Disk Access"
echo "   2. Click '+' and add your terminal/IDE:"
echo "      - Terminal.app"
echo "      - VS Code"
echo "      - Your preferred development environment"
echo ""

# API Setup reminders
echo "🔑 API Setup Required:"
echo ""

echo "1. Google Calendar API:"
echo "   - Go to https://console.cloud.google.com/"
echo "   - Create project → Enable Calendar API → Create OAuth credentials"
echo "   - Set redirect URI: http://localhost:3000/oauth/callback"
echo "   - Add GOOGLE_CALENDAR_CLIENT_ID and GOOGLE_CALENDAR_CLIENT_SECRET to .env"
echo ""

echo "2. Google Gemini AI:"
echo "   - Visit https://makersuite.google.com/app/apikey"
echo "   - Create API key → Add GOOGLE_AI_API_KEY to .env"
echo ""

echo "3. Personal Info:"
echo "   - Update MY_NAME and MY_PHONE in .env"
echo "   - The app will create a LinkedIn profile template for you"
echo ""

# Build the project
echo "🔨 Building project..."
if command -v bun &> /dev/null; then
    bun run build
else
    npm run build
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Configure your API keys in .env"
echo "2. Grant Full Disk Access permissions"  
echo "3. Run: npm start"
echo "4. Send yourself: 'met John at conference, he works in tech'"
echo ""
echo "Need help? Check the README.md for detailed setup instructions."