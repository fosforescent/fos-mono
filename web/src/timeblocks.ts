/**
 * Time-block picker: a zoomable timeline (years › months › days › hours › minutes) on which a block of time
 * (the amount) is placed inside a window (the span the allocation is held in). The result is the amount in hours
 * plus the window as `start`/`end` milliseconds, which is exactly what a calendar allocation or requirement stores
 * (": 1h 2026-10-20T09:00..2026-10-20T11:00"). Busy spans of the chosen bank are drawn so free time is visible.
 */
import { iconSvg } from './icons'
import { formatAmount, formatWindow } from './rows'

const HOUR = 3_600_000
const DAY = 24 * HOUR

export type BusySpan = { start: number; end: number; label: string; open?: () => void }
export type TimeBank = { id: string; name: string; busy: BusySpan[] }
export type TimeBlockOptions = {
  /** Shown in the dialog header, usually the row the time is for. */
  title: string
  /** The row text used in the preview lines (": 1h … text"). */
  text?: string
  /** Block size in hours; defaults to 1. */
  amount?: number
  /** An existing window to start from. */
  start?: number
  end?: number
  banks: TimeBank[]
  /** The bank selected initially (an id from `banks`), '' for an unbound allocation. */
  bank?: string
  /** When set, the preview shows the requirement line above the allocation line and the button reads accordingly. */
  requirement?: boolean
  /** Button text; defaults to "Use this time". */
  cta?: string
}
export type TimeBlockResult = { amount: number; start?: number; end?: number; bank: string }

export const LEVELS = ['Years', 'Months', 'Days', 'Hours', 'Minutes'] as const
export type Level = 0 | 1 | 2 | 3 | 4
/** The unit a placed window snaps to at each level: a month, a day, an hour, 15 minutes, 5 minutes. */
const SNAP: Array<(t: number) => number> = [
  t => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), 1).getTime() },
  t => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() },
  t => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()).getTime() },
  t => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), Math.floor(d.getMinutes() / 15) * 15).getTime() },
  t => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), Math.floor(d.getMinutes() / 5) * 5).getTime() }
]
/** Block sizes with the window each is usually placed in: "1h in 8h" means one hour somewhere in an eight-hour span. */
export const PRESETS: Array<{ block: number; window: number; blockLabel: string; windowLabel: string }> = [
  { block: 1, window: 1, blockLabel: '1h', windowLabel: '1h' },
  { block: 1, window: 8, blockLabel: '1h', windowLabel: '8h' },
  { block: 0.25, window: 4, blockLabel: '15m', windowLabel: '4h' },
  { block: 0.5, window: 2, blockLabel: '30m', windowLabel: '2h' },
  { block: 2, window: 24, blockLabel: '2h', windowLabel: '1d' },
  { block: 4, window: 24 * 7, blockLabel: '4h', windowLabel: '1 week' }
]

const pad = (n: number) => String(n).padStart(2, '0')
const monthName = (d: Date, style: 'short' | 'long') => d.toLocaleString(undefined, { month: style })
const weekday = (d: Date) => d.toLocaleString(undefined, { weekday: 'short' })

/** The span the timeline shows at a level around `anchor`, with its ticks (each tick zooms into the next level). */
export function levelRange(level: Level, anchor: number): { t0: number; t1: number; crumb: string; ticks: Array<{ t: number; label: string }> } {
  const d = new Date(anchor)
  const y = d.getFullYear(), m = d.getMonth(), day = d.getDate(), h = d.getHours()
  const ticks: Array<{ t: number; label: string }> = []
  switch (level) {
    case 0: {
      const y0 = y - 3
      for (let i = 0; i < 7; i++) ticks.push({ t: new Date(y0 + i, 0, 1).getTime(), label: String(y0 + i) })
      return { t0: new Date(y0, 0, 1).getTime(), t1: new Date(y0 + 7, 0, 1).getTime(), crumb: `${y0}–${y0 + 6}`, ticks }
    }
    case 1:
      for (let i = 0; i < 12; i++) ticks.push({ t: new Date(y, i, 1).getTime(), label: monthName(new Date(y, i, 1), 'short') })
      return { t0: new Date(y, 0, 1).getTime(), t1: new Date(y + 1, 0, 1).getTime(), crumb: String(y), ticks }
    case 2: {
      const days = new Date(y, m + 1, 0).getDate()
      for (let i = 1; i <= days; i++) ticks.push({ t: new Date(y, m, i).getTime(), label: i === 1 || i % 5 === 0 ? String(i) : '' })
      return { t0: new Date(y, m, 1).getTime(), t1: new Date(y, m + 1, 1).getTime(), crumb: monthName(d, 'long'), ticks }
    }
    case 3:
      for (let i = 0; i < 24; i++) ticks.push({ t: new Date(y, m, day, i).getTime(), label: i % 3 === 0 ? pad(i) : '' })
      return { t0: new Date(y, m, day).getTime(), t1: new Date(y, m, day + 1).getTime(), crumb: `${weekday(d)} ${day}`, ticks }
    default:
      for (let i = 0; i < 60; i += 5) ticks.push({ t: new Date(y, m, day, h, i).getTime(), label: i % 10 === 0 ? ':' + pad(i) : '' })
      return { t0: new Date(y, m, day, h).getTime(), t1: new Date(y, m, day, h + 1).getTime(), crumb: `${pad(h)}:00`, ticks }
  }
}

