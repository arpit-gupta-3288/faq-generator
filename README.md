# FAQ Generator — Real Estate Project Pages

Generate buyer-intent FAQs from any real estate project page URL using Claude AI.

## Features

- Paste any **NoBroker, 99acres, Housing.com, or MagicBricks** project URL
- Dynamic FAQ count slider (5–20 FAQs)
- Priority filters: High / Medium / Low
- Optional extra context to guide generation
- Expandable FAQ cards grouped by category
- JSON view with **Copy** and **Download** buttons
- Search & filter FAQs after generation
- Claude API key stored securely in `localStorage` — never sent anywhere except Anthropic

## Setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Usage

1. Click **"Add API key"** in the top-right and paste your Claude API key (`sk-ant-...`)
2. Paste a real estate project page URL
3. Set the number of FAQs using the slider
4. Choose priority focus and optionally add context
5. Click **Generate FAQs**

## API Key

- Get your key from [console.anthropic.com](https://console.anthropic.com)
- Stored in your browser's `localStorage` — never sent to any server other than Anthropic
- Change/clear it anytime from the top-right button

## Tech Stack

- React 18 + Vite
- CSS Modules
- Anthropic Claude API (`claude-sonnet-4-20250514`)
- allorigins.win proxy for page scraping

## FAQ JSON Schema

```json
[
  {
    "id": 1,
    "category": "Pricing & Payment",
    "question": "What is the current price of a 2BHK?",
    "answer": "As of latest data...",
    "sources": ["Page Content", "LLM Research"],
    "data_gaps": [],
    "priority": "high"
  }
]
```
