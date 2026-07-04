import { useState, useRef } from 'react'
import { Upload, FileText, X, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react'
import './index.css'

interface UploadedFile {
  file: File
  name: string
}

interface CheckResult {
  status: 'No Issues Found' | 'Issues Found'
  contract_summary: {
    vendor: string | null
    rate_terms: string
    payment_terms: string
  }
  invoice_summary: {
    vendor: string | null
    line_items: string[]
    total: string
  }
  discrepancies: string[]
}

function FileBox({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint: string
  value: UploadedFile | null
  onChange: (f: UploadedFile | null) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = (file: File) => {
    onChange({ file, name: file.name })
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  return (
    <div className="flex-1">
      <label className="block text-sm font-semibold text-slate-300 mb-2">{label}</label>
      {value ? (
        <div className="flex items-center gap-3 border border-slate-600 bg-slate-800 rounded-xl px-4 py-4">
          <FileText size={20} className="text-blue-400 flex-shrink-0" />
          <span className="text-slate-200 text-sm flex-1 truncate">{value.name}</span>
          <button
            onClick={() => onChange(null)}
            className="text-slate-500 hover:text-slate-300 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDrop={onDrop}
          onDragOver={e => e.preventDefault()}
          className="border-2 border-dashed border-slate-600 hover:border-blue-500 bg-slate-800/50 hover:bg-slate-800 rounded-xl px-6 py-10 flex flex-col items-center gap-3 cursor-pointer transition-all"
        >
          <Upload size={24} className="text-slate-500" />
          <div className="text-center">
            <p className="text-slate-300 text-sm font-medium">Drop file or click to browse</p>
            <p className="text-slate-500 text-xs mt-1">{hint}</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.webp,.tiff,.tif"
            onChange={e => {
              const f = e.target.files?.[0]
              if (f) handleFile(f)
              e.target.value = ''
            }}
          />
        </div>
      )}
    </div>
  )
}

export default function App() {
  const [contract, setContract] = useState<UploadedFile | null>(null)
  const [invoice, setInvoice] = useState<UploadedFile | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CheckResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const canCheck = contract !== null && invoice !== null && !loading

  const handleCheck = async () => {
    if (!contract || !invoice) return
    setLoading(true)
    setResult(null)
    setError(null)

    const form = new FormData()
    form.append('contract', contract.file)
    form.append('invoice', invoice.file)

    try {
      const res = await fetch('/api/check', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Server error ${res.status}`)
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setContract(null)
    setInvoice(null)
    setResult(null)
    setError(null)
  }

  const passed = result?.status === 'No Issues Found'

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-start px-4 py-14">
      <div className="w-full max-w-2xl">

        {/* Header */}
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-white mb-2">Invoice Checker</h1>
          <p className="text-slate-400 text-sm">Upload a contract and invoice — AI will compare them and flag any discrepancies.</p>
        </div>

        {/* Upload area */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <FileBox
              label="Upload Contract"
              hint="PDF, Word, or image"
              value={contract}
              onChange={setContract}
            />
            <FileBox
              label="Upload Invoice"
              hint="PDF, Word, or image"
              value={invoice}
              onChange={setInvoice}
            />
          </div>

          <button
            onClick={handleCheck}
            disabled={!canCheck}
            className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all ${
              canCheck
                ? 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                Analyzing…
              </span>
            ) : (
              'Check Invoice Against Contract'
            )}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-900/30 border border-red-700/50 rounded-xl p-4 mb-6 flex items-start gap-3">
            <AlertTriangle size={18} className="text-red-400 mt-0.5 flex-shrink-0" />
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 space-y-5">

            {/* Status banner */}
            <div className={`flex items-center gap-3 rounded-xl px-4 py-3 ${
              passed
                ? 'bg-green-900/40 border border-green-700/50'
                : 'bg-red-900/30 border border-red-700/50'
            }`}>
              {passed
                ? <CheckCircle size={20} className="text-green-400 flex-shrink-0" />
                : <AlertTriangle size={20} className="text-red-400 flex-shrink-0" />
              }
              <span className={`font-semibold ${passed ? 'text-green-300' : 'text-red-300'}`}>
                {result.status}
              </span>
            </div>

            {/* Discrepancies */}
            {!passed && result.discrepancies.length > 0 && (
              <div>
                <h3 className="text-slate-200 font-semibold text-sm mb-3">Discrepancies Found</h3>
                <ul className="space-y-2">
                  {result.discrepancies.map((d, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-slate-300">
                      <span className="mt-0.5 text-red-400 flex-shrink-0">•</span>
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Summaries */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-700">
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Contract</h4>
                <dl className="space-y-1.5 text-sm">
                  {result.contract_summary.vendor && (
                    <div>
                      <dt className="text-slate-500 text-xs">Vendor</dt>
                      <dd className="text-slate-300">{result.contract_summary.vendor}</dd>
                    </div>
                  )}
                  {result.contract_summary.rate_terms && (
                    <div>
                      <dt className="text-slate-500 text-xs">Rate / Pricing</dt>
                      <dd className="text-slate-300">{result.contract_summary.rate_terms}</dd>
                    </div>
                  )}
                  {result.contract_summary.payment_terms && (
                    <div>
                      <dt className="text-slate-500 text-xs">Payment Terms</dt>
                      <dd className="text-slate-300">{result.contract_summary.payment_terms}</dd>
                    </div>
                  )}
                </dl>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Invoice</h4>
                <dl className="space-y-1.5 text-sm">
                  {result.invoice_summary.vendor && (
                    <div>
                      <dt className="text-slate-500 text-xs">Vendor</dt>
                      <dd className="text-slate-300">{result.invoice_summary.vendor}</dd>
                    </div>
                  )}
                  {result.invoice_summary.line_items?.length > 0 && (
                    <div>
                      <dt className="text-slate-500 text-xs">Line Items</dt>
                      <dd className="text-slate-300 space-y-0.5">
                        {result.invoice_summary.line_items.map((item, i) => (
                          <div key={i}>{item}</div>
                        ))}
                      </dd>
                    </div>
                  )}
                  {result.invoice_summary.total && (
                    <div>
                      <dt className="text-slate-500 text-xs">Total</dt>
                      <dd className="text-slate-200 font-semibold">{result.invoice_summary.total}</dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>

            {/* Check another */}
            <div className="pt-2 border-t border-slate-700">
              <button
                onClick={handleReset}
                className="text-sm text-slate-400 hover:text-white transition-colors"
              >
                ← Check another
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  )
}
