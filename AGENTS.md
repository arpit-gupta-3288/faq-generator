# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Development Commands

- **Start All (Frontend + Backend)**: `npm run dev`
- **Start Backend Server only**: `npm run server` (Port 3001)
- **Start Frontend only**: `npx vite`
- **CLI FAQ Generator**: `npm run cli -- <url>`
- **Build Application**: `npm run build`
- **Preview Build**: `npm run preview`

## Architecture: Terminal Codex Access

The project follows a "Local-First" architecture designed for secure and robust AI integration without exposing API keys to the browser.

### Key Components
- **Frontend (React/Vite)**: A UI for generating real estate FAQs. It communicates exclusively with the local backend proxy.
- **Backend (Express - `server.js`)**: A local proxy server that handles:
    - **Scraping**: Uses `axios` and `cheerio` for server-side scraping of property portals (bypassing browser CORS/proxies).
    - **Anthropic Integration**: Uses the `@anthropic-ai/sdk` to securely call Codex using the `ANTHROPIC_API_KEY` from the local environment.
- **CLI Utility (`cli.js`)**: A standalone terminal tool that replicates the core scraping and generation logic for headless use.

### Data Flow
1. User enters a NoBroker URL in the UI.
2. `src/utils/Codex.js` sends a POST request to `http://localhost:3001/api/scrape`.
3. Backend scrapes the page and returns cleaned text.
4. UI sends a request to `http://localhost:3001/api/generate` with the context.
5. Backend calls Codex and returns the structured JSON FAQs.

### Configuration
- Environment variables are managed in a local `.env` file.
- The primary credential is `ANTHROPIC_API_KEY`.
- Model configurations are centralized in `server.js` and `cli.js`.
