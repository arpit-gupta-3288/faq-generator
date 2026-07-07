#!/bin/bash

# Port Cleanup - Ensure fresh start
echo "🧹 Cleaning up existing processes on ports 3000 and 3002..."
lsof -ti:3000,3002 | xargs kill -9 2>/dev/null || true

# Ensure dependencies are installed
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
fi

# Run the development environment in background
echo "🚀 Starting local services (Backend: 3002, Frontend: 3000)..."
npm run dev &

# Wait for Vite to initialize
echo "⏳ Waiting for initialization..."
sleep 6

# Start Cloudflare Tunnel to port 3000
echo ""
echo "----------------------------------------------------------"
echo "🌍 GENERATING RELIABLE CLOUDFLARE PUBLIC URL..."
echo "----------------------------------------------------------"
echo "Note: The proxy in vite.config.js now routes all /api calls"
echo "to your local backend, fixing the 404 errors."
echo "Look for the '.trycloudflare.com' URL below!"
echo "----------------------------------------------------------"
npx cloudflared tunnel --url http://localhost:3000

