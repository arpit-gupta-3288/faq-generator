import axios from 'axios';
import * as cheerio from 'cheerio';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import * as dotenv from 'dotenv';

dotenv.config();

const url = process.argv[2];

if (!url) {
  console.error('Usage: node cli.js <NoBroker-Project-URL>');
  process.exit(1);
}

const hasOpenRouter = !!process.env.OPENROUTER_API_KEY;
const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;

if (!hasOpenRouter && !hasAnthropic) {
  console.error('Error: Either OPENROUTER_API_KEY or ANTHROPIC_API_KEY must be set in .env');
  process.exit(1);
}

const clientType = hasAnthropic ? 'anthropic' : 'openrouter';
let anthropic;
let openai;

if (clientType === 'anthropic') {
  anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
} else {
  openai = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
  });
}

function extractCompleteObjects(str) {
  const objects = [];
  let depth = 0;
  let objStart = -1;
  let inString = false;
  let escape = false;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;

    if (ch === '{') {
      if (depth === 0) objStart = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && objStart !== -1) {
        try { objects.push(JSON.parse(str.slice(objStart, i + 1))); } catch {}
        objStart = -1;
      }
    }
  }
  return objects;
}

/**
 * Clean and robust JSON extraction for CLI
 */
function parseModelJson(raw) {
  const clean = raw.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(clean);
  } catch (error) {
    const arrayMatch = clean.match(/\[[\s\S]*/);
    if (arrayMatch) {
      try {
        return JSON.parse(arrayMatch[0]);
      } catch {
        const recovered = extractCompleteObjects(arrayMatch[0]);
        if (recovered && recovered.length > 0) return recovered;
      }
    }
    const objectMatch = clean.match(/\{[\s\S]*/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]);
      } catch {
        // Fallback
      }
    }
    throw new Error('Failed to parse JSON from AI model response');
  }
}

/**
 * Generic model caller (Anthropic or OpenRouter)
 */
async function callModel(systemPrompt, userPrompt) {
  let raw = '';
  if (clientType === 'anthropic') {
    const message = await anthropic.messages.create({
      model: 'smart-router',
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      headers: {
        'anthropic-beta': 'max-tokens-3-5-sonnet-2024-07-15'
      }
    });
    raw = (message && message.content && message.content[0] && message.content[0].text) || '';
  } else {
    const completion = await openai.chat.completions.create({
      model: 'gemini/gemini-2.5-pro',
      max_tokens: 30000,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });
    raw = completion.choices[0].message.content || '';
  }
  return parseModelJson(raw);
}

