import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { createRequire } from 'module'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { writeFile, readdir, readFile, rm, mkdtemp } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import Groq from 'groq-sdk'
import mammoth from 'mammoth'
import { createWorker } from 'tesseract.js'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs'

GlobalWorkerOptions.workerSrc = new URL(
  './node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
  import.meta.url
).href

const execFileAsync = promisify(execFile)
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

// --- PDF extraction: layer 1 — pdfjs-dist (handles most PDFs, including non-standard) ---
async function extractPdfWithPdfjs(buffer) {
  const data = new Uint8Array(buffer)
  const doc = await getDocument({ data, verbosity: 0 }).promise
  const pages = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items
      .map(item => ('str' in item ? item.str : ''))
      .join(' ')
    pages.push(pageText)
  }
  await doc.destroy()
  return pages.join('\n').trim()
}

// --- PDF extraction: layer 2 — pdf-parse v1 (legacy fallback) ---
async function extractPdfWithPdfParse(buffer) {
  const data = await pdfParse(buffer)
  return (data.text || '').trim()
}

// --- PDF extraction: layer 3 — pdftoppm → tesseract OCR (scanned/image PDFs) ---
async function extractPdfWithOcr(buffer) {
  const tmpDir = await mkdtemp(join(tmpdir(), 'pdf-ocr-'))
  const pdfPath = join(tmpDir, 'input.pdf')
  try {
    await writeFile(pdfPath, buffer)

    // Convert all PDF pages to PNG images at 200dpi
    await execFileAsync('pdftoppm', [
      '-png', '-r', '200',
      pdfPath,
      join(tmpDir, 'page'),
    ])

    const files = (await readdir(tmpDir))
      .filter(f => f.endsWith('.png'))
      .sort()

    if (files.length === 0) {
      throw new Error('pdftoppm produced no output images')
    }

    // OCR each page image
    const worker = await createWorker('eng')
    const pageTexts = []
    for (const filename of files) {
      const imgBuffer = await readFile(join(tmpDir, filename))
      const { data: { text } } = await worker.recognize(imgBuffer)
      pageTexts.push(text)
    }
    await worker.terminate()

    return pageTexts.join('\n').trim()
  } finally {
    await rm(tmpDir, { recursive: true, force: true })
  }
}

// --- Main PDF extractor: tries all three layers, returns first success ---
async function extractPdfText(buffer) {
  const errors = []

  // Layer 1: pdfjs-dist
  try {
    const text = await extractPdfWithPdfjs(buffer)
    if (text.length >= 20) {
      console.log('[PDF] Extracted with pdfjs-dist')
      return text
    }
    errors.push('pdfjs-dist: extracted text too short (likely scanned PDF)')
  } catch (e) {
    errors.push(`pdfjs-dist: ${e.message}`)
    console.log('[PDF] pdfjs-dist failed:', e.message)
  }

  // Layer 2: pdf-parse v1
  try {
    const text = await extractPdfWithPdfParse(buffer)
    if (text.length >= 20) {
      console.log('[PDF] Extracted with pdf-parse')
      return text
    }
    errors.push('pdf-parse: extracted text too short (likely scanned PDF)')
  } catch (e) {
    errors.push(`pdf-parse: ${e.message}`)
    console.log('[PDF] pdf-parse failed:', e.message)
  }

  // Layer 3: OCR via pdftoppm + tesseract
  try {
    const text = await extractPdfWithOcr(buffer)
    if (text.length >= 20) {
      console.log('[PDF] Extracted with OCR fallback')
      return text
    }
    errors.push('OCR: extracted text too short or blank')
  } catch (e) {
    errors.push(`OCR: ${e.message}`)
    console.log('[PDF] OCR fallback failed:', e.message)
  }

  throw new Error(
    'All PDF extraction methods failed. The file may be corrupted, password-protected, or contain no readable content. ' +
    `Details: ${errors.join('; ')}`
  )
}

// --- General file text extractor ---
async function extractText(buffer, mimetype, originalname) {
  const ext = originalname.split('.').pop().toLowerCase()

  if (ext === 'pdf' || mimetype === 'application/pdf') {
    return extractPdfText(buffer)
  }

  if (
    ext === 'docx' ||
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
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
    return res.status(400).json({ error: 'Contract file appears empty after extraction. It may be a blank or image-only PDF with no readable text.' })
  }
  if (!invoiceText || invoiceText.length < 10) {
    return res.status(400).json({ error: 'Invoice file appears empty after extraction. It may be a blank or image-only PDF with no readable text.' })
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

  const userPrompt = `CONTRACT TEXT:\n${contractText.slice(0, 8000)}\n\nINVOICE TEXT:\n${invoiceText.slice(0, 8000)}`

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
      if (match) parsed = JSON.parse(match[0])
      else throw new Error('Model returned non-JSON output')
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
