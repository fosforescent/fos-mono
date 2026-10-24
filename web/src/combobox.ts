import { iconSvg } from './icons'

type ComboAction = { label: string; pressed: boolean; disabled?: boolean; tone?: 'pending'; icon?: string; run: () => void }
export type ComboOption = { label: string; group: string; selected?: boolean; accessory?: ComboAction; accessories?: ComboAction[]; disabled?: boolean; drag?: { type: string; value: string }; run: () => void }
let sequence = 0
let closeActive: (() => void) | undefined
/** Searchable row popover. The caller supplies existing graph operations. */
export function combobox(label: string, caption: string, options: (query: string) => ComboOption[], actions: (query: string) => ComboOption[] = () => [], placeholder = 'Find branch…', editor?: HTMLTextAreaElement): HTMLElement {
  const box = document.createElement('span'); box.className = 'row-combobox'
  const trigger = document.createElement('button'); trigger.type = 'button'; trigger.className = 'combo-trigger secondary small'
  trigger.setAttribute('aria-label', label); trigger.setAttribute('aria-haspopup', 'dialog'); trigger.setAttribute('aria-expanded', 'false')
  const title = document.createElement('span'); title.textContent = caption
  const caret = document.createElement('span'); caret.innerHTML = iconSvg('▾') ?? '▾'
  trigger.append(title, caret)
  const panel = document.createElement('span'); panel.className = 'combo-panel'; panel.hidden = true; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', label)
  const input = editor ?? document.createElement('input'); if (input instanceof HTMLInputElement) input.type = 'search'; if (!editor) input.placeholder = placeholder; input.autocomplete = 'off'
  input.setAttribute('role', 'combobox'); input.setAttribute('aria-label', label); input.setAttribute('aria-autocomplete', 'list'); input.setAttribute('aria-expanded', 'false')
  const list = document.createElement('span'); list.className = 'combo-options'; list.id = `row-options-${++sequence}`; list.setAttribute('role', 'listbox'); list.setAttribute('aria-label', label)
  input.setAttribute('aria-controls', list.id)
  panel.id = `${list.id}-panel`; trigger.setAttribute('aria-controls', panel.id)
  let visible: ComboOption[] = [], active = 0
  const outside = (event: Event) => { if (!box.contains(event.target as Node) && event.target !== editor) close() }
  const reposition = () => close()
  const close = (restore = false) => {
    document.removeEventListener('pointerdown', outside, true); window.removeEventListener('resize', reposition)
    if (closeActive === close) closeActive = undefined
    panel.hidden = true; panel.style.opacity = ''; panel.style.pointerEvents = ''; trigger.setAttribute('aria-expanded', 'false'); input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant')
    if (restore) trigger.focus()
  }
  const highlight = () => {
    Array.from(list.querySelectorAll<HTMLElement>('[role="option"]')).forEach((row, i) => row.classList.toggle('active', i === active))
    const row = list.querySelector<HTMLElement>(`[data-index="${active}"]`)
    if (row) { input.setAttribute('aria-activedescendant', row.id); row.scrollIntoView?.({ block: 'nearest' }) }
    else input.removeAttribute('aria-activedescendant')
  }
  const choose = (option: ComboOption) => { if (option.disabled) return; close(); if (!editor) input.blur(); option.run() }
  const render = () => {
    const text = editor ? input.value.replace(/^@\{/, '').replace(/\}\s*$/, '').trim() : input.value.trim()
    const query = text.toLocaleLowerCase()
    visible = [...options(text).filter(o => o.label.toLocaleLowerCase().includes(query)), ...actions(text)]
    active = Math.min(active, Math.max(0, visible.length - 1)); list.replaceChildren()
    let group = ''
    visible.forEach((option, index) => {
      if (option.group !== group) { const heading = document.createElement('span'); heading.className = 'combo-group'; heading.textContent = group = option.group; list.append(heading) }
      const row = document.createElement('span'); row.className = 'combo-option'; row.id = `${list.id}-${index}`; row.dataset.index = String(index); row.setAttribute('role', 'option'); row.setAttribute('aria-selected', String(!!option.selected))
      row.textContent = `${option.selected ? '✓ ' : ''}${option.label}`
      row.setAttribute('aria-disabled', String(!!option.disabled))
      row.title = option.disabled ? 'Drag to a matching child requirement' : 'Select this value'
      if (option.drag) {
        row.draggable = true; row.tabIndex = -1
        row.addEventListener('dragstart', event => { event.stopPropagation(); event.dataTransfer?.setData(option.drag!.type, option.drag!.value); if (event.dataTransfer) event.dataTransfer.effectAllowed = 'link'; setTimeout(() => { if (!panel.hidden) { panel.style.opacity = '0'; panel.style.pointerEvents = 'none' } }, 0) })
        row.addEventListener('dragend', () => close())
      } else row.onpointerdown = event => event.preventDefault()
      row.onclick = () => choose(option)
      for (const accessory of [...(option.accessory ? [option.accessory] : []), ...(option.accessories ?? [])]) {
        const action = document.createElement('button'); action.type = 'button'; action.className = 'icon branch-request'
        action.innerHTML = iconSvg(accessory.icon ?? 'pull-request') ?? 'PR'; action.setAttribute('aria-label', accessory.label); action.title = accessory.label
        action.setAttribute('aria-pressed', String(accessory.pressed)); action.disabled = !!accessory.disabled
        if (accessory.tone) action.dataset.tone = accessory.tone
        action.onclick = event => { event.stopPropagation(); close(); accessory.run() }
        row.append(action)
      }
      list.append(row)
    })
    if (!visible.length) { const empty = document.createElement('span'); empty.className = 'combo-empty'; empty.textContent = 'No matches'; list.append(empty) }
    highlight()
  }
  const open = () => {
    closeActive?.(); closeActive = close
    document.addEventListener('pointerdown', outside, true); window.addEventListener('resize', reposition)
    panel.hidden = false; if (!editor) input.value = ''; active = 0; render()
    trigger.setAttribute('aria-expanded', 'true'); input.setAttribute('aria-expanded', 'true')
    const rect = (editor ?? trigger).getBoundingClientRect(), width = Math.min(360, window.innerWidth - 16)
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
  input.addEventListener('input', () => { active = 0; if (editor) { if (input.value.startsWith('@{')) { if (panel.hidden) open(); else render() } else close() } else render() })
  input.addEventListener('keydown', e => {
    const event = e as KeyboardEvent
    if (event.isComposing || panel.hidden || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return
    if (editor && ['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(event.key)) event.stopImmediatePropagation()
    if (event.key === 'Escape') { event.preventDefault(); close(!editor); return }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); active = (active + (event.key === 'ArrowDown' ? 1 : -1) + visible.length) % (visible.length || 1); highlight() }
    if (event.key === 'Enter') { event.preventDefault(); if (visible[active]) choose(visible[active]) }
  }, true)
  box.onkeydown = event => { event.stopPropagation(); if (event.key === 'Escape') { event.preventDefault(); close(true) } }
  box.onclick = event => event.stopPropagation()
  box.onpointerdown = event => event.stopPropagation()
  box.addEventListener('focusout', () => { setTimeout(() => { if (!box.contains(document.activeElement)) close() }, 0) })
  if (!editor) panel.append(input)
  panel.append(list); if (!editor) box.append(trigger); else { box.classList.add('peer-autocomplete'); input.addEventListener('blur', () => close()); }
  box.append(panel); return box
}
