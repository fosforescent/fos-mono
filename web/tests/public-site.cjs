// A published node as a website (src/site.ts) and the standalone embed script (src/embed.ts).
const assert = require('node:assert/strict')
const { mkdtempSync, rmSync, readFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const path = require('node:path')
const { buildSync } = require('esbuild')
const { JSDOM } = require('jsdom')
const dir = mkdtempSync(path.join(tmpdir(), 'fos-public-site-'))
const dom = new JSDOM('<div id="host"></div>', { url: 'https://blog.example/' })
for (const key of ['window', 'document', 'HTMLElement', 'Node', 'navigator', 'location']) Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true })
const web = path.resolve(__dirname, '..')
buildSync({ stdin: { contents: `export * from './src/site'; export * from './src/markdown-core'`, resolveDir: web }, bundle: true, platform: 'node', format: 'cjs', outfile: path.join(dir, 'site.cjs') })
buildSync({ entryPoints: [path.join(web, 'src/embed.ts')], bundle: true, platform: 'browser', format: 'iife', outfile: path.join(dir, 'embed.js'), define: { 'import.meta.env': '{"VITE_API_URL":"https://api.example"}' } })
const { siteTree, renderSitePage, markdownToSafeHtml, parseShareAddress, publicReadUrl } = require(path.join(dir, 'site.cjs'))
const tick = () => new Promise(resolve => setTimeout(resolve, 20))

const md = 'markdown' // rows whose text is Markdown (a note's body row)
const node = {
  title: 'My post', type: md, body: '# My post\n\nHello **world** <script>alert(1)</script> [site](https://example.com) <img src=x onerror=alert(1)>',
  rows: [
    { id: 'aside', title: 'Aside', depth: 0, type: md, body: '## Aside\n\n- one\n- two' },
    { id: 'plain', title: 'A plain row', depth: 0 },
    { id: 'chapter', title: 'Chapter one', depth: 0, type: md, body: '# Chapter one\n\nChapter text', truncated: true },
    { id: 'part', title: 'Part', depth: 1, type: md, body: 'Part text' },
    { id: 'deeper', title: 'Deeper', depth: 1 },
    { id: 'deepest', title: 'Deepest row', depth: 2 }
  ],
  inputs: [], proposals: [], revision: 'r', audience: 'public', counts: {}, rankings: {}, participants: 0
}

