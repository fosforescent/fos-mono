import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import './style.css'
import { virtualPeerFromUrl, virtualPeerToken, virtualStorage } from './virtual'
import { App } from './app'
import { pickStorage, createMemoryStorage } from './storage'
import { createProjectStorage, findProject, saveDevice } from './project'
import { serverPolicyOf } from '../../shared/sync/index'
import { mountUi } from './ui'
import { mountSharedNode } from './sharing'

const env = import.meta.env as Record<string, string | undefined> & { DEV?: boolean }

// A device reconnects with the session it stored (a token, never a password).
// Credentials from the build environment are a development convenience only
// and are never embedded in a production bundle.
const devCredentials =
  env.DEV && env.VITE_API_USERNAME && env.VITE_API_PASSWORD
    ? { username: env.VITE_API_USERNAME, password: env.VITE_API_PASSWORD }
    : null

const root = document.getElementById('app')
if (!root) throw new Error('missing #app root')

// Project mode: inside the desktop shell, a directory with fos.config.toml
// decides the server, the device name and where state lives (.fos/).
const virtualRequested = !!virtualPeerToken()
const virtual = virtualPeerFromUrl()
const project = virtualRequested ? null : await findProject()
const storage = virtual ? virtualStorage(virtual) : virtualRequested ? createMemoryStorage() : project ? await createProjectStorage(project) : pickStorage()
const baseUrl = (project?.config.attach?.server ?? env.VITE_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')

const app = new App({
  baseUrl,
  autoLogin: project ? null : devCredentials,
  storage,
  scopedDocument: virtualRequested,
  // [server] to/from in fos.config.toml fixes what this directory sends to and takes from the account server
  project: project ? { dir: project.dir, branch: () => (storage as { branch?: () => string }).branch?.() ?? null, deviceName: project.config.attach?.name ?? project.dir.split(/[\\/]/).filter(Boolean).pop(), policy: serverPolicyOf(project.config) } : undefined
})

if (!project) app.enableVirtualPeers(virtual)
if (virtual) {
  document.title = `${virtual.name} — Fosforescent`
  const url = new URL(location.href); url.searchParams.set('virtual', virtual.token); history.replaceState(null, '', url)
}
mountUi(root, app)
if (virtualRequested && !virtual) app.notify('error', 'This virtual peer connection is unavailable. Spawn a new peer from the original tab.')
else app.start()
mountSharedNode(root, app, baseUrl)

// A `fos` CLI opened this page to have its sign-in approved (?device=CODE).
const params = new URL(location.href).searchParams
const deviceCode = params.get('device')
if (deviceCode) {
  app.setDeviceCode(deviceCode)
  history.replaceState(null, '', location.pathname)
}
// The confirmation email's one-click link, and the password reset link.
const confirmToken = params.get('confirm-email-token')
if (confirmToken) { void app.confirmWithToken(confirmToken); history.replaceState(null, '', location.pathname) }
const resetToken = params.get('reset-password-token')
if (resetToken) { app.setAuthFlow({ phase: 'reset', token: resetToken }); app.openModal('connect'); history.replaceState(null, '', location.pathname) }
// Back from an integration peer's sign-in page (?integration=github&ok=1).
const integration = params.get('integration')
if (integration) {
  app.integrationReturned(integration, params.get('ok') === '1', params.get('message'))
  history.replaceState(null, '', location.pathname)
}

if (project) {
  const projectStorage = storage as Awaited<ReturnType<typeof createProjectStorage>>
  saveDevice(project, { peerId: app.state.replica.meta.peerId, name: app.state.deviceName })
  // Not attached yet but the config carries an invite token: attach now.
  const token = project.config.attach?.token
  if (!app.state.session && token) void app.connectWithToken(token)
  // Follow git branch switches: each branch has its own replica (and its own proposal).
  let switching = false
  setInterval(async () => {
    if (switching) return
    const now = await findProject()
    const branch = now?.branch ?? 'local'
    if (!switching && now && branch !== projectStorage.branch()) {
      switching = true
      document.activeElement?.dispatchEvent(new window.Event('commit-edit'))
      app.beginProjectSwitch()
      root.inert = true
      try { await projectStorage.useBranch(branch); app.reloadReplica() }
      catch (error) { app.notify('error', `Could not switch project branch: ${String(error)}`) }
      finally { root.inert = false; switching = false; app.endProjectSwitch() }
    }
  }, 3000)
}

// Handy for debugging from the devtools console.
;(window as unknown as { fos: App }).fos = app
