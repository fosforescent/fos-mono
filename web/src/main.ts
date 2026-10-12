import './style.css'
import { App } from './app'
import { pickStorage } from './storage'
import { createProjectStorage, findProject, saveDevice } from './project'
import { serverPolicyOf } from '../../shared/sync/index'
import { mountUi } from './ui'

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
const project = await findProject()
const storage = project ? await createProjectStorage(project) : pickStorage()
const baseUrl = (project?.config.attach?.server ?? env.VITE_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')

const app = new App({
  baseUrl,
  autoLogin: project ? null : devCredentials,
  storage,
  // [server] to/from in fos.config.toml fixes what this directory sends to and takes from the account server
  project: project ? { dir: project.dir, branch: () => (storage as { branch?: () => string }).branch?.() ?? null, deviceName: project.config.attach?.name ?? project.dir.split(/[\\/]/).filter(Boolean).pop(), policy: serverPolicyOf(project.config) } : undefined
})

mountUi(root, app)
app.start()

// A `fos` CLI opened this page to have its sign-in approved (?device=CODE).
const deviceCode = new URL(location.href).searchParams.get('device')
if (deviceCode) {
  app.setDeviceCode(deviceCode)
  history.replaceState(null, '', location.pathname)
}

if (project) {
  const projectStorage = storage as Awaited<ReturnType<typeof createProjectStorage>>
  saveDevice(project, { peerId: app.state.replica.meta.peerId, name: app.state.deviceName })
  // Not attached yet but the config carries an invite token: attach now.
  const token = project.config.attach?.token
  if (!app.state.session && token) void app.connectWithToken(token)
  // Follow git branch switches: each branch has its own replica (and its own proposal).
  setInterval(async () => {
    const now = await findProject()
    const branch = now?.branch ?? 'local'
    if (now && branch !== projectStorage.branch()) {
      await projectStorage.useBranch(branch)
      app.reloadReplica()
    }
  }, 3000)
}

// Handy for debugging from the devtools console.
;(window as unknown as { fos: App }).fos = app