async function main() {
  // the depth-first rows rebuild into pages: leaves are sections, rows with rows of their own are sub-pages
  const tree = siteTree(node)
  assert.deepEqual(tree.children.map(c => c.id), ['aside', 'plain', 'chapter'])
  assert.deepEqual(tree.children[2].children.map(c => c.id), ['part', 'deeper'])
  assert.deepEqual(tree.children[2].children[1].children.map(c => c.id), ['deepest'])

  const target = document.getElementById('host')
  let trail = null
  const options = { markdown: markdownToSafeHtml, trail: [], navigate: next => { trail = next } }
  await renderSitePage(target, node, options)
  const page = target.querySelector('article.fos-site')
  assert.equal(page.querySelector('h1').textContent, 'My post')
  assert.equal(page.querySelector('strong').textContent, 'world')
  assert(!page.querySelector('script,img'), 'markdown is sanitized')
  assert(!page.innerHTML.includes('onerror'))
  const external = page.querySelector('a[href="https://example.com"]')
  assert.equal(external.target, '_blank'); assert.equal(external.rel, 'noopener noreferrer')
  const sections = [...page.querySelectorAll('section.fos-site-section')]
  assert.equal(sections.length, 2, 'the markdown aside and the plain row are sections of the page')
  assert.equal(sections[0].querySelectorAll('li').length, 2)
  assert.equal(sections[1].textContent, 'A plain row')
  const links = [...page.querySelectorAll('.fos-site-pages a')]
  assert.deepEqual(links.map(a => a.textContent), ['Chapter one'], 'a row with rows is a linked sub-page')
  links[0].click()
  assert.deepEqual(trail, ['chapter'])

  await renderSitePage(target, node, { ...options, trail: ['chapter'] })
  const sub = target.querySelector('article.fos-site')
  assert.equal(sub.querySelector('.fos-site-crumbs a').textContent, 'My post')
  assert.equal(sub.querySelector('h1').textContent, 'Chapter one')
  assert(sub.querySelector('.fos-site-note'), 'a truncated body says so')
  assert.equal(sub.querySelector('section').textContent.trim(), 'Part text')
  assert.deepEqual([...sub.querySelectorAll('.fos-site-pages a')].map(a => a.textContent), ['Deeper'])
  sub.querySelector('.fos-site-crumbs a').click()
  assert.deepEqual(trail, [])

  // each row by its type: empty fields become inputs of that type, a filled field reads as its value
  const form = { ...node, type: undefined, body: undefined, title: 'Form', rows: [{ id: 'name', title: 'Name', depth: 0, type: 'text', body: '' }, { id: 'age', title: 'Age', depth: 0, type: 'number', body: '' }, { id: 'city', title: 'City', depth: 0, type: 'text', body: 'Paris' }], inputs: [{ key: 'n', path: ['name'], name: 'Name', kind: 'text' }, { key: 'a', path: ['age'], name: 'Age', kind: 'text' }, { key: 'binding', name: 'Missing value', kind: 'text' }] }
  let submitted = null
  await renderSitePage(target, form, { ...options, interact: { signedIn: false, submit: async (answers, revision) => { submitted = { fields: { ...answers.fields }, revision } } } })
  const formSections = [...target.querySelectorAll('section')]
  assert(formSections[0].querySelector('input[type="text"]') && formSections[1].querySelector('input[type="number"]'))
  assert.equal(formSections[2].textContent, 'City: Paris')
  assert(target.querySelector('article > fieldset.fos-site-input input'), 'a missing binding is asked on the page itself')
  formSections[1].querySelector('input').value = '42'; formSections[1].querySelector('input').dispatchEvent(new window.Event('input'))
  target.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); await tick()
  assert.deepEqual(submitted, { fields: { a: { value: '42' } }, revision: 'r' })

  // a plain (non-markdown) published node is a heading over its rows
  await renderSitePage(target, { ...node, title: 'Plain page', type: undefined, body: undefined, rows: [] }, options)
  assert.equal(target.querySelector('h1').textContent, 'Plain page')

  // share links, bare addresses and the read URL
  // an address is the owner and the node's path; whether it may be visited is the node's membership
  const at = { owner: 'host', path: ['fos:home', 'post'] }
  const link = `https://app.example/#share=${encodeURIComponent(JSON.stringify(at))}`
  assert.deepEqual(parseShareAddress(link), at)
  assert.deepEqual(parseShareAddress(JSON.stringify(at)), at)
  assert.equal(parseShareAddress('https://app.example/'), null)
  assert.equal(parseShareAddress(`#share=${encodeURIComponent(JSON.stringify({ ...at, path: [] }))}`), null)
  const read = new URL(publicReadUrl('https://api.example/', at))
  assert.equal(read.origin + read.pathname, 'https://api.example/public/node/read')
  assert.deepEqual(JSON.parse(read.searchParams.get('path')), at.path)

  // the embed script: a script tag renders after itself, a div renders inside, both in a shadow root, read-only fetch
  const page2 = new JSDOM(`<p>Before</p><script data-fos-share="${link.replace(/"/g, '&quot;')}"></script><div id="div" data-fos-share='${JSON.stringify({ ...at, path: ['other'] })}' data-fos-api="https://other-api.example"></div><div id="bad" data-fos-share="nope"></div><style>p { color: red }</style>`, { url: 'https://blog.example/post', runScripts: 'outside-only' })
  const requests = []
  const signup = { ...node, title: 'Sign up', type: undefined, body: undefined, rows: [{ id: 'email', title: 'Email', depth: 0, type: 'text', body: '' }], inputs: [{ key: '["email"]', path: ['email'], name: 'Email', kind: 'text' }] }
  page2.window.fetch = async (url, init) => {
    requests.push({ url, init })
    if (init.method === 'POST') return { ok: true, json: async () => url.endsWith('/visit') ? { node: { ...signup, revision: 'joined' }, visitorToken: 'guest-token' } : { node: { ...signup, revision: 'joined', mine: { peer: 'visitor:1', revision: 'joined', approvals: [], ranking: [], fields: JSON.parse(init.body).fields } } } }
    return { ok: true, json: async () => ({ node: url.includes('other') ? signup : node }) }
  }
  page2.window.eval(readFileSync(path.join(dir, 'embed.js'), 'utf8'))
  await tick(); await tick()
  assert.equal(requests.length, 2, 'reading records nothing: two GETs, no visit')
  for (const r of requests) assert.equal(r.init.credentials, 'omit', 'no cookies or credentials leave the host page')
  assert(requests[0].url.startsWith('https://api.example/public/node/read?'), 'the build default server')
  assert(requests[1].url.startsWith('https://other-api.example/public/node/read?'), 'data-fos-api overrides it')
  const scriptHost = page2.window.document.querySelector('script').nextElementSibling
  assert.equal(scriptHost.className, 'fos-embed')
  const shadow = scriptHost.shadowRoot
  assert.equal(shadow.querySelector('h1').textContent, 'My post')
  assert(shadow.querySelector('style').textContent.includes('.fos-site'), 'styles live inside the shadow root')
  assert(!shadow.querySelector('script'))
  assert.equal(page2.window.document.querySelector('.fos-site'), null, 'nothing leaks into the host document')
  assert.equal(shadow.querySelector('.fos-embed-footer a').href, link)
  shadow.querySelector('.fos-site-pages a').click(); await tick()
  assert.equal(shadow.querySelector('h1').textContent, 'Chapter one', 'sub-pages navigate inside the embed')
  const divShadow = page2.window.document.getElementById('div').shadowRoot
  assert.equal(divShadow.querySelector('h1').textContent, 'Sign up')
  // the same renderer as the share page: the empty field is an input in its section; answering joins, then submits
  const email = divShadow.querySelector('section input[type="text"]'); assert(email, 'an empty text field is a text input')
  email.value = 'pat@example.test'; email.dispatchEvent(new page2.window.Event('input'))
  divShadow.querySelector('form').dispatchEvent(new page2.window.Event('submit', { bubbles: true, cancelable: true })); await tick(); await tick()
  const posts = requests.filter(r => r.init.method === 'POST')
  assert.deepEqual(posts.map(r => r.url), ['https://other-api.example/public/node/visit', 'https://other-api.example/public/node/input'])
  for (const r of posts) assert.equal(r.init.credentials, 'omit')
  const sent = JSON.parse(posts[1].init.body)
  assert.equal(sent.visitorToken, 'guest-token'); assert.equal(sent.revision, 'joined')
  assert.deepEqual(sent.fields, { '["email"]': { value: 'pat@example.test' } })
  assert.match(divShadow.textContent, /Saved/)
  assert.equal(JSON.parse(page2.window.localStorage.getItem('fos:embed:https://other-api.example:' + JSON.stringify({ ...at, path: ['other'] }))).visitorToken, 'guest-token', 'the receipt is remembered for return visits')
  assert(divShadow.querySelector('.fos-embed-footer a').href.startsWith('https://blog.example/#share='))
  assert.match(page2.window.document.getElementById('bad').shadowRoot.textContent, /needs a share link/)
  assert.equal(typeof page2.window.FosEmbed.mount, 'function')
  page2.window.close()
  console.log('PASS: published node as a website (pages, sections, sub-pages, sanitized markdown) and the shadow-DOM embed script')
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => { dom.window.close(); rmSync(dir, { recursive: true, force: true }) })
