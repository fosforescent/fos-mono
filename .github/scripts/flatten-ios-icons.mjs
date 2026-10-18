#!/usr/bin/env node
// App Store Connect rejects app icons that carry an alpha channel. `tauri icon`
// composites the iOS icons over bg_color but still writes them as RGBA, so this
// rewrites every PNG in the given directories as opaque 8-bit RGB, blending any
// remaining transparency over the background color.
//
// Usage: node flatten-ios-icons.mjs <bg-hex> <dir> [<dir> ...]

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { inflateSync, deflateSync, crc32 } from 'node:zlib'

const [bgHex, ...dirs] = process.argv.slice(2)
if (!/^#?[0-9a-f]{6}$/i.test(bgHex ?? '') || dirs.length === 0) {
  console.error('usage: flatten-ios-icons.mjs <bg-hex> <dir> [<dir> ...]')
  process.exit(2)
}
const bg = [0, 2, 4].map((i) => parseInt(bgHex.replace('#', '').slice(i, i + 2), 16))

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function readChunks(buf) {
  if (!buf.subarray(0, 8).equals(SIGNATURE)) throw new Error('not a PNG')
  const chunks = []
  for (let off = 8; off < buf.length; ) {
    const len = buf.readUInt32BE(off)
    chunks.push({ type: buf.toString('latin1', off + 4, off + 8), data: buf.subarray(off + 8, off + 8 + len) })
    off += 12 + len
  }
  return chunks
}

function chunk(type, data) {
  const head = Buffer.alloc(8)
  head.writeUInt32BE(data.length, 0)
  head.write(type, 4, 'latin1')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])) >>> 0)
  return Buffer.concat([head, data, crc])
}

function paeth(a, b, c) {
  const p = a + b - c
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}

// Undo PNG scanline filters; returns the raw pixel bytes without filter bytes.
function unfilter(data, width, height, bpp) {
  const stride = width * bpp
  const out = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y++) {
    const filter = data[y * (stride + 1)]
    const src = y * (stride + 1) + 1
    const row = y * stride
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[row + x - bpp] : 0
      const b = y > 0 ? out[row - stride + x] : 0
      const c = x >= bpp && y > 0 ? out[row - stride + x - bpp] : 0
      const v = data[src + x]
      out[row + x] =
        filter === 0 ? v
        : filter === 1 ? v + a
        : filter === 2 ? v + b
        : filter === 3 ? v + ((a + b) >> 1)
        : filter === 4 ? v + paeth(a, b, c)
        : (() => { throw new Error(`bad filter ${filter}`) })()
    }
  }
  return out
}

// Returns the flattened PNG, or null when the file is already opaque RGB.
function flatten(buf) {
  const chunks = readChunks(buf)
  const ihdr = chunks[0].data
  const width = ihdr.readUInt32BE(0), height = ihdr.readUInt32BE(4)
  const depth = ihdr[8], colorType = ihdr[9], interlace = ihdr[12]
  if (colorType === 2) return null
  if (colorType !== 6 || depth !== 8 || interlace !== 0) {
    throw new Error(`unsupported PNG (color type ${colorType}, depth ${depth}, interlace ${interlace})`)
  }
  const idat = Buffer.concat(chunks.filter((c) => c.type === 'IDAT').map((c) => c.data))
  const rgba = unfilter(inflateSync(idat), width, height, 4)

  const rgb = Buffer.alloc((width * 3 + 1) * height)
  for (let y = 0; y < height; y++) {
    const dst = y * (width * 3 + 1)
    rgb[dst] = 0
    for (let x = 0; x < width; x++) {
      const s = (y * width + x) * 4
      const alpha = rgba[s + 3]
      for (let ch = 0; ch < 3; ch++) {
        rgb[dst + 1 + x * 3 + ch] = Math.round((rgba[s + ch] * alpha + bg[ch] * (255 - alpha)) / 255)
      }
    }
  }

  const newIhdr = Buffer.from(ihdr)
  newIhdr[9] = 2
  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', newIhdr),
    chunk('IDAT', deflateSync(rgb, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

let count = 0
for (const dir of dirs) {
  if (!existsSync(dir)) {
    console.error(`missing icon directory: ${dir}`)
    process.exit(1)
  }
  for (const name of readdirSync(dir).filter((n) => n.toLowerCase().endsWith('.png'))) {
    const path = join(dir, name)
    const out = flatten(readFileSync(path))
    if (out) {
      writeFileSync(path, out)
      count++
    }
  }
}
console.log(`flattened ${count} icon(s) to opaque RGB over ${bgHex}`)
