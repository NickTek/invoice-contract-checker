import { useCallback, useRef } from 'react'
import { Upload, FileText, X, CheckCircle, AlertCircle } from 'lucide-react'
import type { UploadedFile } from '../types'

interface DropZoneProps {
  label: string
  sublabel: string
  file: UploadedFile | null
  onChange: (file: UploadedFile | null) => void
  accentColor: string
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}

function DropZone({ label, sublabel, file, onChange, accentColor }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const isDragging = useRef(false)

  const handleFile = useCallback(async (rawFile: File) => {
    const allowed = ['.txt', '.pdf', '.doc', '.docx', '.csv', '.md', '.rtf']
    const ext = rawFile.name.substring(rawFile.name.lastIndexOf('.')).toLowerCase()
    if (!allowed.includes(ext)) {
      alert(`Unsupported file type: ${ext}. Please upload a text-based document (TXT, PDF, DOCX, etc.)`)
      return
    }
    try {
      const content = await readFileAsText(rawFile)
      onChange({
        name: rawFile.name,
        content,
        size: rawFile.size,
        type: rawFile.type,
      })
    } catch {
      alert('Could not read file. Please ensure it is a text-based document.')
    }
  }, [onChange])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    isDragging.current = false
    const dropped = e.dataTransfer.files[0]
    if (dropped) handleFile(dropped)
  }, [handleFile])

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    isDragging.current = true
  }

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
    if (inputRef.current) inputRef.current.value = ''
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  return (
    <div className="flex-1">
      <div className="mb-3">
        <h3 className="text-white font-semibold text-lg">{label}</h3>
        <p className="text-slate-400 text-sm">{sublabel}</p>
      </div>

      {file ? (
        <div className={`relative bg-white/8 border-2 border-${accentColor}-500/50 rounded-2xl p-6 flex items-start gap-4`}>
          <div className={`w-12 h-12 bg-${accentColor}-500/20 rounded-xl flex items-center justify-center flex-shrink-0`}>
            <FileText size={24} className={`text-${accentColor}-400`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-medium truncate">{file.name}</p>
            <p className="text-slate-400 text-sm mt-1">{formatSize(file.size)} · {file.content.length.toLocaleString()} characters extracted</p>
            <div className="flex items-center gap-1.5 mt-2">
              <CheckCircle size={14} className="text-green-400" />
              <span className="text-green-400 text-xs">Ready for analysis</span>
            </div>
          </div>
          <button
            onClick={() => onChange(null)}
            className="text-slate-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
          >
            <X size={18} />
          </button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDrop={onDrop}
          onDragOver={onDragOver}
          className="bg-white/5 border-2 border-dashed border-white/20 rounded-2xl p-10 flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-white/8 hover:border-white/30 transition-all group"
        >
          <div className={`w-14 h-14 bg-${accentColor}-500/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform`}>
            <Upload size={26} className={`text-${accentColor}-400`} />
          </div>
          <div className="text-center">
            <p className="text-white font-medium">Drop file here or <span className={`text-${accentColor}-400`}>browse</span></p>
            <p className="text-slate-500 text-sm mt-1">TXT, PDF, DOCX, DOC, RTF, MD</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept=".txt,.pdf,.doc,.docx,.rtf,.md,.csv"
            onChange={onInputChange}
          />
        </div>
      )}
    </div>
  )
}

interface UploadSectionProps {
  invoice: UploadedFile | null
  contract: UploadedFile | null
  onInvoiceChange: (file: UploadedFile | null) => void
  onContractChange: (file: UploadedFile | null) => void
  onAnalyze: () => void
}

export function UploadSection({ invoice, contract, onInvoiceChange, onContractChange, onAnalyze }: UploadSectionProps) {
  const bothReady = invoice !== null && contract !== null

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-6 mb-8">
        <DropZone
          label="Invoice"
          sublabel="The invoice you received or issued"
          file={invoice}
          onChange={onInvoiceChange}
          accentColor="blue"
        />
        <div className="hidden sm:flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="w-px h-16 bg-white/20" />
            <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
              <span className="text-slate-400 text-xs font-medium">vs</span>
            </div>
            <div className="w-px h-16 bg-white/20" />
          </div>
        </div>
        <DropZone
          label="Contract"
          sublabel="The signed contract or agreement"
          file={contract}
          onChange={onContractChange}
          accentColor="violet"
        />
      </div>

      {!bothReady && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6 flex items-start gap-3">
          <AlertCircle size={18} className="text-slate-400 mt-0.5 flex-shrink-0" />
          <p className="text-slate-400 text-sm">
            <strong className="text-slate-300">Note:</strong> For PDF files, text extraction works best on text-based PDFs. Scanned image PDFs may not extract correctly — use TXT or DOCX for best results.
          </p>
        </div>
      )}

      <div className="flex justify-center">
        <button
          onClick={onAnalyze}
          disabled={!bothReady}
          className={`px-10 py-4 rounded-xl font-semibold text-lg transition-all ${
            bothReady
              ? 'bg-blue-500 hover:bg-blue-400 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-400/30 hover:scale-105 cursor-pointer'
              : 'bg-white/10 text-slate-500 cursor-not-allowed'
          }`}
        >
          {bothReady ? 'Analyze Documents' : 'Upload Both Documents to Continue'}
        </button>
      </div>
    </div>
  )
}
