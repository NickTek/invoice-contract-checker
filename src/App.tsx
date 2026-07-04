import { useState } from 'react'
import { FileText, Shield, Zap, ChevronRight, AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react'
import { UploadSection } from './components/UploadSection'
import { ResultsPanel } from './components/ResultsPanel'
import { analyzeDocuments } from './utils/analyzer'
import type { AnalysisResult, UploadedFile } from './types'
import './index.css'

type AppState = 'landing' | 'uploading' | 'analyzing' | 'results'

function App() {
  const [state, setState] = useState<AppState>('landing')
  const [invoice, setInvoice] = useState<UploadedFile | null>(null)
  const [contract, setContract] = useState<UploadedFile | null>(null)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleAnalyze = async () => {
    if (!invoice || !contract) return
    setState('analyzing')
    setError(null)
    try {
      const analysis = await analyzeDocuments(invoice, contract)
      setResult(analysis)
      setState('results')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed. Please try again.')
      setState('uploading')
    }
  }

  const handleReset = () => {
    setState('landing')
    setInvoice(null)
    setContract(null)
    setResult(null)
    setError(null)
  }

  if (state === 'results' && result) {
    return <ResultsPanel result={result} onReset={handleReset} invoice={invoice!} contract={contract!} />
  }

  if (state === 'landing') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
        <nav className="flex items-center justify-between px-8 py-5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <Shield size={18} className="text-white" />
            </div>
            <span className="text-white font-semibold text-lg">ContractCheck</span>
          </div>
          <button
            onClick={() => setState('uploading')}
            className="bg-blue-500 hover:bg-blue-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Get Started
          </button>
        </nav>

        <main className="max-w-5xl mx-auto px-8 py-20 text-center">
          <div className="inline-flex items-center gap-2 bg-blue-500/20 border border-blue-400/30 rounded-full px-4 py-1.5 mb-8">
            <Zap size={14} className="text-blue-400" />
            <span className="text-blue-300 text-sm font-medium">AI-Powered Document Analysis</span>
          </div>

          <h1 className="text-5xl sm:text-6xl font-bold text-white mb-6 leading-tight">
            Catch Invoice
            <span className="text-blue-400"> Discrepancies</span>
            <br />Before They Cost You
          </h1>

          <p className="text-slate-400 text-xl mb-12 max-w-2xl mx-auto leading-relaxed">
            Upload your invoice and contract — our AI instantly compares them, flags mismatches, 
            and gives you a clear report of every discrepancy.
          </p>

          <button
            onClick={() => setState('uploading')}
            className="inline-flex items-center gap-2 bg-blue-500 hover:bg-blue-400 text-white px-8 py-4 rounded-xl text-lg font-semibold transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-400/30 hover:scale-105"
          >
            Start Checking
            <ChevronRight size={20} />
          </button>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-24">
            {[
              {
                icon: <AlertTriangle size={24} className="text-amber-400" />,
                title: 'Flag Discrepancies',
                desc: 'Instantly spot mismatched amounts, dates, payment terms, and parties between your invoice and contract.'
              },
              {
                icon: <CheckCircle size={24} className="text-green-400" />,
                title: 'Verify Compliance',
                desc: 'Confirm that invoice line items, rates, and totals align with what was agreed in the contract.'
              },
              {
                icon: <Info size={24} className="text-blue-400" />,
                title: 'Clear Report',
                desc: 'Get a structured, plain-English report with severity levels — critical, warning, and informational.'
              }
            ].map((f, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-6 text-left hover:bg-white/8 transition-colors">
                <div className="mb-4">{f.icon}</div>
                <h3 className="text-white font-semibold text-lg mb-2">{f.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-8">
            {[
              { value: 'PDF', label: 'Supported' },
              { value: 'DOCX', label: 'Supported' },
              { value: 'TXT', label: 'Supported' },
              { value: 'AI', label: 'Powered' },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <div className="text-3xl font-bold text-white">{s.value}</div>
                <div className="text-slate-500 text-sm mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </main>

        <footer className="border-t border-white/10 py-8 text-center text-slate-500 text-sm">
          ContractCheck · AI analysis is informational only — always consult a legal professional for binding decisions.
        </footer>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
      <nav className="flex items-center justify-between px-8 py-5 border-b border-white/10">
        <button onClick={handleReset} className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
            <Shield size={18} className="text-white" />
          </div>
          <span className="text-white font-semibold text-lg">ContractCheck</span>
        </button>
      </nav>

      <main className="max-w-5xl mx-auto px-8 py-12">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-white mb-3">Upload Your Documents</h2>
          <p className="text-slate-400">Upload both your invoice and the corresponding contract to begin analysis.</p>
        </div>

        {state === 'analyzing' ? (
          <div className="flex flex-col items-center justify-center py-24 gap-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-full border-4 border-blue-500/30 border-t-blue-500 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <FileText size={28} className="text-blue-400" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-white font-semibold text-lg">Analyzing Documents...</p>
              <p className="text-slate-400 text-sm mt-1">Comparing invoice against contract terms</p>
            </div>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-6 bg-red-500/20 border border-red-500/40 rounded-xl p-4 flex items-start gap-3">
                <XCircle size={20} className="text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}
            <UploadSection
              invoice={invoice}
              contract={contract}
              onInvoiceChange={setInvoice}
              onContractChange={setContract}
              onAnalyze={handleAnalyze}
            />
          </>
        )}
      </main>
    </div>
  )
}

export default App
