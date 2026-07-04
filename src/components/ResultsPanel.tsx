import { AlertTriangle, CheckCircle, XCircle, Info, RotateCcw, FileText, Shield, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import type { AnalysisResult, Discrepancy, DiscrepancySeverity, UploadedFile } from '../types'

function SeverityBadge({ severity }: { severity: DiscrepancySeverity }) {
  const config = {
    critical: { icon: XCircle, label: 'Critical', cls: 'bg-red-500/20 text-red-300 border-red-500/30' },
    warning: { icon: AlertTriangle, label: 'Warning', cls: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
    info: { icon: Info, label: 'Info', cls: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  }
  const { icon: Icon, label, cls } = config[severity]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cls}`}>
      <Icon size={12} />
      {label}
    </span>
  )
}

function DiscrepancyCard({ item }: { item: Discrepancy }) {
  const [expanded, setExpanded] = useState(false)
  const borderColor = item.severity === 'critical' ? 'border-red-500/30' : item.severity === 'warning' ? 'border-amber-500/30' : 'border-blue-500/30'
  const bgColor = item.severity === 'critical' ? 'bg-red-500/5' : item.severity === 'warning' ? 'bg-amber-500/5' : 'bg-blue-500/5'

  return (
    <div className={`border ${borderColor} ${bgColor} rounded-xl overflow-hidden`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-5 py-4 flex items-start gap-4"
      >
        <div className="flex-shrink-0 mt-0.5">
          <SeverityBadge severity={item.severity} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium">{item.title}</p>
          <p className="text-slate-400 text-sm mt-1 leading-relaxed">{item.description}</p>
        </div>
        <div className="flex-shrink-0 text-slate-500 ml-2 mt-1">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-white/10 pt-4 space-y-4">
          {(item.invoiceValue || item.contractValue) && (
            <div className="grid grid-cols-2 gap-4">
              {item.invoiceValue && (
                <div className="bg-white/5 rounded-lg p-3">
                  <p className="text-xs text-slate-500 mb-1">Invoice Value</p>
                  <p className="text-white text-sm font-medium">{item.invoiceValue}</p>
                </div>
              )}
              {item.contractValue && (
                <div className="bg-white/5 rounded-lg p-3">
                  <p className="text-xs text-slate-500 mb-1">Contract Value</p>
                  <p className="text-white text-sm font-medium">{item.contractValue}</p>
                </div>
              )}
            </div>
          )}
          <div className="bg-white/5 rounded-lg p-3">
            <p className="text-xs text-slate-500 mb-1">Recommendation</p>
            <p className="text-slate-300 text-sm leading-relaxed">{item.recommendation}</p>
          </div>
        </div>
      )}
    </div>
  )
}

interface ResultsPanelProps {
  result: AnalysisResult
  onReset: () => void
  invoice: UploadedFile
  contract: UploadedFile
}

export function ResultsPanel({ result, onReset, invoice, contract }: ResultsPanelProps) {
  const [activeFilter, setActiveFilter] = useState<'all' | DiscrepancySeverity>('all')

  const statusConfig = {
    pass: { icon: CheckCircle, label: 'All Clear', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30' },
    warning: { icon: AlertTriangle, label: 'Warnings Found', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' },
    fail: { icon: XCircle, label: 'Critical Issues', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30' },
  }
  const { icon: StatusIcon, label: statusLabel, color: statusColor, bg: statusBg } = statusConfig[result.overallStatus]

  const filtered = activeFilter === 'all'
    ? result.discrepancies
    : result.discrepancies.filter(d => d.severity === activeFilter)

  const filters: Array<{ key: 'all' | DiscrepancySeverity; label: string; count: number }> = [
    { key: 'all', label: 'All', count: result.discrepancies.length },
    { key: 'critical', label: 'Critical', count: result.criticalCount },
    { key: 'warning', label: 'Warnings', count: result.warningCount },
    { key: 'info', label: 'Info', count: result.infoCount },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
      <nav className="flex items-center justify-between px-8 py-5 border-b border-white/10">
        <button onClick={onReset} className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
            <Shield size={18} className="text-white" />
          </div>
          <span className="text-white font-semibold text-lg">ContractCheck</span>
        </button>
        <button
          onClick={onReset}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
        >
          <RotateCcw size={16} />
          New Analysis
        </button>
      </nav>

      <main className="max-w-4xl mx-auto px-8 py-10">
        <div className={`border ${statusBg} rounded-2xl p-6 mb-8`}>
          <div className="flex items-start gap-4">
            <StatusIcon size={32} className={statusColor} />
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h2 className={`text-xl font-bold ${statusColor}`}>{statusLabel}</h2>
              </div>
              <p className="text-slate-300 leading-relaxed">{result.summary}</p>
              <p className="text-slate-500 text-sm mt-3">Analyzed {result.analysisDate}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-red-400 mb-1">{result.criticalCount}</div>
            <div className="text-slate-400 text-sm">Critical</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-amber-400 mb-1">{result.warningCount}</div>
            <div className="text-slate-400 text-sm">Warnings</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-blue-400 mb-1">{result.infoCount}</div>
            <div className="text-slate-400 text-sm">Info</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-green-400 mb-1">{result.matchedItems.length}</div>
            <div className="text-slate-400 text-sm">Matches</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          {[
            { file: invoice, label: 'Invoice', color: 'blue' },
            { file: contract, label: 'Contract', color: 'violet' },
          ].map(({ file, label, color }) => (
            <div key={label} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-3">
              <div className={`w-10 h-10 bg-${color}-500/20 rounded-lg flex items-center justify-center flex-shrink-0`}>
                <FileText size={20} className={`text-${color}-400`} />
              </div>
              <div className="min-w-0">
                <p className="text-slate-400 text-xs">{label}</p>
                <p className="text-white text-sm font-medium truncate">{file.name}</p>
              </div>
            </div>
          ))}
        </div>

        {result.matchedItems.length > 0 && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-5 mb-8">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle size={18} className="text-green-400" />
              <h3 className="text-green-300 font-semibold">Matching Elements</h3>
            </div>
            <ul className="space-y-2">
              {result.matchedItems.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-green-200/80">
                  <span className="text-green-500 mt-0.5">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {result.discrepancies.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold text-lg">
                Discrepancies ({result.discrepancies.length})
              </h3>
              <div className="flex gap-2">
                {filters.map(f => (
                  <button
                    key={f.key}
                    onClick={() => setActiveFilter(f.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      activeFilter === f.key
                        ? 'bg-blue-500 text-white'
                        : 'bg-white/10 text-slate-400 hover:text-white hover:bg-white/15'
                    }`}
                  >
                    {f.label} {f.count > 0 && <span className="ml-1 opacity-70">{f.count}</span>}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              {filtered.map(item => (
                <DiscrepancyCard key={item.id} item={item} />
              ))}
            </div>
          </div>
        )}

        {result.discrepancies.length === 0 && (
          <div className="text-center py-12">
            <CheckCircle size={48} className="text-green-400 mx-auto mb-4" />
            <h3 className="text-white font-semibold text-xl mb-2">No Discrepancies Found</h3>
            <p className="text-slate-400">The invoice and contract appear to be consistent with each other.</p>
          </div>
        )}

        <div className="mt-10 pt-6 border-t border-white/10">
          <p className="text-slate-500 text-xs text-center leading-relaxed">
            This analysis is for informational purposes only and does not constitute legal or financial advice.
            Always consult a qualified professional before making payment decisions based on this report.
          </p>
        </div>
      </main>
    </div>
  )
}