async function run() {
  try {
    console.log(`\n🔍 Scraping URL: ${url}...`);
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      }
    });

    const $ = cheerio.load(response.data);
    $('script, style, nav, footer, header').remove();
    const pageContent = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 7000);
    console.log('✅ Page content scraped and cleaned successfully!');

    // --- Agent 1: Project Intelligence Agent ---
    console.log('\n🤖 Agent 1: Extracting project intelligence...');
    const agent1System = `You are a real estate research analyst. Extract complete, structured information into this JSON schema:
{
  "project_name": "string",
  "builder": "string",
  "location": "locality, city",
  "price": "string",
  "configurations": "string",
  "possession_date": "string",
  "construction_status": "string",
  "amenities": ["string"],
  "rera_number": "string",
  "rera_status": "string",
  "highlights": ["string"],
  "connectivity": "string",
  "nearby_places": { "schools": [], "hospitals": [], "offices": [] },
  "services": []
}

MANDATORY DATA SOURCING HIERARCHY (Follow strictly):
1. RERA ID SOURCING:
   a. Check the provided NoBroker listing content for the RERA ID.
   b. If the ID found on NoBroker is missing, incomplete (e.g., only the base ID like PRM/KA/RERA/1251/308 without the suffix), or appears incorrect, you MUST ignore the NoBroker value.
   c. In case of a missing/incomplete NoBroker ID, you MUST use your internal knowledge representing Google Search results, AI Overviews, and official RERA portals to find and provide the FULL official registration number (e.g., PRM/KA/RERA/1251/308/PR/170225/007512).
2. For 'price' and 'configurations', prioritize official developer websites and competitor consensus (MagicBricks, 99acres) over NoBroker listing data.
3. ANTI-HALLUCINATION: If even after searching your Google/Official knowledge you are not 100% certain of the full suffix, return ONLY the verified partial ID and advise verification on the portal. NEVER invent suffixes.`;

    const agent1User = `Project URL: ${url}\nContent: ${pageContent || 'Not available'}\nRERA: `;

    const projectKB = await callModel(agent1System, agent1User);
    console.log('✅ Structured Project Knowledge Base generated.');

    // --- Agents 2 & 3: Run in Parallel ---
    console.log('\n🤖 Agents 2 & 3: Analyzing search demand and community feedback in parallel...');

    const agent2System = `You are an SEM analyst. Analyze the Project KB and return 10-15 high-intent Google search queries/PAA questions as a JSON array of:
{ "question": "string", "source": "Google", "intent": "string" }`;

    const agent2User = `KB: ${JSON.stringify(projectKB)}`;

    const agent3System = `You are a forum listener. Analyze the Project KB and return 10-15 community concerns/questions from Reddit as a JSON array of:
{ "question": "string", "source": "Reddit", "sentiment": "string" }`;

    const agent3User = `KB: ${JSON.stringify(projectKB)}`;

    const [googleKB, redditKB] = await Promise.all([
      callModel(agent2System, agent2User).catch(err => {
        console.error('⚠️ Google Demand Agent failed:', err.message);
        return [];
      }),
      callModel(agent3System, agent3User).catch(err => {
        console.error('⚠️ Reddit Discovery Agent failed:', err.message);
        return [];
      })
    ]);
    console.log('✅ Google search queries and Reddit sentiment analyzed.');

    // --- Agent 4: Question Orchestrator Agent ---
    console.log('\n🤖 Agent 4: Orchestrating exactly 40 questions (10 per category)...');
    const agent4System = `You are a master FAQ architect. Your task is to curate EXACTLY 40 high-quality, search-optimized questions based on the Project KB and discovery signals.
You must distribute them strictly into these 4 categories (exactly 10 per category):
1. "About Project"
2. "Location & Connectivity"
3. "Pricing & Buying"
4. "NoBroker Services"

CRITICAL INSTRUCTION: Your primary objective is to cross-verify information across multiple sources. Give higher weightage to official RERA data, competitor listings, and independent Google signals than to NoBroker listing data alone. If sources provide conflicting data (e.g., possession dates), prioritize the official RERA timeline and frame the question to address the ambiguity.

You MUST return EXACTLY 40 questions in total, with EXACTLY 10 in each of the 4 categories listed above. Do not skip any category. Do not return more or less than 10 per category.

Ensure the questions are diverse, address real intent, and sound like high-quality buyer inquiries.
Return ONLY a JSON array of 40 objects:
[
  { "id": 1, "category": "About Project", "question": "..." },
  ...
]`;

    const agent4User = `Project KB: ${JSON.stringify(projectKB)}
Google Signals: ${JSON.stringify(googleKB)}
Reddit Signals: ${JSON.stringify(redditKB)}`;

    const questions = await callModel(agent4System, agent4User);
    console.log(`✅ Curated ${questions.length} questions successfully.`);

    // --- Agent 5: Answer Writer Agent ---
    console.log('\n🤖 Agent 5: Generating concise answers in batches...');
    const agent5System = `You are an elite real estate researcher and writer. Generate short, specific, buyer-useful answers for the provided questions.
Your goal is to answer only what the question asks, using source consensus instead of long explanations.

DATA WEIGHTAGE & TRIANGULATION (STRICT HIERARCHY):
1. OFFICIAL BUILDER WEBSITES & RERA PORTALS: The absolute source of truth for RERA IDs, Pricing, Configurations, and Timelines. If an official source is available, its data MUST be used regardless of what NoBroker or other sites say.
2. Competitor Platforms & AI Knowledge: Use for secondary confirmation or when official data is unavailable. Synthesize data from MagicBricks, 99acres, and AI Overview insights.
3. NoBroker Listing Data: Use ONLY for NoBroker-specific services (e.g., NoBroker Pay, NoBroker Legal). DO NOT use for project specs, RERA IDs, or pricing if it conflicts with official sources.

CONSENSUS RULE:
- RERA ID & PRICING: Try to use the RERA ID from the NoBroker builder data. If it is unavailable or incomplete on NoBroker, you MUST use the full ID found via your Google Search and official RERA portal knowledge.
- IMAGE #2 VERIFICATION: For Prestige Suncrest, the full official ID is PRM/KA/RERA/1251/308/PR/170225/007512. Ensure this level of completeness is achieved for all projects by falling back to Google/Official data when NoBroker fails.
- For other fields, if your internal knowledge or competitor patterns contradict the provided NoBroker text, the NoBroker text MUST be discarded in favor of the competitor/internal consensus.
- If NoBroker and competitors/public sources say different things on other topics, give more weight to what the majority of independent sources say.
- If there is a legal/timeline conflict, RERA or official government records override all other sources.

ANSWER STYLE:
- Keep every answer to 35-60 words.
- Start with the direct answer in the first sentence.
- Do not add background unless it helps answer the exact question.
- Avoid generic marketing language and avoid repeating NoBroker service pitches unless the question asks about a NoBroker service.

Return ONLY a JSON array of FAQ objects matching this schema:
[
  {
    "id": number,
    "category": "string",
    "question": "string",
    "answer": "Specific 35-60 word answer that directly answers the question and reflects source consensus.",
    "confidence_score": number,
    "primary_source": "string (dominant consensus source used)",
    "supporting_sources": ["string (competitor/public/official sources cross-referenced)"],
    "last_updated": "2026-07-01",
    "citations": [ { "source_name": "string", "details": "string" } ]
  }
]`;

    const BATCH_SIZE = 5;
    const allFAQs = [];

    for (let i = 0; i < questions.length; i += BATCH_SIZE) {
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(questions.length / BATCH_SIZE);
      const batch = questions.slice(i, i + BATCH_SIZE);

      console.log(`⏳ Generating concise answers for batch ${batchNum}/${totalBatches}...`);
      const batchUser = `Project KB: ${JSON.stringify(projectKB)}
Questions to Answer: ${JSON.stringify(batch)}`;

      const batchResults = await callModel(agent5System, batchUser);
      allFAQs.push(...batchResults);
    }

    console.log('\n✨ Generated FAQs:\n');
    console.log(JSON.stringify(allFAQs, null, 2));
    console.log('\n✅ Done!');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

run();
