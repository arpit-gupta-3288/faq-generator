import React, { useState, useMemo } from 'react'
import { GeneratorPanel } from './components/GeneratorPanel.jsx'
import { ResultsPanel } from './components/ResultsPanel.jsx'
import { generateAnswersForQuestions } from './utils/claude.js'
import styles from './styles/App.module.css'

export default function App() {
  const [faqs, setFaqs] = useState([])
  const [phase, setPhase] = useState('idle') // 'idle', 'questions', 'review', 'answers', 'done'
  const [generationLog, setGenerationLog] = useState([])
  const [stepResults, setStepResults] = useState({})
  const [projectMeta, setProjectMeta] = useState(null)
  const [pendingQuestions, setPendingQuestions] = useState([])
  const [currentProjectKB, setCurrentProjectKB] = useState(null)

  const handlePhaseChange = (newPhase) => setPhase(newPhase)

  const handleQuestionsGenerated = (data) => {
    setPendingQuestions(data.questions)
    setCurrentProjectKB(data.projectKB)
    setProjectMeta(data.meta)
    setPhase('review')
  }

  const handleGenerateAnswers = async () => {
    setPhase('answers')
    try {
      const finalFAQs = await generateAnswersForQuestions({
        projectKB: currentProjectKB,
        questions: pendingQuestions,
        onLog: (text, status) => setGenerationLog(prev => [...prev, { text, status }]),
        onStepResult: (key, data) => {
          if (key === 'partialFAQs') setFaqs(data)
        }
      })
      setFaqs(finalFAQs)
      setPhase('done')
    } catch (error) {
      console.error('Answer generation failed:', error)
      setPhase('review')
      setGenerationLog(prev => [...prev, { text: `Error: ${error.message}`, status: 'error' }])
    }
  }

  const handleClear = () => {
    setFaqs([])
    setPhase('idle')
    setProjectMeta(null)
    setGenerationLog([])
    setStepResults({})
    setPendingQuestions([])
    setCurrentProjectKB(null)
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
            {faqs.length > 0 && (
              <button className={styles.newBtn} onClick={handleClear}>+ New Search</button>
            )}
            <span className={styles.poweredBy}>powered by Claude</span>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.hero}>
          <h1 className={styles.heroTitle}>
            Generate 40 buyer FAQs<br />
            <em>from any project page</em>
          </h1>
          <p className={styles.heroSub}>
            Paste a NoBroker project URL — orchestrate 10 questions per category with Agent 4, then generate concise answers in batches.
          </p>
        </div>

        <div className={`${styles.layout} ${faqs.length > 0 ? styles.layoutResults : ''}`}>
          <div className={styles.left}>
            <GeneratorPanel
              onQuestionsGenerated={handleQuestionsGenerated}
              onGenerating={(isGenerating) => isGenerating && setPhase('questions')}
              onLog={(text, status) => setGenerationLog(prev => [...prev, { text, status }])}
              onStepResult={(key, data) => {
                setStepResults(prev => ({ ...prev, [key]: data }))
                // Sync FAQs if we get partial ones
                if (key === 'partialFAQs') setFaqs(data)
              }}
              onClear={handleClear}
              phase={phase}
            />
          </div>
          <div className={styles.right}>
            {/* Show ResultsPanel if we have any FAQs, even during generation */}
            {faqs.length > 0 ? (
              <ResultsPanel
                faqs={faqs}
                meta={projectMeta}
                isPartial={phase === 'answers'}
                results={stepResults}
              />
            ) : phase === 'review' ? (
              <QuestionReview
                questions={pendingQuestions}
                onConfirm={handleGenerateAnswers}
                onCancel={handleClear}
              />
            ) : (
              <PipelineProgress phase={phase} log={generationLog} results={stepResults} />
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

function QuestionReview({ questions, onConfirm, onCancel }) {
  const data = Array.isArray(questions) ? questions : []
  const categories = ['About Project', 'Location & Connectivity', 'Pricing & Buying', 'NoBroker Services']

  return (
    <div className={styles.emptyState}>
      <div className={styles.reviewContainer}>
        <div className={styles.reviewHeader}>
          <h2 className={styles.reviewTitle}>Review Orchestrated Questions</h2>
          <p className={styles.reviewDesc}>Agent 4 has curated exactly 40 high-quality questions (10 per category). Please review them before we generate concise, source-weighted answers in batches.</p>
        </div>

        <div className={styles.reviewList}>
          {categories.map(cat => {
            const catQuestions = data.filter(q => q && q.category === cat)
            return (
              <div key={cat} className={styles.reviewCategory}>
                <h3 className={styles.reviewCatTitle}>{cat} <span className={styles.reviewCatCount}>{catQuestions.length} Questions</span></h3>
                <div className={styles.reviewQuestionsGrid}>
                  {catQuestions.map((q, i) => (
                    <div key={i} className={styles.reviewQuestionItem}>
                      <span className={styles.reviewQuestionNum}>{i + 1}</span>
                      <p className={styles.reviewQuestionText}>{q.question}</p>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <div className={styles.reviewActions}>
          <button className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
          <button className={styles.confirmBtn} onClick={onConfirm}>
            Proceed to Generate 40 Concise Answers
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ marginLeft: 8 }}>
              <path d="M6 12l4-4-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

function PipelineProgress({ phase, log, results }) {
  const [expandedStep, setExpandedStep] = useState(null)
  const data = Array.isArray(log) ? log : []

  const STEPS = [
    { key: 'projectKB', label: 'Project Intelligence', desc: 'Agent 1: Extracting project specs and RERA facts.' },
    { key: 'discovery', label: 'Search & Reddit Discovery', desc: 'Agents 2 & 3: Analyzing Google demand and community sentiment.' },
    { key: 'pendingQuestions', label: 'Question Orchestration', desc: 'Agent 4: Curating 10 high-quality questions per category (40 total).' },
    { key: 'finalFAQs', label: 'Batched Answer Synthesis', desc: 'Agent 5: Generating concise, source-weighted answers in batches of 5.' }
  ]

  const isGenerating = phase === 'questions' || phase === 'answers'

  const activeStepKey = useMemo(() => {
    if (!isGenerating || data.length === 0) return null
    const latest = (data[data.length - 1]?.text || '').toLowerCase()
    if (latest.includes('extracting project')) return 'projectKB'
    if (latest.includes('analyzing search')) return 'discovery'
    if (latest.includes('orchestrating')) return 'pendingQuestions'
    if (latest.includes('generating concise answers')) return 'finalFAQs'
    return null
  }, [isGenerating, data])

  if (isGenerating) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.pipeline}>
          <div className={styles.pipelineHeader}>
            <div className={styles.spinnerRingSmall} />
            {phase === 'questions' ? 'Phase 1: Question Orchestration Active' : 'Phase 2: Batched Answer Generation Active'}
          </div>
          <div className={styles.stepsList}>
            {STEPS.map((step, idx) => {
              // Logic for checkmarks
              let isDone = !!results[step.key]
              if (step.key === 'discovery') isDone = !!results.googleKB && !!results.redditKB
              if (step.key === 'finalFAQs' && phase === 'done') isDone = true

              const isActive = activeStepKey === step.key
              const isExpanded = expandedStep === step.key

              return (
                <div key={step.key} className={`${styles.stepItem} ${isDone ? styles.stepDone : ''} ${isActive ? styles.stepActive : ''}`}>
                  <div className={styles.stepConnector} />
                  <div className={styles.stepIndicator}>{isDone ? '✓' : idx + 1}</div>
                  <div className={styles.stepMain}>
                    <div className={styles.stepHeaderRow}>
                      <div className={styles.stepInfo}>
                        <div className={styles.stepLabel}>{step.label}</div>
                        <div className={styles.stepDesc}>{step.desc}</div>
                      </div>
                      {isDone && (
                        <button className={styles.viewOutputBtn} onClick={() => setExpandedStep(isExpanded ? null : step.key)}>
                          {isExpanded ? 'Hide ▲' : 'View ▼'}
                        </button>
                      )}
                    </div>
                    {isExpanded && isDone && (
                      <div className={styles.stepResultPreview}>
                        <pre>{JSON.stringify(results[step.key] || (step.key === 'discovery' ? { google: results.googleKB, reddit: results.redditKB } : {}), null, 2)}</pre>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
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
      <p className={styles.emptyLabel}>Your 40 research-grade FAQs will appear here</p>
    </div>
  )
}
