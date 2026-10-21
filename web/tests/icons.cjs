// Every capability and handler in the constructor menu has an icon of its own, across all tabs and sub-tabs.
const assert = require('node:assert/strict')
const { buildSync } = require('esbuild')
const { mkdtempSync, rmSync } = require('node:fs')
const path = require('node:path')
const { JSDOM } = require('jsdom')
const dir = mkdtempSync(path.join(require('node:os').tmpdir(), 'fos-icons-'))
const dom = new JSDOM('<div id="app"></div>', { url: 'http://localhost/' })
for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'Node', 'Option', 'navigator', 'localStorage', 'sessionStorage', 'location']) Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true })
try {
  buildSync({ stdin: { contents: `export {App} from './src/app'; export {mountUi} from './src/ui'; export {createMemoryStorage} from './src/storage'; export * from '../shared/sync/index'`, resolveDir: path.resolve(__dirname, '..') }, bundle: true, platform: 'node', format: 'cjs', outfile: path.join(dir, 'test.cjs'), logLevel: 'silent', external: ['mermaid', 'katex', 'katex/*'] })
  const { App, mountUi, createMemoryStorage, SERVER_TRANSPORT_CAPABILITIES } = require(path.join(dir, 'test.cjs'))
  const app = new App({ baseUrl: 'http://localhost', autoLogin: null, storage: createMemoryStorage() }); app.scheduleSync = () => {}
  mountUi(document.getElementById('app'), app)
  app.set({ session: { kind: 'user', username: 'alice', jwt: 't', baseUrl: 'http://localhost' }, connection: 'online' })
  // a server with every service, and every device trigger offered: the fullest menu
  app.recordServerOffers([...SERVER_TRANSPORT_CAPABILITIES, 'llm', 'search', 'market', 'cron'])
  app.setPeerOffers(app.state.replica.meta.peerId, ['timer', 'task-completion', 'request'], true)
  document.querySelector('.children-toolbar .constructors-toggle').click()

  const seen = new Map() // icon → constructor
  const visited = new Set()
  const icon = button => { const svg = button.querySelector('svg'); return svg?.getAttribute('data-icon') ?? svg?.outerHTML ?? button.textContent }
  const collect = where => {
    for (const button of document.querySelectorAll('.constructor-grid [data-constructor-id]')) {
      const id = button.dataset.constructorId
      if (id.startsWith('mask:') || id.startsWith('peer:')) continue // permissions and sub-peer navigation, not capabilities
      const key = icon(button), other = seen.get(key)
      assert(!other || other === id, `${id} (${where}) has the icon of ${other}`)
      seen.set(key, id)
    }
  }
  const tabs = () => [...document.querySelectorAll('.peer-tabs [role="tab"]')].map(b => b.getAttribute('aria-label'))
  for (const tab of tabs()) {
    document.querySelector(`.peer-tabs [aria-label="${tab}"]`).click()
    collect(tab)
    // and every sub-tab inside it (integrations, MCP servers, triggers, agents)
    for (const sub of [...document.querySelectorAll('.constructor-grid [data-constructor-id^="peer:"]')].map(b => b.dataset.constructorId)) {
      if (visited.has(sub)) continue
      visited.add(sub)
      document.querySelector(`.peer-tabs [aria-label="${tab}"]`).click()
      document.querySelector(`.constructor-grid [data-constructor-id="${sub}"]`).click()
      collect(`${tab} › ${sub.slice(5)}`)
    }
  }
  assert(seen.size > 30, `the menu was walked: ${seen.size} constructors`)
  console.log(`PASS: ${seen.size} constructors, each with its own icon`)
} finally { rmSync(dir, { recursive: true, force: true }) }