/** The level at which a window of `hours` is comfortable to place: hours for a day or less, days for a week, months beyond. */
export function levelForWindow(hours: number): Level {
  return hours <= 1 ? 4 : hours <= 24 ? 3 : hours <= 24 * 31 ? 2 : hours <= 24 * 366 ? 1 : 0
}

/** Spans that are usually off (nights at the hours level, weekends at the days level), drawn hatched. */
export function offSpans(level: Level, t0: number, t1: number): Array<{ start: number; end: number }> {
  const out: Array<{ start: number; end: number }> = []
  if (level === 3) { out.push({ start: t0, end: t0 + 8 * HOUR }, { start: t0 + 18 * HOUR, end: t1 }) }
  if (level === 2) for (let t = t0; t < t1; t += DAY) { const wd = new Date(t).getDay(); if (wd === 0 || wd === 6) out.push({ start: t, end: Math.min(t1, t + DAY) }) }
  return out
}

function hoursLabel(hours: number): string {
  if (hours >= 24 * 7 && hours % (24 * 7) === 0) return `${hours / (24 * 7)} week${hours === 24 * 7 ? '' : 's'}`
  if (hours >= 24 && hours % 24 === 0) return `${hours / 24}d`
  if (hours >= 1) return Number.isInteger(hours) ? `${hours}h` : `${hours}h`
  return `${Math.round(hours * 60)}m`
}

function svgButton(cls: string, symbol: string, label: string, action: () => void): HTMLButtonElement {
  const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.innerHTML = iconSvg(symbol) ?? symbol; b.title = label; b.setAttribute('aria-label', label); b.addEventListener('click', action); return b
}
function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag); e.className = cls; if (text) e.textContent = text; return e
}

