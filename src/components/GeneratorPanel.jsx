import React, { useState } from 'react'
import { scrapeUrl, scrapeReraData, generateQuestionDrafts } from '../utils/claude.js'
import styles from './GeneratorPanel.module.css'

const PRIORITY_OPTIONS = [
  { value: 'high', label: 'High', color: '#e05c5c' },
  { value: 'medium', label: 'Medium', color: '#d4903a' },
  { value: 'low', label: 'Low', color: '#8a8794' },
]

export function GeneratorPanel({ onQuestionsGenerated, onGenerating, onLog, onStepResult, onClear, phase }) {
  const [url, setUrl] = useState('')
  const count = 40
  const [priorities, setPriorities] = useState(['high', 'medium', 'low'])
  const [extraContext, setExtraContext] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const togglePriority = (val) => {
    setPriorities(prev =>
      prev.includes(val) ? prev.filter(p => p !== val) : [...prev, val]
    )
  }

  const addLog = (text, status = 'done') => {
    onLog(prev => [...prev, { text, status }])
  }

  const handleGenerate = async () => {
    if (!url.trim()) { setError('Please enter a project page URL.'); return }
    if (priorities.length === 0) { setError('Select at least one priority.'); return }

    setError('')
    setLoading(true)
    onGenerating(true)
    onLog([])
    onClear()

    try {
      addLog('Fetching project page…', 'active')
      const pageContent = await scrapeUrl(url.trim())

      if (pageContent) {
        onLog([{ text: 'Page content fetched successfully', status: 'done' }])
      } else {
        onLog([{ text: 'Could not scrape page — using AI knowledge', status: 'done' }])
      }

      addLog('Checking RERA portal for official data…', 'active')
      const reraData = await scrapeReraData(url.trim(), pageContent)

      if (reraData) {
        addLog('RERA data fetched — knowledge gaps will be filled', 'done')
      } else {
        addLog('RERA portal data not available — AI will flag gaps', 'done')
      }

      addLog('Orchestrating 40 search-optimized questions with Claude…', 'active')

      const { projectKB, questions } = await generateQuestionDrafts({
        url: url.trim(),
        pageContent,
        reraData,
        priorities,
        extraContext: extraContext.trim(),
        onLog: (text, status) => addLog(text, status),
        onStepResult
      })

      addLog('40 questions curated successfully!', 'done')

      const urlObj = (() => { try { return new URL(url.trim()) } catch { return null } })()
      const meta = {
        url: url.trim(),
        domain: urlObj?.hostname || url,
        count: questions.length,
        generatedAt: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
        priorities,
        extraContext: extraContext.trim(),
      }

      onQuestionsGenerated({ questions, projectKB, meta })
    } catch (err) {
      setError(err.message || "Something went wrong. Ensure 'npm run server' is running and ANTHROPIC_API_KEY is set in .env")
      addLog('Error: ' + (err.message || 'Unknown error'), 'error')
    } finally {
      setLoading(false)
      onGenerating(false)
    }
  }

  return (
    <div className={styles.panel}>
      <div className={styles.section}>
        <label className={styles.label}>
          <span className={styles.stepNum}>1</span>
          Project page URL
        </label>
        <input
          type="url"
          value={url}
          onChange={e => { setUrl(e.target.value); setError('') }}
          placeholder="https://www.nobroker.in/sobha-dream-acres..."
          disabled={loading}
          onKeyDown={e => e.key === 'Enter' && handleGenerate()}
          className={styles.urlInput}
        />
        <div className={styles.urlHints}>
          {['nobroker.in'].map(d => (
            <span key={d} className={styles.domainPill}>{d}</span>
          ))}
        </div>
      </div>

      <div className={styles.divider} />

      <div className={styles.section}>
        <label className={styles.label}>
          <span className={styles.stepNum}>2</span>
          FAQ Scale
          <span className={styles.countBadge}>40 FAQs</span>
        </label>
        <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.6', marginTop: '6px' }}>
          Strict distribution of exactly 10 questions per target category: <strong>About Project, Location, Pricing</strong>, and <strong>NoBroker Services</strong>.
        </div>
      </div>

      <div className={styles.divider} />

      <div className={styles.section}>
        <label className={styles.label}>
          <span className={styles.stepNum}>3</span>
          Priority focus
        </label>
        <div className={styles.priorityRow}>
          {PRIORITY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className={`${styles.priorityBtn} ${priorities.includes(opt.value) ? styles.priorityBtnOn : ''}`}
              style={{ '--p-color': opt.color }}
              onClick={() => togglePriority(opt.value)}
              disabled={loading}
            >
              <span className={styles.priorityDot} />
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.divider} />

      <div className={styles.section}>
        <label className={styles.label}>
          <span className={styles.stepNum}>4</span>
          Additional focus
          <span className={styles.optional}>optional</span>
        </label>
        <textarea
          value={extraContext}
          onChange={e => setExtraContext(e.target.value)}
          placeholder="E.g. focus on NRI buyers, highlight investment angle, address possession delays…"
          rows={3}
          disabled={loading}
          className={styles.textarea}
        />
      </div>

      {error && (
        <div className={styles.error}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="7" cy="7" r="6"/><path d="M7 4v3M7 10h.01"/>
          </svg>
          {error}
        </div>
      )}

      <button
        className={styles.generateBtn}
        onClick={handleGenerate}
        disabled={loading || !url.trim() || phase === 'questions' || phase === 'answers'}
      >
        {loading || phase === 'questions' || phase === 'answers' ? (
          <>
            <span className={styles.btnSpinner} />
            Orchestrating Questions…
          </>
        ) : (
          <>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M7.5 1v13M1 7.5h13" strokeLinecap="round"/>
            </svg>
            Orchestrate 40 Questions
          </>
        )}
      </button>

      <div className={styles.keyWarning}>
        Using Terminal Claude Access
      </div>
    </div>
  )
}
