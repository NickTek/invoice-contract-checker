import type { AnalysisResult, UploadedFile } from '../types'

export async function analyzeDocuments(invoice: UploadedFile, contract: UploadedFile): Promise<AnalysisResult> {
  const invoiceText = invoice.content.trim()
  const contractText = contract.content.trim()

  if (!invoiceText || invoiceText.length < 20) {
    throw new Error('Invoice file appears to be empty or unreadable. Please upload a text-based document.')
  }
  if (!contractText || contractText.length < 20) {
    throw new Error('Contract file appears to be empty or unreadable. Please upload a text-based document.')
  }

  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      invoiceText,
      contractText,
      invoiceName: invoice.name,
      contractName: contract.name,
    }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Server error ${res.status}`)
  }

  const data = await res.json()

  const criticalCount = data.discrepancies.filter((d: { severity: string }) => d.severity === 'critical').length
  const warningCount = data.discrepancies.filter((d: { severity: string }) => d.severity === 'warning').length
  const infoCount = data.discrepancies.filter((d: { severity: string }) => d.severity === 'info').length

  return {
    summary: data.summary || 'Analysis complete.',
    overallStatus: data.overallStatus || 'pass',
    discrepancies: data.discrepancies || [],
    matchedItems: data.matchedItems || [],
    analysisDate: new Date().toLocaleString(),
    invoiceName: invoice.name,
    contractName: contract.name,
    criticalCount,
    warningCount,
    infoCount,
  }
}
