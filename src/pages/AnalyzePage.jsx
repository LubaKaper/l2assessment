import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import { categorizeMessage, getMockCategorization } from '../utils/llmHelper'
import { calculateUrgency } from '../utils/urgencyScorer'
import { getRecommendedAction, getRoutingRecommendation, shouldEscalate, getResponseTimeSLA } from '../utils/templates'

const LOADING_STAGES = [
  { index: 0, label: 'Reading message...', progress: 10 },
  { index: 1, label: 'Identifying category...', progress: 35 },
  { index: 2, label: 'Assessing urgency & business impact...', progress: 65 },
  { index: 3, label: 'Generating recommendations...', progress: 90 },
]

const EXAMPLE_MESSAGES = [
  { id: 'server-down',  label: 'Server Down',        text: 'Our production server is completely down. None of our customers can log in. This is an emergency!' },
  { id: 'billing-fail', label: 'Payment Failed',      text: "My payment failed but I was still charged. I need this resolved immediately or I'm disputing the charge." },
  { id: 'slow-load',    label: 'Performance Issue',   text: 'The dashboard has been loading extremely slowly for the past 2 days.' },
  { id: 'feature',      label: 'Feature Request',     text: 'It would be great if you could add a dark mode option to the dashboard.' },
  { id: 'positive',     label: 'Positive Feedback',   text: 'Just wanted to say your support team is fantastic. Thanks for the quick help yesterday!' },
]

const urgencyColorClass = (urgency) => ({
  Critical: 'bg-red-200 text-red-900',
  High:     'bg-red-200 text-red-900',
  Medium:   'bg-yellow-200 text-yellow-900',
  Low:      'bg-green-200 text-green-900',
}[urgency] || 'bg-gray-100 text-gray-700')

function AnalysisProgressBar({ stage }) {
  return (
    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex items-center mb-3">
        <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse" />
        <span className="text-sm font-medium text-blue-800">{stage.label}</span>
      </div>
      <div className="w-full bg-blue-100 rounded-full h-2">
        <div
          className="bg-blue-500 h-2 rounded-full transition-all duration-500 ease-in-out"
          style={{ width: `${stage.progress}%` }}
        />
      </div>
      <div className="flex justify-between mt-2 px-1">
        {LOADING_STAGES.map((s) => (
          <div
            key={s.index}
            className={`w-2 h-2 rounded-full transition-colors duration-300 ${
              s.index <= stage.index ? 'bg-blue-500' : 'bg-blue-200'
            }`}
          />
        ))}
      </div>
    </div>
  )
}

