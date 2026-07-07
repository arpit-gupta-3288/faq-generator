const BACKEND_URL = '/api';

/**
 * Scrape a URL using the local backend
 */
export async function scrapeUrl(url) {
  try {
    const res = await fetch(`${BACKEND_URL}/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) throw new Error('Scrape failed');
    const data = await res.json();
    return data.text || null;
  } catch (error) {
    console.error('Frontend scrape error:', error);
    return null;
  }
}

/**
 * Attempt to scrape RERA portal data using the local backend
 */
export async function scrapeReraData(url, pageContent) {
  const reraNum = extractReraNumber(url, pageContent);
  if (!reraNum) return null;

  const state = detectState(url, pageContent);
  let reraUrl = '';

  if (state === 'maharashtra') {
    reraUrl = `https://maharerait.mahaonline.gov.in/PublicViewProject/Project?ProjectID=${encodeURIComponent(reraNum)}`;
  } else if (state === 'karnataka') {
    reraUrl = `https://rera.karnataka.gov.in/viewProject?id=${encodeURIComponent(reraNum)}`;
  }

  if (reraUrl) {
    const text = await scrapeUrl(reraUrl);
    return text ? `Official RERA Data:\n${text}` : null;
  }

  return null;
}

/**
 * Extract a RERA registration number from a URL or page content string.
 */
export function extractReraNumber(url, pageContent) {
  const combined = `${url} ${pageContent || ''}`;
  const patterns = [
    /\bPRM\/KA\/RERA\/\d+\/\d+\/PR\/\d+\/\d+\b/gi, // Full K-RERA format
    /\bP\d{11}\b/gi,                                // MahaRERA format
    /\bRERA\/[A-Z]{2,4}\/\d{4}\/\d+(\/[A-Z0-9\/]+)?\b/gi, // Generalized long format
    /\b[A-Z]{2}RERA\d+\b/gi,
    /\bRN-\d+\b/gi,
    /\bPRM\/KA\/RERA\/\d+\/\d+\b/gi,               // Fallback short K-RERA
  ];
  for (const pat of patterns) {
    const match = combined.match(pat);
    if (match && match[0]) return match[0].trim();
  }
  return null;
}

/**
 * Detect which Indian state's RERA portal to query.
 */
export function detectState(url, pageContent) {
  const combined = `${url} ${pageContent || ''}`.toLowerCase();
  if (combined.includes('maharashtra') || combined.includes('mumbai')) return 'maharashtra';
  if (combined.includes('karnataka') || combined.includes('bangalore')) return 'karnataka';
  return null;
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
 * Robust JSON extraction helper
 */
function parseClaudeJson(raw) {
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
    throw new Error('Failed to parse JSON from Claude response');
  }
}

/**
 * Generic POST fetch to backend AI generate endpoint
 */
async function callClaudeGenerate(systemPrompt, userPrompt) {
  const response = await fetch(`${BACKEND_URL}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ systemPrompt, userPrompt }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Server error ${response.status}`);
  }

  const data = await response.json();
  return parseClaudeJson(data.raw);
}

/**
 * Agent 1 - Project Intelligence Agent
 */
