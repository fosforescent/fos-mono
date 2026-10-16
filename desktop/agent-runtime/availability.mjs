import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

// Report configuration, not credential validity. Probing never sends a model request.
export async function probeAgents({ env = process.env, exists = existsSync, home = homedir(), load = name => import(name) } = {}) {
  const result = { type: 'availability', codex: false, claude: false, diagnostics: {} }
  for (const provider of ['codex', 'claude']) {
    try {
      const sdk = await load(provider === 'codex' ? '@openai/codex-sdk' : '@anthropic-ai/claude-agent-sdk')
      if (provider === 'codex') new sdk.Codex()
      const configured = provider === 'codex'
        ? !!(env.OPENAI_API_KEY || env.CODEX_API_KEY || exists(join(env.CODEX_HOME || join(home, '.codex'), 'auth.json')))
        : !!(env.ANTHROPIC_API_KEY || ['CLAUDE_CODE_USE_BEDROCK', 'CLAUDE_CODE_USE_VERTEX'].some(key => ['1', 'true'].includes(env[key]?.toLowerCase())))
      result[provider] = configured
      if (!configured) result.diagnostics[provider] = provider === 'codex'
        ? 'Sign in with codex login or set OPENAI_API_KEY / CODEX_API_KEY, then restart Fos.'
        : 'Set ANTHROPIC_API_KEY or configure Bedrock / Vertex in the desktop environment, then restart Fos.'
    } catch {
      result.diagnostics[provider] = 'SDK installation unavailable. Run npm run prepare:agents in desktop, including optional dependencies, then check again.'
    }
  }
  return result
}