function AnalyzePage() {
  const [message, setMessage] = useState('')
  const [results, setResults] = useState(null)
  const [loadingStage, setLoadingStage] = useState(null)
  const [selectedExample, setSelectedExample] = useState(null)
  const [testResults, setTestResults] = useState([])
  const [isRunningTests, setIsRunningTests] = useState(false)
  const stageTimers = useRef([])

  useEffect(() => {
    const exampleMessage = localStorage.getItem('exampleMessage')
    if (exampleMessage) {
      setMessage(exampleMessage)
      localStorage.removeItem('exampleMessage')
    }
    return () => stageTimers.current.forEach(clearTimeout)
  }, [])

  const isLoading = loadingStage !== null

  const handleAnalyze = async () => {
    if (!message.trim()) {
      alert('Please enter a message to analyze')
      return
    }

    setLoadingStage(LOADING_STAGES[0])
    setResults(null)

    stageTimers.current = [
      setTimeout(() => setLoadingStage(LOADING_STAGES[1]), 600),
      setTimeout(() => setLoadingStage(LOADING_STAGES[2]), 1400),
      setTimeout(() => setLoadingStage(LOADING_STAGES[3]), 2400),
    ]

    try {
      const llmResult = await categorizeMessage(message)
      stageTimers.current.forEach(clearTimeout)

      const urgency = calculateUrgency(message, llmResult)
      const recommendedAction = getRecommendedAction(llmResult.category, urgency, llmResult)
      const routing = getRoutingRecommendation(llmResult.category, urgency)
      const escalation = shouldEscalate(llmResult.category, urgency, message)
      const sla = getResponseTimeSLA(urgency)

      const analysisResult = {
        message,
        category: llmResult.category,
        urgency,
        urgencyScore: llmResult.urgencyScore,
        recommendedAction,
        reasoning: llmResult.reasoning,
        keywords: llmResult.keywords,
        routing,
        escalation,
        sla,
        timestamp: new Date().toISOString()
      }

      setResults(analysisResult)

      const history = JSON.parse(localStorage.getItem('triageHistory') || '[]')
      history.push(analysisResult)
      localStorage.setItem('triageHistory', JSON.stringify(history))
    } catch (error) {
      stageTimers.current.forEach(clearTimeout)
      console.error('Error analyzing message:', error)
      alert('Error analyzing message. Please try again.')
    } finally {
      setLoadingStage(null)
    }
  }

  const handleClear = () => {
    setMessage('')
    setResults(null)
    setSelectedExample(null)
  }

  const handleExampleClick = (ex) => {
    setMessage(ex.text)
    setSelectedExample({ id: ex.id, oldResult: getMockCategorization(ex.text) })
    setResults(null)
  }

  const handleRunTestSuite = async () => {
    setIsRunningTests(true)
    setTestResults([])
    const results = []
    for (const ex of EXAMPLE_MESSAGES) {
      const oldResult = getMockCategorization(ex.text)
      const llmResult = await categorizeMessage(ex.text)
      const urgency = calculateUrgency(ex.text, llmResult)
      results.push({
        label: ex.label,
        oldCategory: oldResult.category,
        oldUrgency: oldResult.urgency,
        newCategory: llmResult.category,
        newUrgency: urgency,
        sla: getResponseTimeSLA(urgency),
      })
      setTestResults([...results])
    }
    setIsRunningTests(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Analyze Customer Message</h1>
          <p className="text-gray-600 mb-6">
            Paste a customer support message below to automatically categorize and prioritize.
          </p>

          {/* Example Pills */}
          <div className="mb-5">
            <div className="text-sm font-semibold text-gray-600 mb-2">Try an example:</div>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_MESSAGES.map((ex) => (
                <button
                  key={ex.id}
                  onClick={() => handleExampleClick(ex)}
                  disabled={isLoading}
                  className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                    selectedExample?.id === ex.id
                      ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold'
                      : 'border-gray-300 bg-white text-gray-600 hover:border-blue-300 hover:text-blue-600'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {ex.label}
                </button>
              ))}
            </div>
          </div>

          {/* Input Section */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Customer Message
            </label>
            <textarea
              value={message}
              onChange={(e) => { setMessage(e.target.value); setSelectedExample(null) }}
              placeholder="Paste customer message here..."
              className="w-full border border-gray-300 rounded-lg p-3 h-40 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isLoading}
            />
            <div className="text-sm text-gray-500 mt-1">
              {message.length} characters
            </div>
          </div>

          {/* Before/After Panel */}
          {selectedExample && (
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="text-sm font-semibold text-amber-800 mb-2">
                Old System (keyword-based) would return:
              </div>
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full font-semibold">
                  {selectedExample.oldResult.category}
                </span>
                <span className={`px-3 py-1 rounded-full font-semibold ${urgencyColorClass(selectedExample.oldResult.urgency)}`}>
                  {selectedExample.oldResult.urgency}
                </span>
              </div>
              {results && (
                <div className="mt-3 pt-3 border-t border-amber-200">
                  <div className="text-sm font-semibold text-green-800 mb-2">New LLM System returned:</div>
                  <div className="flex flex-wrap gap-2 text-sm">
                    <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full font-semibold">
                      {results.category}
                    </span>
                    <span className={`px-3 py-1 rounded-full font-semibold ${urgencyColorClass(results.urgency)}`}>
                      {results.urgency}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <button
              onClick={handleAnalyze}
              disabled={isLoading}
              className={`flex-1 py-3 rounded-lg font-semibold ${
                isLoading
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Analyzing...
                </span>
              ) : (
                'Analyze Message'
              )}
            </button>
            <button
              onClick={handleClear}
              disabled={isLoading}
              className="px-6 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50"
            >
              Clear
            </button>
          </div>

          {/* Progressive Loading Bar */}
          {loadingStage && <AnalysisProgressBar stage={loadingStage} />}
        </div>

        {/* Results Section */}
        {results && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Analysis Results</h2>

            <div className="space-y-4">
              {/* Escalation Alert */}
              {results.escalation?.shouldEscalate && (
                <div className="bg-red-50 border border-red-300 rounded-lg p-3 flex items-start gap-2">
                  <span className="text-red-700 font-bold text-sm shrink-0">ESCALATE</span>
                  <span className="text-red-700 text-sm">{results.escalation.reasons.join(' · ')}</span>
                </div>
              )}

              {/* Metadata Row */}
              <div className="flex flex-wrap gap-2 items-center">
                <span className="bg-blue-100 text-blue-800 px-3 py-1.5 rounded-lg font-semibold text-sm">
                  {results.category}
                </span>
                <span className={`px-3 py-1.5 rounded-lg font-semibold text-sm ${urgencyColorClass(results.urgency)}`}>
                  {results.urgency} Urgency
                </span>
                <span className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium">
                  Route to: {results.routing?.replace(/_/g, ' ')}
                </span>
                <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-lg text-sm font-medium">
                  SLA: {results.sla}
                </span>
              </div>

              <div>
                <div className="text-sm font-semibold text-gray-600 mb-1">Recommended Action</div>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <p className="text-gray-800">{results.recommendedAction}</p>
                </div>
              </div>

              {/* Keywords */}
              {results.keywords?.length > 0 && (
                <div>
                  <div className="text-sm font-semibold text-gray-600 mb-1">Keywords Detected</div>
                  <div className="flex flex-wrap gap-1">
                    {results.keywords.map((kw, i) => (
                      <span key={i} className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs font-mono">
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="text-sm font-semibold text-gray-600 mb-1">AI Reasoning</div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="prose prose-sm max-w-none text-gray-700">
                    <ReactMarkdown>
                      {results.reasoning}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  const text = `Category: ${results.category}\nUrgency: ${results.urgency}\nRoute to: ${results.routing}\nSLA: ${results.sla}\nRecommendation: ${results.recommendedAction}\n\nReasoning: ${results.reasoning}`
                  navigator.clipboard.writeText(text)
                  alert('Results copied to clipboard!')
                }}
                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 font-semibold"
              >
                Copy Results
              </button>
            </div>
          </div>
        )}

        {/* Test Suite */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Test Suite</h2>
              <p className="text-sm text-gray-500 mt-0.5">Compare old keyword system vs new LLM system across all example messages</p>
            </div>
            <button
              onClick={handleRunTestSuite}
              disabled={isRunningTests || isLoading}
              className={`px-4 py-2 rounded-lg font-semibold text-sm ${
                isRunningTests || isLoading
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isRunningTests ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Running...
                </span>
              ) : 'Run All Tests'}
            </button>
          </div>

          {(testResults.length > 0 || isRunningTests) && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 pr-4 font-semibold text-gray-600 w-1/4">Example</th>
                    <th className="text-left py-2 pr-4 font-semibold text-gray-600 w-5/12">Old System (keyword)</th>
                    <th className="text-left py-2 font-semibold text-gray-600">New LLM System</th>
                  </tr>
                </thead>
                <tbody>
                  {testResults.map((row, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-2 pr-4 font-medium text-gray-700">{row.label}</td>
                      <td className="py-2 pr-4">
                        <div className="flex flex-wrap gap-1">
                          <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs">{row.oldCategory}</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${urgencyColorClass(row.oldUrgency)}`}>{row.oldUrgency}</span>
                        </div>
                      </td>
                      <td className="py-2">
                        <div className="flex flex-wrap gap-1">
                          <span className="bg-blue-50 text-blue-800 px-2 py-0.5 rounded text-xs">{row.newCategory}</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${urgencyColorClass(row.newUrgency)}`}>{row.newUrgency}</span>
                          <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded text-xs">{row.sla}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {isRunningTests && testResults.length < EXAMPLE_MESSAGES.length && (
                    <tr className="border-b border-gray-100">
                      <td className="py-2 pr-4 font-medium text-gray-400">{EXAMPLE_MESSAGES[testResults.length].label}</td>
                      <td className="py-2 pr-4 text-gray-400 text-xs">Analyzing...</td>
                      <td className="py-2 text-gray-400 text-xs">
                        <span className="inline-flex items-center gap-1">
                          <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Processing...
                        </span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {testResults.length === 0 && !isRunningTests && (
            <p className="text-sm text-gray-400 text-center py-4">
              Click "Run All Tests" to see a side-by-side comparison of old vs new system results.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default AnalyzePage
