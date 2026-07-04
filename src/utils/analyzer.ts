import type { AnalysisResult, Discrepancy, UploadedFile } from '../types'

function extractText(content: string): string {
  return content.trim()
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 9)
}

function findAmounts(text: string): string[] {
  const matches = text.match(/\$[\d,]+(?:\.\d{2})?|\d+(?:,\d{3})*(?:\.\d{2})?\s*(?:USD|EUR|GBP)/gi) || []
  return [...new Set(matches)]
}

function findDates(text: string): string[] {
  const patterns = [
    /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/gi,
    /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g,
    /\b\d{4}[\/\-]\d{2}[\/\-]\d{2}\b/g,
  ]
  const dates: string[] = []
  for (const pattern of patterns) {
    const m = text.match(pattern) || []
    dates.push(...m)
  }
  return [...new Set(dates)]
}

function findPaymentTerms(text: string): string {
  const match = text.match(/net\s*\d+|due\s+(?:on\s+)?receipt|payment\s+within\s+\d+|net\s*30|net\s*60|net\s*90/gi)
  return match ? match[0] : ''
}

function findParties(text: string): string[] {
  const patterns = [
    /(?:between|by and between|party[:\s]+|client[:\s]+|vendor[:\s]+|contractor[:\s]+|service provider[:\s]+)([A-Z][A-Za-z\s,\.]+(?:LLC|Inc|Corp|Ltd|LLP|Company|Co\.)?)/g,
    /(?:billed to|bill to|invoice to|from)[:\s]+([A-Z][A-Za-z\s,\.]+)/gi,
  ]
  const parties: string[] = []
  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(text)) !== null) {
      parties.push(match[1].trim())
    }
  }
  return [...new Set(parties)].slice(0, 4)
}

function compareAmounts(invoiceText: string, contractText: string): Discrepancy[] {
  const discrepancies: Discrepancy[] = []
  const invoiceAmounts = findAmounts(invoiceText)
  const contractAmounts = findAmounts(contractText)

  if (invoiceAmounts.length === 0 && contractAmounts.length === 0) return discrepancies

  const parseAmount = (s: string) => parseFloat(s.replace(/[^0-9.]/g, ''))

  const invoiceNums = invoiceAmounts.map(parseAmount).filter(n => !isNaN(n))
  const contractNums = contractAmounts.map(parseAmount).filter(n => !isNaN(n))

  if (invoiceNums.length > 0 && contractNums.length > 0) {
    const maxInvoice = Math.max(...invoiceNums)
    const maxContract = Math.max(...contractNums)
    const diff = Math.abs(maxInvoice - maxContract)
    const pct = contractNums.length > 0 ? diff / maxContract : 0

    if (diff > 0.01) {
      discrepancies.push({
        id: generateId(),
        severity: pct > 0.1 ? 'critical' : pct > 0.02 ? 'warning' : 'info',
        category: 'Amount',
        title: 'Invoice amount does not match contract value',
        description: `The highest amount found in the invoice ($${maxInvoice.toLocaleString()}) differs from the contract's stated value ($${maxContract.toLocaleString()}).`,
        invoiceValue: `$${maxInvoice.toLocaleString()}`,
        contractValue: `$${maxContract.toLocaleString()}`,
        recommendation: 'Verify that all line items, rates, and totals in the invoice match the agreed amounts in the contract. Request a corrected invoice if there is an unauthorized discrepancy.'
      })
    }
  }

  return discrepancies
}

function compareDates(invoiceText: string, contractText: string): Discrepancy[] {
  const discrepancies: Discrepancy[] = []
  const invoiceDates = findDates(invoiceText)
  const contractDates = findDates(contractText)

  if (invoiceDates.length > 0 && contractDates.length > 0) {
    const sharedDates = invoiceDates.filter(d => contractDates.some(cd => cd === d))
    if (sharedDates.length === 0) {
      discrepancies.push({
        id: generateId(),
        severity: 'warning',
        category: 'Dates',
        title: 'No overlapping dates between invoice and contract',
        description: `Invoice contains dates: ${invoiceDates.slice(0, 3).join(', ')}. Contract contains dates: ${contractDates.slice(0, 3).join(', ')}. None of these dates match, which may indicate a period mismatch.`,
        invoiceValue: invoiceDates.slice(0, 2).join(', '),
        contractValue: contractDates.slice(0, 2).join(', '),
        recommendation: 'Verify that the invoice covers the service period defined in the contract. Ensure invoice date falls within the contract term.'
      })
    }
  }

  return discrepancies
}

