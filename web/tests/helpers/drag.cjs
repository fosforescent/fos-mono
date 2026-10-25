/** Exercise the palette's public drag/drop interaction in JSDOM. */
module.exports = function drag(source, destination = document.querySelector('.tree .ghost')) {
  if (!source || !destination) throw new Error('Drag needs a rendered source and destination.')
  const values = new Map()
  const transfer = { get types() { return [...values.keys()] }, setData: (key, value) => values.set(key, value), getData: key => values.get(key) ?? '' }
  for (const [target, type] of [[source, 'dragstart'], [destination, 'dragover'], [destination, 'drop'], [source, 'dragend']]) {
    const event = new window.Event(type, { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'dataTransfer', { value: transfer })
    target.dispatchEvent(event)
  }
}
