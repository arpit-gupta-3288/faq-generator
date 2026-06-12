import axios from 'axios';
import * as cheerio from 'cheerio';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';

dotenv.config();

const url = process.argv[2];

if (!url) {
  console.error('Usage: node cli.js <NoBroker-Project-URL>');
  process.exit(1);
}

if (!process.env.OPENROUTER_API_KEY) {
  console.error('Error: OPENROUTER_API_KEY is not set in .env');
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
});

async function run() {
  try {
    console.log(`\n🔍 Scrapping: ${url}...`);
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      }
    });

    const $ = cheerio.load(response.data);
    $('script, style, nav, footer, header').remove();
    const pageContent = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 7000);

    console.log('🤖 Calling Gemini via OpenRouter to generate FAQs...');

    const systemPrompt = `You are an expert real estate SEO content writer and NoBroker platform representative, writing buyer FAQs natively for NoBroker.

    BRAND INTEGRATION & PERSONA:
    - All FAQs must be framed as native to NoBroker. Speak to users as if they are browsing these details directly on the NoBroker platform.
    - Highlight NoBroker's value-added services: NoBroker Home Loans (paperless assistance, customized/pre-approved rates), NoBroker Interior Services (personalized design, verified partners, quality execution), and NoBroker Legal Services (deed verification, title checks, safe agreements).
    - Explicitly include FAQs answering how NoBroker helps with Loans, Interiors, and Legal checks for this specific project.
    - For property details, technical specifications, and builder records, gather/synthesize from external platforms, google searches, and official RERA data, without implying NoBroker is the builder or direct source of those external details.
    - SEO FIRST: Target relevant long-tail search keywords naturally.
    - BRAND SAFETY: Never mention or link to competitor platforms.

    Return ONLY a valid JSON array containing objects matching this schema:
    [
      {
        "id": 1,
        "category": "category name (e.g. NoBroker Home Loans, NoBroker Interior Services, NoBroker Legal Services, Project Information, Connectivity)",
        "question": "question text",
        "answer": "answer text",
        "priority": "high",
        "data_gaps": ["gap 1"],
        "sources": ["source 1"]
      }
    ]`;

    const userPrompt = `Generate exactly 5 FAQs for this real estate project: ${url}

    CONTEXT & DATA:
    - Page Content:
    ${pageContent}

    INSTRUCTIONS:
    - Generate exactly 5 FAQs.
    - You MUST include dedicated FAQs/answers specifically for NoBroker services: NoBroker Home Loans, NoBroker Interior Services, and NoBroker Legal Services.
    - When referencing the property's detailed technical specifications or developer status, cite Google search information and RERA compliance data.

    Return exactly 5 FAQs in the specified JSON format.`;

    const completion = await openai.chat.completions.create({
      model: 'gemini/gemini-2.5-pro',
      max_tokens: 3000,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    const raw = completion.choices[0].message.content || '';
    const clean = raw.replace(/```json|```/g, '').trim();

    console.log('\n✨ Generated FAQs:\n');
    console.log(JSON.stringify(JSON.parse(clean), null, 2));
    console.log('\n✅ Done!');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

run();