function comparePaymentTerms(invoiceText: string, contractText: string): Discrepancy[] {
  const discrepancies: Discrepancy[] = []
  const invoiceTerms = findPaymentTerms(invoiceText)
  const contractTerms = findPaymentTerms(contractText)

  if (invoiceTerms && contractTerms && invoiceTerms.toLowerCase() !== contractTerms.toLowerCase()) {
    discrepancies.push({
      id: generateId(),
      severity: 'warning',
      category: 'Payment Terms',
      title: 'Payment terms differ between invoice and contract',
      description: `The invoice specifies "${invoiceTerms}" while the contract specifies "${contractTerms}". Conflicting payment terms may cause payment disputes.`,
      invoiceValue: invoiceTerms,
      contractValue: contractTerms,
      recommendation: 'Ensure the payment terms on the invoice exactly match those agreed in the contract. The contract terms generally take precedence.'
    })
  }

  return discrepancies
}

function compareParties(invoiceText: string, contractText: string): Discrepancy[] {
  const discrepancies: Discrepancy[] = []
  const invoiceParties = findParties(invoiceText)
  const contractParties = findParties(contractText)

  if (invoiceParties.length > 0 && contractParties.length > 0) {
    const hasMatch = invoiceParties.some(ip =>
      contractParties.some(cp =>
        ip.toLowerCase().includes(cp.toLowerCase().split(' ')[0]) ||
        cp.toLowerCase().includes(ip.toLowerCase().split(' ')[0])
      )
    )

    if (!hasMatch) {
      discrepancies.push({
        id: generateId(),
        severity: 'critical',
        category: 'Parties',
        title: 'Party names may not match between documents',
        description: `Invoice references: ${invoiceParties.slice(0, 2).join(', ')}. Contract references: ${contractParties.slice(0, 2).join(', ')}. No clear match found between the parties named in each document.`,
        invoiceValue: invoiceParties.slice(0, 2).join(', '),
        contractValue: contractParties.slice(0, 2).join(', '),
        recommendation: 'Confirm that the invoice is issued by the correct vendor/contractor and addressed to the correct client as specified in the contract. Mismatched parties may invalidate the invoice.'
      })
    }
  }

  return discrepancies
}

function checkMissingFields(invoiceText: string, contractText: string): Discrepancy[] {
  const discrepancies: Discrepancy[] = []
  const lowerInvoice = invoiceText.toLowerCase()
  const lowerContract = contractText.toLowerCase()

  if (!findAmounts(invoiceText).length) {
    discrepancies.push({
      id: generateId(),
      severity: 'critical',
      category: 'Missing Data',
      title: 'No monetary amounts found in invoice',
      description: 'The invoice does not appear to contain any monetary amounts. This may indicate an incomplete invoice or parsing issue.',
      recommendation: 'Ensure the invoice clearly states the total amount due, unit prices, and any applicable taxes.'
    })
  }

  const hasInvoiceNumber = /invoice\s*#?\s*\d+|inv[-\s]?\d+|invoice\s+number/i.test(invoiceText)
  if (!hasInvoiceNumber) {
    discrepancies.push({
      id: generateId(),
      severity: 'info',
      category: 'Invoice Format',
      title: 'Invoice number not clearly identified',
      description: 'No invoice number was detected. A unique invoice number is required for record-keeping and dispute resolution.',
      recommendation: 'Request the vendor to include a unique sequential invoice number on all invoices.'
    })
  }

  const hasTaxInContract = /tax|vat|gst/i.test(lowerContract)
  const hasTaxInInvoice = /tax|vat|gst/i.test(lowerInvoice)
  if (hasTaxInContract && !hasTaxInInvoice) {
    discrepancies.push({
      id: generateId(),
      severity: 'warning',
      category: 'Tax',
      title: 'Tax requirements mentioned in contract but not reflected in invoice',
      description: 'The contract references tax obligations, but no tax amounts or tax IDs were found on the invoice.',
      recommendation: 'Verify whether taxes apply to this transaction. If so, request an updated invoice with itemized tax amounts and the vendor\'s tax ID.'
    })
  }

  const hasSignatureInContract = /signed|signature|sign below|authorized by|signatory/i.test(lowerContract)
  if (hasSignatureInContract) {
    discrepancies.push({
      id: generateId(),
      severity: 'info',
      category: 'Authorization',
      title: 'Contract requires authorized signatures — verify before payment',
      description: 'The contract contains signature requirements. Ensure all required parties have signed the contract before processing payment.',
      recommendation: 'Do not authorize payment until you have confirmed that the contract has been properly executed by all required signatories.'
    })
  }

  return discrepancies
}

