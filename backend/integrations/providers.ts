/**
 * Integration peers: outside services a user signs in with (OAuth) that then provide capabilities to the tree
 * (repositories, a calendar, messages) and consume some of ours; platform peers the account is already set up
 * with (Stripe for payments); and channel peers (a phone number, for text notifications and texted commands).
 * The registry is data; `backend/integrations/routes.ts` runs the flows and the handlers. Language models are
 * the fos server's own capability (its keys), not something a user connects.
 */

import { INTEGRATION_PEERS, type IntegrationPeer } from '@fosforescent/shared/sync/index'

export type ProviderKind = IntegrationPeer['kind']

export type Provider = IntegrationPeer & {
  oauth?: {
    authorizeUrl: string
    tokenUrl: string
    scopes: string[]
    /** Extra query parameters on the authorize URL (Google: offline access, consent prompt). */
    extra?: Record<string, string>
    /** Env names of the client id and secret. */
    clientIdEnv: string
    clientSecretEnv: string
    /** Header the token endpoint wants its answer in (GitHub answers form-encoded unless asked for JSON). */
    tokenAccept?: string
  }
}

const OAUTH: Record<string, Provider['oauth']> = {
  github: { authorizeUrl: 'https://github.com/login/oauth/authorize', tokenUrl: 'https://github.com/login/oauth/access_token', scopes: ['repo', 'read:user'], clientIdEnv: 'GITHUB_CLIENT_ID', clientSecretEnv: 'GITHUB_CLIENT_SECRET', tokenAccept: 'application/json' },
  google: { authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth', tokenUrl: 'https://oauth2.googleapis.com/token', scopes: ['https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/userinfo.email'], extra: { access_type: 'offline', prompt: 'consent' }, clientIdEnv: 'GOOGLE_OAUTH_CLIENT_ID', clientSecretEnv: 'GOOGLE_OAUTH_CLIENT_SECRET' },
  discord: { authorizeUrl: 'https://discord.com/api/oauth2/authorize', tokenUrl: 'https://discord.com/api/oauth2/token', scopes: ['identify'], clientIdEnv: 'DISCORD_CLIENT_ID', clientSecretEnv: 'DISCORD_CLIENT_SECRET' }
}

export const PROVIDERS: Provider[] = INTEGRATION_PEERS.map((peer) => ({
  ...peer, ...(OAUTH[peer.id] ? { oauth: OAUTH[peer.id] } : {})
}))

export function providerById(id: string): Provider | undefined {
  return PROVIDERS.find((p) => p.id === id)
}
