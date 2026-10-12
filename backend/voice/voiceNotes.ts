/**
 * Voice notes: audio → transcript → hierarchical summary → sentiment clusters,
 * returned as a tree the client turns into note blocks.
 *
 *   POST /user/data/voice-notes   body: raw audio (Content-Type audio/webm, audio/mp4, …), ≤ 25 MB
 *   → { transcript, title, summary, clusters: [{ title, sentiment, summary, points }] }
 *
 * Long transcripts are summarized hierarchically: fixed-size chunks are each
 * summarized, then the chunk summaries are summarized together, so the final
 * summary and the clustering never see more than one model context.
 *
 * Provider: Gemini on Vertex AI by default (the Cloud Run service account has
 * roles/aiplatform.user; locally, application-default credentials), OpenAI
 * when VOICE_PROVIDER=openai. Spend is metered per user from the models'
 * token counts; users without an active subscription get VOICE_FREE_BUDGET_USD
 * (default 1.00) in total, after which the endpoint answers 402.
 */

import type { Request, Response } from 'express'

export type Sentiment = 'positive' | 'negative' | 'neutral' | 'mixed'
export type VoiceCluster = { title: string; sentiment: Sentiment; summary: string; points: string[] }
export type VoiceNote = { transcript: string; title: string; summary: string; clusters: VoiceCluster[] }

export type VoiceDeps = {
  /** Audio bytes → transcript text. */
  transcribe(audio: Buffer, mimeType: string): Promise<string>
  /** Prompt → text (JSON when `json` is set, validated by the caller). */
  complete(system: string, user: string, json?: boolean): Promise<string>
  /** Words per chunk for hierarchical summarization. */
  chunkWords?: number
  /** Cost (USD) and tokens consumed since the last call to `drain`; providers that meter their calls implement it. */
  drain?(): { usd: number; tokens: number }
}

/** Per-user spend accounting for the free budget. */
export type VoiceUsage = {
  /** Who is calling (from the JWT); null → 401. */
  userOf(req: Request): Promise<{ id: number; paying: boolean } | null>
  /** USD spent so far by this user on voice notes. */
  spent(userId: number): Promise<number>
  record(userId: number, entry: { usd: number; tokens: number; seconds: number; bytes: number; clusters: number }): Promise<void>
  budgetUsd: number
}

const SENTIMENTS: Sentiment[] = ['positive', 'negative', 'neutral', 'mixed']

export function chunkText(text: string, words: number): string[] {
  const all = text.split(/\s+/).filter(Boolean)
  const chunks: string[] = []
  for (let i = 0; i < all.length; i += words) chunks.push(all.slice(i, i + words).join(' '))
  return chunks.length ? chunks : ['']
}

/** Summarize chunks, then summarize the summaries, until one summary remains. */
export async function summarizeHierarchically(deps: VoiceDeps, transcript: string): Promise<{ summary: string; levels: number }> {
  const words = deps.chunkWords ?? 900
  let pieces = chunkText(transcript, words)
  let levels = 0
  const system = 'You summarize spoken notes faithfully. Keep every distinct point, decision, question and name. Write compact prose, no preamble.'
  while (true) {
    levels++
    if (pieces.length === 1) {
      return { summary: await deps.complete(system, `Summarize this ${levels === 1 ? 'transcript' : 'set of partial summaries'}:\n\n${pieces[0]}`), levels }
    }
    const next: string[] = []
    for (const piece of pieces) next.push(await deps.complete(system, `Summarize this part of a longer recording:\n\n${piece}`))
    pieces = chunkText(next.join('\n\n'), words)
  }
}

function parseClusters(raw: string): Omit<VoiceNote, 'transcript'> {
  let data: unknown
  try { data = JSON.parse(raw) } catch { throw new Error('model returned invalid JSON') }
  const obj = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>
  const clusters = Array.isArray(obj.clusters) ? obj.clusters : []
  return {
    title: String(obj.title ?? 'Voice note').slice(0, 120),
    summary: String(obj.summary ?? ''),
    clusters: clusters
      .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
      .map((c) => ({
        title: String(c.title ?? 'Untitled').slice(0, 120),
        sentiment: (SENTIMENTS.includes(c.sentiment as Sentiment) ? c.sentiment : 'neutral') as Sentiment,
        summary: String(c.summary ?? ''),
        points: Array.isArray(c.points) ? c.points.map((p) => String(p)).filter(Boolean).slice(0, 40) : []
      }))
      .slice(0, 20)
  }
}

