import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'

/**
 * Centralized AI client access.
 *
 * Two providers are used in this app, for distinct purposes:
 *  - Anthropic  → all text generation (chat, blueprints, reports, homework).
 *                 Model: claude-opus-4-5.
 *  - OpenAI     → embeddings only (text-embedding-3-small), used by
 *                 src/lib/brain-search.ts for vector search against the Brain.
 *
 * Clients are created lazily and cached, so importing this module never
 * throws when a key is missing — the error only surfaces when a route
 * actually tries to use the provider. This keeps the build and unrelated
 * routes working even when ANTHROPIC_API_KEY is unset (e.g. the `dev`
 * script does `env -u ANTHROPIC_API_KEY`).
 */

export const CLAUDE_MODEL = 'claude-opus-4-5'

let anthropicClient: Anthropic | null = null
let openaiClient: OpenAI | null = null

/** Returns a cached Anthropic client. Throws a clear error if the key is missing. */
export function getAnthropic(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set on the server')
    }
    anthropicClient = new Anthropic({ apiKey })
  }
  return anthropicClient
}

/** Returns a cached OpenAI client. Throws a clear error if the key is missing. */
export function getOpenAI(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not set on the server')
    }
    openaiClient = new OpenAI({ apiKey })
  }
  return openaiClient
}
