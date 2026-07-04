import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { createRequire } from 'module'
import Groq from 'groq-sdk'
import mammoth from 'mammoth'
import { createWorker } from 'tesseract.js'

const require = createRequire(import.meta.url)
const pdfParse = require('pdf-parse')

const app = express()
const PORT = 3001

app.use(cors())
app.use(express.json())

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
})

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

async function extractText(buffer, mimetype, originalname) {
  const ext = originalname.split('.').pop().toLowerCase()

  if (ext === 'pdf' || mimetype === 'application/pdf') {
    const data = await pdfParse(buffer)
    return data.text.trim()
  }

  if (ext === 'docx' || mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const result = await mammoth.extractRawText({ buffer })
    return result.value.trim()
  }

  if (ext === 'doc' || mimetype === 'application/msword') {
    const result = await mammoth.extractRawText({ buffer })
    return result.value.trim()
  }

  const imageTypes = ['jpg', 'jpeg', 'png', 'webp', 'tiff', 'tif', 'bmp', 'gif']
  if (imageTypes.includes(ext) || mimetype.startsWith('image/')) {
    const worker = await createWorker('eng')
    const { data: { text } } = await worker.recognize(buffer)
    await worker.terminate()
    return text.trim()
  }

  if (ext === 'txt' || mimetype === 'text/plain') {
    return buffer.toString('utf-8').trim()
  }

  throw new Error(`Unsupported file type: .${ext}`)
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, hasKey: !!process.env.GROQ_API_KEY })
})

app.post('/api/check', upload.fields([
  { name: 'contract', maxCount: 1 },
  { name: 'invoice', maxCount: 1 },
]), async (req, res) => {
  if (!process.env.GROQ_API_KEY) {
    return res.status(503).json({ error: 'GROQ_API_KEY is not configured.' })
  }

  const contractFile = req.files?.contract?.[0]
  const invoiceFile = req.files?.invoice?.[0]

  if (!contractFile || !invoiceFile) {
    return res.status(400).json({ error: 'Both a contract and an invoice file are required.' })
  }

  let contractText, invoiceText
  try {
    contractText = await extractText(contractFile.buffer, contractFile.mimetype, contractFile.originalname)
  } catch (err) {
    return res.status(400).json({ error: `Could not read contract: ${err.message}` })
  }
  try {
    invoiceText = await extractText(invoiceFile.buffer, invoiceFile.mimetype, invoiceFile.originalname)
  } catch (err) {
    return res.status(400).json({ error: `Could not read invoice: ${err.message}` })
  }

  if (!contractText || contractText.length < 10) {
    return res.status(400).json({ error: 'Contract file appears to be empty or unreadable.' })
  }
  if (!invoiceText || invoiceText.length < 10) {
    return res.status(400).json({ error: 'Invoice file appears to be empty or unreadable.' })
  }

  const today = new Date().toISOString().split('T')[0]

  const systemPrompt = `You are an expert invoice auditor. Analyze a contract and an invoice, then return ONLY valid JSON — no markdown, no code fences, no commentary.

Return this exact structure:
{
  "status": "No Issues Found" or "Issues Found",
  "contract_summary": {
    "vendor": "vendor name from contract or null",
    "rate_terms": "pricing/rate terms from contract",
    "payment_terms": "payment terms from contract"
  },
  "invoice_summary": {
    "vendor": "vendor name from invoice or null",
    "line_items": ["item description and amount", ...],
    "total": "total amount from invoice"
  },
  "discrepancies": [
    "Plain English description of each issue found"
  ]
}

Rules:
- Today is ${today}. Flag any invoice dated more than 90 days ago as unusually old.
- Check: vendor name match, rates/prices match contract terms, line item math adds up to the stated total, payment terms match.
- discrepancies must be an array of strings. Empty array [] if status is "No Issues Found".
- Be specific — quote the actual values that conflict (e.g. "Invoice rate is $120/hr but contract specifies $100/hr").
- If text is too short or garbled to analyze, set status to "Issues Found" and note it in discrepancies.`

  const userPrompt = `CONTRACT TEXT:
${contractText.slice(0, 8000)}

INVOICE TEXT:
${invoiceText.slice(0, 8000)}`

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.05,
      max_tokens: 1024,
    })

    const raw = completion.choices[0]?.message?.content?.trim() || ''

    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch {
      const match = raw.match(/\{[\s\S]*\}/)
      if (match) {
        parsed = JSON.parse(match[0])
      } else {
        throw new Error('Model returned non-JSON output')
      }
    }

    if (!Array.isArray(parsed.discrepancies)) parsed.discrepancies = []

    res.json(parsed)
  } catch (err) {
    console.error('Groq error:', err)
    res.status(500).json({ error: err.message || 'AI analysis failed. Please try again.' })
  }
})

app.listen(PORT, 'localhost', () => {
  console.log(`API server running on http://localhost:${PORT}`)
})
