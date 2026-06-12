import React, { useState } from 'react'
import { GeneratorPanel } from './components/GeneratorPanel.jsx'
import { ResultsPanel } from './components/ResultsPanel.jsx'
import styles from './styles/App.module.css'

export default function App() {
  const [faqs, setFaqs] = useState([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationLog, setGenerationLog] = useState([])
  const [projectMeta, setProjectMeta] = useState(null)

  const handleGenerated = (data) => {
    setFaqs(data.faqs)
    setProjectMeta(data.meta)
  }

  const handleClear = () => {
    setFaqs([])
    setProjectMeta(null)
    setGenerationLog([])
  }

  return (
    <div className={styles.root}>
      <div className={styles.noise} />
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.logo}>
            <div className={styles.logoMark}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="1" y="1" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.9"/>
                <rect x="10" y="1" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.5"/>
                <rect x="1" y="10" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.5"/>
                <rect x="10" y="10" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.9"/>
              </svg>
            </div>
            <span className={styles.logoText}>FAQ<span className={styles.logoAccent}>gen</span></span>
          </div>
          <div className={styles.headerRight}>
            <span className={styles.poweredBy}>powered by Claude</span>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.hero}>
          <h1 className={styles.heroTitle}>
            Generate buyer FAQs<br />
            <em>from any project page</em>
          </h1>
          <p className={styles.heroSub}>
            Paste a NoBroker project URL — get research-grade, SEO-optimised FAQs in seconds.
          </p>
        </div>

        <div className={styles.layout}>
          <div className={styles.left}>
            <GeneratorPanel
              onGenerated={handleGenerated}
              onGenerating={setIsGenerating}
              onLog={setGenerationLog}
              onClear={handleClear}
              hasResults={faqs.length > 0}
            />
          </div>
          <div className={styles.right}>
            {faqs.length > 0 ? (
              <ResultsPanel faqs={faqs} meta={projectMeta} />
            ) : (
              <EmptyState isGenerating={isGenerating} log={generationLog} />
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

function EmptyState({ isGenerating, log }) {
  if (isGenerating) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.generatingWrap}>
          <div className={styles.spinnerRing} />
          <div className={styles.generatingLog}>
            {log.map((entry, i) => (
              <div key={i} className={styles.logEntry} style={{ animationDelay: `${i * 0.1}s` }}>
                <span className={styles.logDot} data-status={entry.status} />
                <span>{entry.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.emptyState}>
      <div className={styles.emptyGrid}>
        {[...Array(6)].map((_, i) => (
          <div key={i} className={styles.emptyCard} style={{ opacity: 1 - i * 0.12 }}>
            <div className={styles.emptyCardLine} style={{ width: `${70 + Math.random() * 30}%` }} />
            <div className={styles.emptyCardLine} style={{ width: '90%', height: 8, marginTop: 8 }} />
            <div className={styles.emptyCardLine} style={{ width: '75%', height: 8, marginTop: 4 }} />
          </div>
        ))}
      </div>
      <p className={styles.emptyLabel}>Your FAQs will appear here</p>
    </div>
  )
}
