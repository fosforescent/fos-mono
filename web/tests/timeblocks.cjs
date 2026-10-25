// The time-block picker: level ranges, snapping, placing a block on the timeline and the result it hands back.
const assert = require('node:assert/strict')
const { mkdtempSync } = require('node:fs')
const { tmpdir } = require('node:os')
const path = require('node:path')
const { buildSync } = require('esbuild')
const { JSDOM } = require('jsdom')
const dir = mkdtempSync(path.join(tmpdir(), 'fos-timeblocks-'))
const dom = new JSDOM('<div id="app"></div>', { url: 'http://localhost/' })
for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'Node', 'Option', 'navigator', 'localStorage', 'sessionStorage', 'location']) Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true })
buildSync({ stdin: { contents: `export * from './src/timeblocks'; export {App} from './src/app'; export {mountUi} from './src/ui'; export {createMemoryStorage} from './src/storage'; export {parseRowInput, parseWindow, formatWindow, rawRowText} from './src/rows'; export * from '../shared/sync/index'`, resolveDir: path.resolve(__dirname, '..') }, bundle: true, platform: 'node', format: 'cjs', outfile: path.join(dir, 'tb.cjs'), external: ['mermaid', 'katex', 'katex/*'] })
const { levelRange, levelForWindow, offSpans, openTimeBlockPicker, LEVELS, App, mountUi, createMemoryStorage, parseRowInput, parseWindow, formatWindow, rawRowText, HOME_ID, view } = require(path.join(dir, 'tb.cjs'))
const tick = () => new Promise(resolve => setImmediate(resolve))
window.HTMLDialogElement.prototype.showModal = function () { this.open = true }
window.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new window.Event('close')) }
window.HTMLElement.prototype.setPointerCapture = () => {}

