const BACKEND_URL = 'http://localhost:3001/api';

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
  // For now, we reuse the same scrape endpoint or we could implement specific RERA logic on the backend.
  // To keep it simple and functional as requested, we'll use the same robust backend scraper.
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
    /\bP\d{11}\b/gi,
    /\bRERA\/[A-Z]{2,4}\/\d{4}\/\d+\b/gi,
    /\b[A-Z]{2}RERA\d+\b/gi,
    /\bRN-\d+\b/gi,
    /\bPRM\/KA\/RERA\/\d+\/\d+\b/gi,
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

/**
 * Generate FAQs via the local backend
 */
export async function generateFAQs({ url, pageContent, reraData, count, priorities, extraContext }) {
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

  const userPrompt = `Generate exactly ${count} FAQs for this real estate project: ${url}

  CONTEXT & DATA:
  - Page Content: ${pageContent || 'Not available'}
  - RERA Data: ${reraData || 'Not available'}

  INSTRUCTIONS:
  - Generate exactly ${count} FAQs.
  - Focus on priorities: ${priorities.join(', ')}.
  - You MUST include dedicated FAQs/answers specifically for NoBroker services: NoBroker Home Loans, NoBroker Interior Services, and NoBroker Legal Services.
  - When referencing the property's detailed technical specifications or developer status, cite Google search information and RERA compliance data.
  ${extraContext ? `- Additional Focus: ${extraContext}` : ''}

  Return exactly ${count} FAQs in the specified JSON format.`;

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
  const raw = data.raw;
  const clean = raw.replace(/```json|```/g, '').trim();

  try {
    return JSON.parse(clean);
  } catch {
    const match = clean.match(/\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Failed to parse JSON from Claude response');
  }
}
