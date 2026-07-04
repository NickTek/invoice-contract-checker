import express from 'express'
import cors from 'cors'
import Groq from 'groq-sdk'

const app = express()
const PORT = 3001

app.use(cors())
app.use(express.json({ limit: '2mb' }))

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, hasKey: !!process.env.GROQ_API_KEY })
})

app.post('/api/analyze', async (req, res) => {
  const { invoiceText, contractText, invoiceName, contractName } = req.body

  if (!invoiceText || !contractText) {
    return res.status(400).json({ error: 'Both invoiceText and contractText are required.' })
  }

  if (!process.env.GROQ_API_KEY) {
    return res.status(503).json({ error: 'GROQ_API_KEY is not configured. Please add it as a secret.' })
  }

  const systemPrompt = `You are an expert contract analyst and invoice auditor. Your job is to compare an invoice against a contract and identify every discrepancy, mismatch, or concern.

You must respond with ONLY valid JSON — no markdown, no prose, no code fences. The JSON must match this exact schema:

{
  "summary": "string — 2-3 sentence plain-English summary of findings",
  "overallStatus": "pass" | "warning" | "fail",
  "discrepancies": [
    {
      "id": "string — unique short id like 'a1b2c3'",
      "severity": "critical" | "warning" | "info",
      "category": "string — e.g. Amount, Dates, Payment Terms, Parties, Tax, Scope, Authorization",
      "title": "string — short title of the issue",
      "description": "string — clear plain-English explanation",
      "invoiceValue": "string | null — the value as stated in the invoice",
      "contractValue": "string | null — the value as stated in the contract",
      "recommendation": "string — specific actionable advice"
    }
  ],
  "matchedItems": ["string — things that correctly match between the two documents"]
}

Rules:
- severity "critical": must fix before payment (wrong parties, amount exceeds contract, unauthorized items)
- severity "warning": should review (date mismatches, missing tax info, ambiguous terms)
- severity "info": good to know (formatting notes, standard observations)
- overallStatus "fail" if any critical issues, "warning" if only warnings, "pass" if clean
- matchedItems should list 2-5 things that DO match (e.g. matching amounts, dates, party names, payment terms)
- Be specific and quote exact values from the documents when possible
- If a document is too short or seems like a placeholder, note it as critical`

  const userPrompt = `Compare this invoice against this contract and return the JSON analysis.

=== INVOICE: "${invoiceName}" ===
${invoiceText.slice(0, 6000)}

=== CONTRACT: "${contractName}" ===
${contractText.slice(0, 6000)}`

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 2048,
    })

    const raw = completion.choices[0]?.message?.content?.trim() || ''

    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch {
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('Model returned non-JSON response')
      }
    }

    if (!Array.isArray(parsed.discrepancies)) parsed.discrepancies = []
    if (!Array.isArray(parsed.matchedItems)) parsed.matchedItems = []

    parsed.discrepancies = parsed.discrepancies.map((d, i) => ({
      id: d.id || Math.random().toString(36).slice(2, 9),
      severity: ['critical', 'warning', 'info'].includes(d.severity) ? d.severity : 'info',
      category: d.category || 'General',
      title: d.title || 'Issue detected',
      description: d.description || '',
      invoiceValue: d.invoiceValue ?? null,
      contractValue: d.contractValue ?? null,
      recommendation: d.recommendation || '',
    }))

    res.json(parsed)
  } catch (err) {
    console.error('Groq error:', err)
    res.status(500).json({ error: err.message || 'Analysis failed' })
  }
})

app.listen(PORT, 'localhost', () => {
  console.log(`API server running on http://localhost:${PORT}`)
})