async function main() {
  const anchor = new Date(2026, 9, 20, 9, 0).getTime()
  assert.deepEqual(parseWindow('description'), { start: null, end: null, rest: 'description' })
  for (const window of ['', '2026-10-20', '..2026-10-20', '2026-10-20..2026-10-21']) {
    const parsed = parseWindow(window)
    assert.equal(formatWindow(parsed), window)
    for (const marker of ['calendar', 'money', 'inventory', 'person', 'points', 'location']) {
      const bank = parseRowInput(`@${marker} ${window} Source 10`)
      assert.equal(bank.extras.resource.start, parsed.start)
      assert.equal(bank.extras.resource.end, parsed.end)
      const raw = rawRowText({ type: bank.type, title: bank.text, resource: bank.extras.resource })
      assert.deepEqual(parseRowInput(raw).extras.resource, bank.extras.resource, 'editing a bank must retain its open bounds')
    }
  }
  // Each level spans one unit of the level above and offers that unit's subdivisions as ticks.
  assert.equal(LEVELS.length, 5)
  const years = levelRange(0, anchor); assert.equal(years.ticks.length, 7); assert.equal(years.crumb, '2023–2029')
  const months = levelRange(1, anchor); assert.equal(months.ticks.length, 12); assert.equal(months.crumb, '2026')
  const days = levelRange(2, anchor); assert.equal(days.ticks.length, 31); assert.equal(days.ticks[0].label, '1'); assert.equal(days.ticks[1].label, '')
  const hours = levelRange(3, anchor); assert.equal(hours.ticks.length, 24); assert.equal(hours.t1 - hours.t0, 24 * 3_600_000)
  const minutes = levelRange(4, anchor); assert.equal(minutes.ticks.length, 12); assert.equal(minutes.crumb, '09:00')
  assert.equal(levelForWindow(8), 3); assert.equal(levelForWindow(24 * 7), 2); assert.equal(levelForWindow(0.5), 4)
  assert.equal(offSpans(3, hours.t0, hours.t1).length, 2, 'nights are off at the hours level')
  assert(offSpans(2, days.t0, days.t1).length >= 8, 'weekends are off at the days level')

  // Placing on the track snaps to the level's unit and the result carries amount, window and bank.
  const busy = { start: anchor + 4 * 3_600_000, end: anchor + 5 * 3_600_000, label: 'Walkthrough' }
  const pending = openTimeBlockPicker({ title: 'Venue booking', text: 'Site visit', amount: 1, start: anchor, end: anchor + 8 * 3_600_000, banks: [{ id: 'team', name: 'Team calendar', busy: [busy] }], bank: 'team', requirement: true })
  await tick()
  const dialog = document.querySelector('.timeblock-dialog')
  assert(dialog, 'the picker is a native dialog')
  assert.equal(dialog.querySelector('.tb-scale-level.active').textContent, 'Hours', 'an 8h window opens at the hours level')
  assert(dialog.querySelector('.tb-busy').textContent.includes('Walkthrough'), 'allocations from the bank show as taken')
  assert(dialog.querySelector('.tb-line').textContent.startsWith('-: 1h 2026-10-20T09:00..2026-10-20T17:00'), 'the preview shows the requirement line in row syntax')
  // zoom into the 12:00 tick → minutes level around noon
  ;[...dialog.querySelectorAll('.tb-tick')].find(b => b.textContent === '12').click()
  assert.equal(dialog.querySelector('.tb-scale-level.active').textContent, 'Minutes')
  assert.equal(dialog.querySelector('.tb-crumb.current').textContent, '12:00')
  // a preset picks block and window sizes and slides to a comfortable scale
  ;[...dialog.querySelectorAll('.tb-preset')].find(b => b.getAttribute('aria-label') === '2h block in a 1d window').click()
  assert.equal(dialog.querySelector('.tb-scale-level.active').textContent, 'Hours')
  // placing at the middle of the track snaps to 15 minutes at the hours level
  const track = dialog.querySelector('.tb-track')
  track.getBoundingClientRect = () => ({ left: 0, width: 240 })
  track.dispatchEvent(Object.assign(new window.Event('pointerdown', { bubbles: true }), { clientX: 125, pointerId: 1 }))
  const placedStart = dialog.querySelector('.tb-track').getAttribute('aria-valuetext')
  assert(placedStart.includes('12:30') || placedStart.includes('12:15'), 'the window starts near noon, snapped to a quarter hour: ' + placedStart)
  dialog.querySelector('.tb-confirm').click()
  const result = await pending
  assert.equal(result.amount, 2); assert.equal(result.bank, 'team')
  assert.equal(result.end - result.start, 24 * 3_600_000)
  assert.equal(new Date(result.start).getMinutes() % 15, 0)

  const a = new App({ baseUrl: 'http://localhost', autoLogin: null, storage: createMemoryStorage() })
  a.scheduleSync = () => {}; mountUi(document.getElementById('app'), a)
  assert.equal(document.querySelector('.first-run').textContent, 'Press Ctrl+H for help')
  assert(!document.querySelector('.first-run-examples'), 'empty nodes show help without examples')
  a.addRowAtTop(parseRowInput('@calendar Team 40h'))
  const requirement = a.addRowAtTop(parseRowInput('-: 1h Site visit'))
  await tick()
  assert(!document.querySelector('.first-run'))
  const chip = document.querySelector(`[data-id="${requirement}"] .kind-badge`)
  assert.equal(chip.textContent, 'Needs time', 'requirements read as what they need')
  const privateFolder = a.addRowAtTop(parseRowInput('[ ] Private'))
  const hidden = a.addRowAt([privateFolder], 'resource', 'Private calendar', { extras: { resource: { type: 'calendar', unit: 'h' } } })
  assert(!a.contextBanks().some(({ row }) => row.id === hidden), 'sibling-private banks are not ambient handlers')
  a.addRowAtTop(parseRowInput('@calendar Another 20h'))
  assert.equal(a.bankFor([], 'calendar'), null, 'several visible handlers require a choice')
  console.log('timeblocks ok')
}
main().catch(error => { console.error(error); process.exit(1) })