export async function voiceNoteFromAudio(deps: VoiceDeps, audio: Buffer, mimeType: string): Promise<VoiceNote> {
  const transcript = (await deps.transcribe(audio, mimeType)).trim()
  if (!transcript) throw new Error('nothing was transcribed')
  const { summary } = await summarizeHierarchically(deps, transcript)
  const raw = await deps.complete(
    'You organize spoken notes. Group what was said into clusters of similar sentiment and topic. Respond with JSON only: {"title": string, "summary": string, "clusters": [{"title": string, "sentiment": "positive"|"negative"|"neutral"|"mixed", "summary": string, "points": string[]}]}. Points are short, concrete statements in the speaker\'s own terms; every substantive point in the transcript belongs to exactly one cluster.',
    `Overall summary:\n${summary}\n\nTranscript:\n${transcript}`,
    true
  )
  const organized = parseClusters(raw)
  return { transcript, ...organized, summary: organized.summary || summary }
}

/** Express handler; the raw body is the audio (see express.raw in index.ts). */
export function createVoiceNoteHandler(deps: VoiceDeps, usage?: VoiceUsage) {
  return async (req: Request, res: Response): Promise<Response> => {
    const raw = req.body as { length?: unknown } | undefined
    // express.raw gives a Buffer; accept any byte-array-like body (test environments may hand over another realm's Buffer)
    const audio = raw && typeof raw === 'object' && typeof raw.length === 'number' && raw.length > 0 ? Buffer.from(raw as unknown as Uint8Array) : null
    if (!audio) return res.status(400).json({ error: 'send the recording as the raw request body with an audio/* content type' })
    const mimeType = (req.header('content-type') ?? 'audio/webm').split(';')[0] as string
    let user: { id: number; paying: boolean } | null = null
    if (usage) {
      user = await usage.userOf(req)
      if (!user) return res.status(401).json({ error: 'Unauthorized' })
      if (!user.paying) {
        const spent = await usage.spent(user.id)
        if (spent >= usage.budgetUsd) {
          return res.status(402).json({ error: `Voice notes have used up the free budget ($${usage.budgetUsd.toFixed(2)}). Subscribe to keep transcribing.`, spentUsd: spent, budgetUsd: usage.budgetUsd })
        }
      }
    }
    const started = Date.now()
    deps.drain?.()
    try {
      const note = await voiceNoteFromAudio(deps, audio, mimeType)
      const cost = deps.drain?.() ?? { usd: 0, tokens: 0 }
      if (usage && user) await usage.record(user.id, { usd: cost.usd, tokens: cost.tokens, seconds: (Date.now() - started) / 1000, bytes: audio.length, clusters: note.clusters.length })
      return res.json({ ...note, cost: { usd: cost.usd, tokens: cost.tokens } })
    } catch (error) {
      const cost = deps.drain?.() ?? { usd: 0, tokens: 0 }
      if (usage && user && cost.usd > 0) await usage.record(user.id, { usd: cost.usd, tokens: cost.tokens, seconds: (Date.now() - started) / 1000, bytes: audio.length, clusters: 0 })
      console.error('voice note failed:', error instanceof Error ? error.message : error)
      return res.status(502).json({ error: `transcription failed: ${error instanceof Error ? error.message : String(error)}` })
    }
  }
}

/**
 * Gemini on Vertex AI. One multimodal call transcribes the audio; text calls do the
 * summaries and clustering. Token counts come from usageMetadata and are priced with
 * VOICE_PRICE_* (USD per 1M tokens; defaults are Gemini 2.5 Flash list prices).
 */
export function geminiVoiceDeps(): VoiceDeps {
  const project = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT
  const location = process.env.VERTEX_LOCATION || process.env.GCP_REGION || 'us-central1'
  const model = process.env.VOICE_GEMINI_MODEL || 'gemini-2.5-flash'
  const price = {
    text: Number(process.env.VOICE_PRICE_TEXT_IN ?? 0.30),
    audio: Number(process.env.VOICE_PRICE_AUDIO_IN ?? 1.00),
    out: Number(process.env.VOICE_PRICE_OUT ?? 2.50)
  }
  let clientPromise: Promise<any> | null = null
  const client = async () => {
    if (!project) throw new Error('GCP_PROJECT_ID is not configured')
    if (!clientPromise) clientPromise = import('@google/genai').then((m) => new m.GoogleGenAI({ vertexai: true, project, location }))
    return clientPromise
  }
  let usd = 0
  let tokens = 0
  const meter = (response: any, audioIn: boolean) => {
    const u = response?.usageMetadata ?? {}
    const inTok = Number(u.promptTokenCount ?? 0)
    const outTok = Number(u.candidatesTokenCount ?? 0) + Number(u.thoughtsTokenCount ?? 0)
    // audio prompts are billed at the audio rate; without a per-modality split, price the whole prompt as audio
    usd += (inTok * (audioIn ? price.audio : price.text) + outTok * price.out) / 1_000_000
    tokens += inTok + outTok
  }
  const textOf = (response: any): string => {
    if (typeof response?.text === 'string') return response.text
    const parts = response?.candidates?.[0]?.content?.parts ?? []
    return parts.map((p: any) => p?.text ?? '').join('')
  }
  return {
    async transcribe(audio, mimeType) {
      const ai = await client()
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [
          { inlineData: { mimeType, data: audio.toString('base64') } },
          { text: 'Transcribe this recording verbatim in its original language. Output only the transcript, no commentary, no speaker labels unless clearly needed.' }
        ] }],
        config: { temperature: 0 }
      })
      meter(response, true)
      return textOf(response).trim()
    },
    async complete(system, user, json) {
      const ai = await client()
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: user }] }],
        config: { systemInstruction: system, temperature: 0.2, ...(json ? { responseMimeType: 'application/json' } : {}) }
      })
      meter(response, false)
      return textOf(response)
    },
    drain() {
      const out = { usd, tokens }
      usd = 0; tokens = 0
      return out
    }
  }
}