/** Opens the picker; resolves with the chosen time, or null when dismissed. */
export function openTimeBlockPicker(options: TimeBlockOptions): Promise<TimeBlockResult | null> {
  return new Promise(resolve => {
    const dialog = document.createElement('dialog')
    dialog.className = 'import-dialog timeblock-dialog'
    dialog.setAttribute('aria-label', `${options.title} — time`)
    let amount = options.amount && options.amount > 0 ? options.amount : 1
    // Without a window to start from, hold the block in a working day (or the block itself when it is longer).
    let windowHours = options.start !== undefined && options.end !== undefined ? Math.max(amount, (options.end - options.start) / HOUR) : Math.max(amount, 8)
    let winStart: number | undefined = options.start
    let anchor = options.start ?? SNAP[3]!(Date.now() + HOUR)
    let level: Level = levelForWindow(windowHours)
    let bank = options.bank ?? options.banks[0]?.id ?? ''
    let result: TimeBlockResult | null = null

    const header = el('div', 'tb-header')
    const heading = el('h2', 'tb-title', options.title)
    header.append(heading, svgButton('icon tb-close', '×', 'Close', () => dialog.close()))

    const bankSelect = document.createElement('select'); bankSelect.className = 'tb-bank'; bankSelect.setAttribute('aria-label', 'Source calendar')
    bankSelect.append(new Option('Unbound allocation', ''))
    for (const b of options.banks) bankSelect.append(new Option(b.name, b.id))
    bankSelect.value = bank
    bankSelect.addEventListener('change', () => { bank = bankSelect.value; render() })

    const crumbs = el('nav', 'tb-crumbs'); crumbs.setAttribute('aria-label', 'Zoom path')
    const scale = el('div', 'tb-scale'); scale.setAttribute('role', 'group'); scale.setAttribute('aria-label', 'Scale')
    const toolbar = el('div', 'tb-toolbar'); toolbar.append(bankSelect, crumbs, scale)

    const presets = el('div', 'tb-presets'); presets.setAttribute('role', 'group'); presets.setAttribute('aria-label', 'Blocks to place')
    const ticks = el('div', 'tb-ticks')
    const track = el('div', 'tb-track'); track.setAttribute('aria-label', 'Timeline'); track.tabIndex = 0
    track.title = 'Click or drag to place the window; use ← → to nudge it'
    const timeline = el('div', 'tb-timeline'); timeline.append(ticks, track)
    const preview = el('div', 'tb-preview')
    const line1 = el('code', 'tb-line'), line2 = el('code', 'tb-line')
    preview.append(line1, line2)
    const cancel = el('button', 'secondary', 'Cancel'); cancel.type = 'button'; cancel.addEventListener('click', () => dialog.close())
    const confirm = el('button', 'primary tb-confirm', options.cta ?? 'Use this time'); confirm.type = 'button'
    confirm.addEventListener('click', () => { result = { amount, bank, ...(winStart !== undefined ? { start: winStart, end: winStart + windowHours * HOUR } : {}) }; dialog.close() })
    const footer = el('div', 'tb-footer'); footer.append(preview, cancel, confirm)
    const top = el('div', 'tb-controls'); top.append(toolbar, presets)
    dialog.append(header, top, timeline, footer)

    const setLevel = (next: number, at?: number) => { level = Math.max(0, Math.min(LEVELS.length - 1, next)) as Level; if (at !== undefined) anchor = at; render() }
    const pct = (t0: number, t1: number, t: number) => Math.max(0, Math.min(100, ((t - t0) / (t1 - t0)) * 100))
    const place = (t: number) => { winStart = SNAP[level]!(t); anchor = winStart; render() }
    const timeAt = (clientX: number, t0: number, t1: number) => { const r = track.getBoundingClientRect(); const x = Math.max(0, Math.min(1, (clientX - r.left) / Math.max(1, r.width))); return t0 + x * (t1 - t0) }
    let dragging = false, range = levelRange(level, anchor)
    track.addEventListener('pointerdown', event => { if ((event.target as HTMLElement).closest('a,button')) return; dragging = true; track.setPointerCapture(event.pointerId); place(timeAt(event.clientX, range.t0, range.t1)) })
    track.addEventListener('pointermove', event => { if (dragging) place(timeAt(event.clientX, range.t0, range.t1)) })
    track.addEventListener('pointerup', () => { dragging = false })
    track.addEventListener('keydown', event => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      event.preventDefault()
      const step = (range.t1 - range.t0) / Math.max(1, range.ticks.length)
      place((winStart ?? range.t0) + (event.key === 'ArrowLeft' ? -step : step))
    })

    function render(): void {
      range = levelRange(level, anchor)
      const { t0, t1 } = range
      crumbs.replaceChildren()
      for (let i = 0; i <= level; i++) {
        const b = el('button', 'tb-crumb' + (i === level ? ' current' : ''), levelRange(i as Level, anchor).crumb); b.type = 'button'
        b.addEventListener('click', () => setLevel(i)); crumbs.append(b)
        if (i < level) crumbs.append(el('span', 'sep', '›'))
      }
      scale.replaceChildren(svgButton('tb-scale-step', '▸', 'Larger scale', () => setLevel(level - 1)))
      ;(scale.firstElementChild as HTMLButtonElement).disabled = level === 0
      ;(scale.firstElementChild as HTMLElement).classList.add('flip')
      for (const i of [level - 1, level, level + 1]) {
        const b = el('button', 'tb-scale-level' + (i === level ? ' active' : ''), LEVELS[i] ?? ''); b.type = 'button'; b.setAttribute('aria-pressed', String(i === level)); b.disabled = !LEVELS[i]
        b.addEventListener('click', () => setLevel(i)); scale.append(b)
      }
      const inward = svgButton('tb-scale-step', '▸', 'Smaller scale', () => setLevel(level + 1)); inward.disabled = level === LEVELS.length - 1; scale.append(inward)

      presets.replaceChildren()
      const combos = PRESETS.some(p => p.block === amount && p.window === windowHours) ? PRESETS : [{ block: amount, window: windowHours, blockLabel: hoursLabel(amount), windowLabel: hoursLabel(windowHours) }, ...PRESETS]
      for (const p of combos) {
        const on = p.block === amount && p.window === windowHours
        const b = el('button', 'tb-preset' + (on ? ' active' : '')); b.type = 'button'; b.setAttribute('aria-pressed', String(on))
        b.setAttribute('aria-label', `${p.blockLabel} block in a ${p.windowLabel} window`); b.title = 'Click, then place it on the timeline'
        const glyph = el('span', 'tb-preset-glyph'); glyph.setAttribute('aria-hidden', 'true'); glyph.style.width = `${Math.min(56, 16 + Math.log2(1 + p.window) * 8)}px`
        const bar = el('span', 'tb-preset-bar'); bar.style.width = `${Math.max(2, Math.min(100, (p.block / p.window) * 100))}%`; glyph.append(bar)
        const text = el('span', ''); text.append(el('span', 'tb-sel-text', p.blockLabel), el('span', 'muted', ' in '), el('span', 'tb-win-text', p.windowLabel))
        b.append(glyph, text)
        b.addEventListener('click', () => { amount = p.block; windowHours = p.window; setLevel(levelForWindow(p.window)) })
        presets.append(b)
      }

      ticks.replaceChildren()
      for (const tick of range.ticks) {
        const b = el('button', 'tb-tick', tick.label); b.type = 'button'; b.setAttribute('aria-label', `Zoom into ${tick.label || new Date(tick.t).toLocaleString()}`)
        b.disabled = level === LEVELS.length - 1
        b.addEventListener('click', () => setLevel(level + 1, tick.t)); ticks.append(b)
      }

      track.replaceChildren()
      const block = (cls: string, start: number, end: number, label: string, aria?: string) => {
        const s = Math.max(t0, start), e = Math.min(t1, end)
        if (e <= t0 || s >= t1) return null
        const b = el('div', cls, label); b.style.left = `${pct(t0, t1, s)}%`; b.style.width = `${Math.max(0.3, pct(t0, t1, e) - pct(t0, t1, s))}%`
        if (aria) b.setAttribute('aria-label', aria)
        track.append(b); return b
      }
      for (const off of offSpans(level, t0, t1)) { const b = block('tb-off', off.start, off.end, ''); if (b) b.title = 'Usually off' }
      const chosen = options.banks.find(b => b.id === bank)
      for (const busy of chosen?.busy ?? []) {
        const b = block('tb-busy', busy.start, busy.end, busy.label, `Taken: ${busy.label}`)
        if (b && busy.open) { b.classList.add('link'); b.title = `Go to ${busy.label}`; b.tabIndex = 0; b.setAttribute('role', 'link'); b.addEventListener('click', e => { e.stopPropagation(); dialog.close(); busy.open!() }) }
        else if (b) b.title = `Taken in ${chosen?.name ?? 'this calendar'}: ${busy.label}`
      }
      if (winStart !== undefined) {
        const winEnd = winStart + windowHours * HOUR
        const w = block('tb-window', winStart, winEnd, '', `Window, ${hoursLabel(windowHours)}`)
        if (w) { const tag = el('span', 'tb-window-tag'); tag.append(el('code', '', options.requirement ? '-:' : ':'), ' ' + hoursLabel(windowHours) + ' window'); w.append(tag) }
        const s = block('tb-selected', winStart, winStart + amount * HOUR, '', `${hoursLabel(amount)} assigned${chosen ? ' from ' + chosen.name : ''}`)
        if (s) {
          s.append(el('span', 'tb-selected-label', hoursLabel(amount)))
          const clear = svgButton('tb-unplace', '×', 'Unassign this time', () => { winStart = undefined; render() }); s.append(clear)
        }
      }
      const fmt = (t?: number) => t === undefined ? '' : new Date(t).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
      track.setAttribute('aria-valuetext', winStart === undefined ? 'No time placed yet' : `${fmt(winStart)} to ${fmt(winStart + windowHours * HOUR)}`)

      const text = options.text ? ' ' + options.text : ''
      const win = winStart !== undefined ? ' ' + formatWindow({ start: winStart, end: winStart + windowHours * HOUR }) : ''
      const amt = formatAmount(amount, 'h').replace(' h', 'h')
      if (options.requirement) {
        line1.textContent = `-: ${amt}${win}${text}`; line1.className = 'tb-line tb-win-text'
        line2.textContent = winStart !== undefined ? `  : ${amt}${win}${chosen ? ' ' + chosen.name : ''}` : ''; line2.className = 'tb-line tb-sel-text'
      } else {
        line1.textContent = `: ${amt}${win}${text}${chosen ? ' · ' + chosen.name : ''}`; line1.className = 'tb-line tb-sel-text'
        line2.textContent = winStart === undefined ? 'Place the block on the timeline, or keep it unscheduled.' : ''; line2.className = 'tb-line muted'
      }
      confirm.textContent = options.cta ?? (options.requirement ? (winStart !== undefined ? 'Create allocation' : 'Keep as requirement') : 'Use this time')
    }

    render()
    dialog.addEventListener('close', () => { dialog.remove(); resolve(result) })
    document.body.append(dialog)
    dialog.showModal()
  })
}
