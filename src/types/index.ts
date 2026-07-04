export interface UploadedFile {
  name: string
  content: string
  size: number
  type: string
}

export type DiscrepancySeverity = 'critical' | 'warning' | 'info'

export interface Discrepancy {
  id: string
  severity: DiscrepancySeverity
  category: string
  title: string
  description: string
  invoiceValue?: string
  contractValue?: string
  recommendation: string
}

export interface AnalysisResult {
  summary: string
  overallStatus: 'pass' | 'warning' | 'fail'
  discrepancies: Discrepancy[]
  matchedItems: string[]
  analysisDate: string
  invoiceName: string
  contractName: string
  criticalCount: number
  warningCount: number
  infoCount: number
}
