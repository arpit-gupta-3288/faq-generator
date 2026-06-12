import React, { useState, useMemo } from 'react'
import styles from './ResultsPanel.module.css'

const PRIORITY_COLORS = {
  high:   { bg: 'var(--red-dim)',   border: 'rgba(224,92,92,0.25)',   text: 'var(--red)' },
  medium: { bg: 'var(--amber-dim)', border: 'rgba(212,144,58,0.25)',  text: 'var(--amber)' },
  low:    { bg: 'rgba(138,135,148,0.12)', border: 'rgba(138,135,148,0.2)', text: 'var(--text-secondary)' },
}

export function ResultsPanel({ faqs, meta }) {
  const [tab, setTab] = useState('cards')
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState(new Set())
  const [copied, setCopied] = useState(false)

  const categories = useMemo(() => [...new Set(faqs.map(f => f.category))], [faqs])

  const filtered = useMemo(() => {
    return faqs.filter(f => {
      const matchPriority = filter === 'all' || f.priority === filter || filter === f.category
      const matchSearch = !search || f.question.toLowerCase().includes(search.toLowerCase()) || f.answer.toLowerCase().includes(search.toLowerCase())
      return matchPriority && matchSearch
    })
  }, [faqs, filter, search])

  const stats = useMemo(() => ({
    total: faqs.length,
    high: faqs.filter(f => f.priority === 'high').length,
    medium: faqs.filter(f => f.priority === 'medium').length,
    low: faqs.filter(f => f.priority === 'low').length,
    withGaps: faqs.filter(f => f.data_gaps?.length > 0).length,
    categories: [...new Set(faqs.map(f => f.category))].length,
  }), [faqs])

  const toggleExpand = (id) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const expandAll = () => setExpanded(new Set(faqs.map(f => f.id)))
  const collapseAll = () => setExpanded(new Set())

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(faqs, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(faqs, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    const slug = meta?.domain?.replace(/\./g, '-') || 'project'
    a.download = `faqs-${slug}-${Date.now()}.json`
    a.click()
  }

  const filterOptions = [
    { value: 'all', label: 'All', count: faqs.length },
    { value: 'high', label: 'High', count: stats.high },
    { value: 'medium', label: 'Medium', count: stats.medium },
    { value: 'low', label: 'Low', count: stats.low },
  ]

  return (
    <div className={styles.panel}>
      <div className={styles.metaBar}>
        <div className={styles.metaLeft}>
          <div className={styles.metaUrl}>{meta?.domain}</div>
          <div className={styles.metaTime}>Generated {meta?.generatedAt}</div>
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

      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <span className={styles.statVal}>{stats.total}</span>
          <span className={styles.statLabel}>Total FAQs</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statVal} style={{ color: 'var(--red)' }}>{stats.high}</span>
          <span className={styles.statLabel}>High priority</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statVal} style={{ color: 'var(--amber)' }}>{stats.medium}</span>
          <span className={styles.statLabel}>Medium</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statVal}>{stats.categories}</span>
          <span className={styles.statLabel}>Categories</span>
        </div>
        {stats.withGaps > 0 && (
          <div className={styles.statCard}>
            <span className={styles.statVal} style={{ color: 'var(--amber)' }}>{stats.withGaps}</span>
            <span className={styles.statLabel}>Data gaps</span>
          </div>
        )}
      </div>

      <div className={styles.tabBar}>
        <button className={`${styles.tab} ${tab === 'cards' ? styles.tabActive : ''}`} onClick={() => setTab('cards')}>
          FAQ cards
        </button>
        <button className={`${styles.tab} ${tab === 'json' ? styles.tabActive : ''}`} onClick={() => setTab('json')}>
          JSON output
        </button>
      </div>

      {tab === 'cards' && (
        <div className={styles.cardsView}>
          <div className={styles.toolbar}>
            <div className={styles.filterPills}>
              {filterOptions.map(opt => (
                <button
                  key={opt.value}
                  className={`${styles.filterPill} ${filter === opt.value ? styles.filterPillActive : ''}`}
                  onClick={() => setFilter(opt.value)}
                >
                  {opt.label}
                  <span className={styles.filterCount}>{opt.count}</span>
                </button>
              ))}
            </div>
            <div className={styles.toolbarRight}>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search FAQs…"
                className={styles.searchInput}
              />
              <button className={styles.iconBtn} onClick={expandAll} title="Expand all">↕</button>
              <button className={styles.iconBtn} onClick={collapseAll} title="Collapse all">↔</button>
            </div>
          </div>

          {categories.map(cat => {
            const catFaqs = filtered.filter(f => f.category === cat)
            if (!catFaqs.length) return null
            return (
              <div key={cat} className={styles.category}>
                <div className={styles.catHeader}>{cat}</div>
                {catFaqs.map(faq => (
                  <FAQCard
                    key={faq.id}
                    faq={faq}
                    expanded={expanded.has(faq.id)}
                    onToggle={() => toggleExpand(faq.id)}
                  />
                ))}
              </div>
            )
          })}

          {filtered.length === 0 && (
            <div className={styles.noResults}>No FAQs match your filter or search.</div>
          )}
        </div>
      )}

      {tab === 'json' && (
        <div className={styles.jsonView}>
          <pre className={styles.jsonBlock}>{JSON.stringify(faqs, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}

function FAQCard({ faq, expanded, onToggle }) {
  const pc = PRIORITY_COLORS[faq.priority] || PRIORITY_COLORS.low
  const hasGaps = faq.data_gaps?.length > 0

  return (
    <div className={styles.faqCard}>
      <div className={styles.faqHeader} onClick={onToggle}>
        <div className={styles.faqQ}>{faq.question}</div>
        <div className={styles.faqMeta}>
          <span className={styles.priorityBadge} style={{ background: pc.bg, border: `1px solid ${pc.border}`, color: pc.text }}>
            {faq.priority}
          </span>
          {hasGaps && (
            <span className={styles.gapBadge}>
              {faq.data_gaps.length} gap{faq.data_gaps.length > 1 ? 's' : ''}
            </span>
          )}
          <span className={`${styles.chevron} ${expanded ? styles.chevronOpen : ''}`}>
            <ChevronIcon />
          </span>
        </div>
      </div>

      {expanded && (
        <div className={styles.faqBody}>
          <p className={styles.faqAnswer}>{faq.answer}</p>
          <div className={styles.faqFooter}>
            <div className={styles.sources}>
              {(faq.sources || []).map(s => (
                <span key={s} className={styles.sourcePill}>{s}</span>
              ))}
            </div>
            {hasGaps && (
              <div className={styles.gapList}>
                <span className={styles.gapIcon}>⚠</span>
                Data gaps: {faq.data_gaps.join(', ')}
              </div>
            )}
          </div>
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
