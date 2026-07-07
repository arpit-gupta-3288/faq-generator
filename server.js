import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import axios from 'axios';
import * as cheerio from 'cheerio';
import Anthropic from '@anthropic-ai/sdk';

dotenv.config();

const app = express();
const port = 3002;

app.use(cors());
app.use(express.json());

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Scrape a URL and return cleaned text content
 */
app.post('/api/scrape', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  try {
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });

    const $ = cheerio.load(response.data);
    $('script, style, nav, footer, header, noscript, iframe').remove();

    const text = $('body')
      .text()
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 8000);

    res.json({ text });
  } catch (error) {
    console.error('Scrape error:', error.message);
    res.status(500).json({ error: 'Failed to scrape URL', details: error.message });
  }
});

/**
 * Generate FAQs using Claude via Anthropic
 */
app.post('/api/generate', async (req, res) => {
  const { systemPrompt, userPrompt } = req.body;

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not set in server environment' });
  }

  try {
    const message = await anthropic.messages.create({
      model: 'smart-router',
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      headers: {
        'anthropic-beta': 'max-tokens-3-5-sonnet-2024-07-15'
      }
    });
    console.log('DEBUG API Message:', JSON.stringify(message));

    let raw = '';
    if (message && message.content && message.content[0]) {
      raw = message.content[0].text || '';
    } else {
      console.warn('Warning: Anthropic API returned empty content. Message object:', JSON.stringify(message));
    }
    res.json({ raw });
  } catch (error) {
    console.error('Anthropic API error:', error);
    res.status(500).json({ error: 'Anthropic API error', details: error.message });
  }
});

app.listen(port, () => {
  console.log(`Backend server running at http://localhost:${port}`);
});
