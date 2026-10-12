// Runtime shims for the sync core inside QuickJS (see core.rs for the host functions).
globalThis.console = globalThis.console || {};
for (const level of ['log', 'info', 'warn', 'error', 'debug', 'trace']) {
  globalThis.console[level] = (...args) => { try { __hostLog(level, args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')) } catch (_) {} };
}
globalThis.crypto = globalThis.crypto || {};
globalThis.crypto.getRandomValues = (array) => { for (let i = 0; i < array.length; i++) array[i] = __hostRandom() & 0xff; return array; };
globalThis.crypto.randomUUID = () => {
  const b = globalThis.crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};
globalThis.process = globalThis.process || { env: {}, stdout: { isTTY: false } };
globalThis.window = globalThis;

// Uniform entry for the host: every call returns a JSON string {ok} or {error}.
globalThis.__call = (name, argsJson) => {
  try {
    const fn = globalThis.fosCore && globalThis.fosCore[name];
    if (typeof fn !== 'function') return JSON.stringify({ error: 'unknown core function ' + name });
    const value = fn.apply(globalThis.fosCore, JSON.parse(argsJson));
    return JSON.stringify({ ok: value === undefined ? null : value });
  } catch (e) {
    return JSON.stringify({ error: String((e && e.message) || e) });
  }
};
