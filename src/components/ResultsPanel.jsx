import React, { useState, useMemo } from 'react'
import styles from './ResultsPanel.module.css'

const STANDARD_CATEGORIES = [
  'About Project',
  'Location & Connectivity',
  'Pricing & Buying',
  'NoBroker Services',
]

export function ResultsPanel({ faqs, meta, isPartial, results }) {
  const data = useMemo(() => Array.isArray(faqs) ? faqs : [], [faqs])
  const metadata = useMemo(() => meta || {}, [meta])
  const intel = useMemo(() => results || {}, [results])

  const [tab, setTab] = useState('workspace')
  const [activeCategory, setActiveCategory] = useState('About Project')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState(new Set())
  const [copied, setCopied] = useState(false)
  const [copiedSchema, setCopiedSchema] = useState(false)

  const schemaScript = useMemo(() => {
    const schemaJson = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": data.map(f => ({
        "@type": "Question",
        "name": f.question,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": f.answer
        }
      }))
    }
    return `<script type="application/ld+json">\n${JSON.stringify(schemaJson, null, 2)}\n</script>`
  }, [data])

  const categoryCounts = useMemo(() => {
    const counts = {}
    STANDARD_CATEGORIES.forEach(cat => {
      counts[cat] = data.filter(f => f.category === cat).length
    })
    return counts
  }, [data])

  const filtered = useMemo(() => {
    return data.filter(f => {
      const matchCategory = f.category === activeCategory
      const matchSearch = !search ||
        (f.question || '').toLowerCase().includes(search.toLowerCase()) ||
        (f.answer || '').toLowerCase().includes(search.toLowerCase())
      return matchCategory && matchSearch
    })
  }, [data, activeCategory, search])

  const stats = useMemo(() => {
    const validScores = data.map(f => parseInt(f.confidence_score) || 90)
    const avgConfidence = validScores.length > 0
      ? Math.round(validScores.reduce((acc, score) => acc + score, 0) / validScores.length)
      : 90

    return {
      total: data.length,
      avgConfidence,
      withWarnings: data.filter(f => (parseInt(f.confidence_score) || 90) < 90).length,
      categories: [...new Set(data.map(f => f.category))].length,
    }
  }, [data])

  const toggleExpand = (id) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const expandAll = () => {
    const categoryFaqIds = data.filter(f => f.category === activeCategory).map(f => f.id)
    setExpanded(prev => {
      const next = new Set(prev)
      categoryFaqIds.forEach(id => next.add(id))
      return next
    })
  }

  const collapseAll = () => {
    const categoryFaqIds = data.filter(f => f.category === activeCategory).map(f => f.id)
    setExpanded(prev => {
      const next = new Set(prev)
      categoryFaqIds.forEach(id => next.delete(id))
      return next
    })
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    const slug = metadata?.domain?.replace(/\./g, '-') || 'project'
    a.download = `faqs-${slug}-${Date.now()}.json`
    a.click()
  }

  const handleCopySchema = () => {
    navigator.clipboard.writeText(schemaScript)
    setCopiedSchema(true)
    setTimeout(() => setCopiedSchema(false), 2000)
  }

  return (
    <div className={styles.panel}>
      {/* Meta Header */}
      <div className={styles.metaBar}>
        <div className={styles.metaLeft}>
          <div className={styles.metaUrl}>{metadata?.url || 'Project Generation'}</div>
          <div className={styles.metaTime}>Generated {metadata?.generatedAt}</div>
        </div>
        <div className={styles.metaActions}>
          <button className={styles.actionBtn} onClick={handleCopy}>
            {copied ? (
              <><CheckIcon /> Copied</>
            ) : (
              <><CopyIcon /> Copy JSON</>
            )}
          </button>
          <button className={styles.actionBtn} onClick={handleDownload}>
            <DownloadIcon /> Download
          </button>
        </div>
      </div>

      {/* Stats Summary Bar */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className={styles.statVal}>{stats.total}</span>
            {isPartial && <div className={styles.partialSpinner} />}
          </div>
          <span className={styles.statLabel}>{isPartial ? 'FAQs Curated' : 'Total FAQs'}</span>
        </div>
        <div className={styles.statCard}>
          <span
            className={styles.statVal}
            style={{ color: stats.avgConfidence >= 90 ? '#2e7d32' : '#d4903a' }}
          >
            {isPartial ? '--' : `${stats.avgConfidence}%`}
          </span>
          <span className={styles.statLabel}>Avg Confidence</span>
        </div>
        <div className={styles.statCard}>
          <span
            className={styles.statVal}
            style={{ color: stats.withWarnings > 0 ? '#d4903a' : 'var(--text-secondary)' }}
          >
            {isPartial ? '--' : stats.withWarnings}
          </span>
          <span className={styles.statLabel}>Source Mismatches</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statVal}>{stats.categories}</span>
          <span className={styles.statLabel}>Active Categories</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className={styles.tabBar}>
        <button
          className={`${styles.tab} ${tab === 'workspace' ? styles.tabActive : ''}`}
          onClick={() => setTab('workspace')}
        >
          FAQ Workspace
        </button>
        <button
          className={`${styles.tab} ${tab === 'intelligence' ? styles.tabActive : ''}`}
          onClick={() => setTab('intelligence')}
        >
          Research Intelligence
        </button>
        <button
          className={`${styles.tab} ${tab === 'json' ? styles.tabActive : ''}`}
          onClick={() => setTab('json')}
        >
          JSON Output
        </button>
        <button
          className={`${styles.tab} ${tab === 'seo' ? styles.tabActive : ''}`}
          onClick={() => setTab('seo')}
        >
          SEO Schema
        </button>
      </div>

      {/* Research Intelligence View */}
      {tab === 'intelligence' && (
        <IntelligenceView intel={intel} />
      )}

      {/* Workspace View */}
      {tab === 'workspace' && (
        <div className={styles.workspace}>
          {/* Left Sidebar - Categories */}
          <div className={styles.sidebar}>
            <div className={styles.sidebarTitle}>Categories</div>
            {STANDARD_CATEGORIES.map(cat => {
              const isActive = activeCategory === cat
              const count = categoryCounts[cat] || 0
              return (
                <button
                  key={cat}
                  className={`${styles.sidebarItem} ${isActive ? styles.sidebarItemActive : ''}`}
                  onClick={() => {
                    setActiveCategory(cat)
                    setSearch('') // Reset search on category change
                  }}
                >
                  <span className={styles.categoryLabel}>{cat}</span>
                  <span className={styles.categoryCount}>{count}</span>
                </button>
              )
            })}
          </div>

          {/* Right Main Panel - FAQs */}
          <div className={styles.mainContent}>
            <div className={styles.categoryHeader}>
              <h2 className={styles.categoryTitle}>{activeCategory}</h2>
              <div className={styles.toolbarRight}>
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={`Search ${activeCategory}…`}
                  className={styles.searchInput}
                />
                <button className={styles.iconBtn} onClick={expandAll} title="Expand all current">↕</button>
                <button className={styles.iconBtn} onClick={collapseAll} title="Collapse all current">↔</button>
              </div>
            </div>

            <div className={styles.faqsList}>
              {filtered.map(faq => (
                <FAQCard
                  key={faq.id}
                  faq={faq}
                  expanded={expanded.has(faq.id)}
                  onToggle={() => toggleExpand(faq.id)}
                />
              ))}

              {filtered.length === 0 && (
                <div className={styles.noResults}>
                  {search ? 'No FAQs match your search query.' : `No FAQs generated under the "${activeCategory}" category.`}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Raw JSON View */}
      {tab === 'json' && (
        <div className={styles.jsonView}>
          <pre className={styles.jsonBlock}>{JSON.stringify(faqs, null, 2)}</pre>
        </div>
      )}

      {/* SEO LD+JSON View */}
      {tab === 'seo' && (
        <div className={styles.seoView}>
          <div className={styles.seoHeader}>
            <div className={styles.seoTitle}>Google Search FAQ Schema Markup</div>
            <p className={styles.seoDesc}>
              Copy the JSON-LD script below and paste it directly into the <code>&lt;head&gt;</code> of your HTML project page. This enables search engines like Google to index your FAQs and display rich snippets directly on search results!
            </p>
            <button className={styles.copySchemaBtn} onClick={handleCopySchema}>
              {copiedSchema ? (
                <>
                  <CheckIcon /> Copied Script Tag!
                </>
              ) : (
                <>
                  <CopyIcon /> Copy Script Tag
                </>
              )}
            </button>
          </div>
          <pre className={styles.jsonBlock}>{schemaScript}</pre>
        </div>
      )}
    </div>
  )
}

function FAQCard({ faq, expanded, onToggle }) {
  const [showCitations, setShowCitations] = useState(false)

  // Color-coded mapping based on verification confidence
  const scoreVal = parseInt(faq.confidence_score) || 90
  const isHigh = scoreVal >= 90
  const isMedium = scoreVal >= 75

  const scoreColor = isHigh ? '#2e7d32' : isMedium ? '#d4903a' : '#e05c5c'
  const scoreBg = isHigh ? 'rgba(46,125,50,0.08)' : isMedium ? 'rgba(212,144,58,0.08)' : 'rgba(224,92,92,0.08)'

  return (
    <div className={styles.faqCard}>
      {/* FAQ Header Clickable */}
      <div className={styles.faqHeader} onClick={onToggle}>
        <div className={styles.faqQ}>{faq.question}</div>
        <div className={styles.faqMeta}>
          <span
            className={styles.confidenceBadge}
            style={{ background: scoreBg, border: `1px solid ${scoreColor}30`, color: scoreColor }}
          >
            {scoreVal}% Confidence
          </span>
          <span className={`${styles.chevron} ${expanded ? styles.chevronOpen : ''}`}>
            <ChevronIcon />
          </span>
        </div>
      </div>

      {/* FAQ Body Expanded */}
      {expanded && (
        <div className={styles.faqBody}>
          <p className={styles.faqAnswer}>{faq.answer}</p>

          {/* Metadata Row */}
          <div className={styles.faqMetadataRow}>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Last Updated:</span>
              <span className={styles.metaVal}>{faq.last_updated || '2026-06-27'}</span>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Primary:</span>
              <span className={styles.primarySourceBadge}>{faq.primary_source || 'NoBroker Listing'}</span>
            </div>
            {faq.supporting_sources && faq.supporting_sources.length > 0 && (
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Supporting:</span>
                <div className={styles.sourcesPills}>
                  {faq.supporting_sources.map(src => (
                    <span key={src} className={styles.sourcePill}>{src}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Citation Panel */}
          {faq.citations && faq.citations.length > 0 && (
            <div className={styles.citationsSection}>
              <button
                className={styles.citationToggleBtn}
                onClick={(e) => {
                  e.stopPropagation()
                  setShowCitations(!showCitations)
                }}
              >
                {showCitations ? 'Hide Sources ▲' : 'Show Sources ▼'}
              </button>

              {showCitations && (
                <div className={styles.citationsContent}>
                  <div className={styles.citationsTitle}>Data Source Citations</div>
                  <ul className={styles.citationsList}>
                    {faq.citations.map((cit, idx) => (
                      <li key={idx} className={styles.citationItem}>
                        <span className={styles.citationSourceName}>{cit.source_name}:</span>{' '}
                        <span className={styles.citationDetails}>{cit.details}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Validation Warning Alert Callout */}
                  {scoreVal < 90 && (
                    <div className={styles.validationCallout}>
                      <span className={styles.validationIcon}>⚠</span>
                      <div className={styles.validationText}>
                        <strong>Validation Layer Alert:</strong> Discrepancies, varying possession dates, or critical data gaps were flagged across sources for this inquiry. Verify with official RERA portals before booking.
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ChevronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 5l4 4 4-4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="4" y="4" width="8" height="8" rx="1.5"/>
      <path d="M9 4V2.5A1.5 1.5 0 007.5 1h-5A1.5 1.5 0 001 2.5v5A1.5 1.5 0 002.5 9H4"/>
    </svg>
  )
}
function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 7l3.5 3.5L11 3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function DownloadIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M6.5 1v8M3 6l3.5 3.5L10 6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M1 11h11" strokeLinecap="round"/>
    </svg>
  )
}

/**
 * Intelligence Workspace View
 */
function IntelligenceView({ intel }) {
  const { projectKB, googleKB, redditKB } = intel

  return (
    <div className={styles.intelWorkspace}>
      <div className={styles.intelHeader}>
        <h2 className={styles.intelTitle}>Research Synthesis Overview</h2>
        <p className={styles.intelDesc}>
          Agent 4 curated exactly 40 high-quality questions by synthesizing foundational project facts (Agent 1) with real-world search intent (Agent 2) and community sentiment (Agent 3).
        </p>
      </div>

      <div className={styles.intelGrid}>
        {/* Project Knowledge Base */}
        <section className={styles.intelSection}>
          <div className={styles.sectionTag}>Agent 1: Extraction Foundation</div>
          <ProjectKBView kb={projectKB} />
        </section>

        {/* Discovery Signals */}
        <section className={styles.intelSection}>
          <div className={styles.sectionTag}>Agents 2 & 3: Discovery Signals</div>
          <DiscoverySignalsView google={googleKB} reddit={redditKB} />
        </section>
      </div>
    </div>
  )
}

function ProjectKBView({ kb }) {
  if (!kb) return <div className={styles.emptyIntel}>Waiting for project intelligence...</div>

  return (
    <div className={styles.kbCard}>
      <div className={styles.kbHeader}>
        <div className={styles.kbProjectName}>{kb.project_name || 'Project Name Not Extracted'}</div>
        <div className={styles.kbBuilder}>by {kb.builder || 'Builder Unknown'}</div>
      </div>

      <div className={styles.kbInfoGrid}>
        <div className={styles.kbInfoItem}>
          <span className={styles.kbLabel}>Location</span>
          <span className={styles.kbVal}>{kb.location}</span>
        </div>
        <div className={styles.kbInfoItem}>
          <span className={styles.kbLabel}>Pricing</span>
          <span className={styles.kbVal}>{kb.price}</span>
        </div>
        <div className={styles.kbInfoItem}>
          <span className={styles.kbLabel}>Status</span>
          <span className={styles.kbVal}>{kb.construction_status} ({kb.possession_date})</span>
        </div>
        <div className={styles.kbInfoItem}>
          <span className={styles.kbLabel}>RERA Number</span>
          <span className={styles.kbVal}>{kb.rera_number} ({kb.rera_status})</span>
        </div>
      </div>

      <div className={styles.kbArrays}>
        <div className={styles.kbArrayGroup}>
          <div className={styles.kbLabel}>Key Amenities</div>
          <div className={styles.kbPills}>
            {(kb.amenities || []).slice(0, 12).map(a => <span key={a} className={styles.kbPill}>{a}</span>)}
            {(kb.amenities || []).length > 12 && <span className={styles.kbPillMore}>+{(kb.amenities || []).length - 12} more</span>}
          </div>
        </div>
        <div className={styles.kbArrayGroup}>
          <div className={styles.kbLabel}>Project Highlights</div>
          <ul className={styles.kbList}>
            {(kb.highlights || []).map((h, i) => <li key={i}>{h}</li>)}
          </ul>
        </div>
      </div>
    </div>
  )
}

function DiscoverySignalsView({ google, reddit }) {
  const gData = Array.isArray(google) ? google : []
  const rData = Array.isArray(reddit) ? reddit : []

  return (
    <div className={styles.signalsSplit}>
      {/* Google Signals */}
      <div className={styles.signalColumn}>
        <div className={styles.signalColHeader}>
          <span>Google Demand Signals</span>
          <span className={styles.sourceTag}>Agent 2</span>
        </div>
        <div className={styles.signalList}>
          {gData.map((q, i) => (
            <div key={i} className={styles.signalItem}>
              <div className={styles.signalQ}>{q.question}</div>
              <div className={styles.signalMeta}>
                <span className={styles.intentBadge} data-intent={q.intent}>{q.intent}</span>
                <span className={styles.freqBadge}>Freq: {q.frequency || 'medium'}</span>
              </div>
            </div>
          ))}
          {gData.length === 0 && <div className={styles.emptyIntel}>Analyzing Google search trends...</div>}
        </div>
      </div>

      {/* Reddit Signals */}
      <div className={styles.signalColumn}>
        <div className={styles.signalColHeader}>
          <span>Community Feedback (Reddit)</span>
          <span className={styles.sourceTag}>Agent 3</span>
        </div>
        <div className={styles.signalList}>
          {rData.map((q, i) => (
            <div key={i} className={styles.signalItem}>
              <div className={styles.signalQ}>{q.question}</div>
              <div className={styles.signalMeta}>
                <span className={styles.sentimentBadge} data-sent={q.sentiment}>{q.sentiment}</span>
                <span className={styles.freqBadge}>Mentions: {q.mentions || 'medium'}</span>
              </div>
            </div>
          ))}
          {rData.length === 0 && <div className={styles.emptyIntel}>Scouring community forums...</div>}
        </div>
      </div>
    </div>
  )
}