/** Pick the provider from the environment: Gemini when a GCP project is configured (default), OpenAI on request. */
export function voiceDepsFromEnv(): VoiceDeps {
  const provider = process.env.VOICE_PROVIDER || ((process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT) ? 'google' : 'openai')
  return provider === 'openai' ? openAiVoiceDeps() : geminiVoiceDeps()
}

/** Production dependencies on OpenAI (loaded lazily so tests and local runs without a key still start). */
export function openAiVoiceDeps(): VoiceDeps {
  let usd = 0
  let tokens = 0
  let clientPromise: Promise<any> | null = null
  const client = async () => {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured')
    if (!clientPromise) clientPromise = import('openai').then((m) => new (m.default ?? m.OpenAI)({ apiKey: process.env.OPENAI_API_KEY }))
    return clientPromise
  }
  return {
    async transcribe(audio, mimeType) {
      const openai = await client()
      const { toFile } = await import('openai')
      const ext = mimeType.includes('mp4') || mimeType.includes('m4a') ? 'm4a' : mimeType.includes('mpeg') || mimeType.includes('mp3') ? 'mp3' : mimeType.includes('ogg') ? 'ogg' : mimeType.includes('wav') ? 'wav' : 'webm'
      const file = await toFile(audio, `voice.${ext}`, { type: mimeType })
      const result = await openai.audio.transcriptions.create({ file, model: process.env.VOICE_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe' })
      usd += (audio.length / 360_000) * 0.003 // ≈ $0.003 per minute of opus at 48 kbps
      return typeof result === 'string' ? result : result.text ?? ''
    },
    async complete(system, user, json) {
      const openai = await client()
      const completion = await openai.chat.completions.create({
        model: process.env.VOICE_SUMMARY_MODEL || 'gpt-4o-mini',
        temperature: 0.2,
        ...(json ? { response_format: { type: 'json_object' } } : {}),
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }]
      })
      const u = completion.usage ?? {}
      usd += (Number(u.prompt_tokens ?? 0) * 0.15 + Number(u.completion_tokens ?? 0) * 0.60) / 1_000_000
      tokens += Number(u.total_tokens ?? 0)
      return completion.choices?.[0]?.message?.content ?? ''
    },
    drain() {
      const out = { usd, tokens }
      usd = 0; tokens = 0
      return out
    }
  }
}

/** Usage accounting on Prisma: one ToolUseModel row per voice note (toolName "voice-note", cost in metadata.usd). */
export function prismaVoiceUsage(prisma: { userModel: any; toolUseModel: any }, budgetUsd = Number(process.env.VOICE_FREE_BUDGET_USD ?? 1)): VoiceUsage {
  return {
    budgetUsd,
    async userOf(req) {
      const username = (req as Request & { claims?: { username?: string } }).claims?.username
      if (!username) return null
      const user = await prisma.userModel.findUnique({ where: { user_name: username }, select: { id: true, subscription_status: true, role: true } })
      if (!user) return null
      const paying = ['active', 'trialing', 'past_due'].includes(String(user.subscription_status ?? '')) || ['admin', 'superadmin'].includes(String(user.role ?? ''))
      return { id: user.id, paying }
    },
    async spent(userId) {
      const rows: Array<{ metadata: unknown }> = await prisma.toolUseModel.findMany({ where: { callerUserId: userId, toolName: 'voice-note' }, select: { metadata: true } })
      return rows.reduce((sum, r) => sum + Number((r.metadata as { usd?: unknown })?.usd ?? 0), 0)
    },
    async record(userId, entry) {
      const { randomUUID } = await import('node:crypto')
      await prisma.toolUseModel.create({ data: {
        toolUseId: randomUUID(), callerUserId: userId, toolName: 'voice-note', toolDescription: 'Voice note transcription and clustering',
        status: 'completed', duration: Math.round(entry.seconds * 1000), tokenCost: entry.tokens, completedAt: new Date(),
        inputParameters: { bytes: entry.bytes }, outputResult: { clusters: entry.clusters }, metadata: { usd: entry.usd, tokens: entry.tokens }
      } })
    }
  }
}
