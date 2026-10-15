import { iconSvg } from './icons'

export type ComboOption = { label: string; group: string; selected?: boolean; run: () => void }
let sequence = 0
let closeActive: (() => void) | undefined
/** Searchable row popover. The caller supplies existing graph operations. */
export function combobox(label: string, caption: string, options: () => ComboOption[], actions: (query: string) => ComboOption[] = () => []): HTMLElement {
  const box = document.createElement('span'); box.className = 'row-combobox'
  const trigger = document.createElement('button'); trigger.type = 'button'; trigger.className = 'combo-trigger secondary small'
  trigger.setAttribute('aria-label', label); trigger.setAttribute('aria-haspopup', 'dialog'); trigger.setAttribute('aria-expanded', 'false')
  const title = document.createElement('span'); title.textContent = caption
  const caret = document.createElement('span'); caret.innerHTML = iconSvg('▾') ?? '▾'
  trigger.append(title, caret)
  const panel = document.createElement('span'); panel.className = 'combo-panel'; panel.hidden = true; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', label)
  const input = document.createElement('input'); input.type = 'search'; input.placeholder = 'Find branch, proposal or child…'; input.autocomplete = 'off'
  input.setAttribute('role', 'combobox'); input.setAttribute('aria-label', label); input.setAttribute('aria-autocomplete', 'list'); input.setAttribute('aria-expanded', 'false')
  const list = document.createElement('span'); list.className = 'combo-options'; list.id = `row-options-${++sequence}`; list.setAttribute('role', 'listbox'); list.setAttribute('aria-label', label)
  input.setAttribute('aria-controls', list.id)
  panel.id = `${list.id}-panel`; trigger.setAttribute('aria-controls', panel.id)
  let visible: ComboOption[] = [], active = 0
  const outside = (event: Event) => { if (!box.contains(event.target as Node)) close() }
  const reposition = () => close()
  const close = (restore = false) => {
    document.removeEventListener('pointerdown', outside, true); window.removeEventListener('resize', reposition)
    if (closeActive === close) closeActive = undefined
    panel.hidden = true; trigger.setAttribute('aria-expanded', 'false'); input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant')
    if (restore) trigger.focus()
  }
  const highlight = () => {
    Array.from(list.querySelectorAll<HTMLElement>('[role="option"]')).forEach((row, i) => row.classList.toggle('active', i === active))
    const row = list.querySelector<HTMLElement>(`[data-index="${active}"]`)
    if (row) { input.setAttribute('aria-activedescendant', row.id); row.scrollIntoView?.({ block: 'nearest' }) }
    else input.removeAttribute('aria-activedescendant')
  }
  const choose = (option: ComboOption) => { close(); input.blur(); option.run() }
  const render = () => {
    const query = input.value.trim().toLocaleLowerCase()
    visible = [...options().filter(o => o.label.toLocaleLowerCase().includes(query)), ...actions(input.value.trim())]
    active = Math.min(active, Math.max(0, visible.length - 1)); list.replaceChildren()
    let group = ''
    visible.forEach((option, index) => {
      if (option.group !== group) { const heading = document.createElement('span'); heading.className = 'combo-group'; heading.textContent = group = option.group; list.append(heading) }
      const row = document.createElement('span'); row.className = 'combo-option'; row.id = `${list.id}-${index}`; row.dataset.index = String(index); row.setAttribute('role', 'option'); row.setAttribute('aria-selected', String(!!option.selected))
      row.textContent = `${option.selected ? '✓ ' : ''}${option.label}`
      row.onpointerdown = event => event.preventDefault()
      row.onclick = () => choose(option)
      list.append(row)
    })
    if (!visible.length) { const empty = document.createElement('span'); empty.className = 'combo-empty'; empty.textContent = 'No matches'; list.append(empty) }
    highlight()
  }
  const open = () => {
    closeActive?.(); closeActive = close
    document.addEventListener('pointerdown', outside, true); window.addEventListener('resize', reposition)
    panel.hidden = false; input.value = ''; active = 0; render()
    trigger.setAttribute('aria-expanded', 'true'); input.setAttribute('aria-expanded', 'true')
    const rect = trigger.getBoundingClientRect(), width = Math.min(360, window.innerWidth - 16)
    panel.style.width = `${width}px`; panel.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))}px`
    const below = window.innerHeight - rect.bottom - 8, above = rect.top - 8
    const up = below < 240 && above > below
    panel.style.top = up ? 'auto' : `${rect.bottom + 4}px`; panel.style.bottom = up ? `${window.innerHeight - rect.top + 4}px` : 'auto'
    panel.style.maxHeight = `${Math.max(100, Math.min(400, up ? above : below))}px`
    input.focus()
  }
  trigger.addEventListener('pointerdown', event => { if (event.button !== 0) return; event.preventDefault(); event.stopPropagation(); panel.hidden ? open() : close(true) })
  trigger.onclick = event => { if (event.detail === 0) panel.hidden ? open() : close(true) }
  trigger.onkeydown = event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); open() } }
  input.oninput = () => { active = 0; render() }
  input.onkeydown = event => {
    if (event.isComposing) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); active = (active + (event.key === 'ArrowDown' ? 1 : -1) + visible.length) % (visible.length || 1); highlight() }
    if (event.key === 'Enter') { event.preventDefault(); if (visible[active]) choose(visible[active]) }
  }
  box.onkeydown = event => { event.stopPropagation(); if (event.key === 'Escape') { event.preventDefault(); close(true) } }
  box.onclick = event => event.stopPropagation()
  box.onpointerdown = event => event.stopPropagation()
  box.addEventListener('focusout', () => { queueMicrotask(() => { if (!box.contains(document.activeElement)) close() }) })
  panel.append(input, list); box.append(trigger, panel); return box
}