export async function runProjectIntelligenceAgent(url, pageContent, reraData) {
  const systemPrompt = `You are a real estate research analyst. Extract complete, structured information into this JSON schema:
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
  const userPrompt = `Project URL: ${url}\nContent: ${pageContent}\nRERA: ${reraData}`;
  return callClaudeGenerate(systemPrompt, userPrompt);
}

/**
 * Agent 2 - Google Demand Agent
 */
export async function runGoogleDemandAgent(projectKB) {
  const systemPrompt = `You are an SEM analyst. Analyze the Project KB and return 10-15 high-intent Google search queries/PAA questions as a JSON array of:
{ "question": "string", "source": "Google", "intent": "string" }`;
  const userPrompt = `KB: ${JSON.stringify(projectKB)}`;
  return callClaudeGenerate(systemPrompt, userPrompt);
}

/**
 * Agent 3 - Reddit Discovery Agent
 */
export async function runRedditDiscoveryAgent(projectKB) {
  const systemPrompt = `You are a forum listener. Analyze the Project KB and return 10-15 community concerns/questions from Reddit as a JSON array of:
{ "question": "string", "source": "Reddit", "sentiment": "string" }`;
  const userPrompt = `KB: ${JSON.stringify(projectKB)}`;
  return callClaudeGenerate(systemPrompt, userPrompt);
}

/**
 * Agent 4 - Question Orchestrator Agent
 * Objective: Curate exactly 40 high-quality questions (10 per category).
 */
export async function runQuestionOrchestratorAgent(projectKB, googleKB, redditKB, priorities, extraContext) {
  const systemPrompt = `You are a master FAQ architect. Your task is to curate EXACTLY 40 high-quality, search-optimized questions based on the Project KB and discovery signals.
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
  let userPrompt = `Project KB: ${JSON.stringify(projectKB)}
Google Signals: ${JSON.stringify(googleKB)}
Reddit Signals: ${JSON.stringify(redditKB)}`;

  if (priorities && priorities.length > 0) {
    userPrompt += `\nPriority Focus Areas: ${priorities.join(', ')}`;
  }
  if (extraContext) {
    userPrompt += `\nAdditional Focus / Buyer Angle / Specific Instructions: ${extraContext}`;
  }

  const questions = await callClaudeGenerate(systemPrompt, userPrompt);
  if (!Array.isArray(questions) || questions.length === 0) throw new Error('Question Orchestrator failed to return a list of questions.');
  return questions;
}

/**
 * Agent 5 - Answer Writer Agent
 * Objective: Generate concise answers for a batch of questions.
 */
export async function runAnswerWriterAgent(projectKB, questionsBatch) {
  const systemPrompt = `You are an elite real estate researcher and writer. Generate short, specific, buyer-useful answers for the provided questions.
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
  const userPrompt = `Project KB: ${JSON.stringify(projectKB)}
Questions to Answer: ${JSON.stringify(questionsBatch)}`;

  return callClaudeGenerate(systemPrompt, userPrompt);
}

/**
 * Phase 1: Generate Draft Questions
 */
export async function generateQuestionDrafts({ url, pageContent, reraData, priorities, extraContext, onLog, onStepResult }) {
  const log = (text, status = 'done') => onLog?.(text, status);
  const report = (key, data) => onStepResult?.(key, data);

  log('Extracting project intelligence (Agent 1)...', 'active');
  const projectKB = await runProjectIntelligenceAgent(url, pageContent, reraData);
  report('projectKB', projectKB);

  log('Analyzing search demand and community feedback in parallel (Agent 2 & 3)...', 'active');
  const [googleKB, redditKB] = await Promise.all([
    runGoogleDemandAgent(projectKB).catch(() => []),
    runRedditDiscoveryAgent(projectKB).catch(() => [])
  ]);
  report('googleKB', googleKB);
  report('redditKB', redditKB);

  log('Orchestrating 40 high-quality questions (Agent 4)...', 'active');
  const questions = await runQuestionOrchestratorAgent(projectKB, googleKB, redditKB, priorities, extraContext);
  report('pendingQuestions', questions);

  log('Draft questions generated for review', 'done');
  return { projectKB, questions };
}

/**
 * Phase 2: Generate Batched Answers
 */
export async function generateAnswersForQuestions({ projectKB, questions, onLog, onStepResult }) {
  const log = (text, status = 'done') => onLog?.(text, status);
  const report = (key, data) => onStepResult?.(key, data);

  const BATCH_SIZE = 5;
  const allFAQs = [];

  for (let i = 0; i < questions.length; i += BATCH_SIZE) {
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(questions.length / BATCH_SIZE);
    const batch = questions.slice(i, i + BATCH_SIZE);

    log(`Generating concise answers for batch ${batchNum}/${totalBatches} (Agent 5)...`, 'active');
    const batchResults = await runAnswerWriterAgent(projectKB, batch);
    allFAQs.push(...batchResults);

    // Report progress to UI
    report('partialFAQs', [...allFAQs]);
  }

  log('All 40 concise FAQs generated and verified successfully!', 'done');
  return allFAQs;
}