function findMatchedItems(invoiceText: string, contractText: string): string[] {
  const matched: string[] = []
  const lowerI = invoiceText.toLowerCase()
  const lowerC = contractText.toLowerCase()

  const invoiceAmounts = findAmounts(invoiceText)
  const contractAmounts = findAmounts(contractText)
  const shared = invoiceAmounts.filter(a => contractAmounts.includes(a))
  if (shared.length > 0) {
    matched.push(`Matching monetary amounts found: ${shared.slice(0, 3).join(', ')}`)
  }

  const sharedDates = findDates(invoiceText).filter(d => findDates(contractText).includes(d))
  if (sharedDates.length > 0) {
    matched.push(`Common dates found in both documents: ${sharedDates.slice(0, 2).join(', ')}`)
  }

  const terms = ['payment', 'delivery', 'service', 'scope', 'work', 'project']
  const matchedTerms = terms.filter(t => lowerI.includes(t) && lowerC.includes(t))
  if (matchedTerms.length > 0) {
    matched.push(`Both documents reference common topics: ${matchedTerms.slice(0, 4).join(', ')}`)
  }

  const invoiceTerms = findPaymentTerms(invoiceText)
  const contractTerms = findPaymentTerms(contractText)
  if (invoiceTerms && contractTerms && invoiceTerms.toLowerCase() === contractTerms.toLowerCase()) {
    matched.push(`Payment terms match: "${invoiceTerms}"`)
  }

  return matched
}

export async function analyzeDocuments(invoice: UploadedFile, contract: UploadedFile): Promise<AnalysisResult> {
  const invoiceText = extractText(invoice.content)
  const contractText = extractText(contract.content)

  if (!invoiceText || !contractText) {
    throw new Error('Could not extract text from one or both documents. Please ensure the files contain readable text.')
  }

  if (invoiceText.length < 20) {
    throw new Error('Invoice file appears to be empty or unreadable. Please upload a text-based document.')
  }

  if (contractText.length < 20) {
    throw new Error('Contract file appears to be empty or unreadable. Please upload a text-based document.')
  }

  await new Promise(resolve => setTimeout(resolve, 1200))

  const discrepancies: Discrepancy[] = [
    ...compareAmounts(invoiceText, contractText),
    ...compareDates(invoiceText, contractText),
    ...comparePaymentTerms(invoiceText, contractText),
    ...compareParties(invoiceText, contractText),
    ...checkMissingFields(invoiceText, contractText),
  ]

  const matchedItems = findMatchedItems(invoiceText, contractText)

  const criticalCount = discrepancies.filter(d => d.severity === 'critical').length
  const warningCount = discrepancies.filter(d => d.severity === 'warning').length
  const infoCount = discrepancies.filter(d => d.severity === 'info').length

  let overallStatus: 'pass' | 'warning' | 'fail' = 'pass'
  if (criticalCount > 0) overallStatus = 'fail'
  else if (warningCount > 0) overallStatus = 'warning'

  let summary = ''
  if (overallStatus === 'pass') {
    summary = `No significant discrepancies found between the invoice "${invoice.name}" and contract "${contract.name}". The documents appear to be consistent. Review the informational notes below for minor observations.`
  } else if (overallStatus === 'warning') {
    summary = `${warningCount} warning${warningCount > 1 ? 's' : ''} detected between the invoice "${invoice.name}" and contract "${contract.name}". These issues should be reviewed and resolved before processing payment.`
  } else {
    summary = `${criticalCount} critical issue${criticalCount > 1 ? 's' : ''} detected. The invoice "${invoice.name}" has significant discrepancies with the contract "${contract.name}" that must be addressed before payment is authorized.`
  }

  return {
    summary,
    overallStatus,
    discrepancies,
    matchedItems,
    analysisDate: new Date().toLocaleString(),
    invoiceName: invoice.name,
    contractName: contract.name,
    criticalCount,
    warningCount,
    infoCount,
  }
}
