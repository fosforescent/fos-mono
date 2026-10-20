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

const md = { mediaType: 'text/markdown' }
const node = {
  title: 'My post', text: md, body: '# My post\n\nHello **world** <script>alert(1)</script> [site](https://example.com) <img src=x onerror=alert(1)>',
  rows: [
    { id: 'aside', title: 'Aside', depth: 0, text: md, body: '## Aside\n\n- one\n- two' },
    { id: 'plain', title: 'A plain row', depth: 0 },
    { id: 'chapter', title: 'Chapter one', depth: 0, text: md, body: '# Chapter one\n\nChapter text', truncated: true },
    { id: 'part', title: 'Part', depth: 1, text: md, body: 'Part text' },
    { id: 'deeper', title: 'Deeper', depth: 1 },
    { id: 'deepest', title: 'Deepest note', depth: 2, text: md, body: '*deep*' }
  ],
  inputs: [], options: [], poll: null, proposals: [], revision: 'r', audience: 'public', counts: {}, rankings: {}, participants: 0
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

  // a plain (non-markdown) published node is a heading over its rows
  await renderSitePage(target, { ...node, title: 'Plain page', text: undefined, body: undefined, rows: [] }, options)
  assert.equal(target.querySelector('h1').textContent, 'Plain page')

  // share links, bare addresses and the read URL
  const at = { owner: 'host', path: ['fos:home', 'post'], share: 'share-id-0123456789' }
  const link = `https://app.example/#share=${encodeURIComponent(JSON.stringify(at))}`
  assert.deepEqual(parseShareAddress(link), at)
  assert.deepEqual(parseShareAddress(JSON.stringify(at)), at)
  assert.equal(parseShareAddress('https://app.example/'), null)
  assert.equal(parseShareAddress(`#share=${encodeURIComponent(JSON.stringify({ ...at, share: 'x' }))}`), null)
  const read = new URL(publicReadUrl('https://api.example/', at))
  assert.equal(read.origin + read.pathname, 'https://api.example/public/node/read')
  assert.deepEqual(JSON.parse(read.searchParams.get('path')), at.path)

  // the embed script: a script tag renders after itself, a div renders inside, both in a shadow root, read-only fetch
  const page2 = new JSDOM(`<p>Before</p><script data-fos-share="${link.replace(/"/g, '&quot;')}"></script><div id="div" data-fos-share='${JSON.stringify({ ...at, path: ['other'] })}' data-fos-api="https://other-api.example"></div><div id="bad" data-fos-share="nope"></div><style>p { color: red }</style>`, { url: 'https://blog.example/post', runScripts: 'outside-only' })
  const requests = []
  page2.window.fetch = async (url, init) => {
    requests.push({ url, init })
    return { ok: true, json: async () => ({ node: url.includes('other') ? { ...node, title: 'Poll', text: undefined, body: undefined, rows: [], poll: { mode: 'approval' } } : node }) }
  }
  page2.window.eval(readFileSync(path.join(dir, 'embed.js'), 'utf8'))
  await tick(); await tick()
  assert.equal(requests.length, 2)
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
  assert.equal(divShadow.querySelector('h1').textContent, 'Poll')
  assert.equal(divShadow.querySelector('.fos-embed-footer a').textContent, 'Respond on Fosforescent', 'interactive nodes link to the share page')
  assert(divShadow.querySelector('.fos-embed-footer a').href.startsWith('https://blog.example/#share='))
  assert.match(page2.window.document.getElementById('bad').shadowRoot.textContent, /needs a share link/)
  assert.equal(typeof page2.window.FosEmbed.mount, 'function')
  page2.window.close()
  console.log('PASS: published node as a website (pages, sections, sub-pages, sanitized markdown) and the shadow-DOM embed script')
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => { dom.window.close(); rmSync(dir, { recursive: true, force: true }) })
