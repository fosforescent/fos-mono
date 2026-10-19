/**
 * Semantic search over rows. Every row of a user's tree is embedded (title, or
 * the first lines of a note) with Vertex AI text embeddings and kept in the
 * RowEmbeddingModel table (pgvector). Rows whose ref node is listed on the
 * market are searchable by other accounts.
 *
 *   indexStore(prisma, user, store, embed)   upsert changed rows, drop vanished ones (after a save)
 *   searchRows(prisma, {userId, query, market, limit}, embed)
 *
 * The embedding function is injected so tests run without Vertex.
 */

import { createHash } from 'node:crypto'
import { FosStore } from '@fosforescent/shared/dag-implementation/store'
import { LISTING_ARGUMENT, createReplica, marketplaceOffers, namedValueOf, withMainBranchPolicy, content, identityCid, isRowEdge, rootTargetCid, rowKindOf, valueContent, isShippedLibrary, type Scope } from '@fosforescent/shared/sync/index'

export type Embed = (texts: string[]) => Promise<number[][]>

export const EMBEDDING_DIM = 768

export type IndexedRow = { aliasId: string; kind: string; title: string; path: Scope; market: boolean; text: string }

/** Rows worth indexing (supplies are not; a note contributes its first 600 characters). */
export function collectRows(store: FosStore, limit = 5000): IndexedRow[] {
  const out: IndexedRow[] = [], seen = new Set<string>()
  const walk = (cid: string, path: Scope, inherited: boolean) => {
    if (seen.has(cid) || seen.size >= limit || path.length > 64) return
    seen.add(cid)
    for (const edge of valueContent(store, cid).children) {
      if (out.length >= limit) return
      const kind = rowKindOf(store, edge)
      // a device root's shipped library is not the account's content
      if (!kind || isShippedLibrary(store, path, edge)) continue
      const id = identityCid(store, edge)
      const identity = content(store, id)
      const value = valueContent(store, id)
      const aliasId = identity.data.alias?.id
      if (!aliasId) continue
      const market = inherited || !!namedValueOf(store, id, LISTING_ARGUMENT)
      const title = (value.data.description?.content ?? '').trim()
      if (kind !== 'supply' && kind !== 'ref' && title) {
        const text = kind === 'note' ? title.slice(0, 600) : title.slice(0, 300)
        out.push({ aliasId, kind, title: title.split('\n')[0]!.slice(0, 200), path, market, text })
      }
      walk(id, [...path, aliasId], market)
    }
  }
  withMainBranchPolicy(store, () => walk(rootTargetCid(store), [], false))
  for (const offer of marketplaceOffers(createReplica('market-index', store))) {
    const text = `${offer.label} ${valueContent(store, offer.cid).data.description?.content ?? ''}`.trim().slice(0, 600)
    out.push({ aliasId: offer.id, kind: 'capability', title: offer.label, path: offer.path, market: true, text })
  }
  return out
}

function textHash(text: string, market: boolean): string {
  return createHash('sha1').update(`${market ? 'm' : 'p'}:${text}`).digest('hex')
}

type Prisma = { $queryRawUnsafe: (sql: string, ...params: unknown[]) => Promise<unknown>; $executeRawUnsafe: (sql: string, ...params: unknown[]) => Promise<unknown> }

/** Upsert embeddings for rows whose text or market flag changed, remove rows that are gone. */
export async function indexStore(prisma: Prisma, user: { id: number; username: string }, store: FosStore, embed: Embed): Promise<{ embedded: number; removed: number }> {
  const rows = collectRows(store)
  const existing = (await prisma.$queryRawUnsafe('SELECT "aliasId", "textHash" FROM "RowEmbeddingModel" WHERE "userId" = $1', user.id)) as Array<{ aliasId: string; textHash: string }>
  const known = new Map(existing.map((r) => [r.aliasId, r.textHash]))
  const changed = rows.filter((r) => known.get(r.aliasId) !== textHash(r.text, r.market))
  const present = new Set(rows.map((r) => r.aliasId))
  const gone = existing.filter((r) => !present.has(r.aliasId)).map((r) => r.aliasId)
  if (gone.length) await prisma.$executeRawUnsafe('DELETE FROM "RowEmbeddingModel" WHERE "userId" = $1 AND "aliasId" = ANY($2::text[])', user.id, gone)
  let embedded = 0
  for (let i = 0; i < changed.length; i += 32) {
    const batch = changed.slice(i, i + 32)
    const vectors = await embed(batch.map((r) => r.text))
    for (const [j, row] of batch.entries()) {
      const vector = vectors[j]
      if (!vector) continue
      await prisma.$executeRawUnsafe(
        `INSERT INTO "RowEmbeddingModel" ("userId", "owner", "aliasId", "kind", "title", "path", "market", "textHash", "embedding", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9::vector, NOW())
         ON CONFLICT ("userId", "aliasId") DO UPDATE SET "kind" = EXCLUDED."kind", "title" = EXCLUDED."title", "path" = EXCLUDED."path", "market" = EXCLUDED."market", "textHash" = EXCLUDED."textHash", "embedding" = EXCLUDED."embedding", "updatedAt" = NOW()`,
        user.id, user.username, row.aliasId, row.kind, row.title, JSON.stringify(row.path), row.market, textHash(row.text, row.market), `[${vector.join(',')}]`
      )
      embedded++
    }
  }
  return { embedded, removed: gone.length }
}

export type SearchHit = { aliasId: string; title: string; kind: string; score: number; owner: string | null; path: Scope }

export async function searchRows(prisma: Prisma, params: { userId: number; query: string; market: boolean; limit: number }, embed: Embed): Promise<SearchHit[]> {
  const [vector] = await embed([params.query])
  if (!vector) return []
  const limit = Math.max(1, Math.min(50, params.limit))
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT "aliasId", "title", "kind", "path", "userId", "owner", 1 - ("embedding" <=> $1::vector) AS score
     FROM "RowEmbeddingModel"
     WHERE "userId" = $2 OR ($3 AND "market")
     ORDER BY "embedding" <=> $1::vector
     LIMIT $4`,
    `[${vector.join(',')}]`, params.userId, params.market, limit
  )) as Array<{ aliasId: string; title: string; kind: string; path: unknown; userId: number; owner: string; score: number }>
  return rows.map((r) => ({
    aliasId: r.aliasId,
    title: r.title,
    kind: r.kind,
    score: Number(r.score),
    owner: r.userId === params.userId ? null : r.owner,
    path: Array.isArray(r.path) ? (r.path as Scope) : typeof r.path === 'string' ? (JSON.parse(r.path) as Scope) : []
  }))
}

/** Vertex AI text embeddings (text-embedding-005, 768 dimensions) through the same client as voice notes. */
export function vertexEmbed(): Embed {
  const project = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT
  const location = process.env.VERTEX_LOCATION || process.env.GCP_REGION || 'us-central1'
  const model = process.env.EMBEDDING_MODEL || 'text-embedding-005'
  let clientPromise: Promise<any> | null = null
  return async (texts) => {
    if (!project) throw new Error('GCP_PROJECT_ID is not configured')
    if (!clientPromise) clientPromise = import('@google/genai').then((m) => new m.GoogleGenAI({ vertexai: true, project, location }))
    const ai = await clientPromise
    const response = await ai.models.embedContent({ model, contents: texts, config: { outputDimensionality: EMBEDDING_DIM } })
    return (response.embeddings ?? []).map((e: { values?: number[] }) => e.values ?? [])
  }
}
