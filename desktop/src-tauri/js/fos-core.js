"use strict";
(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __esm = (fn, res, err) => function __init() {
    if (err) throw err[0];
    try {
      return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
    } catch (e) {
      throw err = [e], e;
    }
  };
  var __commonJS = (cb, mod) => function __require() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // src-tauri/js/prelude.js
  var init_prelude = __esm({
    "src-tauri/js/prelude.js"() {
      "use strict";
      globalThis.console = globalThis.console || {};
      for (const level of ["log", "info", "warn", "error", "debug", "trace"]) {
        globalThis.console[level] = (...args) => {
          try {
            __hostLog(level, args.map((a) => typeof a === "string" ? a : JSON.stringify(a)).join(" "));
          } catch (_) {
          }
        };
      }
      globalThis.crypto = globalThis.crypto || {};
      globalThis.crypto.getRandomValues = (array) => {
        for (let i2 = 0; i2 < array.length; i2++) array[i2] = __hostRandom() & 255;
        return array;
      };
      globalThis.crypto.randomUUID = () => {
        const b = globalThis.crypto.getRandomValues(new Uint8Array(16));
        b[6] = b[6] & 15 | 64;
        b[8] = b[8] & 63 | 128;
        const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
        return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
      };
      globalThis.process = globalThis.process || { env: {}, stdout: { isTTY: false } };
      globalThis.window = globalThis;
      globalThis.__call = (name, argsJson) => {
        try {
          const fn = globalThis.fosCore && globalThis.fosCore[name];
          if (typeof fn !== "function") return JSON.stringify({ error: "unknown core function " + name });
          const value = fn.apply(globalThis.fosCore, JSON.parse(argsJson));
          return JSON.stringify({ ok: value === void 0 ? null : value });
        } catch (e) {
          return JSON.stringify({ error: String(e && e.message || e) });
        }
      };
    }
  });

  // ../node_modules/js-sha3/src/sha3.js
  var require_sha3 = __commonJS({
    "../node_modules/js-sha3/src/sha3.js"(exports, module) {
      init_prelude();
      (function() {
        "use strict";
        var INPUT_ERROR = "input is invalid type";
        var FINALIZE_ERROR = "finalize already called";
        var WINDOW = typeof window === "object";
        var root = WINDOW ? window : {};
        if (root.JS_SHA3_NO_WINDOW) {
          WINDOW = false;
        }
        var WEB_WORKER = !WINDOW && typeof self === "object";
        var NODE_JS = !root.JS_SHA3_NO_NODE_JS && typeof process === "object" && process.versions && process.versions.node;
        if (NODE_JS) {
          root = global;
        } else if (WEB_WORKER) {
          root = self;
        }
        var COMMON_JS = !root.JS_SHA3_NO_COMMON_JS && typeof module === "object" && module.exports;
        var AMD = typeof define === "function" && define.amd;
        var ARRAY_BUFFER = !root.JS_SHA3_NO_ARRAY_BUFFER && typeof ArrayBuffer !== "undefined";
        var HEX_CHARS = "0123456789abcdef".split("");
        var SHAKE_PADDING = [31, 7936, 2031616, 520093696];
        var CSHAKE_PADDING = [4, 1024, 262144, 67108864];
        var KECCAK_PADDING = [1, 256, 65536, 16777216];
        var PADDING = [6, 1536, 393216, 100663296];
        var SHIFT = [0, 8, 16, 24];
        var RC = [
          1,
          0,
          32898,
          0,
          32906,
          2147483648,
          2147516416,
          2147483648,
          32907,
          0,
          2147483649,
          0,
          2147516545,
          2147483648,
          32777,
          2147483648,
          138,
          0,
          136,
          0,
          2147516425,
          0,
          2147483658,
          0,
          2147516555,
          0,
          139,
          2147483648,
          32905,
          2147483648,
          32771,
          2147483648,
          32770,
          2147483648,
          128,
          2147483648,
          32778,
          0,
          2147483658,
          2147483648,
          2147516545,
          2147483648,
          32896,
          2147483648,
          2147483649,
          0,
          2147516424,
          2147483648
        ];
        var BITS = [224, 256, 384, 512];
        var SHAKE_BITS = [128, 256];
        var OUTPUT_TYPES = ["hex", "buffer", "arrayBuffer", "array", "digest"];
        var CSHAKE_BYTEPAD = {
          "128": 168,
          "256": 136
        };
        var isArray = root.JS_SHA3_NO_NODE_JS || !Array.isArray ? function(obj) {
          return Object.prototype.toString.call(obj) === "[object Array]";
        } : Array.isArray;
        var isView = ARRAY_BUFFER && (root.JS_SHA3_NO_ARRAY_BUFFER_IS_VIEW || !ArrayBuffer.isView) ? function(obj) {
          return typeof obj === "object" && obj.buffer && obj.buffer.constructor === ArrayBuffer;
        } : ArrayBuffer.isView;
        var formatMessage = function(message) {
          var type = typeof message;
          if (type === "string") {
            return [message, true];
          }
          if (type !== "object" || message === null) {
            throw new Error(INPUT_ERROR);
          }
          if (ARRAY_BUFFER && message.constructor === ArrayBuffer) {
            return [new Uint8Array(message), false];
          }
          if (!isArray(message) && !isView(message)) {
            throw new Error(INPUT_ERROR);
          }
          return [message, false];
        };
        var empty = function(message) {
          return formatMessage(message)[0].length === 0;
        };
        var cloneArray = function(array) {
          var newArray = [];
          for (var i3 = 0; i3 < array.length; ++i3) {
            newArray[i3] = array[i3];
          }
          return newArray;
        };
        var createOutputMethod = function(bits2, padding, outputType) {
          return function(message) {
            return new Keccak(bits2, padding, bits2).update(message)[outputType]();
          };
        };
        var createShakeOutputMethod = function(bits2, padding, outputType) {
          return function(message, outputBits) {
            return new Keccak(bits2, padding, outputBits).update(message)[outputType]();
          };
        };
        var createCshakeOutputMethod = function(bits2, padding, outputType) {
          return function(message, outputBits, n, s) {
            return methods["cshake" + bits2].update(message, outputBits, n, s)[outputType]();
          };
        };
        var createKmacOutputMethod = function(bits2, padding, outputType) {
          return function(key, message, outputBits, s) {
            return methods["kmac" + bits2].update(key, message, outputBits, s)[outputType]();
          };
        };
        var createOutputMethods = function(method, createMethod2, bits2, padding) {
          for (var i3 = 0; i3 < OUTPUT_TYPES.length; ++i3) {
            var type = OUTPUT_TYPES[i3];
            method[type] = createMethod2(bits2, padding, type);
          }
          return method;
        };
        var createMethod = function(bits2, padding) {
          var method = createOutputMethod(bits2, padding, "hex");
          method.create = function() {
            return new Keccak(bits2, padding, bits2);
          };
          method.update = function(message) {
            return method.create().update(message);
          };
          return createOutputMethods(method, createOutputMethod, bits2, padding);
        };
        var createShakeMethod = function(bits2, padding) {
          var method = createShakeOutputMethod(bits2, padding, "hex");
          method.create = function(outputBits) {
            return new Keccak(bits2, padding, outputBits);
          };
          method.update = function(message, outputBits) {
            return method.create(outputBits).update(message);
          };
          return createOutputMethods(method, createShakeOutputMethod, bits2, padding);
        };
        var createCshakeMethod = function(bits2, padding) {
          var w = CSHAKE_BYTEPAD[bits2];
          var method = createCshakeOutputMethod(bits2, padding, "hex");
          method.create = function(outputBits, n, s) {
            if (empty(n) && empty(s)) {
              return methods["shake" + bits2].create(outputBits);
            } else {
              return new Keccak(bits2, padding, outputBits).bytepad([n, s], w);
            }
          };
          method.update = function(message, outputBits, n, s) {
            return method.create(outputBits, n, s).update(message);
          };
          return createOutputMethods(method, createCshakeOutputMethod, bits2, padding);
        };
        var createKmacMethod = function(bits2, padding) {
          var w = CSHAKE_BYTEPAD[bits2];
          var method = createKmacOutputMethod(bits2, padding, "hex");
          method.create = function(key, outputBits, s) {
            return new Kmac(bits2, padding, outputBits).bytepad(["KMAC", s], w).bytepad([key], w);
          };
          method.update = function(key, message, outputBits, s) {
            return method.create(key, outputBits, s).update(message);
          };
          return createOutputMethods(method, createKmacOutputMethod, bits2, padding);
        };
        var algorithms = [
          { name: "keccak", padding: KECCAK_PADDING, bits: BITS, createMethod },
          { name: "sha3", padding: PADDING, bits: BITS, createMethod },
          { name: "shake", padding: SHAKE_PADDING, bits: SHAKE_BITS, createMethod: createShakeMethod },
          { name: "cshake", padding: CSHAKE_PADDING, bits: SHAKE_BITS, createMethod: createCshakeMethod },
          { name: "kmac", padding: CSHAKE_PADDING, bits: SHAKE_BITS, createMethod: createKmacMethod }
        ];
        var methods = {}, methodNames = [];
        for (var i2 = 0; i2 < algorithms.length; ++i2) {
          var algorithm = algorithms[i2];
          var bits = algorithm.bits;
          for (var j = 0; j < bits.length; ++j) {
            var methodName = algorithm.name + "_" + bits[j];
            methodNames.push(methodName);
            methods[methodName] = algorithm.createMethod(bits[j], algorithm.padding);
            if (algorithm.name !== "sha3") {
              var newMethodName = algorithm.name + bits[j];
              methodNames.push(newMethodName);
              methods[newMethodName] = methods[methodName];
            }
          }
        }
        function Keccak(bits2, padding, outputBits) {
          this.blocks = [];
          this.s = [];
          this.padding = padding;
          this.outputBits = outputBits;
          this.reset = true;
          this.finalized = false;
          this.block = 0;
          this.start = 0;
          this.blockCount = 1600 - (bits2 << 1) >> 5;
          this.byteCount = this.blockCount << 2;
          this.outputBlocks = outputBits >> 5;
          this.extraBytes = (outputBits & 31) >> 3;
          for (var i3 = 0; i3 < 50; ++i3) {
            this.s[i3] = 0;
          }
        }
        Keccak.prototype.update = function(message) {
          if (this.finalized) {
            throw new Error(FINALIZE_ERROR);
          }
          var result = formatMessage(message);
          message = result[0];
          var isString = result[1];
          var blocks = this.blocks, byteCount = this.byteCount, length = message.length, blockCount = this.blockCount, index = 0, s = this.s, i3, code;
          while (index < length) {
            if (this.reset) {
              this.reset = false;
              blocks[0] = this.block;
              for (i3 = 1; i3 < blockCount + 1; ++i3) {
                blocks[i3] = 0;
              }
            }
            if (isString) {
              for (i3 = this.start; index < length && i3 < byteCount; ++index) {
                code = message.charCodeAt(index);
                if (code < 128) {
                  blocks[i3 >> 2] |= code << SHIFT[i3++ & 3];
                } else if (code < 2048) {
                  blocks[i3 >> 2] |= (192 | code >> 6) << SHIFT[i3++ & 3];
                  blocks[i3 >> 2] |= (128 | code & 63) << SHIFT[i3++ & 3];
                } else if (code < 55296 || code >= 57344) {
                  blocks[i3 >> 2] |= (224 | code >> 12) << SHIFT[i3++ & 3];
                  blocks[i3 >> 2] |= (128 | code >> 6 & 63) << SHIFT[i3++ & 3];
                  blocks[i3 >> 2] |= (128 | code & 63) << SHIFT[i3++ & 3];
                } else {
                  code = 65536 + ((code & 1023) << 10 | message.charCodeAt(++index) & 1023);
                  blocks[i3 >> 2] |= (240 | code >> 18) << SHIFT[i3++ & 3];
                  blocks[i3 >> 2] |= (128 | code >> 12 & 63) << SHIFT[i3++ & 3];
                  blocks[i3 >> 2] |= (128 | code >> 6 & 63) << SHIFT[i3++ & 3];
                  blocks[i3 >> 2] |= (128 | code & 63) << SHIFT[i3++ & 3];
                }
              }
            } else {
              for (i3 = this.start; index < length && i3 < byteCount; ++index) {
                blocks[i3 >> 2] |= message[index] << SHIFT[i3++ & 3];
              }
            }
            this.lastByteIndex = i3;
            if (i3 >= byteCount) {
              this.start = i3 - byteCount;
              this.block = blocks[blockCount];
              for (i3 = 0; i3 < blockCount; ++i3) {
                s[i3] ^= blocks[i3];
              }
              f2(s);
              this.reset = true;
            } else {
              this.start = i3;
            }
          }
          return this;
        };
        Keccak.prototype.encode = function(x, right) {
          var o = x & 255, n = 1;
          var bytes = [o];
          x = x >> 8;
          o = x & 255;
          while (o > 0) {
            bytes.unshift(o);
            x = x >> 8;
            o = x & 255;
            ++n;
          }
          if (right) {
            bytes.push(n);
          } else {
            bytes.unshift(n);
          }
          this.update(bytes);
          return bytes.length;
        };
        Keccak.prototype.encodeString = function(str) {
          var result = formatMessage(str);
          str = result[0];
          var isString = result[1];
          var bytes = 0, length = str.length;
          if (isString) {
            for (var i3 = 0; i3 < str.length; ++i3) {
              var code = str.charCodeAt(i3);
              if (code < 128) {
                bytes += 1;
              } else if (code < 2048) {
                bytes += 2;
              } else if (code < 55296 || code >= 57344) {
                bytes += 3;
              } else {
                code = 65536 + ((code & 1023) << 10 | str.charCodeAt(++i3) & 1023);
                bytes += 4;
              }
            }
          } else {
            bytes = length;
          }
          bytes += this.encode(bytes * 8);
          this.update(str);
          return bytes;
        };
        Keccak.prototype.bytepad = function(strs, w) {
          var bytes = this.encode(w);
          for (var i3 = 0; i3 < strs.length; ++i3) {
            bytes += this.encodeString(strs[i3]);
          }
          var paddingBytes = (w - bytes % w) % w;
          var zeros = [];
          zeros.length = paddingBytes;
          this.update(zeros);
          return this;
        };
        Keccak.prototype.finalize = function() {
          if (this.finalized) {
            return;
          }
          this.finalized = true;
          var blocks = this.blocks, i3 = this.lastByteIndex, blockCount = this.blockCount, s = this.s;
          blocks[i3 >> 2] |= this.padding[i3 & 3];
          if (this.lastByteIndex === this.byteCount) {
            blocks[0] = blocks[blockCount];
            for (i3 = 1; i3 < blockCount + 1; ++i3) {
              blocks[i3] = 0;
            }
          }
          blocks[blockCount - 1] |= 2147483648;
          for (i3 = 0; i3 < blockCount; ++i3) {
            s[i3] ^= blocks[i3];
          }
          f2(s);
        };
        Keccak.prototype.toString = Keccak.prototype.hex = function() {
          this.finalize();
          var blockCount = this.blockCount, s = this.s, outputBlocks = this.outputBlocks, extraBytes = this.extraBytes, i3 = 0, j2 = 0;
          var hex = "", block;
          while (j2 < outputBlocks) {
            for (i3 = 0; i3 < blockCount && j2 < outputBlocks; ++i3, ++j2) {
              block = s[i3];
              hex += HEX_CHARS[block >> 4 & 15] + HEX_CHARS[block & 15] + HEX_CHARS[block >> 12 & 15] + HEX_CHARS[block >> 8 & 15] + HEX_CHARS[block >> 20 & 15] + HEX_CHARS[block >> 16 & 15] + HEX_CHARS[block >> 28 & 15] + HEX_CHARS[block >> 24 & 15];
            }
            if (j2 % blockCount === 0) {
              s = cloneArray(s);
              f2(s);
              i3 = 0;
            }
          }
          if (extraBytes) {
            block = s[i3];
            hex += HEX_CHARS[block >> 4 & 15] + HEX_CHARS[block & 15];
            if (extraBytes > 1) {
              hex += HEX_CHARS[block >> 12 & 15] + HEX_CHARS[block >> 8 & 15];
            }
            if (extraBytes > 2) {
              hex += HEX_CHARS[block >> 20 & 15] + HEX_CHARS[block >> 16 & 15];
            }
          }
          return hex;
        };
        Keccak.prototype.arrayBuffer = function() {
          this.finalize();
          var blockCount = this.blockCount, s = this.s, outputBlocks = this.outputBlocks, extraBytes = this.extraBytes, i3 = 0, j2 = 0;
          var bytes = this.outputBits >> 3;
          var buffer;
          if (extraBytes) {
            buffer = new ArrayBuffer(outputBlocks + 1 << 2);
          } else {
            buffer = new ArrayBuffer(bytes);
          }
          var array = new Uint32Array(buffer);
          while (j2 < outputBlocks) {
            for (i3 = 0; i3 < blockCount && j2 < outputBlocks; ++i3, ++j2) {
              array[j2] = s[i3];
            }
            if (j2 % blockCount === 0) {
              s = cloneArray(s);
              f2(s);
            }
          }
          if (extraBytes) {
            array[j2] = s[i3];
            buffer = buffer.slice(0, bytes);
          }
          return buffer;
        };
        Keccak.prototype.buffer = Keccak.prototype.arrayBuffer;
        Keccak.prototype.digest = Keccak.prototype.array = function() {
          this.finalize();
          var blockCount = this.blockCount, s = this.s, outputBlocks = this.outputBlocks, extraBytes = this.extraBytes, i3 = 0, j2 = 0;
          var array = [], offset, block;
          while (j2 < outputBlocks) {
            for (i3 = 0; i3 < blockCount && j2 < outputBlocks; ++i3, ++j2) {
              offset = j2 << 2;
              block = s[i3];
              array[offset] = block & 255;
              array[offset + 1] = block >> 8 & 255;
              array[offset + 2] = block >> 16 & 255;
              array[offset + 3] = block >> 24 & 255;
            }
            if (j2 % blockCount === 0) {
              s = cloneArray(s);
              f2(s);
            }
          }
          if (extraBytes) {
            offset = j2 << 2;
            block = s[i3];
            array[offset] = block & 255;
            if (extraBytes > 1) {
              array[offset + 1] = block >> 8 & 255;
            }
            if (extraBytes > 2) {
              array[offset + 2] = block >> 16 & 255;
            }
          }
          return array;
        };
        function Kmac(bits2, padding, outputBits) {
          Keccak.call(this, bits2, padding, outputBits);
        }
        Kmac.prototype = new Keccak();
        Kmac.prototype.finalize = function() {
          this.encode(this.outputBits, true);
          return Keccak.prototype.finalize.call(this);
        };
        var f2 = function(s) {
          var h, l, n, c0, c1, c2, c3, c4, c5, c6, c7, c8, c9, b0, b1, b2, b3, b4, b5, b6, b7, b8, b9, b10, b11, b12, b13, b14, b15, b16, b17, b18, b19, b20, b21, b22, b23, b24, b25, b26, b27, b28, b29, b30, b31, b32, b33, b34, b35, b36, b37, b38, b39, b40, b41, b42, b43, b44, b45, b46, b47, b48, b49;
          for (n = 0; n < 48; n += 2) {
            c0 = s[0] ^ s[10] ^ s[20] ^ s[30] ^ s[40];
            c1 = s[1] ^ s[11] ^ s[21] ^ s[31] ^ s[41];
            c2 = s[2] ^ s[12] ^ s[22] ^ s[32] ^ s[42];
            c3 = s[3] ^ s[13] ^ s[23] ^ s[33] ^ s[43];
            c4 = s[4] ^ s[14] ^ s[24] ^ s[34] ^ s[44];
            c5 = s[5] ^ s[15] ^ s[25] ^ s[35] ^ s[45];
            c6 = s[6] ^ s[16] ^ s[26] ^ s[36] ^ s[46];
            c7 = s[7] ^ s[17] ^ s[27] ^ s[37] ^ s[47];
            c8 = s[8] ^ s[18] ^ s[28] ^ s[38] ^ s[48];
            c9 = s[9] ^ s[19] ^ s[29] ^ s[39] ^ s[49];
            h = c8 ^ (c2 << 1 | c3 >>> 31);
            l = c9 ^ (c3 << 1 | c2 >>> 31);
            s[0] ^= h;
            s[1] ^= l;
            s[10] ^= h;
            s[11] ^= l;
            s[20] ^= h;
            s[21] ^= l;
            s[30] ^= h;
            s[31] ^= l;
            s[40] ^= h;
            s[41] ^= l;
            h = c0 ^ (c4 << 1 | c5 >>> 31);
            l = c1 ^ (c5 << 1 | c4 >>> 31);
            s[2] ^= h;
            s[3] ^= l;
            s[12] ^= h;
            s[13] ^= l;
            s[22] ^= h;
            s[23] ^= l;
            s[32] ^= h;
            s[33] ^= l;
            s[42] ^= h;
            s[43] ^= l;
            h = c2 ^ (c6 << 1 | c7 >>> 31);
            l = c3 ^ (c7 << 1 | c6 >>> 31);
            s[4] ^= h;
            s[5] ^= l;
            s[14] ^= h;
            s[15] ^= l;
            s[24] ^= h;
            s[25] ^= l;
            s[34] ^= h;
            s[35] ^= l;
            s[44] ^= h;
            s[45] ^= l;
            h = c4 ^ (c8 << 1 | c9 >>> 31);
            l = c5 ^ (c9 << 1 | c8 >>> 31);
            s[6] ^= h;
            s[7] ^= l;
            s[16] ^= h;
            s[17] ^= l;
            s[26] ^= h;
            s[27] ^= l;
            s[36] ^= h;
            s[37] ^= l;
            s[46] ^= h;
            s[47] ^= l;
            h = c6 ^ (c0 << 1 | c1 >>> 31);
            l = c7 ^ (c1 << 1 | c0 >>> 31);
            s[8] ^= h;
            s[9] ^= l;
            s[18] ^= h;
            s[19] ^= l;
            s[28] ^= h;
            s[29] ^= l;
            s[38] ^= h;
            s[39] ^= l;
            s[48] ^= h;
            s[49] ^= l;
            b0 = s[0];
            b1 = s[1];
            b32 = s[11] << 4 | s[10] >>> 28;
            b33 = s[10] << 4 | s[11] >>> 28;
            b14 = s[20] << 3 | s[21] >>> 29;
            b15 = s[21] << 3 | s[20] >>> 29;
            b46 = s[31] << 9 | s[30] >>> 23;
            b47 = s[30] << 9 | s[31] >>> 23;
            b28 = s[40] << 18 | s[41] >>> 14;
            b29 = s[41] << 18 | s[40] >>> 14;
            b20 = s[2] << 1 | s[3] >>> 31;
            b21 = s[3] << 1 | s[2] >>> 31;
            b2 = s[13] << 12 | s[12] >>> 20;
            b3 = s[12] << 12 | s[13] >>> 20;
            b34 = s[22] << 10 | s[23] >>> 22;
            b35 = s[23] << 10 | s[22] >>> 22;
            b16 = s[33] << 13 | s[32] >>> 19;
            b17 = s[32] << 13 | s[33] >>> 19;
            b48 = s[42] << 2 | s[43] >>> 30;
            b49 = s[43] << 2 | s[42] >>> 30;
            b40 = s[5] << 30 | s[4] >>> 2;
            b41 = s[4] << 30 | s[5] >>> 2;
            b22 = s[14] << 6 | s[15] >>> 26;
            b23 = s[15] << 6 | s[14] >>> 26;
            b4 = s[25] << 11 | s[24] >>> 21;
            b5 = s[24] << 11 | s[25] >>> 21;
            b36 = s[34] << 15 | s[35] >>> 17;
            b37 = s[35] << 15 | s[34] >>> 17;
            b18 = s[45] << 29 | s[44] >>> 3;
            b19 = s[44] << 29 | s[45] >>> 3;
            b10 = s[6] << 28 | s[7] >>> 4;
            b11 = s[7] << 28 | s[6] >>> 4;
            b42 = s[17] << 23 | s[16] >>> 9;
            b43 = s[16] << 23 | s[17] >>> 9;
            b24 = s[26] << 25 | s[27] >>> 7;
            b25 = s[27] << 25 | s[26] >>> 7;
            b6 = s[36] << 21 | s[37] >>> 11;
            b7 = s[37] << 21 | s[36] >>> 11;
            b38 = s[47] << 24 | s[46] >>> 8;
            b39 = s[46] << 24 | s[47] >>> 8;
            b30 = s[8] << 27 | s[9] >>> 5;
            b31 = s[9] << 27 | s[8] >>> 5;
            b12 = s[18] << 20 | s[19] >>> 12;
            b13 = s[19] << 20 | s[18] >>> 12;
            b44 = s[29] << 7 | s[28] >>> 25;
            b45 = s[28] << 7 | s[29] >>> 25;
            b26 = s[38] << 8 | s[39] >>> 24;
            b27 = s[39] << 8 | s[38] >>> 24;
            b8 = s[48] << 14 | s[49] >>> 18;
            b9 = s[49] << 14 | s[48] >>> 18;
            s[0] = b0 ^ ~b2 & b4;
            s[1] = b1 ^ ~b3 & b5;
            s[10] = b10 ^ ~b12 & b14;
            s[11] = b11 ^ ~b13 & b15;
            s[20] = b20 ^ ~b22 & b24;
            s[21] = b21 ^ ~b23 & b25;
            s[30] = b30 ^ ~b32 & b34;
            s[31] = b31 ^ ~b33 & b35;
            s[40] = b40 ^ ~b42 & b44;
            s[41] = b41 ^ ~b43 & b45;
            s[2] = b2 ^ ~b4 & b6;
            s[3] = b3 ^ ~b5 & b7;
            s[12] = b12 ^ ~b14 & b16;
            s[13] = b13 ^ ~b15 & b17;
            s[22] = b22 ^ ~b24 & b26;
            s[23] = b23 ^ ~b25 & b27;
            s[32] = b32 ^ ~b34 & b36;
            s[33] = b33 ^ ~b35 & b37;
            s[42] = b42 ^ ~b44 & b46;
            s[43] = b43 ^ ~b45 & b47;
            s[4] = b4 ^ ~b6 & b8;
            s[5] = b5 ^ ~b7 & b9;
            s[14] = b14 ^ ~b16 & b18;
            s[15] = b15 ^ ~b17 & b19;
            s[24] = b24 ^ ~b26 & b28;
            s[25] = b25 ^ ~b27 & b29;
            s[34] = b34 ^ ~b36 & b38;
            s[35] = b35 ^ ~b37 & b39;
            s[44] = b44 ^ ~b46 & b48;
            s[45] = b45 ^ ~b47 & b49;
            s[6] = b6 ^ ~b8 & b0;
            s[7] = b7 ^ ~b9 & b1;
            s[16] = b16 ^ ~b18 & b10;
            s[17] = b17 ^ ~b19 & b11;
            s[26] = b26 ^ ~b28 & b20;
            s[27] = b27 ^ ~b29 & b21;
            s[36] = b36 ^ ~b38 & b30;
            s[37] = b37 ^ ~b39 & b31;
            s[46] = b46 ^ ~b48 & b40;
            s[47] = b47 ^ ~b49 & b41;
            s[8] = b8 ^ ~b0 & b2;
            s[9] = b9 ^ ~b1 & b3;
            s[18] = b18 ^ ~b10 & b12;
            s[19] = b19 ^ ~b11 & b13;
            s[28] = b28 ^ ~b20 & b22;
            s[29] = b29 ^ ~b21 & b23;
            s[38] = b38 ^ ~b30 & b32;
            s[39] = b39 ^ ~b31 & b33;
            s[48] = b48 ^ ~b40 & b42;
            s[49] = b49 ^ ~b41 & b43;
            s[0] ^= RC[n];
            s[1] ^= RC[n + 1];
          }
        };
        if (COMMON_JS) {
          module.exports = methods;
        } else {
          for (i2 = 0; i2 < methodNames.length; ++i2) {
            root[methodNames[i2]] = methods[methodNames[i2]];
          }
          if (AMD) {
            define(function() {
              return methods;
            });
          }
        }
      })();
    }
  });

  // ../shared/node_modules/uuid/dist/esm-browser/max.js
  var max_default;
  var init_max = __esm({
    "../shared/node_modules/uuid/dist/esm-browser/max.js"() {
      init_prelude();
      max_default = "ffffffff-ffff-ffff-ffff-ffffffffffff";
    }
  });

  // ../shared/node_modules/uuid/dist/esm-browser/nil.js
  var nil_default;
  var init_nil = __esm({
    "../shared/node_modules/uuid/dist/esm-browser/nil.js"() {
      init_prelude();
      nil_default = "00000000-0000-0000-0000-000000000000";
    }
  });

  // ../shared/node_modules/uuid/dist/esm-browser/regex.js
  var regex_default;
  var init_regex = __esm({
    "../shared/node_modules/uuid/dist/esm-browser/regex.js"() {
      init_prelude();
      regex_default = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/i;
    }
  });

  // ../shared/node_modules/uuid/dist/esm-browser/validate.js
  function validate(uuid) {
    return typeof uuid === "string" && regex_default.test(uuid);
  }
  var validate_default;
  var init_validate = __esm({
    "../shared/node_modules/uuid/dist/esm-browser/validate.js"() {
      init_prelude();
      init_regex();
      validate_default = validate;
    }
  });

  // ../shared/node_modules/uuid/dist/esm-browser/parse.js
  function parse(uuid) {
    if (!validate_default(uuid)) {
      throw TypeError("Invalid UUID");
    }
    var v;
    var arr = new Uint8Array(16);
    arr[0] = (v = parseInt(uuid.slice(0, 8), 16)) >>> 24;
    arr[1] = v >>> 16 & 255;
    arr[2] = v >>> 8 & 255;
    arr[3] = v & 255;
    arr[4] = (v = parseInt(uuid.slice(9, 13), 16)) >>> 8;
    arr[5] = v & 255;
    arr[6] = (v = parseInt(uuid.slice(14, 18), 16)) >>> 8;
    arr[7] = v & 255;
    arr[8] = (v = parseInt(uuid.slice(19, 23), 16)) >>> 8;
    arr[9] = v & 255;
    arr[10] = (v = parseInt(uuid.slice(24, 36), 16)) / 1099511627776 & 255;
    arr[11] = v / 4294967296 & 255;
    arr[12] = v >>> 24 & 255;
    arr[13] = v >>> 16 & 255;
    arr[14] = v >>> 8 & 255;
    arr[15] = v & 255;
    return arr;
  }
  var parse_default;
  var init_parse = __esm({
    "../shared/node_modules/uuid/dist/esm-browser/parse.js"() {
      init_prelude();
      init_validate();
      parse_default = parse;
    }
  });

  // ../shared/node_modules/uuid/dist/esm-browser/stringify.js
  function unsafeStringify(arr, offset = 0) {
    return (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + "-" + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + "-" + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + "-" + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + "-" + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase();
  }
  function stringify(arr, offset = 0) {
    var uuid = unsafeStringify(arr, offset);
    if (!validate_default(uuid)) {
      throw TypeError("Stringified UUID is invalid");
    }
    return uuid;
  }
  var byteToHex, i, stringify_default;
  var init_stringify = __esm({
    "../shared/node_modules/uuid/dist/esm-browser/stringify.js"() {
      init_prelude();
      init_validate();
      byteToHex = [];
      for (i = 0; i < 256; ++i) {
        byteToHex.push((i + 256).toString(16).slice(1));
      }
      stringify_default = stringify;
    }
  });

  // ../shared/node_modules/uuid/dist/esm-browser/rng.js
  function rng() {
    if (!getRandomValues) {
      getRandomValues = typeof crypto !== "undefined" && crypto.getRandomValues && crypto.getRandomValues.bind(crypto);
      if (!getRandomValues) {
        throw new Error("crypto.getRandomValues() not supported. See https://github.com/uuidjs/uuid#getrandomvalues-not-supported");
      }
    }
    return getRandomValues(rnds8);
  }
  var getRandomValues, rnds8;
  var init_rng = __esm({
    "../shared/node_modules/uuid/dist/esm-browser/rng.js"() {
      init_prelude();
      rnds8 = new Uint8Array(16);
    }
  });

  // ../shared/node_modules/uuid/dist/esm-browser/v1.js
  function v1(options, buf, offset) {
    var i2 = buf && offset || 0;
    var b = buf || new Array(16);
    options = options || {};
    var node = options.node;
    var clockseq = options.clockseq;
    if (!options._v6) {
      if (!node) {
        node = _nodeId;
      }
      if (clockseq == null) {
        clockseq = _clockseq;
      }
    }
    if (node == null || clockseq == null) {
      var seedBytes = options.random || (options.rng || rng)();
      if (node == null) {
        node = [seedBytes[0], seedBytes[1], seedBytes[2], seedBytes[3], seedBytes[4], seedBytes[5]];
        if (!_nodeId && !options._v6) {
          node[0] |= 1;
          _nodeId = node;
        }
      }
      if (clockseq == null) {
        clockseq = (seedBytes[6] << 8 | seedBytes[7]) & 16383;
        if (_clockseq === void 0 && !options._v6) {
          _clockseq = clockseq;
        }
      }
    }
    var msecs = options.msecs !== void 0 ? options.msecs : Date.now();
    var nsecs = options.nsecs !== void 0 ? options.nsecs : _lastNSecs + 1;
    var dt = msecs - _lastMSecs + (nsecs - _lastNSecs) / 1e4;
    if (dt < 0 && options.clockseq === void 0) {
      clockseq = clockseq + 1 & 16383;
    }
    if ((dt < 0 || msecs > _lastMSecs) && options.nsecs === void 0) {
      nsecs = 0;
    }
    if (nsecs >= 1e4) {
      throw new Error("uuid.v1(): Can't create more than 10M uuids/sec");
    }
    _lastMSecs = msecs;
    _lastNSecs = nsecs;
    _clockseq = clockseq;
    msecs += 122192928e5;
    var tl = ((msecs & 268435455) * 1e4 + nsecs) % 4294967296;
    b[i2++] = tl >>> 24 & 255;
    b[i2++] = tl >>> 16 & 255;
    b[i2++] = tl >>> 8 & 255;
    b[i2++] = tl & 255;
    var tmh = msecs / 4294967296 * 1e4 & 268435455;
    b[i2++] = tmh >>> 8 & 255;
    b[i2++] = tmh & 255;
    b[i2++] = tmh >>> 24 & 15 | 16;
    b[i2++] = tmh >>> 16 & 255;
    b[i2++] = clockseq >>> 8 | 128;
    b[i2++] = clockseq & 255;
    for (var n = 0; n < 6; ++n) {
      b[i2 + n] = node[n];
    }
    return buf || unsafeStringify(b);
  }
  var _nodeId, _clockseq, _lastMSecs, _lastNSecs, v1_default;
  var init_v1 = __esm({
    "../shared/node_modules/uuid/dist/esm-browser/v1.js"() {
      init_prelude();
      init_rng();
      init_stringify();
      _lastMSecs = 0;
      _lastNSecs = 0;
      v1_default = v1;
    }
  });

  // ../shared/node_modules/uuid/dist/esm-browser/v1ToV6.js
  function v1ToV6(uuid) {
    var v1Bytes = typeof uuid === "string" ? parse_default(uuid) : uuid;
    var v6Bytes = _v1ToV6(v1Bytes);
    return typeof uuid === "string" ? unsafeStringify(v6Bytes) : v6Bytes;
  }
  function _v1ToV6(v1Bytes, randomize = false) {
    return Uint8Array.of((v1Bytes[6] & 15) << 4 | v1Bytes[7] >> 4 & 15, (v1Bytes[7] & 15) << 4 | (v1Bytes[4] & 240) >> 4, (v1Bytes[4] & 15) << 4 | (v1Bytes[5] & 240) >> 4, (v1Bytes[5] & 15) << 4 | (v1Bytes[0] & 240) >> 4, (v1Bytes[0] & 15) << 4 | (v1Bytes[1] & 240) >> 4, (v1Bytes[1] & 15) << 4 | (v1Bytes[2] & 240) >> 4, 96 | v1Bytes[2] & 15, v1Bytes[3], v1Bytes[8], v1Bytes[9], v1Bytes[10], v1Bytes[11], v1Bytes[12], v1Bytes[13], v1Bytes[14], v1Bytes[15]);
  }
  var init_v1ToV6 = __esm({
    "../shared/node_modules/uuid/dist/esm-browser/v1ToV6.js"() {
      init_prelude();
      init_parse();
      init_stringify();
    }
  });

  // ../shared/node_modules/uuid/dist/esm-browser/v35.js
  function stringToBytes(str) {
    str = unescape(encodeURIComponent(str));
    var bytes = [];
    for (var i2 = 0; i2 < str.length; ++i2) {
      bytes.push(str.charCodeAt(i2));
    }
    return bytes;
  }
  function v35(name, version2, hashfunc) {
    function generateUUID(value, namespace, buf, offset) {
      var _namespace;
      if (typeof value === "string") {
        value = stringToBytes(value);
      }
      if (typeof namespace === "string") {
        namespace = parse_default(namespace);
      }
      if (((_namespace = namespace) === null || _namespace === void 0 ? void 0 : _namespace.length) !== 16) {
        throw TypeError("Namespace must be array-like (16 iterable integer values, 0-255)");
      }
      var bytes = new Uint8Array(16 + value.length);
      bytes.set(namespace);
      bytes.set(value, namespace.length);
      bytes = hashfunc(bytes);
      bytes[6] = bytes[6] & 15 | version2;
      bytes[8] = bytes[8] & 63 | 128;
      if (buf) {
        offset = offset || 0;
        for (var i2 = 0; i2 < 16; ++i2) {
          buf[offset + i2] = bytes[i2];
        }
        return buf;
      }
      return unsafeStringify(bytes);
    }
    try {
      generateUUID.name = name;
    } catch (err) {
    }
    generateUUID.DNS = DNS;
    generateUUID.URL = URL;
    return generateUUID;
  }
  var DNS, URL;
  var init_v35 = __esm({
    "../shared/node_modules/uuid/dist/esm-browser/v35.js"() {
      init_prelude();
      init_stringify();
      init_parse();
      DNS = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
      URL = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";
    }
  });

  // ../shared/node_modules/uuid/dist/esm-browser/md5.js
  function md5(bytes) {
    if (typeof bytes === "string") {
      var msg = unescape(encodeURIComponent(bytes));
      bytes = new Uint8Array(msg.length);
      for (var i2 = 0; i2 < msg.length; ++i2) {
        bytes[i2] = msg.charCodeAt(i2);
      }
    }
    return md5ToHexEncodedArray(wordsToMd5(bytesToWords(bytes), bytes.length * 8));
  }
  function md5ToHexEncodedArray(input) {
    var output = [];
    var length32 = input.length * 32;
    var hexTab = "0123456789abcdef";
    for (var i2 = 0; i2 < length32; i2 += 8) {
      var x = input[i2 >> 5] >>> i2 % 32 & 255;
      var hex = parseInt(hexTab.charAt(x >>> 4 & 15) + hexTab.charAt(x & 15), 16);
      output.push(hex);
    }
    return output;
  }
  function getOutputLength(inputLength8) {
    return (inputLength8 + 64 >>> 9 << 4) + 14 + 1;
  }
  function wordsToMd5(x, len) {
    x[len >> 5] |= 128 << len % 32;
    x[getOutputLength(len) - 1] = len;
    var a = 1732584193;
    var b = -271733879;
    var c = -1732584194;
    var d = 271733878;
    for (var i2 = 0; i2 < x.length; i2 += 16) {
      var olda = a;
      var oldb = b;
      var oldc = c;
      var oldd = d;
      a = md5ff(a, b, c, d, x[i2], 7, -680876936);
      d = md5ff(d, a, b, c, x[i2 + 1], 12, -389564586);
      c = md5ff(c, d, a, b, x[i2 + 2], 17, 606105819);
      b = md5ff(b, c, d, a, x[i2 + 3], 22, -1044525330);
      a = md5ff(a, b, c, d, x[i2 + 4], 7, -176418897);
      d = md5ff(d, a, b, c, x[i2 + 5], 12, 1200080426);
      c = md5ff(c, d, a, b, x[i2 + 6], 17, -1473231341);
      b = md5ff(b, c, d, a, x[i2 + 7], 22, -45705983);
      a = md5ff(a, b, c, d, x[i2 + 8], 7, 1770035416);
      d = md5ff(d, a, b, c, x[i2 + 9], 12, -1958414417);
      c = md5ff(c, d, a, b, x[i2 + 10], 17, -42063);
      b = md5ff(b, c, d, a, x[i2 + 11], 22, -1990404162);
      a = md5ff(a, b, c, d, x[i2 + 12], 7, 1804603682);
      d = md5ff(d, a, b, c, x[i2 + 13], 12, -40341101);
      c = md5ff(c, d, a, b, x[i2 + 14], 17, -1502002290);
      b = md5ff(b, c, d, a, x[i2 + 15], 22, 1236535329);
      a = md5gg(a, b, c, d, x[i2 + 1], 5, -165796510);
      d = md5gg(d, a, b, c, x[i2 + 6], 9, -1069501632);
      c = md5gg(c, d, a, b, x[i2 + 11], 14, 643717713);
      b = md5gg(b, c, d, a, x[i2], 20, -373897302);
      a = md5gg(a, b, c, d, x[i2 + 5], 5, -701558691);
      d = md5gg(d, a, b, c, x[i2 + 10], 9, 38016083);
      c = md5gg(c, d, a, b, x[i2 + 15], 14, -660478335);
      b = md5gg(b, c, d, a, x[i2 + 4], 20, -405537848);
      a = md5gg(a, b, c, d, x[i2 + 9], 5, 568446438);
      d = md5gg(d, a, b, c, x[i2 + 14], 9, -1019803690);
      c = md5gg(c, d, a, b, x[i2 + 3], 14, -187363961);
      b = md5gg(b, c, d, a, x[i2 + 8], 20, 1163531501);
      a = md5gg(a, b, c, d, x[i2 + 13], 5, -1444681467);
      d = md5gg(d, a, b, c, x[i2 + 2], 9, -51403784);
      c = md5gg(c, d, a, b, x[i2 + 7], 14, 1735328473);
      b = md5gg(b, c, d, a, x[i2 + 12], 20, -1926607734);
      a = md5hh(a, b, c, d, x[i2 + 5], 4, -378558);
      d = md5hh(d, a, b, c, x[i2 + 8], 11, -2022574463);
      c = md5hh(c, d, a, b, x[i2 + 11], 16, 1839030562);
      b = md5hh(b, c, d, a, x[i2 + 14], 23, -35309556);
      a = md5hh(a, b, c, d, x[i2 + 1], 4, -1530992060);
      d = md5hh(d, a, b, c, x[i2 + 4], 11, 1272893353);
      c = md5hh(c, d, a, b, x[i2 + 7], 16, -155497632);
      b = md5hh(b, c, d, a, x[i2 + 10], 23, -1094730640);
      a = md5hh(a, b, c, d, x[i2 + 13], 4, 681279174);
      d = md5hh(d, a, b, c, x[i2], 11, -358537222);
      c = md5hh(c, d, a, b, x[i2 + 3], 16, -722521979);
      b = md5hh(b, c, d, a, x[i2 + 6], 23, 76029189);
      a = md5hh(a, b, c, d, x[i2 + 9], 4, -640364487);
      d = md5hh(d, a, b, c, x[i2 + 12], 11, -421815835);
      c = md5hh(c, d, a, b, x[i2 + 15], 16, 530742520);
      b = md5hh(b, c, d, a, x[i2 + 2], 23, -995338651);
      a = md5ii(a, b, c, d, x[i2], 6, -198630844);
      d = md5ii(d, a, b, c, x[i2 + 7], 10, 1126891415);
      c = md5ii(c, d, a, b, x[i2 + 14], 15, -1416354905);
      b = md5ii(b, c, d, a, x[i2 + 5], 21, -57434055);
      a = md5ii(a, b, c, d, x[i2 + 12], 6, 1700485571);
      d = md5ii(d, a, b, c, x[i2 + 3], 10, -1894986606);
      c = md5ii(c, d, a, b, x[i2 + 10], 15, -1051523);
      b = md5ii(b, c, d, a, x[i2 + 1], 21, -2054922799);
      a = md5ii(a, b, c, d, x[i2 + 8], 6, 1873313359);
      d = md5ii(d, a, b, c, x[i2 + 15], 10, -30611744);
      c = md5ii(c, d, a, b, x[i2 + 6], 15, -1560198380);
      b = md5ii(b, c, d, a, x[i2 + 13], 21, 1309151649);
      a = md5ii(a, b, c, d, x[i2 + 4], 6, -145523070);
      d = md5ii(d, a, b, c, x[i2 + 11], 10, -1120210379);
      c = md5ii(c, d, a, b, x[i2 + 2], 15, 718787259);
      b = md5ii(b, c, d, a, x[i2 + 9], 21, -343485551);
      a = safeAdd(a, olda);
      b = safeAdd(b, oldb);
      c = safeAdd(c, oldc);
      d = safeAdd(d, oldd);
    }
    return [a, b, c, d];
  }
  function bytesToWords(input) {
    if (input.length === 0) {
      return [];
    }
    var length8 = input.length * 8;
    var output = new Uint32Array(getOutputLength(length8));
    for (var i2 = 0; i2 < length8; i2 += 8) {
      output[i2 >> 5] |= (input[i2 / 8] & 255) << i2 % 32;
    }
    return output;
  }
  function safeAdd(x, y) {
    var lsw = (x & 65535) + (y & 65535);
    var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
    return msw << 16 | lsw & 65535;
  }
  function bitRotateLeft(num, cnt) {
    return num << cnt | num >>> 32 - cnt;
  }
  function md5cmn(q, a, b, x, s, t) {
    return safeAdd(bitRotateLeft(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b);
  }
  function md5ff(a, b, c, d, x, s, t) {
    return md5cmn(b & c | ~b & d, a, b, x, s, t);
  }
  function md5gg(a, b, c, d, x, s, t) {
    return md5cmn(b & d | c & ~d, a, b, x, s, t);
  }
  function md5hh(a, b, c, d, x, s, t) {
    return md5cmn(b ^ c ^ d, a, b, x, s, t);
  }
  function md5ii(a, b, c, d, x, s, t) {
    return md5cmn(c ^ (b | ~d), a, b, x, s, t);
  }
  var md5_default;
  var init_md5 = __esm({
    "../shared/node_modules/uuid/dist/esm-browser/md5.js"() {
      init_prelude();
      md5_default = md5;
    }
  });

  // ../shared/node_modules/uuid/dist/esm-browser/v3.js
  var v3, v3_default;
  var init_v3 = __esm({
    "../shared/node_modules/uuid/dist/esm-browser/v3.js"() {
      init_prelude();
      init_v35();
      init_md5();
      v3 = v35("v3", 48, md5_default);
      v3_default = v3;
    }
  });

  // ../shared/node_modules/uuid/dist/esm-browser/native.js
  var randomUUID, native_default;
  var init_native = __esm({
    "../shared/node_modules/uuid/dist/esm-browser/native.js"() {
      init_prelude();
      randomUUID = typeof crypto !== "undefined" && crypto.randomUUID && crypto.randomUUID.bind(crypto);
      native_default = {
        randomUUID
      };
    }
  });

  // ../shared/node_modules/uuid/dist/esm-browser/v4.js
  function v4(options, buf, offset) {
    if (native_default.randomUUID && !buf && !options) {
      return native_default.randomUUID();
    }
    options = options || {};
    var rnds = options.random || (options.rng || rng)();
    rnds[6] = rnds[6] & 15 | 64;
    rnds[8] = rnds[8] & 63 | 128;
    if (buf) {
      offset = offset || 0;
      for (var i2 = 0; i2 < 16; ++i2) {
        buf[offset + i2] = rnds[i2];
      }
      return buf;
    }
    return unsafeStringify(rnds);
  }
  var v4_default;
  var init_v4 = __esm({
    "../shared/node_modules/uuid/dist/esm-browser/v4.js"() {
      init_prelude();
      init_native();
      init_rng();
      init_stringify();
      v4_default = v4;
    }
  });

  // ../shared/node_modules/uuid/dist/esm-browser/sha1.js
  function f(s, x, y, z) {
    switch (s) {
      case 0:
        return x & y ^ ~x & z;
      case 1:
        return x ^ y ^ z;
      case 2:
        return x & y ^ x & z ^ y & z;
      case 3:
        return x ^ y ^ z;
    }
  }
  function ROTL(x, n) {
    return x << n | x >>> 32 - n;
  }
  function sha1(bytes) {
    var K = [1518500249, 1859775393, 2400959708, 3395469782];
    var H = [1732584193, 4023233417, 2562383102, 271733878, 3285377520];
    if (typeof bytes === "string") {
      var msg = unescape(encodeURIComponent(bytes));
      bytes = [];
      for (var i2 = 0; i2 < msg.length; ++i2) {
        bytes.push(msg.charCodeAt(i2));
      }
    } else if (!Array.isArray(bytes)) {
      bytes = Array.prototype.slice.call(bytes);
    }
    bytes.push(128);
    var l = bytes.length / 4 + 2;
    var N = Math.ceil(l / 16);
    var M = new Array(N);
    for (var _i = 0; _i < N; ++_i) {
      var arr = new Uint32Array(16);
      for (var j = 0; j < 16; ++j) {
        arr[j] = bytes[_i * 64 + j * 4] << 24 | bytes[_i * 64 + j * 4 + 1] << 16 | bytes[_i * 64 + j * 4 + 2] << 8 | bytes[_i * 64 + j * 4 + 3];
      }
      M[_i] = arr;
    }
    M[N - 1][14] = (bytes.length - 1) * 8 / Math.pow(2, 32);
    M[N - 1][14] = Math.floor(M[N - 1][14]);
    M[N - 1][15] = (bytes.length - 1) * 8 & 4294967295;
    for (var _i2 = 0; _i2 < N; ++_i2) {
      var W = new Uint32Array(80);
      for (var t = 0; t < 16; ++t) {
        W[t] = M[_i2][t];
      }
      for (var _t = 16; _t < 80; ++_t) {
        W[_t] = ROTL(W[_t - 3] ^ W[_t - 8] ^ W[_t - 14] ^ W[_t - 16], 1);
      }
      var a = H[0];
      var b = H[1];
      var c = H[2];
      var d = H[3];
      var e = H[4];
      for (var _t2 = 0; _t2 < 80; ++_t2) {
        var s = Math.floor(_t2 / 20);
        var T = ROTL(a, 5) + f(s, b, c, d) + e + K[s] + W[_t2] >>> 0;
        e = d;
        d = c;
        c = ROTL(b, 30) >>> 0;
        b = a;
        a = T;
      }
      H[0] = H[0] + a >>> 0;
      H[1] = H[1] + b >>> 0;
      H[2] = H[2] + c >>> 0;
      H[3] = H[3] + d >>> 0;
      H[4] = H[4] + e >>> 0;
    }
    return [H[0] >> 24 & 255, H[0] >> 16 & 255, H[0] >> 8 & 255, H[0] & 255, H[1] >> 24 & 255, H[1] >> 16 & 255, H[1] >> 8 & 255, H[1] & 255, H[2] >> 24 & 255, H[2] >> 16 & 255, H[2] >> 8 & 255, H[2] & 255, H[3] >> 24 & 255, H[3] >> 16 & 255, H[3] >> 8 & 255, H[3] & 255, H[4] >> 24 & 255, H[4] >> 16 & 255, H[4] >> 8 & 255, H[4] & 255];
  }
  var sha1_default;
  var init_sha1 = __esm({
    "../shared/node_modules/uuid/dist/esm-browser/sha1.js"() {
      init_prelude();
      sha1_default = sha1;
    }
  });

  // ../shared/node_modules/uuid/dist/esm-browser/v5.js
  var v5, v5_default;
  var init_v5 = __esm({
    "../shared/node_modules/uuid/dist/esm-browser/v5.js"() {
      init_prelude();
      init_v35();
      init_sha1();
      v5 = v35("v5", 80, sha1_default);
      v5_default = v5;
    }
  });

  // ../shared/node_modules/uuid/dist/esm-browser/v6.js
  function ownKeys(e, r) {
    var t = Object.keys(e);
    if (Object.getOwnPropertySymbols) {
      var o = Object.getOwnPropertySymbols(e);
      r && (o = o.filter(function(r2) {
        return Object.getOwnPropertyDescriptor(e, r2).enumerable;
      })), t.push.apply(t, o);
    }
    return t;
  }
  function _objectSpread(e) {
    for (var r = 1; r < arguments.length; r++) {
      var t = null != arguments[r] ? arguments[r] : {};
      r % 2 ? ownKeys(Object(t), true).forEach(function(r2) {
        _defineProperty(e, r2, t[r2]);
      }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function(r2) {
        Object.defineProperty(e, r2, Object.getOwnPropertyDescriptor(t, r2));
      });
    }
    return e;
  }
  function _defineProperty(e, r, t) {
    return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: true, configurable: true, writable: true }) : e[r] = t, e;
  }
  function _toPropertyKey(t) {
    var i2 = _toPrimitive(t, "string");
    return "symbol" == typeof i2 ? i2 : i2 + "";
  }
  function _toPrimitive(t, r) {
    if ("object" != typeof t || !t) return t;
    var e = t[Symbol.toPrimitive];
    if (void 0 !== e) {
      var i2 = e.call(t, r || "default");
      if ("object" != typeof i2) return i2;
      throw new TypeError("@@toPrimitive must return a primitive value.");
    }
    return ("string" === r ? String : Number)(t);
  }
  function v6(options = {}, buf, offset = 0) {
    var bytes = v1_default(_objectSpread(_objectSpread({}, options), {}, {
      _v6: true
    }), new Uint8Array(16));
    bytes = v1ToV6(bytes);
    if (buf) {
      for (var i2 = 0; i2 < 16; i2++) {
        buf[offset + i2] = bytes[i2];
      }
      return buf;
    }
    return unsafeStringify(bytes);
  }
  var init_v6 = __esm({
    "../shared/node_modules/uuid/dist/esm-browser/v6.js"() {
      init_prelude();
      init_stringify();
      init_v1();
      init_v1ToV6();
    }
  });

  // ../shared/node_modules/uuid/dist/esm-browser/v6ToV1.js
  function v6ToV1(uuid) {
    var v6Bytes = typeof uuid === "string" ? parse_default(uuid) : uuid;
    var v1Bytes = _v6ToV1(v6Bytes);
    return typeof uuid === "string" ? unsafeStringify(v1Bytes) : v1Bytes;
  }
  function _v6ToV1(v6Bytes) {
    return Uint8Array.of((v6Bytes[3] & 15) << 4 | v6Bytes[4] >> 4 & 15, (v6Bytes[4] & 15) << 4 | (v6Bytes[5] & 240) >> 4, (v6Bytes[5] & 15) << 4 | v6Bytes[6] & 15, v6Bytes[7], (v6Bytes[1] & 15) << 4 | (v6Bytes[2] & 240) >> 4, (v6Bytes[2] & 15) << 4 | (v6Bytes[3] & 240) >> 4, 16 | (v6Bytes[0] & 240) >> 4, (v6Bytes[0] & 15) << 4 | (v6Bytes[1] & 240) >> 4, v6Bytes[8], v6Bytes[9], v6Bytes[10], v6Bytes[11], v6Bytes[12], v6Bytes[13], v6Bytes[14], v6Bytes[15]);
  }
  var init_v6ToV1 = __esm({
    "../shared/node_modules/uuid/dist/esm-browser/v6ToV1.js"() {
      init_prelude();
      init_parse();
      init_stringify();
    }
  });

  // ../shared/node_modules/uuid/dist/esm-browser/v7.js
  function v7(options, buf, offset) {
    options = options || {};
    var i2 = buf && offset || 0;
    var b = buf || new Uint8Array(16);
    var rnds = options.random || (options.rng || rng)();
    var msecs = options.msecs !== void 0 ? options.msecs : Date.now();
    var seq = options.seq !== void 0 ? options.seq : null;
    var seqHigh = _seqHigh;
    var seqLow = _seqLow;
    if (msecs > _msecs && options.msecs === void 0) {
      _msecs = msecs;
      if (seq !== null) {
        seqHigh = null;
        seqLow = null;
      }
    }
    if (seq !== null) {
      if (seq > 2147483647) {
        seq = 2147483647;
      }
      seqHigh = seq >>> 19 & 4095;
      seqLow = seq & 524287;
    }
    if (seqHigh === null || seqLow === null) {
      seqHigh = rnds[6] & 127;
      seqHigh = seqHigh << 8 | rnds[7];
      seqLow = rnds[8] & 63;
      seqLow = seqLow << 8 | rnds[9];
      seqLow = seqLow << 5 | rnds[10] >>> 3;
    }
    if (msecs + 1e4 > _msecs && seq === null) {
      if (++seqLow > 524287) {
        seqLow = 0;
        if (++seqHigh > 4095) {
          seqHigh = 0;
          _msecs++;
        }
      }
    } else {
      _msecs = msecs;
    }
    _seqHigh = seqHigh;
    _seqLow = seqLow;
    b[i2++] = _msecs / 1099511627776 & 255;
    b[i2++] = _msecs / 4294967296 & 255;
    b[i2++] = _msecs / 16777216 & 255;
    b[i2++] = _msecs / 65536 & 255;
    b[i2++] = _msecs / 256 & 255;
    b[i2++] = _msecs & 255;
    b[i2++] = seqHigh >>> 4 & 15 | 112;
    b[i2++] = seqHigh & 255;
    b[i2++] = seqLow >>> 13 & 63 | 128;
    b[i2++] = seqLow >>> 5 & 255;
    b[i2++] = seqLow << 3 & 255 | rnds[10] & 7;
    b[i2++] = rnds[11];
    b[i2++] = rnds[12];
    b[i2++] = rnds[13];
    b[i2++] = rnds[14];
    b[i2++] = rnds[15];
    return buf || unsafeStringify(b);
  }
  var _seqLow, _seqHigh, _msecs, v7_default;
  var init_v7 = __esm({
    "../shared/node_modules/uuid/dist/esm-browser/v7.js"() {
      init_prelude();
      init_rng();
      init_stringify();
      _seqLow = null;
      _seqHigh = null;
      _msecs = 0;
      v7_default = v7;
    }
  });

  // ../shared/node_modules/uuid/dist/esm-browser/version.js
  function version(uuid) {
    if (!validate_default(uuid)) {
      throw TypeError("Invalid UUID");
    }
    return parseInt(uuid.slice(14, 15), 16);
  }
  var version_default;
  var init_version = __esm({
    "../shared/node_modules/uuid/dist/esm-browser/version.js"() {
      init_prelude();
      init_validate();
      version_default = version;
    }
  });

  // ../shared/node_modules/uuid/dist/esm-browser/index.js
  var esm_browser_exports = {};
  __export(esm_browser_exports, {
    MAX: () => max_default,
    NIL: () => nil_default,
    parse: () => parse_default,
    stringify: () => stringify_default,
    v1: () => v1_default,
    v1ToV6: () => v1ToV6,
    v3: () => v3_default,
    v4: () => v4_default,
    v5: () => v5_default,
    v6: () => v6,
    v6ToV1: () => v6ToV1,
    v7: () => v7_default,
    validate: () => validate_default,
    version: () => version_default
  });
  var init_esm_browser = __esm({
    "../shared/node_modules/uuid/dist/esm-browser/index.js"() {
      init_prelude();
      init_max();
      init_nil();
      init_parse();
      init_stringify();
      init_v1();
      init_v1ToV6();
      init_v3();
      init_v4();
      init_v5();
      init_v6();
      init_v6ToV1();
      init_v7();
      init_validate();
      init_version();
    }
  });

  // ../shared/sync/embed.ts
  init_prelude();

  // ../shared/sync/index.ts
  init_prelude();

  // ../shared/sync/graph.ts
  init_prelude();

  // ../shared/dag-implementation/cid.ts
  init_prelude();
  var jsSha3 = __toESM(require_sha3(), 1);
  var sha3_2562 = jsSha3.sha3_256 ?? jsSha3.default.sha3_256;
  var PREFIXED = /^v(\d+)-([0-9a-f]+)$/;
  var LEGACY = /^[0-9a-f]{64}$/;
  function normalizeObject(obj) {
    if (obj === null || typeof obj !== "object") return obj;
    if (Array.isArray(obj)) return obj.map(normalizeObject);
    const source = obj;
    return Object.keys(source).sort().reduce((result, key) => {
      result[key] = normalizeObject(source[key]);
      return result;
    }, {});
  }
  function sortEdgesUndirected(edges) {
    return edges.map((edge) => [...edge].sort()).sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0);
  }
  function sha3Digest(content2) {
    const normalized = {
      data: JSON.stringify(normalizeObject(content2.data)),
      children: sortEdgesUndirected(content2.children || [])
    };
    return sha3_2562(JSON.stringify(normalized));
  }
  function sha3OrderedDigest(content2) {
    const normalized = {
      v: 2,
      data: JSON.stringify(normalizeObject(content2.data)),
      children: (content2.children || []).map(([a, b]) => [a, b])
    };
    return sha3_2562(JSON.stringify(normalized));
  }
  var CID_FORMATS = {
    0: {
      version: 0,
      description: "Legacy: bare sha3-256 hex of {data: canonical JSON, children: sorted edges}; no version prefix.",
      digest: sha3Digest
    },
    1: {
      version: 1,
      description: 'Same digest as v0, written as "v1-<hex>" so the format can be told apart and migrated.',
      digest: sha3Digest
    },
    2: {
      version: 2,
      description: "Edges hashed in order and direction (child order is part of identity).",
      digest: sha3OrderedDigest
    }
  };
  var CURRENT_CID_VERSION = 2;
  function parseCid(cid) {
    if (typeof cid !== "string") return null;
    const prefixed = PREFIXED.exec(cid);
    if (prefixed) {
      const version2 = Number(prefixed[1]);
      return version2 in CID_FORMATS ? { version: version2, digest: prefixed[2] } : null;
    }
    if (LEGACY.test(cid)) return { version: 0, digest: cid };
    return null;
  }
  function cidVersion(cid) {
    return parseCid(cid)?.version ?? null;
  }
  function formatCid(version2, digest) {
    if (!(version2 in CID_FORMATS)) throw new Error(`unknown cid version ${version2}`);
    return version2 === 0 ? digest : `v${version2}-${digest}`;
  }
  function isCurrentCid(cid) {
    return cidVersion(cid) === CURRENT_CID_VERSION;
  }
  function hashContentAt(content2, version2) {
    const format = CID_FORMATS[version2];
    if (!format) throw new Error(`unknown cid version ${version2}`);
    return formatCid(version2, format.digest(content2));
  }
  function hashContent(content2) {
    return hashContentAt(content2, CURRENT_CID_VERSION);
  }
  function verifyCid(cid, content2) {
    const parsed = parseCid(cid);
    if (!parsed) return false;
    return hashContentAt(content2, parsed.version) === cid;
  }

  // ../shared/sync/graph.ts
  var SYNC_FORMAT_VERSION = 1;
  function content(store, cid) {
    const value = store.table.get(cid);
    if (!value) throw new Error(`node ${cid.slice(0, 12)} not found`);
    return value;
  }
  function hasNode(store, cid) {
    return !!cid && store.table.has(cid);
  }
  function put(store, value) {
    return store.create(value).getId();
  }
  function aliasIdOf(value) {
    return value.data.alias?.id ?? null;
  }
  function isRefNode(store, value) {
    return value.children.some(([i2]) => i2 === store.primitive.targetPointerConstructor.getId());
  }
  function isHandle(value) {
    return !!value.data.ref;
  }
  function refValueCid(store, value) {
    const edge = value.children.find(([i2]) => i2 === store.primitive.targetPointerConstructor.getId());
    return edge ? edge[1] : null;
  }
  function refTypeCid(store, value) {
    const edge = value.children.find(([i2]) => i2 === store.primitive.instructionPointerConstructor.getId());
    return edge ? edge[1] : null;
  }
  function valueContent(store, cid) {
    const value = content(store, cid);
    if (isHandle(value)) return value;
    const target = refValueCid(store, value);
    return target && store.table.has(target) ? content(store, target) : value;
  }
  function refNodeContent(store, data, valueCid, bookkeeping = [], typeCid = null) {
    const children = [[store.primitive.targetPointerConstructor.getId(), valueCid]];
    if (typeCid) children.push([store.primitive.instructionPointerConstructor.getId(), typeCid]);
    return { data, children: [...children, ...bookkeeping] };
  }
  function newId() {
    const cryptoApi = globalThis.crypto;
    if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
    return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  }
  function edgeKey(store, edge) {
    const [instr, target] = edge;
    if (instr === store.primitive.proposalField.getId()) {
      const p = readProposal(store, target);
      if (p) return `p:${p.peerId}/${p.name}`;
    }
    const targetAlias = aliasIdOf(content(store, target));
    if (targetAlias) return `a:${targetAlias}`;
    const instrAlias = aliasIdOf(content(store, instr));
    if (instrAlias) return `a:${instrAlias}`;
    return `e:${instr}:${target}`;
  }
  function isTaskEdge(store, edge) {
    return edge[1] === store.primitive.completeField.getId() && !!valueContent(store, edge[0]).data.todo;
  }
  function rowPrimitive(store, kind) {
    switch (kind) {
      case "task":
        return store.primitive.completeField.getId();
      case "plain":
        return store.primitive.descriptionField.getId();
      case "note":
        return store.primitive.documentField.getId();
      case "comment":
        return store.primitive.commentField.getId();
      case "ref":
        return store.primitive.linkField.getId();
      case "requirement":
        return store.primitive.requirementField.getId();
      case "supply":
        return store.primitive.supplyField.getId();
      case "query":
        return store.primitive.queryField.getId();
      case "resource":
        return store.primitive.resourceField.getId();
      case "allocation":
        return store.primitive.allocationField.getId();
      case "template":
        return store.primitive.templateField.getId();
    }
  }
  function rowKindOf(store, edge) {
    if (isPartitionEdge(store, edge)) return "plain";
    const [, target] = edge;
    const p = store.primitive;
    if (target === p.completeField.getId()) return valueContent(store, edge[0]).data.todo ? "task" : "plain";
    if (target === p.descriptionField.getId()) return "plain";
    if (target === p.documentField.getId()) return "note";
    if (target === p.commentField.getId()) return "comment";
    if (target === p.linkField.getId()) return "ref";
    if (target === p.requirementField.getId()) return "requirement";
    if (target === p.supplyField.getId()) return "supply";
    if (target === p.queryField.getId()) return "query";
    if (target === p.resourceField.getId()) return "resource";
    if (target === p.allocationField.getId()) return "allocation";
    if (target === p.templateField.getId()) return "template";
    return null;
  }
  function isRowEdge(store, edge) {
    return rowKindOf(store, edge) !== null;
  }
  function identityOnInstruction(store, edge) {
    return !isPartitionEdge(store, edge) && rowKindOf(store, edge) !== null;
  }
  function isPartitionEdge(store, edge) {
    return edge[0] === store.primitive.listField.getId();
  }
  function isChoiceEdge(store, edge) {
    return edge[0] === store.primitive.choiceTarget.getId();
  }
  function isPeerEdge(store, edge) {
    return edge[0] === store.primitive.peerField.getId();
  }
  function identityCid(store, edge) {
    return identityOnInstruction(store, edge) ? edge[0] : edge[1];
  }
  function withIdentity(store, edge, cid) {
    return identityOnInstruction(store, edge) ? [cid, edge[1]] : [edge[0], cid];
  }
  function sameShape(store, a, b) {
    const aRow = identityOnInstruction(store, a);
    const bRow = identityOnInstruction(store, b);
    if (aRow !== bRow) return false;
    return aRow ? a[1] === b[1] : a[0] === b[0];
  }
  function taskContent(id, title, done, createdAt, updatedAt) {
    return {
      data: {
        alias: { id },
        description: { content: title },
        todo: { completed: done, time: createdAt },
        updated: { time: updatedAt }
      },
      children: []
    };
  }
  function rowContent(kind, id, text, now, extra = {}) {
    const data = { alias: { id }, description: { content: text }, updated: { time: now } };
    if (kind === "task") data.todo = { completed: !!extra.done, time: now };
    if (kind === "requirement") data.requirement = extra.requirement ?? { capability: "confirmation" };
    if (kind === "supply") data.supply = extra.supply ?? { capability: "confirmation", by: "", at: now };
    if (kind === "query") data.query = extra.query ?? {};
    if (kind === "resource") data.resource = extra.resource ?? { type: "inventory", unit: "unit" };
    if (kind === "allocation") data.allocation = extra.allocation ?? { resource: "", type: "inventory", amount: 0, unit: "unit" };
    if (kind === "comment") data.comment = { content: text, authorID: extra.author?.id ?? "", authorName: extra.author?.name ?? "", time: now, votes: {} };
    if (kind === "ref") {
      data.ref = extra.refOwner ? { id: extra.refId ?? "", owner: extra.refOwner } : { id: extra.refId ?? "" };
      if (extra.targetCid && extra.store) return refNodeContent(extra.store, data, extra.targetCid);
    }
    return { data, children: [] };
  }
  function rowEdge(store, kind, cid) {
    return [cid, rowPrimitive(store, kind)];
  }
  function convertRowContent(value, kind, now) {
    const { todo: _todo, comment: _comment, ref: _ref, requirement: _rq, supply: _su, query: _q, resource: _rs, allocation: _al, ...rest } = value.data;
    const data = { ...rest, updated: { time: now } };
    if (kind === "task") data.todo = { completed: !!value.data.todo?.completed, time: value.data.todo?.time ?? now };
    if (kind === "comment") data.comment = value.data.comment ?? { content: value.data.description?.content ?? "", authorID: "", authorName: "", time: now, votes: {} };
    if (kind === "ref") data.ref = value.data.ref ?? { id: "" };
    if (kind === "requirement") data.requirement = value.data.requirement ?? { capability: "confirmation" };
    if (kind === "supply") data.supply = value.data.supply ?? { capability: "confirmation", by: "", at: now };
    if (kind === "query") data.query = value.data.query ?? {};
    if (kind === "resource") data.resource = value.data.resource ?? { type: "inventory", unit: "unit" };
    if (kind === "allocation") data.allocation = value.data.allocation ?? { resource: "", type: "inventory", amount: 0, unit: "unit" };
    return { ...value, data };
  }
  function peerRefContent(peerId) {
    return { data: { peerId: { content: peerId } }, children: [] };
  }
  function taskEdge(store, taskCid) {
    return [taskCid, store.primitive.completeField.getId()];
  }
  function pointerContent(peerId, edge, store) {
    const data = peerId ? { peerId: { content: peerId } } : {};
    const children = edge ? [
      [store.primitive.instructionPointerConstructor.getId(), edge[0]],
      [store.primitive.targetPointerConstructor.getId(), edge[1]]
    ] : [];
    return { data, children };
  }
  function readPointer(store, cid) {
    const value = content(store, cid);
    let instr = null;
    let target = null;
    for (const [i2, t] of value.children) {
      if (i2 === store.primitive.instructionPointerConstructor.getId()) instr = t;
      if (i2 === store.primitive.targetPointerConstructor.getId()) target = t;
    }
    return {
      peerId: value.data.peerId?.content ?? null,
      edge: instr && target ? [instr, target] : null
    };
  }
  function putChoice(store, id, base, options) {
    const alternatives = options.map((o) => ({ peerId: o.peerId, cid: put(store, pointerContent(o.peerId, o.edge, store)) })).sort((a, b) => a.cid < b.cid ? -1 : a.cid > b.cid ? 1 : 0);
    const baseCid = put(store, pointerContent(null, base, store));
    const children = [
      [store.primitive.conflictBaseNode.getId(), baseCid],
      ...alternatives.map((a) => [store.primitive.optionNotSelectedConstructor.getId(), a.cid])
    ];
    return put(store, {
      data: {
        alias: { id },
        conflict: { path: id },
        option: { selectedIndex: 0, defaultResolutionStrategy: "choice" }
      },
      children
    });
  }
  function readChoice(store, choiceCid) {
    const value = content(store, choiceCid);
    let base = null;
    const options = [];
    for (const [instr, target] of value.children) {
      if (instr === store.primitive.conflictBaseNode.getId()) {
        base = readPointer(store, target).edge;
      } else if (instr === store.primitive.optionNotSelectedConstructor.getId()) {
        const pointer = readPointer(store, target);
        options.push({ peerId: pointer.peerId ?? "unknown", edge: pointer.edge });
      }
    }
    return { cid: choiceCid, id: aliasIdOf(value) ?? choiceCid, base, options };
  }
  function findEdge(store, value, key) {
    return value.children.find((edge) => edgeKey(store, edge) === key);
  }
  function resolveScope(store, nodeCid, scope) {
    let current = nodeCid;
    for (const step of scope) {
      if (!current) return null;
      current = findChild(store, current, step);
    }
    return current;
  }
  function replaceEdge(store, value, key, edge) {
    let found = false;
    const children = [];
    for (const existing of value.children) {
      if (edgeKey(store, existing) === key) {
        found = true;
        if (edge) children.push(edge);
      } else {
        children.push(existing);
      }
    }
    if (!found && edge) children.push(edge);
    return { ...value, children };
  }
  function updateAtScope(store, nodeCid, scope, fn, mode = "value") {
    const identity = content(store, nodeCid);
    const ref = isRefNode(store, identity) && !isHandle(identity);
    const value = ref ? valueContent(store, nodeCid) : identity;
    const advance = (nextValue) => {
      if (nextValue === value) return nodeCid;
      if (ref) {
        const now = nextValue.data.updated?.time ?? value.data.updated?.time ?? 0;
        return put(store, relinkContent(store, identity, nodeCid, nextValue, now));
      }
      if (isLegacyInlineLink(store, identity)) {
        const contentChanged = putStripped(store, nextValue) !== putStripped(store, value);
        return put(store, contentChanged ? withPrev(store, nextValue, nodeCid) : nextValue);
      }
      return put(store, nextValue);
    };
    if (scope.length === 0) {
      if (mode === "node") {
        const next = fn(identity);
        return next === identity ? nodeCid : put(store, next);
      }
      return advance(fn(value));
    }
    const [step, ...rest] = scope;
    const found = findAliasEdge(store, value, step);
    if (!found || isChoiceEdge(store, found.edge)) throw new Error(`node ${step} not found`);
    const childCid = identityCid(store, found.edge);
    const nextChild = updateAtScope(store, childCid, rest, fn, mode);
    if (nextChild === childCid) return nodeCid;
    const children = [...value.children];
    children[found.index] = withIdentity(store, found.edge, nextChild);
    return advance({ ...value, children });
  }
  function withChildValue(store, edge, nextValue, now) {
    const idCid = identityCid(store, edge);
    const identity = content(store, idCid);
    if (isRefNode(store, identity) && !isHandle(identity)) {
      return withIdentity(store, edge, put(store, relinkContent(store, identity, idCid, nextValue, now)));
    }
    return withIdentity(store, edge, put(store, nextValue));
  }
  function withPeer(store, value, peerId) {
    const refCid = put(store, peerRefContent(peerId));
    const edge = [store.primitive.peerField.getId(), refCid];
    if (value.children.some(([i2, t]) => i2 === edge[0] && t === edge[1])) return value;
    return { ...value, children: [...value.children, edge] };
  }
  function rootTargetCid(store) {
    const root = content(store, store.rootNodeId);
    const pointer = root.children.find(([i2]) => i2 === store.primitive.targetPointerConstructor.getId());
    return pointer ? pointer[1] : store.rootNodeId;
  }
  function rootIsAlias(store) {
    return content(store, store.rootNodeId).children.some(([i2]) => i2 === store.primitive.targetPointerConstructor.getId());
  }
  function commitRoot(store, newTargetCid, now, mergeSourceCid = null) {
    if (newTargetCid === rootTargetCid(store) && !mergeSourceCid) return;
    const previous = content(store, store.rootNodeId);
    const instruction = rootIsAlias(store) ? previous.children.find(([i2]) => i2 === store.primitive.instructionPointerConstructor.getId()) : void 0;
    const children = [
      [store.primitive.targetPointerConstructor.getId(), newTargetCid],
      [store.primitive.instructionPointerConstructor.getId(), instruction ? instruction[1] : store.primitive.rootInstructionNode.getId()],
      [store.primitive.previousVersion.getId(), store.rootNodeId]
    ];
    if (mergeSourceCid) children.push([store.primitive.mergeSourceNode.getId(), mergeSourceCid]);
    const alias = previous.data.alias ?? { id: newId() };
    store.rootNodeId = put(store, { data: { alias, updated: { time: now } }, children });
    store.updateCtxCallback?.(store.exportContext([]));
  }
  function reachableNodes(store, roots, skip = /* @__PURE__ */ new Set()) {
    const out = {};
    const stack = roots.filter((r) => !!r && store.table.has(r));
    const seen = /* @__PURE__ */ new Set();
    while (stack.length) {
      const cid = stack.pop();
      if (seen.has(cid)) continue;
      seen.add(cid);
      const value = content(store, cid);
      if (!skip.has(cid)) out[cid] = value;
      for (const [i2, t] of value.children) {
        if (!seen.has(i2)) stack.push(i2);
        if (!seen.has(t)) stack.push(t);
      }
    }
    return out;
  }
  function reachableSet(store, roots) {
    return new Set(Object.keys(reachableNodes(store, roots)));
  }
  function importNodes(store, nodes) {
    const accepted = [];
    let pending = Object.entries(nodes).filter(([cid, value]) => {
      if (store.table.has(cid)) return false;
      if (!value || typeof value !== "object" || !Array.isArray(value.children)) return false;
      return isCurrentCid(cid) && verifyCid(cid, value);
    });
    let progress = true;
    while (pending.length && progress) {
      progress = false;
      const rest = [];
      for (const entry of pending) {
        const [cid, value] = entry;
        if (value.children.every(([i2, t]) => store.table.has(i2) && store.table.has(t))) {
          store.table.set(cid, value);
          accepted.push(cid);
          progress = true;
        } else {
          rest.push(entry);
        }
      }
      pending = rest;
    }
    return accepted;
  }
  function exportReachableContext(store, extraRoots = []) {
    return {
      nodes: reachableNodes(store, [store.rootNodeId, ...extraRoots]),
      route: [],
      rootNodeId: store.rootNodeId
    };
  }
  function rowView(store, nodeCid, kind) {
    const identity = content(store, nodeCid);
    const value = valueContent(store, nodeCid);
    const created = value.data.todo?.time ?? value.data.updated?.time ?? 0;
    const sub = countNode(store, nodeCid);
    const view2 = {
      id: aliasIdOf(value) ?? nodeCid,
      title: value.data.description?.content ?? "",
      kind,
      checkable: kind === "task",
      done: kind === "task" && !!value.data.todo?.completed,
      createdAt: created,
      updatedAt: value.data.updated?.time ?? created,
      childCount: value.children.filter((e) => isRowEdge(store, e)).length,
      childChoices: value.children.filter((e) => isChoiceEdge(store, e)).length,
      subtreeTasks: sub.tasks,
      subtreeDone: sub.done,
      isLink: isLink(store, identity)
    };
    if (kind === "ref") {
      view2.refId = identity.data.ref?.id ?? "";
      if (identity.data.ref?.owner) view2.refOwner = identity.data.ref.owner;
    }
    if (kind === "comment" && value.data.comment) view2.author = { id: value.data.comment.authorID, name: value.data.comment.authorName, time: value.data.comment.time };
    if (kind === "task") {
      const blockers = taskBlockers(store, nodeCid);
      if (blockers.length) view2.blockedBy = blockers;
      if (value.data.template) view2.template = value.data.template;
    }
    if (kind === "requirement" && value.data.requirement) {
      const progress = requirementProgress(store, nodeCid);
      view2.requirement = { ...value.data.requirement, satisfied: requirementSatisfied(store, nodeCid), summary: requirementSummary(value.data.requirement), ...progress ? progress : {} };
    }
    if (kind === "supply" && value.data.supply) view2.supply = value.data.supply;
    if (kind === "query") view2.query = value.data.query ?? {};
    if (kind === "resource" && value.data.resource) {
      const allocated = allocatedIn(store, nodeCid);
      view2.resource = { ...value.data.resource, allocated, available: value.data.resource.capacity === void 0 ? null : value.data.resource.capacity - allocated };
    }
    if (kind === "allocation" && value.data.allocation) view2.allocation = value.data.allocation;
    if (identity.data.listing) view2.market = true;
    return view2;
  }
  function requirementSummary(req) {
    switch (req.capability) {
      case "confirmation":
        return "confirmation";
      case "choice":
        return `choice${req.options?.length ? ` (${req.options.join(" | ")})` : ""}`;
      case "search":
        return "search";
      case "allocation":
        return `${req.resource ?? "resource"}${req.amount !== void 0 ? ` ${req.amount} ${req.unit ?? ""}`.trimEnd() : ""}`;
      case "task":
        return "task";
      case "market":
        return "market";
      case "mail":
        return "mail";
      case "peer":
        return req.peer ? `@${req.peer}` : "peer";
    }
  }
  function childRows(store, cid, kind) {
    const out = [];
    for (const edge of valueContent(store, cid).children) {
      const k = rowKindOf(store, edge);
      if (!k || kind && k !== kind) continue;
      const id = identityCid(store, edge);
      out.push({ cid: id, kind: k, value: valueContent(store, id) });
    }
    return out;
  }
  function allocationFills(req, a) {
    return !!a && (!req.resource || a.type === req.resource) && (req.amount === void 0 || a.amount >= req.amount);
  }
  function allocationMatches(req, a) {
    return !!a && (!req.resource || a.type === req.resource);
  }
  function requirementProgress(store, requirementCid, root) {
    const req = valueContent(store, requirementCid).data.requirement;
    if (!req || req.capability !== "allocation" || req.amount === void 0) return null;
    let have = 0;
    for (const { kind, value } of childRows(store, requirementCid)) {
      if (kind === "allocation" && allocationMatches(req, value.data.allocation)) have += value.data.allocation?.amount ?? 0;
      if (kind === "supply" && value.data.supply?.capability === "allocation" && value.data.supply.ref) {
        const found = findRowByAlias(store, root ?? rootTargetCid(store), value.data.supply.ref);
        if (!found) have += req.amount;
        else if (allocationMatches(req, found.row.allocation)) have += found.row.allocation?.amount ?? 0;
      }
    }
    return { have, need: req.amount };
  }
  function requirementSatisfied(store, requirementCid, root) {
    const req = valueContent(store, requirementCid).data.requirement;
    if (!req) return true;
    const rows = childRows(store, requirementCid);
    const filledByChild = rows.some(({ kind, value }) => {
      switch (req.capability) {
        case "task":
          return kind === "task" && !!value.data.todo?.completed;
        case "allocation":
          return kind === "allocation" && allocationFills(req, value.data.allocation);
        case "search":
          return kind === "query" && !!value.data.query?.executedAt;
        // "-@name": the named person allocates themself ("@name 2h") inside it
        case "peer":
          return kind === "allocation" && value.data.allocation?.type === "person" && (!req.peer || value.data.allocation.person === req.peer);
        default:
          return false;
      }
    });
    if (filledByChild) return true;
    if (req.capability === "allocation" && req.amount !== void 0 && req.amount > 0) {
      const progress = requirementProgress(store, requirementCid, root);
      if (progress && progress.have >= progress.need) return true;
    }
    return rows.some(({ kind, value }) => {
      const s = kind === "supply" ? value.data.supply : void 0;
      if (!s || s.capability !== req.capability) return false;
      switch (req.capability) {
        case "confirmation":
          return !!s.by;
        case "choice":
          return typeof s.choice === "number" && (!req.options || s.choice >= 0 && s.choice < req.options.length);
        case "search":
          return !!s.ref;
        case "task":
          return !!s.ref;
        case "market":
          return !!s.by;
        case "mail":
          return !!s.by;
        case "peer":
          return !!s.by && (!req.peer || s.by === req.peer);
        case "allocation": {
          if (!s.ref) return false;
          const found = findRowByAlias(store, root ?? rootTargetCid(store), s.ref);
          if (!found) return true;
          return allocationFills(req, found.row.allocation);
        }
      }
    });
  }
  function taskBlockers(store, taskCid) {
    return childRows(store, taskCid, "requirement").filter(({ cid }) => !requirementSatisfied(store, cid)).map(({ value }) => value.data.requirement ? requirementSummary(value.data.requirement) : "requirement");
  }
  function allocatedIn(store, bankCid) {
    let total = 0;
    for (const { cid, kind, value } of childRows(store, bankCid)) {
      if (kind === "allocation") total += value.data.allocation?.amount ?? 0;
      else if (kind === "resource") total += allocatedIn(store, cid);
    }
    return total;
  }
  function describeEdge(store, edge) {
    if (!edge) return { task: null, label: null };
    const kind = rowKindOf(store, edge);
    if (kind) return { task: rowView(store, identityCid(store, edge), kind), label: null };
    const value = valueContent(store, identityCid(store, edge));
    return { task: null, label: value.data.description?.content ?? value.data.alias?.id ?? "node" };
  }
  function choiceView(store, choiceCid) {
    const record = readChoice(store, choiceCid);
    const base = describeEdge(store, record.base);
    const options = record.options.map((o) => ({ peerId: o.peerId, ...describeEdge(store, o.edge) }));
    const subject = base.task?.title ?? base.label ?? options.map((o) => o.task?.title ?? o.label).find((s) => !!s) ?? record.id;
    return { id: record.id, subject, base: base.task, baseLabel: base.label, options };
  }
  function countNode(store, cid) {
    let tasks = 0;
    let done = 0;
    let choices = 0;
    for (const edge of valueContent(store, cid).children) {
      if (isTaskEdge(store, edge)) {
        tasks++;
        if (content(store, edge[0]).data.todo?.completed) done++;
        const sub = countNode(store, edge[0]);
        tasks += sub.tasks;
        done += sub.done;
        choices += sub.choices;
      } else if (isChoiceEdge(store, edge)) {
        choices++;
      } else if (isRowEdge(store, edge)) {
        const sub = countNode(store, identityCid(store, edge));
        tasks += sub.tasks;
        done += sub.done;
        choices += sub.choices;
      }
    }
    return { tasks, done, choices };
  }
  function viewNode(store, cid) {
    const identity = content(store, cid);
    const value = valueContent(store, cid);
    const link = isLink(store, identity);
    const view2 = {
      name: value.data.description?.content ?? null,
      done: value.data.todo ? !!value.data.todo.completed : null,
      tasks: [],
      choices: [],
      peers: [],
      isLink: link,
      members: link ? readMembers(store, identity) : [],
      proposals: link ? readProposals(store, identity).map((p) => proposalView(store, identity, p)) : [],
      versions: link ? linkHistory(store, cid).length : 0
    };
    const peerEdges = identity === value ? identity.children : [...identity.children, ...value.children];
    for (const edge of peerEdges) {
      if (isPeerEdge(store, edge)) {
        const peerId = content(store, edge[1]).data.peerId?.content;
        if (peerId && !view2.peers.includes(peerId)) view2.peers.push(peerId);
      }
    }
    for (const edge of value.children) {
      const kind = rowKindOf(store, edge);
      if (kind) {
        view2.tasks.push(rowView(store, identityCid(store, edge), kind));
      } else if (isChoiceEdge(store, edge)) {
        view2.choices.push(choiceView(store, edge[1]));
      }
    }
    return view2;
  }
  function scopeNames(store, nodeCid, scope) {
    const names = [];
    let current = nodeCid;
    for (const step of scope) {
      if (!current) {
        names.push(step);
        continue;
      }
      const next = findChild(store, current, step);
      names.push(next ? valueContent(store, next).data.description?.content ?? step : step);
      current = next;
    }
    return names;
  }
  var CAPABILITIES = ["read", "read-requests", "edit", "approve", "autopush", "direct", "http", "ws", "relay", "search", "market", "mail"];
  function isLink(store, value) {
    if (isHandle(value)) return false;
    return isRefNode(store, value) || !!value.data.link;
  }
  function isLegacyInlineLink(store, value) {
    return !!value.data.link && !isRefNode(store, value);
  }
  function isPrevEdge(store, edge) {
    return edge[0] === store.primitive.previousVersion.getId();
  }
  function isMemberEdge(store, edge) {
    return edge[0] === store.primitive.memberField.getId();
  }
  function isProposalEdge(store, edge) {
    return edge[0] === store.primitive.proposalField.getId();
  }
  function isBookkeepingEdge(store, edge) {
    return isPrevEdge(store, edge) || isMemberEdge(store, edge) || isProposalEdge(store, edge) || isPeerEdge(store, edge);
  }
  function stripLink(store, value) {
    if (isRefNode(store, value) && !isHandle(value)) {
      const target = refValueCid(store, value);
      return store.table.has(target) ? content(store, target) : { data: {}, children: [] };
    }
    const { link: _link, ...data } = value.data;
    return { data, children: value.children.filter((e) => !isBookkeepingEdge(store, e)) };
  }
  function bookkeepingOf(store, value) {
    return value.children.filter((e) => isBookkeepingEdge(store, e));
  }
  function putStripped(store, value) {
    return put(store, stripLink(store, value));
  }
  function makeLink(store, value, now) {
    if (isRefNode(store, value) && !isHandle(value)) return value;
    const stripped = stripLink(store, value);
    const valueCid = put(store, stripped);
    const data = { alias: value.data.alias ?? { id: newId() }, updated: { time: now } };
    return refNodeContent(store, data, valueCid, bookkeepingOf(store, value));
  }
  function withPrev(store, next, previousCid) {
    const prevEdge = [store.primitive.previousVersion.getId(), previousCid];
    const children = next.children.filter((e) => !isPrevEdge(store, e));
    return { ...next, children: [...children, prevEdge] };
  }
  function linkHistory(store, cid, limit = 50) {
    const out = [];
    let current = cid;
    while (current && out.length < limit) {
      const prev = content(store, current).children.find((e) => isPrevEdge(store, e));
      current = prev ? prev[1] : null;
      if (current && store.table.has(current)) out.push(current);
      else break;
    }
    return out;
  }
  function capabilityTarget(store, capability) {
    const p = store.primitive;
    switch (capability) {
      case "edit":
        return p.proposeAction.getId();
      case "approve":
        return p.approveAction.getId();
      case "direct":
        return p.directConnectCapability.getId();
      case "http":
        return p.httpConnectCapability.getId();
      case "ws":
        return p.wsConnectCapability.getId();
      case "relay":
        return p.relayCapability.getId();
      case "search":
        return p.searchCapability.getId();
      case "market":
        return p.marketCapability.getId();
      case "mail":
        return p.mailCapability.getId();
      case "read":
        return p.readCapability.getId();
      case "read-requests":
        return p.readRequestsCapability.getId();
      case "autopush":
        return p.autopushCapability.getId();
    }
  }
  function capabilityOfTarget(store, target) {
    return CAPABILITIES.find((c) => target === capabilityTarget(store, c)) ?? null;
  }
  function capabilityOf(store, edge) {
    if (edge[0] !== store.primitive.capabilityNode.getId()) return null;
    return capabilityOfTarget(store, edge[1]);
  }
  function acceptsOf(store, edge) {
    if (edge[0] !== store.primitive.acceptsNode.getId()) return null;
    return capabilityOfTarget(store, edge[1]);
  }
  function readMembers(store, value) {
    const out = [];
    for (const edge of value.children) {
      if (!isMemberEdge(store, edge)) continue;
      const ref = content(store, edge[1]);
      const peerId = ref.data.peerId?.content;
      if (!peerId) continue;
      const caps = ref.children.map((e) => capabilityOf(store, e)).filter((c) => c !== null);
      const off = (ref.data.disabledCapabilities?.content ?? []).filter((c) => CAPABILITIES.includes(c) && caps.includes(c));
      const accepts = ref.children.map((e) => acceptsOf(store, e)).filter((c) => c !== null);
      out.push({ peerId, name: ref.data.name?.content ?? null, capabilities: caps, ...off.length ? { disabled: off } : {}, ...accepts.length ? { accepts } : {} });
    }
    return out;
  }
  function textNode(store, text) {
    return put(store, { data: { description: { content: text } }, children: [] });
  }
  function proposalContent(store, peerId, name, contentCid, baseCid, timestamp, status = "open") {
    return {
      data: { proposal: { status } },
      children: [
        [store.primitive.proposalNameField.getId(), textNode(store, name)],
        [store.primitive.proposedContentField.getId(), contentCid],
        [store.primitive.senderField.getId(), textNode(store, peerId)],
        [store.primitive.timestampField.getId(), textNode(store, String(timestamp))],
        [store.primitive.previousVersion.getId(), baseCid]
      ]
    };
  }
  function readProposal(store, cid) {
    const value = content(store, cid);
    let peerId = "";
    let name = "";
    let contentCid = "";
    let baseCid = "";
    let timestamp = 0;
    for (const [instr, target] of value.children) {
      if (instr === store.primitive.proposalNameField.getId()) name = content(store, target).data.description?.content ?? "";
      else if (instr === store.primitive.proposedContentField.getId()) contentCid = target;
      else if (instr === store.primitive.senderField.getId()) peerId = content(store, target).data.description?.content ?? "";
      else if (instr === store.primitive.timestampField.getId()) timestamp = Number(content(store, target).data.description?.content ?? 0) || 0;
      else if (instr === store.primitive.previousVersion.getId()) baseCid = target;
    }
    if (!peerId || !contentCid || !baseCid) return null;
    return { cid, peerId, name, status: value.data.proposal?.status === "rejected" ? "rejected" : "open", contentCid, baseCid, timestamp };
  }
  function markProposalRejected(store, value, proposalCid) {
    const record = readProposal(store, proposalCid);
    if (!record || record.status === "rejected") return value;
    const rejectedCid = put(store, proposalContent(store, record.peerId, record.name, record.contentCid, record.baseCid, record.timestamp, "rejected"));
    return withProposal(store, value, record.peerId, rejectedCid, record.name);
  }
  function readProposals(store, value) {
    const out = [];
    for (const edge of value.children) {
      if (!isProposalEdge(store, edge)) continue;
      const record = readProposal(store, edge[1]);
      if (record) out.push(record);
    }
    return out;
  }
  function withProposal(store, value, peerId, proposalCid, name) {
    const matches = (cid) => {
      const p = readProposal(store, cid);
      return !!p && p.peerId === peerId && (name === void 0 || p.name === name);
    };
    const children = value.children.filter((e) => !(isProposalEdge(store, e) && matches(e[1])));
    if (proposalCid) children.push([store.primitive.proposalField.getId(), proposalCid]);
    return { ...value, children };
  }
  function removeProposalByCid(store, value, proposalCid) {
    return { ...value, children: value.children.filter((e) => !(isProposalEdge(store, e) && e[1] === proposalCid)) };
  }
  function relinkContent(store, previous, previousCid, strippedContent, now) {
    const bookkeeping = previous.children.filter((e) => isBookkeepingEdge(store, e) && !isPrevEdge(store, e));
    const data = { alias: previous.data.alias ?? strippedContent.data.alias ?? { id: newId() }, updated: { time: now } };
    if (previous.data.ref) data.ref = previous.data.ref;
    const next = refNodeContent(store, data, put(store, strippedContent), bookkeeping, refTypeCid(store, previous));
    return withPrev(store, next, previousCid);
  }
  function normalizeRefs(store, nodeCid, now = 0) {
    const identity = content(store, nodeCid);
    if (isHandle(identity)) return nodeCid;
    const ref = isRefNode(store, identity);
    const value = ref ? valueContent(store, nodeCid) : identity;
    let changed = false;
    const children = value.children.map((edge) => {
      if (!isRowEdge(store, edge) || isPartitionEdge(store, edge)) return edge;
      const childCid = identityCid(store, edge);
      const next = normalizeRefs(store, childCid, now);
      if (next === childCid) return edge;
      changed = true;
      return withIdentity(store, edge, next);
    });
    let nextValue = changed ? { ...value, children } : value;
    if (isLegacyInlineLink(store, identity)) {
      const stripped = stripLink(store, nextValue);
      return put(store, refNodeContent(store, { alias: identity.data.alias ?? { id: newId() }, updated: { time: identity.data.updated?.time ?? now } }, put(store, stripped), bookkeepingOf(store, identity)));
    }
    if (!changed) return nodeCid;
    if (ref) return put(store, relinkContent(store, identity, nodeCid, nextValue, identity.data.updated?.time ?? now));
    return put(store, nextValue);
  }
  function findAliasEdge(store, value, aliasId) {
    const key = `a:${aliasId}`;
    const index = value.children.findIndex((e) => edgeKey(store, e) === key);
    return index >= 0 ? { edge: value.children[index], index } : null;
  }
  function findChild(store, nodeCid, aliasId) {
    const found = findAliasEdge(store, valueContent(store, nodeCid), aliasId);
    if (!found) return null;
    const { edge } = found;
    if (isChoiceEdge(store, edge)) return null;
    return identityCid(store, edge);
  }
  function findRowByAlias(store, rootCid, aliasId, prefix = []) {
    for (const edge of valueContent(store, rootCid).children) {
      const kind = rowKindOf(store, edge);
      if (!kind) continue;
      const cid = identityCid(store, edge);
      const id = aliasIdOf(content(store, cid));
      if (!id) continue;
      if (id === aliasId) return { path: prefix, row: rowView(store, cid, kind) };
      const found = findRowByAlias(store, cid, aliasId, [...prefix, id]);
      if (found) return found;
    }
    return null;
  }
  function copyRowContent(store, nodeCid, now, freshId) {
    const value = stripLink(store, content(store, nodeCid));
    const children = [];
    for (const edge of value.children) {
      const kind = rowKindOf(store, edge);
      if (!kind) continue;
      const copied = copyRowContent(store, identityCid(store, edge), now, freshId);
      children.push(isPartitionEdge(store, edge) ? rowEdge(store, "plain", copied) : withIdentity(store, edge, copied));
    }
    return put(store, { ...value, data: { ...value.data, alias: { id: freshId() }, updated: { time: now } }, children });
  }
  function moveChild(store, rootCid, fromPath, aliasId, toPath, position) {
    if (toPath.includes(aliasId)) return null;
    const fromCid = resolveScope(store, rootCid, fromPath);
    if (!fromCid) return null;
    const found = findAliasEdge(store, content(store, fromCid), aliasId);
    if (!found) return null;
    const moving = found.edge;
    let root = updateAtScope(store, rootCid, fromPath, (value) => ({ ...value, children: value.children.filter((e) => e !== moving) }));
    const insert = (value) => {
      const children = [...value.children];
      if ("into" in position) {
        const parent = findAliasEdge(store, value, position.into);
        if (!parent) throw new Error("destination not found");
        const target = identityCid(store, parent.edge);
        const targetContent = valueContent(store, target);
        const kids = [...targetContent.children];
        const at = position.index === void 0 || position.index < 0 ? kids.length : Math.min(position.index, kids.length);
        kids.splice(at, 0, moving);
        children[parent.index] = withChildValue(store, parent.edge, { ...targetContent, children: kids }, targetContent.data.updated?.time ?? 0);
        return { ...value, children };
      }
      const sibling = findAliasEdge(store, value, position.relativeTo);
      if (!sibling) throw new Error("destination not found");
      children.splice(position.position === "above" ? sibling.index : sibling.index + 1, 0, moving);
      return { ...value, children };
    };
    root = updateAtScope(store, root, toPath, insert);
    return root;
  }
  function proposalView(store, nodeValue, proposal) {
    const current = store.getNodeByAddress(proposal.baseCid) ? content(store, proposal.baseCid) : stripLink(store, nodeValue);
    const proposed = content(store, proposal.contentCid);
    const index = (value) => {
      const map = /* @__PURE__ */ new Map();
      for (const edge of value.children) {
        if (!isRowEdge(store, edge)) continue;
        const id = identityCid(store, edge);
        map.set(edgeKey(store, edge), { title: content(store, id).data.description?.content ?? "", cid: id });
      }
      return map;
    };
    const a = index(current);
    const b = index(proposed);
    const summary = { added: [], changed: [], removed: [] };
    for (const [key, entry] of b) {
      const before = a.get(key);
      if (!before) summary.added.push(entry.title);
      else if (before.cid !== entry.cid) summary.changed.push(entry.title);
    }
    for (const [key, entry] of a) if (!b.has(key)) summary.removed.push(entry.title);
    return { id: proposal.cid, peerId: proposal.peerId, name: proposal.name, status: proposal.status, timestamp: proposal.timestamp, summary };
  }

  // ../shared/sync/merge.ts
  init_prelude();
  var EMPTY = { data: {}, children: [] };
  function mergeNodes(store, baseCid, oursCid, theirsCid, labels) {
    const newChoiceCids = [];
    const outcome = mergeNode(store, baseCid, oursCid, theirsCid, labels, newChoiceCids, true);
    if (outcome.kind !== "node") throw new Error("unreachable: top-level merge cannot conflict");
    return { cid: outcome.cid, newChoiceCids };
  }
  function mergeNode(store, baseCid, oursCid, theirsCid, labels, newChoiceCids, isTop) {
    if (oursCid === theirsCid) return { kind: "node", cid: oursCid };
    if (baseCid === oursCid) return { kind: "node", cid: theirsCid };
    if (baseCid === theirsCid) return { kind: "node", cid: oursCid };
    const base = baseCid ? content(store, baseCid) : EMPTY;
    const ours = content(store, oursCid);
    const theirs = content(store, theirsCid);
    const asRef = (value) => isRefNode(store, value) && !isHandle(value) || isLegacyInlineLink(store, value);
    if (asRef(ours) || asRef(theirs)) {
      const refOf = (cid, value) => {
        if (!cid) return null;
        if (isRefNode(store, value) && !isHandle(value)) return { cid, node: value };
        const node = makeLink(store, value, 0);
        return { cid: put(store, node), node };
      };
      const o = refOf(oursCid, ours);
      const t = refOf(theirsCid, theirs);
      const b = baseCid ? refOf(baseCid, base) : null;
      const valueOf = (r) => r ? refValueCid(store, r.node) : null;
      const oursValue = valueOf(o) ?? put(store, stripLink(store, ours));
      const theirsValue = valueOf(t) ?? put(store, stripLink(store, theirs));
      const merged = mergeNode(store, valueOf(b), oursValue, theirsValue, labels, newChoiceCids, true);
      const mergedValue = merged.kind === "node" ? merged.cid : oursValue;
      const book = (r) => ({ data: {}, children: r ? bookkeepingOf(store, r.node).filter((e) => !isPrevEdge(store, e)) : [] });
      const bookkeeping = mergeChildren(store, book(b), book(o), book(t), labels, newChoiceCids);
      const valueChanged = mergedValue !== oursValue || mergedValue !== theirsValue;
      const prevEdge = (cid) => [store.primitive.previousVersion.getId(), cid];
      const existingPrev = (r) => r ? r.node.children.filter((e) => isPrevEdge(store, e)) : [];
      const prev = valueChanged ? o.cid === t.cid ? [prevEdge(o.cid)] : [prevEdge(o.cid), prevEdge(t.cid)] : [...existingPrev(o), ...existingPrev(t).filter((e) => !existingPrev(o).some((x) => x[1] === e[1]))];
      const data2 = mergeData(b?.node.data ?? {}, o.node.data, t.node.data, true) ?? o.node.data;
      return { kind: "node", cid: put(store, refNodeContent(store, data2, mergedValue, [...bookkeeping, ...prev], refTypeCid(store, o.node) ?? refTypeCid(store, t.node))) };
    }
    const isContainer = ours.children.length > 0 || theirs.children.length > 0 || base.children.length > 0;
    const data = mergeData(base.data, ours.data, theirs.data, isContainer || isTop);
    if (!data) return { kind: "conflict" };
    const children = mergeChildren(store, base, ours, theirs, labels, newChoiceCids);
    return { kind: "node", cid: put(store, { data, children }) };
  }
  function mergeData(base, ours, theirs, theirsWins) {
    const out = {};
    const keys = /* @__PURE__ */ new Set([...Object.keys(base), ...Object.keys(ours), ...Object.keys(theirs)]);
    const b = base;
    const o = ours;
    const t = theirs;
    for (const key of keys) {
      if (key === "versionControl") continue;
      if (key === "updated") {
        const time = Math.max(timeOf(o[key]), timeOf(t[key]), timeOf(b[key]));
        if (time > 0) out[key] = { time };
        continue;
      }
      const bv = b[key], ov = o[key], tv = t[key];
      if (same(ov, tv)) {
        if (ov !== void 0) out[key] = ov;
        continue;
      }
      if (same(bv, ov)) {
        if (tv !== void 0) out[key] = tv;
        continue;
      }
      if (same(bv, tv)) {
        if (ov !== void 0) out[key] = ov;
        continue;
      }
      if (!theirsWins) return null;
      if (tv !== void 0) out[key] = tv;
    }
    return out;
  }
  function timeOf(value) {
    return value && typeof value === "object" && typeof value.time === "number" ? value.time : 0;
  }
  function same(a, b) {
    if (a === b) return true;
    if (a === void 0 || b === void 0) return false;
    return JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));
  }
  function sortKeys(value) {
    if (Array.isArray(value)) return value.map(sortKeys);
    if (value && typeof value === "object") {
      const src = value;
      const out = {};
      for (const k of Object.keys(src).sort()) out[k] = sortKeys(src[k]);
      return out;
    }
    return value;
  }
  function mergeChildren(store, base, ours, theirs, labels, newChoiceCids) {
    const index = (value) => {
      const map = /* @__PURE__ */ new Map();
      for (const edge of value.children) map.set(edgeKey(store, edge), edge);
      return map;
    };
    const bMap = index(base);
    const oMap = index(ours);
    const tMap = index(theirs);
    const keys = orderedKeys([...oMap.keys()], [...tMap.keys()], [...bMap.keys()]);
    const out = [];
    for (const key of keys) {
      const b = bMap.get(key) ?? null;
      const o = oMap.get(key) ?? null;
      const t = tMap.get(key) ?? null;
      if (sameEdge(o, t)) {
        if (o) out.push(o);
        continue;
      }
      if (sameEdge(b, o)) {
        if (t) out.push(t);
        continue;
      }
      if (sameEdge(b, t)) {
        if (o) out.push(o);
        continue;
      }
      if (key.startsWith("p:") && o && t) {
        const ot = readProposal(store, o[1])?.timestamp ?? 0;
        const tt = readProposal(store, t[1])?.timestamp ?? 0;
        out.push(tt > ot ? t : o);
        continue;
      }
      if (o && t && sameShape(store, o, t) && !isChoiceEdge(store, o)) {
        const baseIdentity = b && sameShape(store, b, o) && !isChoiceEdge(store, b) ? identityCid(store, b) : null;
        const merged = mergeNode(store, baseIdentity, identityCid(store, o), identityCid(store, t), labels, newChoiceCids, false);
        if (merged.kind === "node") {
          out.push(withIdentity(store, o, merged.cid));
          continue;
        }
      }
      const id = key.startsWith("a:") ? key.slice(2) : key;
      const options = [
        { peerId: labels.ours, edge: o },
        { peerId: labels.theirs, edge: t }
      ];
      const choiceCid = putChoice(store, id, b && !isChoiceEdge(store, b) ? b : null, options);
      newChoiceCids.push(choiceCid);
      out.push([store.primitive.choiceTarget.getId(), choiceCid]);
    }
    return out;
  }
  function orderedKeys(ours, theirs, base) {
    const out = [...ours];
    const present = new Set(out);
    theirs.forEach((key, i2) => {
      if (present.has(key)) return;
      let at = -1;
      for (let j = i2 - 1; j >= 0 && at < 0; j--) {
        const idx = out.indexOf(theirs[j]);
        if (idx >= 0) at = idx + 1;
      }
      for (let j = i2 + 1; j < theirs.length && at < 0; j++) {
        const idx = out.indexOf(theirs[j]);
        if (idx >= 0) at = idx;
      }
      if (at < 0) at = out.length;
      out.splice(at, 0, key);
      present.add(key);
    });
    for (const key of base) if (!present.has(key)) {
      out.push(key);
      present.add(key);
    }
    return out;
  }
  function sameEdge(a, b) {
    if (!a || !b) return a === b;
    return a[0] === b[0] && a[1] === b[1];
  }
  function resolveChoiceIn(store, value, choiceId, pick, now) {
    const key = `a:${choiceId}`;
    const edge = value.children.find((e) => edgeKey(store, e) === key);
    if (!edge || !isChoiceEdge(store, edge)) return value;
    const children = [];
    for (const existing of value.children) {
      if (existing !== edge) {
        children.push(existing);
        continue;
      }
      if (pick === null) continue;
      const choice = content(store, edge[1]);
      const alternatives = choice.children.filter(([i2]) => i2 === store.primitive.optionNotSelectedConstructor.getId());
      const alt = alternatives[pick];
      if (!alt) throw new Error(`choice ${choiceId} has no option ${pick}`);
      const pointer = content(store, alt[1]);
      let instr = null;
      let target = null;
      for (const [i2, t] of pointer.children) {
        if (i2 === store.primitive.instructionPointerConstructor.getId()) instr = t;
        if (i2 === store.primitive.targetPointerConstructor.getId()) target = t;
      }
      if (!instr || !target) continue;
      const picked = [instr, target];
      const idCid = identityCid(store, picked);
      const touched = put(store, { ...content(store, idCid), data: { ...content(store, idCid).data, updated: { time: now } } });
      children.push(withIdentity(store, picked, touched));
    }
    return { ...value, children };
  }

  // ../shared/sync/protocol.ts
  init_prelude();
  function parseSyncRequest(body) {
    if (!body || typeof body !== "object") return { error: "request body must be an object", code: "bad-request" };
    const raw = body;
    if (raw.version !== SYNC_FORMAT_VERSION) return { error: `unsupported sync version ${String(raw.version)}`, code: "bad-request" };
    if (typeof raw.cidVersion !== "number") return { error: "cidVersion required", code: "bad-request" };
    if (typeof raw.peerId !== "string" || !raw.peerId || raw.peerId.length > 128) return { error: "peerId must be a non-empty string", code: "bad-request" };
    if (!Array.isArray(raw.scope) || raw.scope.length > 32 || !raw.scope.every((s) => typeof s === "string" && s.length > 0 && s.length <= 128)) {
      return { error: "scope must be an array of ids", code: "bad-request" };
    }
    if (typeof raw.headCid !== "string" || !raw.headCid) return { error: "headCid required", code: "bad-request" };
    if (raw.baseCid !== null && raw.baseCid !== void 0 && typeof raw.baseCid !== "string") return { error: "baseCid must be a cid or null", code: "bad-request" };
    if (raw.nodes !== void 0 && (typeof raw.nodes !== "object" || raw.nodes === null)) return { error: "nodes must be an object", code: "bad-request" };
    return {
      version: SYNC_FORMAT_VERSION,
      cidVersion: raw.cidVersion,
      peerId: raw.peerId,
      scope: [...raw.scope],
      baseCid: raw.baseCid ?? null,
      headCid: raw.headCid,
      nodes: raw.nodes ?? {},
      ...typeof raw.branch === "string" && raw.branch.length > 0 && raw.branch.length <= 200 ? { branch: raw.branch } : {}
    };
  }
  function serveSync(store, request, serverPeerId, now = Date.now(), options = {}) {
    if (request.cidVersion !== CURRENT_CID_VERSION) {
      return { error: `peer uses cid format v${request.cidVersion}, this side uses v${CURRENT_CID_VERSION}`, code: "version-mismatch" };
    }
    importNodes(store, request.nodes);
    if (!hasNode(store, request.headCid)) {
      const sent = request.nodes[request.headCid];
      const missing = sent ? sent.children.flat().filter((cid) => !store.table.has(cid)) : [];
      const detail = !sent ? "the head node itself was not sent" : missing.length ? `head references unknown nodes: ${missing.map((c) => c.slice(0, 16)).join(", ")}` : "the head node did not verify";
      return { error: `head node not provided (${detail})`, code: "missing-nodes" };
    }
    const rootTarget = rootTargetCid(store);
    const currentCid = resolveScope(store, rootTarget, request.scope);
    if (!currentCid) return { error: "scope not found", code: "scope-not-found" };
    if (options.proposeOnly && isLink(store, content(store, currentCid))) {
      return serveProposal(store, request, serverPeerId, now, options, rootTarget, currentCid);
    }
    const headCid2 = request.headCid;
    const baseCid = hasNode(store, request.baseCid) ? request.baseCid : null;
    const emptyCid = baseCid ?? put(store, { data: {}, children: [] });
    let action;
    let mergedCid;
    let newChoiceCids = [];
    if (currentCid === headCid2) {
      action = "noop";
      mergedCid = currentCid;
    } else if (currentCid === emptyCid) {
      action = "fast-forward";
      mergedCid = headCid2;
    } else if (headCid2 === emptyCid) {
      action = "pull";
      mergedCid = currentCid;
    } else {
      action = "merge";
      const merged = mergeNodes(store, baseCid, currentCid, headCid2, { ours: serverPeerId, theirs: request.peerId });
      mergedCid = merged.cid;
      newChoiceCids = merged.newChoiceCids;
    }
    const withPeerContent = withPeer(store, content(store, mergedCid), request.peerId);
    const resultCid = withPeerContent === content(store, mergedCid) ? mergedCid : put(store, withPeerContent);
    const changed = resultCid !== currentCid;
    if (changed) {
      const newRootTarget = updateAtScope(store, rootTarget, request.scope, () => content(store, resultCid), "node");
      commitRoot(store, newRootTarget, now);
    }
    const known = /* @__PURE__ */ new Set([...Object.keys(request.nodes), ...reachableSet(store, [headCid2, baseCid])]);
    return {
      changed,
      response: {
        version: SYNC_FORMAT_VERSION,
        cidVersion: CURRENT_CID_VERSION,
        peerId: serverPeerId,
        scope: request.scope,
        action,
        resultCid,
        nodes: reachableNodes(store, [resultCid], known),
        newChoiceIds: newChoiceCids.map((cid) => content(store, cid).data.alias?.id ?? cid),
        serverTime: now,
        presence: options.onlinePeers,
        capabilities: options.capabilities
      }
    };
  }
  function serveProposal(store, request, serverPeerId, now, options, rootTarget, linkCid) {
    const linkValue = content(store, linkCid);
    const mainStripped = putStripped(store, linkValue);
    const headStripped = putStripped(store, content(store, request.headCid));
    const branchName = request.branch ?? options.peerName ?? request.peerId;
    const existing = readProposals(store, linkValue).find((p) => p.peerId === request.peerId && p.name === branchName) ?? null;
    const baseStripped = hasNode(store, request.baseCid) ? putStripped(store, content(store, request.baseCid)) : null;
    let action = "noop";
    let branchCid = headStripped;
    let newChoiceCids = [];
    let proposalCid = existing?.cid ?? null;
    const branchBase = existing?.baseCid ?? baseStripped;
    if (headStripped === mainStripped) {
      proposalCid = null;
      action = existing ? "pull" : "noop";
    } else if (branchBase === mainStripped) {
      action = "propose";
    } else {
      action = "propose";
      const merged = mergeNodes(store, branchBase, headStripped, mainStripped, { ours: request.peerId, theirs: serverPeerId });
      branchCid = merged.cid;
      newChoiceCids = merged.newChoiceCids;
    }
    if (action === "propose" && branchCid === mainStripped) {
      proposalCid = null;
      action = "pull";
    } else if (action === "propose") {
      const unchanged = existing && existing.contentCid === branchCid && existing.baseCid === mainStripped;
      const peerEdited = !existing || headStripped !== existing.contentCid;
      const status = existing?.status === "rejected" && !peerEdited ? "rejected" : "open";
      proposalCid = unchanged ? existing.cid : put(store, proposalContent(store, request.peerId, branchName, branchCid, mainStripped, existing && !peerEdited ? existing.timestamp : now, status));
      if (unchanged) action = "noop";
    }
    const nextLink = withProposal(store, linkValue, request.peerId, proposalCid, branchName);
    const withPeerContent = withPeer(store, nextLink, request.peerId);
    const nextLinkCid = put(store, withPeerContent);
    let changed = nextLinkCid !== linkCid;
    if (changed) {
      const newRootTarget = updateAtScope(store, rootTarget, request.scope, () => content(store, nextLinkCid), "node");
      commitRoot(store, newRootTarget, now);
    }
    const persisted = content(store, nextLinkCid);
    const bookkeeping = bookkeepingOf(store, persisted);
    const resultContent = refNodeContent(store, { ...persisted.data, alias: persisted.data.alias ?? content(store, branchCid).data.alias ?? { id: request.scope[request.scope.length - 1] ?? "" } }, branchCid, bookkeeping, refTypeCid(store, persisted));
    const resultExisted = store.table.has(store.hash(resultContent));
    const resultCid = put(store, resultContent);
    if (!resultExisted) changed = true;
    if (action === "noop" && resultCid !== request.headCid) action = "pull";
    const known = /* @__PURE__ */ new Set([...Object.keys(request.nodes), ...reachableSet(store, [request.headCid, request.baseCid])]);
    return {
      changed,
      response: {
        version: SYNC_FORMAT_VERSION,
        cidVersion: CURRENT_CID_VERSION,
        peerId: serverPeerId,
        scope: request.scope,
        action,
        resultCid,
        nodes: reachableNodes(store, [resultCid], known),
        newChoiceIds: newChoiceCids.map((cid) => content(store, cid).data.alias?.id ?? cid),
        serverTime: now,
        presence: options.onlinePeers,
        capabilities: options.capabilities
      }
    };
  }
  function applySyncResponse(store, request, response, localPeerId, now) {
    if (response.cidVersion !== CURRENT_CID_VERSION) {
      throw new Error(`server uses cid format v${response.cidVersion}, this client uses v${CURRENT_CID_VERSION}`);
    }
    importNodes(store, response.nodes);
    if (!hasNode(store, response.resultCid)) throw new Error("sync response did not include the result node");
    const current = rootTargetCid(store);
    if (current === request.headCid) {
      commitRoot(store, response.resultCid, now);
      return { reMerged: false, newChoiceIds: [...response.newChoiceIds] };
    }
    const merged = mergeNodes(store, request.headCid, current, response.resultCid, { ours: localPeerId, theirs: response.peerId });
    commitRoot(store, merged.cid, now);
    const localChoiceIds = merged.newChoiceCids.map((cid) => content(store, cid).data.alias?.id ?? cid);
    return { reMerged: true, newChoiceIds: [...response.newChoiceIds, ...localChoiceIds] };
  }

  // ../shared/sync/replica.ts
  init_prelude();

  // ../shared/dag-implementation/store.ts
  init_prelude();

  // ../shared/utils.ts
  init_prelude();

  // ../shared/dag-implementation/expression.ts
  init_prelude();

  // ../shared/dag-implementation/context.ts
  init_prelude();
  var runAvailableFunctions = async (expr) => {
    if (expr.isUpdate()) {
      const { parent } = expr.getParentInfo();
      if (parent.isAlias()) {
      }
    }
    if (expr.isTodo()) {
    }
    return false;
  };

  // ../shared/dag-implementation/expression.ts
  var FosExpression = class _FosExpression {
    constructor(store, instructionOrRoute, target, parent) {
      __publicField(this, "store");
      /** Direct reference to instruction node */
      __publicField(this, "instructionNode");
      /** Direct reference to target node */
      __publicField(this, "targetNode");
      /**
       * Parent expression - direct reference for navigation.
       * null only for root expression.
       */
      __publicField(this, "_parent");
      /**
       * Cached route - computed lazily from parent chain.
       * Invalidated when parent relationships change.
       */
      __publicField(this, "_cachedRoute", null);
      this.store = store;
      if (Array.isArray(instructionOrRoute)) {
        const route = instructionOrRoute;
        this._cachedRoute = route;
        this._parent = null;
        if (route.length === 0) {
          this.instructionNode = this.store.primitive.voidNode;
          this.targetNode = this.store.getRootNode();
        } else {
          const pathElem = route[route.length - 1];
          if (!pathElem) {
            throw new Error("Path element not found");
          }
          const [instructionId, targetId] = pathElem;
          const instructionNode = this.store.getNodeByAddress(instructionId);
          if (!instructionNode) {
            throw new Error(`Instruction node not found for ${instructionId}`);
          }
          const targetNode = this.store.getNodeByAddress(targetId);
          if (!targetNode) {
            throw new Error(`Target node not found for ${targetId}`);
          }
          this.instructionNode = instructionNode;
          this.targetNode = targetNode;
        }
      } else {
        this.instructionNode = instructionOrRoute;
        this.targetNode = target;
        this._parent = parent ?? null;
      }
    }
    /**
     * Get the route (CID-based path).
     * Computed lazily from parent chain if not cached.
     */
    get route() {
      if (this._cachedRoute !== null) {
        return this._cachedRoute;
      }
      if (!this._parent) {
        this._cachedRoute = [];
        return this._cachedRoute;
      }
      this._cachedRoute = [
        ...this._parent.route,
        [this.instructionNode.getId(), this.targetNode.getId()]
      ];
      return this._cachedRoute;
    }
    /**
     * Invalidate the cached route (call when parent chain changes).
     */
    invalidateRoute() {
      this._cachedRoute = null;
    }
    /**
     * Get the parent expression (direct reference, no lookup needed).
     */
    getParentDirect() {
      return this._parent;
    }
    /**
     * Set the parent expression (used during tree restructuring).
     */
    setParent(parent) {
      this._parent = parent;
      this.invalidateRoute();
    }
    async runFunctions(context) {
      const result = await runAvailableFunctions(this);
      if (!result) {
        throw new Error("No function matched context and expression");
      }
    }
    // Core Property Getters
    expressionType() {
      return this.instructionNode.getId();
    }
    expressionId() {
      return this.targetNode.getId();
    }
    expressionLabel() {
      return `${this.expressionType}-${this.expressionId}`;
    }
    dragLabel() {
      return this.expressionLabel();
    }
    isUpdate() {
      const leftIsUpdate = this.instructionNode.getId() === this.store.primitive.updateAction.getId();
      return leftIsUpdate;
    }
    // instructionContent(): any {
    //   return this.instructionNode.getContent()
    // }
    // nodeData(): FosDataContent {
    //   return this.nodeContent().data
    // }
    // nodeChildren(): FosPathElem[] {
    //   return this.nodeContent().children
    // }
    // nodeContent(): FosNodeContent {
    //   return this.instructionNode.getContent()
    // }
    // nodeChild(index: number): FosPathElem {
    //   const child = this.nodeChildren()[index]
    //   if (!child) {
    //     throw new Error(`Child at index ${index} not found`)
    //   }
    //   return child
    // }
    getSelectedChild() {
      throw new Error("Method not implemented");
    }
    childRoutes() {
      return this.targetNode.getEdges().map((childEdge) => [...this.route, childEdge]);
    }
    hasChildren() {
      return this.targetNode.getEdges().length > 0;
    }
    childrenVisible() {
      return !this.isCollapsed() && !this.isTooDeep();
    }
    depth() {
      return this.route.length;
    }
    focusChar() {
      return this.store.trellisData.focusChar;
    }
    pathElem() {
      return [this.instructionNode.getId(), this.targetNode.getId()];
    }
    // State Getters
    currentMode() {
      return this.store.trellisData.mode;
    }
    currentView() {
      return this.store.trellisData.view;
    }
    currentActivity() {
      return this.store.trellisData.activity;
    }
    currentGroup() {
      return getGroupFromRoute(this.route, this.store);
    }
    equals(other) {
      const instructionsEqual = this.instructionNode.getId() === other.instructionNode.getId();
      const targetsEqual = this.targetNode.getId() === other.targetNode.getId();
      const pathsEqual = pathEqual(this.route, other.route);
      const allEqual = instructionsEqual && targetsEqual && pathsEqual;
      return allEqual;
    }
    // State Check Methods
    isLocked() {
      return false;
    }
    isDisabled() {
      return false;
    }
    isEditing() {
      return false;
    }
    isDiffing() {
      return false;
    }
    isCollapsed() {
      const found = this.store.trellisData.collapsedList.find((collapsedRoute) => {
        return pathEqual(collapsedRoute, this.route);
      });
      return !!found;
    }
    isDragging() {
      return pathEqual(this.store.trellisData.dragInfo.dragging?.nodeRoute || [], this.route);
    }
    isDraggingOver() {
      return pathEqual(this.store.trellisData.dragInfo.dragOverInfo?.nodeRoute || [], this.route);
    }
    hasFocus() {
      return pathEqual(this.store.trellisData.focusRoute, this.route);
    }
    isTooDeep() {
      return this.depth() > this.store.trellisData.rowDepth;
    }
    isTodo() {
      return this.matchesPattern(this.store.primitive.unit, this.store.primitive.completeField);
    }
    // Type Check Methods
    isRoot() {
      const lastElem = this.route[this.route.length - 1];
      const isRootInstruction = this.instructionNode.getId() === this.store.primitive.rootInstructionNode.getId();
      if (!lastElem || isRootInstruction) {
        return true;
      }
    }
    hasParent() {
      return this.route.length > 0;
    }
    isAlias() {
      const targetHasTargetEdge = this.targetNode.getEdges().some((edge) => {
        return edge[0] === this.store.primitive.targetPointerConstructor.getId();
      });
      const targetHasAliasInstruction = this.targetNode.getEdges().some((edge) => {
        return edge[0] === this.store.primitive.instructionPointerConstructor.getId();
      });
      return targetHasTargetEdge;
    }
    followAlias() {
      if (!this.isAlias()) {
        console.log("Follow Alias Error", this.instructionNode.getId(), this.store.primitive.aliasConstructor.getId());
        throw new Error("Expression is not an alias");
      }
      const {
        instruction: aliasInstruction,
        target: aliasTarget
      } = this.targetNode.dereferenceNodes();
      return new _FosExpression(this.store, aliasInstruction, aliasTarget, this);
    }
    isReference() {
      const isAlias = this.isAlias();
      return isAlias;
    }
    isWorkflow() {
      return this.store.primitive.workflowField.getId() === this.instructionNode.getId();
    }
    isOption() {
      return this.store.primitive.optionConstructor.getId() === this.targetNode.getId();
    }
    isChoice() {
      return this.store.primitive.choiceTarget.getId() === this.targetNode.getId();
    }
    isDocument() {
      return this.store.primitive.documentField.getId() === this.instructionNode.getId();
    }
    isComment() {
      return this.expressionType() === this.store.primitive.commentConstructor.getId();
    }
    isGroup() {
      return this.expressionType() === this.store.primitive.groupField.getId();
    }
    isMarketRequest() {
      return this.expressionType() === this.store.primitive.marketRequestNode.getId();
    }
    isMarketService() {
      return this.expressionType() === this.store.primitive.marketServiceNode.getId();
    }
    isSearch() {
      return this.expressionType() === this.store.primitive.searchQueryNode.getId();
    }
    isSearchResults() {
      return this.expressionType() === this.store.primitive.searchResultsNode.getId();
    }
    isLastNameField() {
      return this.expressionType() === this.store.primitive.lastNameField.getId();
    }
    isFirstNameField() {
      return this.expressionType() === this.store.primitive.firstNameField.getId();
    }
    isEmailField() {
      return this.expressionType() === this.store.primitive.emailField.getId();
    }
    isConflict() {
      return this.expressionType() === this.store.primitive.conflictNode.getId();
    }
    isError() {
      return this.expressionType() === this.store.primitive.errorNode.getId();
    }
    isContact() {
      return this.expressionType() === this.store.primitive.contactField.getId();
    }
    isBase() {
      return pathEqual(this.route, this.store.fosRoute);
    }
    // Navigation Methods
    /**
     * Get the parent expression.
     * Uses direct parent pointer if available (preferred), otherwise falls back to route-based lookup.
     */
    getParent() {
      if (this._parent) {
        return this._parent;
      }
      if (this.hasParent()) {
        return new _FosExpression(this.store, this.route.slice(0, -1));
      } else {
        throw new Error("Cannot get parent of root node");
      }
    }
    /**
     * Get child expressions with proper parent pointers.
     * Uses resolved object references - no CID lookups needed.
     */
    getTargetChildren(index = null) {
      const children = this.targetNode.getEdgesResolved().map(([instrNode, targetNode]) => {
        return new _FosExpression(this.store, instrNode, targetNode, this);
      });
      if (index === null) {
        return children;
      }
      const indexedChild = children.slice(index, index + 1)[0];
      if (!indexedChild) {
        throw new Error("Child not found");
      }
      return [indexedChild];
    }
    /**
     * Get child at specific index with parent pointer.
     * Uses resolved object references - no CID lookups needed.
     */
    getChild(index) {
      const edges = this.targetNode.getEdgesResolved();
      const edge = edges[index];
      if (!edge) return null;
      const [instrNode, targetNode] = edge;
      return new _FosExpression(this.store, instrNode, targetNode, this);
    }
    /**
     * Get the index of this expression in its parent's children.
     * Uses object identity comparison instead of CID comparison.
     */
    getIndex() {
      if (!this._parent) return 0;
      const siblings = this._parent.targetNode.getEdgesResolved();
      return siblings.findIndex(
        ([instrNode, targetNode]) => instrNode === this.instructionNode && targetNode === this.targetNode
      );
    }
    /**
     * Get the depth of this expression in the tree.
     */
    getDepth() {
      let depth = 0;
      let current = this._parent;
      while (current) {
        depth++;
        current = current._parent;
      }
      return depth;
    }
    /**
     * Navigate from the root to a destination using only instruction CIDs.
     * This is used after updates when target CIDs have changed but instruction CIDs remain the same.
     * @param instructionPath Array of instruction CIDs to follow from root
     * @returns The expression at the destination path
     */
    static navigateByInstructions(store, instructionPath) {
      let currentExpr = store.getRootExpression();
      let pathToFollow = [...instructionPath];
      console.log("[navigateByInstructions] Starting navigation");
      console.log("[navigateByInstructions] Root isAlias:", currentExpr.isAlias());
      console.log("[navigateByInstructions] Root targetNode edges:", currentExpr.targetNode.getEdges().length);
      if (currentExpr.isAlias()) {
        const beforeFollow = currentExpr;
        currentExpr = currentExpr.followAlias();
        console.log("[navigateByInstructions] After followAlias:");
        console.log("[navigateByInstructions]   instruction:", currentExpr.instructionNode.getId());
        console.log("[navigateByInstructions]   targetNode edges:", currentExpr.targetNode.getEdges().length);
        console.log("[navigateByInstructions]   pathToFollow[0]:", pathToFollow[0]);
        if (pathToFollow.length > 0 && currentExpr.instructionNode.getId() === pathToFollow[0]) {
          pathToFollow = pathToFollow.slice(1);
          console.log("[navigateByInstructions] Skipped first instruction, new pathToFollow length:", pathToFollow.length);
        }
      }
      for (const instrId of pathToFollow) {
        const actualExpr = currentExpr.isAlias() ? currentExpr.followAlias() : currentExpr;
        const children = actualExpr.getTargetChildren();
        const nextExpr = children.find((c) => c.instructionNode.getId() === instrId);
        if (!nextExpr) {
          console.error("[navigateByInstructions] Navigation failed at instruction:", instrId);
          console.error("[navigateByInstructions] Available children:", children.map((c) => c.instructionNode.getId()));
          console.error("[navigateByInstructions] Current expr instruction:", currentExpr.instructionNode.getId());
          console.error("[navigateByInstructions] Current expr targetNode edges:", currentExpr.targetNode.getEdges());
          console.error("[navigateByInstructions] Full instruction path:", instructionPath);
          console.error("[navigateByInstructions] Path to follow:", pathToFollow);
          throw new Error(`Could not navigate to instruction ${instrId}`);
        }
        currentExpr = nextExpr;
      }
      return currentExpr;
    }
    /**
     * Extract the instruction path (instruction CIDs only) from a route.
     */
    static getInstructionPath(route) {
      return route.map(([instr, _]) => instr);
    }
    getInstructionChildren(index = null) {
      const children = this.instructionNode.getEdgesResolved().map(([instrNode, targetNode]) => {
        return new _FosExpression(this.store, instrNode, targetNode, this);
      });
      if (index === null) {
        return children;
      }
      const indexedChild = children.slice(index, index + 1)[0];
      if (!indexedChild) {
        throw new Error("Child not found");
      }
      return [indexedChild];
    }
    // Content Methods
    getDescription() {
      return this.targetNode.getContent().data.description?.content || "";
    }
    truncatedDescription() {
      const description = this.getDescription();
      return description.length > 20 ? description.slice(0, 17) + "..." : description;
    }
    // Pattern Matching Methods
    matchesPattern(instructionPattern, targetPattern) {
      const instructionNodesMatch = this.store.matchPattern(instructionPattern, this.instructionNode);
      const hasInstructionMatch = instructionNodesMatch.length > 0;
      const targetNodesMatch = this.store.matchPattern(targetPattern, this.targetNode);
      const hasTargetMatch = targetNodesMatch.length > 0;
      return hasInstructionMatch && hasTargetMatch;
    }
    getTargetChildrenMatchingPattern(typeNode, targetNode) {
      return this.getTargetChildren().filter((child) => {
        const instructionNodesMatch = this.store.matchPattern(typeNode, child.instructionNode);
        const hasInstructionMatch = instructionNodesMatch.length > 0;
        const targetNodesMatch = this.store.matchPattern(targetNode, child.targetNode);
        const hasTargetMatch = targetNodesMatch.length > 0;
        return hasInstructionMatch && hasTargetMatch;
      });
    }
    getTargetChildrenForActivity(activity) {
      if (activity === "comments") {
        return this.getTargetChildrenMatchingPattern(this.store.primitive.commentConstructor, this.store.primitive.unit);
      }
      if (activity === "todo") {
        return this.getTargetChildrenMatchingPattern(this.store.primitive.unit, this.store.primitive.completeField);
      }
      return [];
    }
    getAllDescendentsMatchingPattern(typeNode, targetNode) {
      const routeMap = mutableReduceToRouteMapFromExpression(this, (acc, expression) => {
        const instructionNodesMatch = this.store.matchPattern(typeNode, expression.instructionNode);
        const hasInstructionMatch = instructionNodesMatch.length > 0;
        const targetNodesMatch = this.store.matchPattern(targetNode, expression.targetNode);
        const hasTargetMatch = targetNodesMatch.length > 0;
        if (hasInstructionMatch && hasTargetMatch) {
          acc.set(expression.route, expression);
        }
        console.log("allDescendentsMatchingPattern - instruction", hasInstructionMatch, expression.instructionNode, typeNode, expression.instructionNode.getData().description?.content || expression.instructionNode.getId(), expression.route);
        console.log("allDescendentsMatchingPattern - target", hasTargetMatch, expression.targetNode, targetNode, expression.targetNode.getData().description?.content || expression.targetNode.getId(), expression.route);
        console.log("allDescendentsMatchingPattern - info", expression.route, this);
        return acc;
      });
      return [...routeMap.keys()];
    }
    getAllDescendentsForActivity(activity) {
      console.log("getAllDescendentsForActivity", activity);
      if (activity === "comments") {
        const existingRoutes = this.getAllDescendentsMatchingPattern(this.store.primitive.commentConstructor, this.store.primitive.unit);
        const routeKeys = new Set(existingRoutes.map((route) => JSON.stringify(route)));
        const globalCommentRoutes = [...this.store.table.entries()].filter(([cid, node]) => node.data.comment?.scope === "global").map(([cid]) => {
          const route = [[this.store.primitive.commentConstructor.getId(), cid]];
          return route;
        }).filter((route) => {
          const key = JSON.stringify(route);
          if (routeKeys.has(key)) {
            return false;
          }
          routeKeys.add(key);
          return true;
        });
        return [...existingRoutes, ...globalCommentRoutes];
      }
      if (activity === "todo") {
        return this.getAllDescendentsMatchingPattern(this.store.primitive.unit, this.store.primitive.completeField);
      }
      if (activity === "document") {
        return this.getAllDescendentsMatchingPattern(this.store.primitive.documentField, this.store.primitive.unit);
      }
      if (activity === "all") {
        const routeMap = mutableReduceToRouteMapFromExpression(this, (acc, expression) => {
          acc.set(expression.route, expression);
          return acc;
        });
        return [...routeMap.keys()];
      }
      return [];
    }
    // Option Related Methods
    getOptions() {
      if (this.isOption()) {
        return this.getTargetChildren().map((child, index) => ({
          value: index.toString(),
          label: child.getDescription()
        }));
      } else {
        throw new Error("getOptions must be used on an option expression");
      }
    }
    getOptionInfo() {
      if (!this.isOption()) {
        throw new Error("getOptionInfo must be used on an option expression");
      }
      const selectedIndex = this.targetNode.getData().option?.selectedIndex || 0;
      const nodeOptions = this.getOptions();
      const nodeChildren = this.getTargetChildren();
      if (nodeChildren.length < 2) {
        throw new Error("Should not have less than 2 options");
      }
      if (!nodeChildren[selectedIndex]) {
        throw new Error("selectedChild not found");
      }
      const selectedChildRoute = this.getTargetChildren(selectedIndex)[0]?.route;
      if (!selectedChildRoute) {
        throw new Error("selectedChildRoute not found");
      }
      const isOptionChildCollapsed = this.store.trellisData.collapsedList.some(
        (route) => pathEqual(route, selectedChildRoute)
      );
      const resolutionStrategy = this.targetNode.getData().option?.defaultResolutionStrategy || "selected";
      const selectedOption = nodeOptions[selectedIndex];
      const selectedChild = new _FosExpression(this.store, selectedChildRoute);
      if (!selectedOption) {
        throw new Error("selectedOption not found");
      }
      return {
        selectedIndex,
        selectedChildRoute,
        nodeOptions,
        selectedOption,
        selectedChild,
        isOptionChildCollapsed,
        resolutionStrategy
      };
    }
    // Parent Info Methods
    getParentInfo() {
      if (!this.hasParent()) {
        throw new Error("Cannot get parent of root node");
      }
      let thisParent = this.getParent();
      if (thisParent.instructionNode.getId() === this.store.primitive.targetPointerConstructor.getId()) {
        const {
          instruction: aliasInstruction,
          target: aliasTarget
        } = thisParent.targetNode.dereferenceNodes();
        thisParent = new _FosExpression(this.store, [...thisParent.route.slice(-1), [aliasInstruction.getId(), aliasTarget.getId()]]);
      }
      let oneWasFound = false;
      const targetIndexInParent = thisParent.getTargetChildren().findIndex((childExpr) => {
        if (thisParent.isAlias()) {
          const {
            instruction: aliasInstruction,
            target: aliasTarget
          } = thisParent.targetNode.dereferenceNodes();
          if (childExpr.instructionNode.getId() === this.store.primitive.instructionPointerConstructor.getId()) {
            const isMatch = aliasInstruction.getId() === childExpr.targetNode.getId();
            if (!isMatch) {
              throw new Error("Alias parent does not contain alias instruction");
            }
            return isMatch && (oneWasFound = true);
          }
          if (childExpr.instructionNode.getId() === this.store.primitive.targetPointerConstructor.getId()) {
            const isMatch = aliasTarget.getId() === childExpr.targetNode.getId();
            if (!isMatch) {
              throw new Error("Alias parent does not contain target node");
            }
            return isMatch && (oneWasFound = true);
          }
        }
        return this.equals(childExpr);
      });
      const instructionIndexInParent = thisParent.getInstructionChildren().findIndex(
        (childExpr) => this.equals(childExpr)
      );
      if (targetIndexInParent === -1 && instructionIndexInParent === -1) {
        throw new Error("Parent does not contain this child");
      }
      if (targetIndexInParent !== -1 && instructionIndexInParent !== -1) {
        throw new Error("Edge duplicated in instruction and target");
      }
      return {
        parent: thisParent,
        targetIndexInParent,
        instructionIndexInParent,
        siblingRoutes: thisParent.childRoutes
      };
    }
    isOptionChildCollapsed() {
      const { selectedChildRoute } = this.getOptionInfo();
      return this.store.trellisData.collapsedList.some(
        (route) => pathEqual(route, selectedChildRoute)
      );
    }
    // UI Related Methods
    getDragItem(breadcrumb = false) {
      return {
        id: this.expressionLabel(),
        data: { nodeRoute: this.route, breadcrumb },
        breadcrumb
      };
    }
    getDragInfo() {
      return this.store.trellisData.dragInfo;
    }
    setDragInfo(dragInfo) {
      this.store.trellisData.dragInfo = dragInfo;
    }
    getShortLabel() {
      const uuidPre = "";
      const tCidPre = this.targetNode.getId().slice(0, 8);
      const iCidPre = this.instructionNode.getId().slice(0, 8);
      return `<${uuidPre}(${tCidPre}-${iCidPre})>`;
    }
    commit() {
      throw new Error("Method not implemented");
    }
    async update(instructionNode, targetNode) {
      console.log("[update] START", {
        routeLength: this.route.length,
        oldInstrId: this.instructionNode.getId().substring(0, 12),
        oldTargetId: this.targetNode.getId().substring(0, 12),
        newInstrId: instructionNode.getId().substring(0, 12),
        newTargetId: targetNode.getId().substring(0, 12)
      });
      const updateArgNode = this.store.create({
        data: {},
        children: [
          [this.store.primitive.prevInstructionPointerConstructor.getId(), this.instructionNode.getId()],
          [this.store.primitive.prevTargetPointerConstructor.getId(), this.targetNode.getId()],
          [this.store.primitive.instructionPointerConstructor.getId(), instructionNode.getId()],
          [this.store.primitive.targetPointerConstructor.getId(), targetNode.getId()]
        ]
      });
      const updateElem = [this.store.primitive.updateAction.getId(), updateArgNode.getId()];
      console.log("[update] Creating newExpr with updateElem", updateElem[0].substring(0, 12));
      const newExpr = new _FosExpression(this.store, [...this.route, updateElem]);
      console.log("[update] newExpr created", {
        newExprInstrId: newExpr.instructionNode.getId().substring(0, 12),
        newExprTargetId: newExpr.targetNode.getId().substring(0, 12)
      });
      const prevInstruction = this.instructionNode;
      const prevTarget = this.targetNode;
      this.instructionNode = newExpr.instructionNode;
      this.targetNode = newExpr.targetNode;
      this.invalidateRoute();
      console.log("[update] After assignment", {
        thisInstrId: this.instructionNode.getId().substring(0, 12),
        thisTargetId: this.targetNode.getId().substring(0, 12)
      });
      newExpr.runUpdateRaw(prevInstruction, prevTarget);
      console.log("[update] END - runUpdateRaw completed");
    }
    runUpdateRaw(prevInstruction, prevTarget) {
      const parent = this.getParent();
      if (this.isRoot()) {
        console.log("runUpdateRaw - root case", this.route, this.instructionNode.getId(), this.targetNode.getId());
        this.store.rootNodeId = this.targetNode.getId();
        this.store.updateCtxCallback?.(this.store.exportContext([]));
      } else {
        if (this.isAlias()) {
          console.log("runUpdateRaw - base case alias", this.route, this.instructionNode.getId(), this.targetNode.getId());
          const {
            target,
            instruction
          } = this.targetNode.dereferenceNodes();
          const structuralIds = new Set([
            this.store.primitive.targetPointerConstructor.getId(),
            this.store.primitive.instructionPointerConstructor.getId(),
            this.store.primitive.previousVersion.getId(),
            this.store.primitive.prevTargetPointerConstructor?.getId(),
            this.store.primitive.prevInstructionPointerConstructor?.getId()
          ].filter(Boolean));
          const preservedEdges = this.targetNode.getEdges().filter(
            ([instrId]) => !structuralIds.has(instrId)
          );
          console.log("runUpdateRaw - preserving", preservedEdges.length, "non-structural edges");
          const newAliasInfo = this.store.create({
            data: this.targetNode.getContent().data,
            // Preserve data
            children: [
              [this.store.primitive.targetPointerConstructor.getId(), target.getId()],
              [this.store.primitive.instructionPointerConstructor.getId(), instruction.getId()],
              [this.store.primitive.previousVersion.getId(), this.targetNode.getId()],
              // Previous version
              ...preservedEdges
              // Preserve proposals, etc.
            ]
          });
          const newParentTarget = parent.targetNode.updateEdge(
            prevInstruction.getId(),
            prevTarget.getId(),
            instruction.getId(),
            newAliasInfo.getId()
          );
          this.propagateTargetChange(parent, newParentTarget);
        } else {
          const newParentTarget = parent.targetNode.updateEdge(
            prevInstruction.getId(),
            prevTarget.getId(),
            this.instructionNode.getId(),
            this.targetNode.getId()
          );
          parent.setTargetNode(newParentTarget);
        }
      }
    }
    /**
     * Propagate a target node change up the tree to the root without creating update actions.
     * This is used during runUpdateRaw to avoid infinite recursion when handling aliases.
     */
    propagateTargetChange(expr, newTarget) {
      console.log("[propagateTargetChange] expr.route.length:", expr.route.length, "newTarget edges:", newTarget.getEdges().length);
      if (expr.route.length <= 1) {
        console.log("[propagateTargetChange] Setting rootNodeId directly with", newTarget.getEdges().length, "edges");
        this.store.rootNodeId = newTarget.getId();
        this.store.updateCtxCallback?.(this.store.exportContext([]));
      } else {
        const parent = expr.getParent();
        const newParentTarget = parent.targetNode.updateEdge(
          expr.instructionNode.getId(),
          expr.targetNode.getId(),
          expr.instructionNode.getId(),
          newTarget.getId()
        );
        this.propagateTargetChange(parent, newParentTarget);
      }
    }
    // Content Modification Methods
    updateTargetContent(newContent) {
      const thisEdge = this.route[this.route.length - 1];
      const newTarget = this.store.create(newContent);
      if (!thisEdge) {
        throw new Error("Cannot update root node");
      }
      return this.setTargetNode(newTarget);
    }
    setTargetNode(targetNode) {
      return this.update(this.instructionNode, targetNode);
    }
    setInstructionNode(instructionNode) {
      return this.update(instructionNode, this.targetNode);
    }
    getAction() {
    }
    async addBranch(content2) {
      const branchArgNode = this.store.create({
        data: {},
        children: [
          [this.store.primitive.prevInstructionPointerConstructor.getId(), this.store.primitive.voidNode.getId()],
          [this.store.primitive.prevTargetPointerConstructor.getId(), this.store.primitive.voidNode.getId()],
          [this.store.primitive.instructionPointerConstructor.getId(), this.instructionNode.getId()],
          [this.store.primitive.targetPointerConstructor.getId(), this.targetNode.getId()]
        ]
      });
      const updateElem = [this.store.primitive.brachConstructorNode.getId(), branchArgNode.getId()];
      const newExpr = new _FosExpression(this.store, [...this.route, updateElem]);
      return newExpr;
    }
    async setDescription(description) {
      console.log("[setDescription] START", {
        description: description.substring(0, 50),
        route: this.route,
        targetNodeId: this.targetNode.getId().substring(0, 12),
        instrNodeId: this.instructionNode.getId().substring(0, 12)
      });
      const newTarget = this.targetNode.updateData({
        description: {
          content: description
        }
      });
      console.log("[setDescription] newTarget created", {
        newTargetId: newTarget.getId().substring(0, 12),
        oldTargetId: this.targetNode.getId().substring(0, 12)
      });
      const newExpr = this.update(this.instructionNode, newTarget);
      console.log("[setDescription] END");
    }
    setFocusAndDescription(description, focusChar) {
      this.setDescription(description);
      this.updateFocus(focusChar);
    }
    async setSelectedOption(selectedOption) {
      const newTargetNode = this.targetNode.updateData({
        option: {
          defaultResolutionStrategy: "selected",
          selectedIndex: selectedOption
        }
      });
      await this.update(this.instructionNode, newTargetNode);
    }
    addOption(nodeContent, index) {
      throw new Error("Method not implemented");
    }
    deleteOption() {
      throw new Error("Method not implemented");
    }
    // Not Implemented Methods - These would need implementation based on requirements
    getGroupInfo() {
      throw new Error("Method not implemented");
    }
    getTodoInfo() {
      throw new Error("Method not implemented");
    }
    getAllowedChildren() {
      throw new Error("Method not implemented");
    }
    getPreviousVersions() {
      throw new Error("Method not implemented");
    }
    getGroupProposedVersions() {
      throw new Error("Method not implemented");
    }
    getBranchVersions() {
      throw new Error("Method not implemented");
    }
    getBranches() {
      throw new Error("Method not implemented");
    }
    getCommentInfo() {
      throw new Error("Method not implemented");
    }
    async addChoice(content2) {
      const newAlternative = this.store.create({
        data: {
          description: {
            content: content2
          }
        },
        children: []
      });
      const optionTarget = this.store.primitive.optionNotSelectedConstructor;
      const newTarget = this.targetNode.addEdge(newAlternative.getId(), optionTarget.getId());
      await this.update(this.instructionNode, newTarget);
      return new _FosExpression(this.store, newAlternative, optionTarget, this);
    }
    async addWorkflow(content2) {
      const workflowConstructor = this.store.primitive.workflowField;
      const workflowTargetNode = this.store.create({
        data: {
          description: {
            content: content2
          }
        },
        children: []
      });
      const newTarget = this.targetNode.addEdge(workflowConstructor.getId(), workflowTargetNode.getId());
      await this.update(this.instructionNode, newTarget);
      return new _FosExpression(this.store, workflowConstructor, workflowTargetNode, this);
    }
    async addDocument(content2) {
      const documentConstructor = this.store.primitive.documentField;
      const documentTargetNode = this.store.create({
        data: {
          description: {
            content: content2
          }
        },
        children: [
          [this.store.primitive.targetPointerConstructor.getId(), this.targetNode.getId()]
        ]
      });
      const newTarget = this.targetNode.addEdge(documentConstructor.getId(), documentTargetNode.getId());
      await this.update(this.instructionNode, newTarget);
      return new _FosExpression(this.store, documentConstructor, documentTargetNode, this);
    }
    async addMarketRequest(content2) {
      throw new Error("Method not implemented");
    }
    async addMarketService(content2) {
      throw new Error("Method not implemented");
    }
    registerMarketService(service) {
      if (!this.isWorkflow()) {
        throw new Error("Method only implemented for workflow expressions");
      }
      const rootExpr = this.store.getRootExpression();
      const marketServiceNode = this.store.create({
        data: {
          description: {
            content: service
          }
        },
        children: [
          [this.store.primitive.targetPointerConstructor.getId(), this.targetNode.getId()]
        ]
      });
      const newRootTarget = rootExpr.targetNode.addEdge(this.store.primitive.marketServiceNode.getId(), marketServiceNode.getId());
      rootExpr.update(rootExpr.instructionNode, newRootTarget);
      const newExpr = new _FosExpression(this.store, [[this.store.primitive.marketServiceNode.getId(), marketServiceNode.getId()]]);
      return newExpr;
    }
    registerMarketRequest(request) {
      if (!this.isTodo()) {
        throw new Error("Method only implemented for todo expressions");
      }
      const rootExpr = this.store.getRootExpression();
      const marketRequestNode = this.store.create({
        data: {
          description: {
            content: request
          }
        },
        children: [
          [this.store.primitive.targetPointerConstructor.getId(), this.instructionNode.getId()]
        ]
      });
      const newRootTarget = rootExpr.targetNode.addEdge(this.store.primitive.marketRequestNode.getId(), marketRequestNode.getId());
      rootExpr.update(rootExpr.instructionNode, newRootTarget);
      const newExpr = new _FosExpression(this.store, [[this.store.primitive.marketRequestNode.getId(), marketRequestNode.getId()]]);
      return newExpr;
    }
    applyPattern(instruction, target) {
      throw new Error("Method not implemented");
    }
    /**
     * Query this expression's children as a Datalog-style scope
     * Returns all children matching the given instruction/target pattern
     *
     * @param instructionPattern Pattern for instruction node (use primitive.unit for wildcard)
     * @param targetPattern Pattern for target node (use primitive.unit for wildcard)
     * @returns Array of matching child expressions with bindings
     */
    queryPattern(instructionPattern, targetPattern) {
      return this.getTargetChildren().filter((child) => {
        const instrMatches = instructionPattern.getId() === this.store.primitive.unit.getId() || this.store.matchPattern(instructionPattern, child.instructionNode).length > 0;
        const targetMatches = targetPattern.getId() === this.store.primitive.unit.getId() || this.store.matchPattern(targetPattern, child.targetNode).length > 0;
        return instrMatches && targetMatches;
      });
    }
    /**
     * Query this scope for facts matching a predicate pattern
     * Facts are children with the FACT primitive as instruction
     *
     * @param predicatePattern The pattern to match against fact predicates
     * @returns Array of matching fact expressions
     */
    queryFacts(predicatePattern) {
      const factPrimitive = this.store.primitive.factNode;
      if (!predicatePattern) {
        return this.getTargetChildren().filter(
          (child) => child.instructionNode.getId() === factPrimitive.getId()
        );
      }
      return this.getTargetChildren().filter((child) => {
        if (child.instructionNode.getId() !== factPrimitive.getId()) {
          return false;
        }
        return this.store.matchPattern(predicatePattern, child.targetNode).length > 0;
      });
    }
    /**
     * Get all rules in this scope
     * Rules are children with the RULE primitive as instruction
     */
    getRulesInScope() {
      const rulePrimitive = this.store.primitive.ruleNode;
      return this.getTargetChildren().filter(
        (child) => child.instructionNode.getId() === rulePrimitive.getId()
      );
    }
    /**
     * Synthesize expressions that would satisfy a given type/pattern
     *
     * This is type-directed synthesis: given a type (pattern),
     * generate all expressions from this scope that would satisfy it.
     *
     * @param typePattern The type/pattern to synthesize for
     * @returns Array of expressions that satisfy the type
     */
    synthesize(typePattern) {
      const results = [];
      const directMatches = this.getTargetChildren().filter(
        (child) => this.store.matchPattern(typePattern, child.targetNode).length > 0
      );
      results.push(...directMatches);
      const factMatches = this.queryFacts(typePattern);
      for (const fact of factMatches) {
        if (!results.some((r) => r.targetNode.getId() === fact.targetNode.getId())) {
          results.push(fact);
        }
      }
      const rules = this.getRulesInScope();
      for (const rule of rules) {
        const ruleHead = this.getRuleHead(rule);
        if (ruleHead && this.store.matchPattern(typePattern, ruleHead).length > 0) {
        }
      }
      return results;
    }
    /**
     * Get the head (derived pattern) of a rule expression
     */
    getRuleHead(ruleExpr) {
      const ruleHeadPrimitive = this.store.primitive.ruleHeadNode;
      const headChild = ruleExpr.getTargetChildren().find(
        (child) => child.instructionNode.getId() === ruleHeadPrimitive.getId()
      );
      return headChild?.targetNode ?? null;
    }
    /**
     * Get the body (conditions) of a rule expression
     */
    getRuleBody(ruleExpr) {
      const ruleBodyPrimitive = this.store.primitive.ruleBodyNode;
      return ruleExpr.getTargetChildren().filter((child) => child.instructionNode.getId() === ruleBodyPrimitive.getId()).map((child) => child.targetNode);
    }
    /**
     * Assert a fact into this scope (add as child with FACT instruction)
     *
     * @param factNode The fact to assert
     * @returns The new fact expression
     */
    async assertFact(factNode) {
      const factPrimitive = this.store.primitive.factNode;
      const existing = this.queryFacts(factNode);
      if (existing.length > 0) {
        return existing[0];
      }
      const newTarget = this.targetNode.addEdge(factPrimitive.getId(), factNode.getId());
      await this.update(this.instructionNode, newTarget);
      return new _FosExpression(this.store, factPrimitive, factNode, this);
    }
    /**
     * Retract a fact from this scope (remove child matching the fact)
     *
     * @param factPattern The fact pattern to retract
     */
    async retractFact(factPattern) {
      const matches = this.queryFacts(factPattern);
      for (const match of matches) {
        const { targetIndexInParent } = match.getParentInfo();
        if (targetIndexInParent !== -1) {
          const newTarget = this.targetNode.removeEdgeByIndex(targetIndexInParent);
          await this.update(this.instructionNode, newTarget);
        }
      }
    }
    /**
     * Add a derivation rule to this scope
     *
     * @param head The pattern this rule derives
     * @param body The conditions that must match
     * @returns The new rule expression
     */
    async addRule(head, body) {
      const rulePrimitive = this.store.primitive.ruleNode;
      const ruleHeadPrimitive = this.store.primitive.ruleHeadNode;
      const ruleBodyPrimitive = this.store.primitive.ruleBodyNode;
      const ruleChildren = [
        [ruleHeadPrimitive.getId(), head.getId()],
        ...body.map((b) => [ruleBodyPrimitive.getId(), b.getId()])
      ];
      const ruleNode = this.store.create({
        data: { description: { content: "Derivation rule" } },
        children: ruleChildren
      });
      const newTarget = this.targetNode.addEdge(rulePrimitive.getId(), ruleNode.getId());
      await this.update(this.instructionNode, newTarget);
      return new _FosExpression(this.store, rulePrimitive, ruleNode, this);
    }
    /**
     * Apply all rules to derive new facts (forward chaining)
     * Continues until no new facts are derived (fixpoint)
     */
    async saturate() {
      let changed = true;
      while (changed) {
        changed = false;
        const rules = this.getRulesInScope();
        for (const rule of rules) {
          const head = this.getRuleHead(rule);
          const body = this.getRuleBody(rule);
          if (!head) continue;
          const bodySatisfied = body.every(
            (condition) => this.queryFacts(condition).length > 0
          );
          if (bodySatisfied) {
            const existingHead = this.queryFacts(head);
            if (existingHead.length === 0) {
              await this.assertFact(head);
              changed = true;
            }
          }
        }
      }
    }
    /**
     * Complete a task and execute its effects
     * Default effect: assert completed(task)
     * Additional effects from TASK_EFFECT children
     */
    async completeTaskWithEffects() {
      const taskEffectPrimitive = this.store.primitive.taskEffectNode;
      const assertPrimitive = this.store.primitive.assertNode;
      const retractPrimitive = this.store.primitive.retractNode;
      const completedPrimitive = this.store.primitive.completedNode;
      const effects = this.getTargetChildren().filter(
        (child) => child.instructionNode.getId() === taskEffectPrimitive.getId()
      );
      for (const effect of effects) {
        const effectChildren = effect.getTargetChildren();
        for (const ec of effectChildren) {
          if (ec.instructionNode.getId() === assertPrimitive.getId()) {
            await this.getParent().assertFact(ec.targetNode);
          } else if (ec.instructionNode.getId() === retractPrimitive.getId()) {
            await this.getParent().retractFact(ec.targetNode);
          }
        }
      }
      const completedFact = this.store.create({
        data: { completed: { taskId: this.targetNode.getId(), time: Date.now() } },
        children: [[completedPrimitive.getId(), this.targetNode.getId()]]
      });
      if (this.hasParent()) {
        await this.getParent().assertFact(completedFact);
      }
      this.completeTask();
    }
    /**
     * Create a variable node for pattern matching
     */
    createVariable(name) {
      const variablePrimitive = this.store.primitive.variableNode;
      return this.store.create({
        data: { variable: { name } },
        children: [[variablePrimitive.getId(), this.store.primitive.terminal.getId()]]
      }, `VAR_${name}`);
    }
    /**
     * Create a fact node from a predicate name and arguments
     */
    createFact(predicate, args) {
      const factPrimitive = this.store.primitive.factNode;
      const children = args.map(
        (arg) => [factPrimitive.getId(), arg.getId()]
      );
      return this.store.create({
        data: { predicate, description: { content: predicate } },
        children
      }, `FACT_${predicate}`);
    }
    // === Version Control Methods ===
    /**
     * Get the version history of this expression by following PREV pointers
     * Returns an array of commits from newest to oldest
     */
    getHistory() {
      const history = [];
      const prevPrimitive = this.store.primitive.previousVersion;
      let current = this;
      while (current) {
        history.push(current);
        const prevChild = current.getTargetChildren().find(
          (child) => child.instructionNode.getId() === prevPrimitive.getId()
        );
        if (prevChild && prevChild.targetNode.getId() !== this.store.primitive.terminal.getId()) {
          current = new _FosExpression(this.store, [...current.route, [prevPrimitive.getId(), prevChild.targetNode.getId()]]);
        } else {
          current = null;
        }
      }
      return history;
    }
    /**
     * Create a commit (versioned snapshot) of this expression
     *
     * @param message Commit message
     * @param branchName Optional branch name (defaults to "main")
     * @returns The new expression with commit metadata
     */
    async createCommit(message, branchName = "main") {
      const commitPrimitive = this.store.primitive.commitNode;
      const prevPrimitive = this.store.primitive.previousVersion;
      const branchNamePrimitive = this.store.primitive.branchNameNode;
      const branchNode = this.store.create({
        data: { branch: { name: branchName } },
        children: []
      }, `BRANCH_${branchName}`);
      const commitData = {
        ...this.targetNode.getData(),
        commit: {
          message,
          timestamp: Date.now(),
          branch: branchName
        }
      };
      const newTarget = this.store.create({
        data: commitData,
        children: [
          [prevPrimitive.getId(), this.targetNode.getId()],
          [branchNamePrimitive.getId(), branchNode.getId()],
          ...this.targetNode.getEdges().filter(
            ([instr]) => instr !== prevPrimitive.getId() && instr !== branchNamePrimitive.getId()
          )
        ]
      });
      await this.update(this.instructionNode, newTarget);
      return this.isAlias() ? this.followAlias() : this;
    }
    /**
     * Get all branches in this scope's history
     */
    getBranchNames() {
      const branches = /* @__PURE__ */ new Set();
      const branchNamePrimitive = this.store.primitive.branchNameNode;
      const history = this.getHistory();
      for (const expr of history) {
        const branchChild = expr.getTargetChildren().find(
          (child) => child.instructionNode.getId() === branchNamePrimitive.getId()
        );
        if (branchChild) {
          const branchData = branchChild.targetNode.getData().branch;
          if (branchData?.name) {
            branches.add(branchData.name);
          }
        }
      }
      if (branches.size === 0) {
        branches.add("main");
      }
      return Array.from(branches);
    }
    /**
     * Get the current branch name
     */
    getCurrentBranch() {
      const branchNamePrimitive = this.store.primitive.branchNameNode;
      const branchChild = this.getTargetChildren().find(
        (child) => child.instructionNode.getId() === branchNamePrimitive.getId()
      );
      if (branchChild) {
        const branchData = branchChild.targetNode.getData().branch;
        return branchData?.name ?? "main";
      }
      return "main";
    }
    /**
     * Create a new branch from this expression
     *
     * @param branchName Name for the new branch
     * @returns Expression on the new branch
     */
    async createNewBranch(branchName) {
      return this.createCommit(`Branch: ${branchName}`, branchName);
    }
    /**
     * Find the common ancestor between this expression and another
     *
     * @param other The other expression to find common ancestor with
     * @returns The common ancestor expression, or null if none found
     */
    findCommonAncestor(other) {
      const thisHistory = this.getHistory();
      const otherHistory = other.getHistory();
      const thisIds = new Set(thisHistory.map((e) => e.targetNode.getId()));
      for (const expr of otherHistory) {
        if (thisIds.has(expr.targetNode.getId())) {
          return expr;
        }
      }
      return null;
    }
    /**
     * Merge another expression into this one
     *
     * @param other The expression to merge in
     * @param message Optional merge commit message
     * @returns MergeResult with merged expression or conflicts
     */
    async merge(other, message) {
      const mergeSourcePrimitive = this.store.primitive.mergeSourceNode;
      const conflictPrimitive = this.store.primitive.conflictNode;
      const conflictOursPrimitive = this.store.primitive.conflictOursNode;
      const conflictTheirsPrimitive = this.store.primitive.conflictTheirsNode;
      const conflictBasePrimitive = this.store.primitive.conflictBaseNode;
      const ancestor = this.findCommonAncestor(other);
      const ourChildren = this.getTargetChildren();
      const theirChildren = other.getTargetChildren();
      const ancestorChildren = ancestor?.getTargetChildren() ?? [];
      const ourMap = new Map(ourChildren.map((c) => [c.instructionNode.getId(), c]));
      const theirMap = new Map(theirChildren.map((c) => [c.instructionNode.getId(), c]));
      const ancestorMap = new Map(ancestorChildren.map((c) => [c.instructionNode.getId(), c]));
      const conflicts = [];
      const mergedChildren = [];
      const allInstrIds = /* @__PURE__ */ new Set([...ourMap.keys(), ...theirMap.keys()]);
      for (const instrId of allInstrIds) {
        const ours = ourMap.get(instrId);
        const theirs = theirMap.get(instrId);
        const base = ancestorMap.get(instrId);
        if (ours && theirs) {
          if (ours.targetNode.getId() === theirs.targetNode.getId()) {
            mergedChildren.push([instrId, ours.targetNode.getId()]);
          } else if (base && ours.targetNode.getId() === base.targetNode.getId()) {
            mergedChildren.push([instrId, theirs.targetNode.getId()]);
          } else if (base && theirs.targetNode.getId() === base.targetNode.getId()) {
            mergedChildren.push([instrId, ours.targetNode.getId()]);
          } else {
            const conflictNode = this.store.create({
              data: { conflict: { path: instrId } },
              children: [
                [conflictOursPrimitive.getId(), ours.targetNode.getId()],
                [conflictTheirsPrimitive.getId(), theirs.targetNode.getId()],
                ...base ? [[conflictBasePrimitive.getId(), base.targetNode.getId()]] : []
              ]
            });
            conflicts.push({
              path: instrId,
              ours: ours.targetNode,
              theirs: theirs.targetNode,
              base: base?.targetNode ?? null,
              conflictNode
            });
            mergedChildren.push([conflictPrimitive.getId(), conflictNode.getId()]);
          }
        } else if (ours) {
          if (base) {
            mergedChildren.push([instrId, ours.targetNode.getId()]);
          } else {
            mergedChildren.push([instrId, ours.targetNode.getId()]);
          }
        } else if (theirs) {
          if (base) {
            mergedChildren.push([instrId, theirs.targetNode.getId()]);
          } else {
            mergedChildren.push([instrId, theirs.targetNode.getId()]);
          }
        }
      }
      const mergedData = {
        ...this.targetNode.getData(),
        merge: {
          message: message ?? `Merge ${other.getCurrentBranch()} into ${this.getCurrentBranch()}`,
          timestamp: Date.now(),
          hasConflicts: conflicts.length > 0
        }
      };
      const mergedTarget = this.store.create({
        data: mergedData,
        children: [
          [mergeSourcePrimitive.getId(), other.targetNode.getId()],
          ...mergedChildren
        ]
      });
      if (conflicts.length === 0) {
        await this.update(this.instructionNode, mergedTarget);
        return {
          success: true,
          merged: this.isAlias() ? this.followAlias() : this,
          conflicts: []
        };
      }
      return {
        success: false,
        merged: null,
        conflicts
      };
    }
    /**
     * Get any unresolved conflicts in this expression
     */
    getConflicts() {
      const conflictPrimitive = this.store.primitive.conflictNode;
      return this.getTargetChildren().filter(
        (child) => child.instructionNode.getId() === conflictPrimitive.getId()
      );
    }
    /**
     * Check if this expression has unresolved conflicts
     */
    hasConflicts() {
      return this.getConflicts().length > 0;
    }
    /**
     * Resolve a conflict by choosing a resolution
     *
     * @param conflictExpr The conflict expression to resolve
     * @param resolution Which version to use: 'ours', 'theirs', or a custom node
     */
    async resolveConflict(conflictExpr, resolution) {
      const conflictPrimitive = this.store.primitive.conflictNode;
      const conflictOursPrimitive = this.store.primitive.conflictOursNode;
      const conflictTheirsPrimitive = this.store.primitive.conflictTheirsNode;
      const conflictData = conflictExpr.targetNode.getData().conflict;
      if (!conflictData?.path) {
        throw new Error("Invalid conflict expression");
      }
      let resolvedNode;
      if (resolution === "ours") {
        const oursChild = conflictExpr.getTargetChildren().find(
          (c) => c.instructionNode.getId() === conflictOursPrimitive.getId()
        );
        if (!oursChild) throw new Error("Ours not found in conflict");
        resolvedNode = oursChild.targetNode;
      } else if (resolution === "theirs") {
        const theirsChild = conflictExpr.getTargetChildren().find(
          (c) => c.instructionNode.getId() === conflictTheirsPrimitive.getId()
        );
        if (!theirsChild) throw new Error("Theirs not found in conflict");
        resolvedNode = theirsChild.targetNode;
      } else {
        resolvedNode = resolution;
      }
      const newChildren = this.targetNode.getEdges().map(([instr, target]) => {
        if (instr === conflictPrimitive.getId() && target === conflictExpr.targetNode.getId()) {
          return [conflictData.path, resolvedNode.getId()];
        }
        return [instr, target];
      });
      const newTarget = this.store.create({
        data: this.targetNode.getData(),
        children: newChildren
      });
      await this.update(this.instructionNode, newTarget);
    }
    /**
     * Resolve all conflicts automatically using a strategy
     *
     * @param strategy The resolution strategy: 'ours', 'theirs'
     */
    async resolveAllConflicts(strategy) {
      const conflicts = this.getConflicts();
      for (const conflict of conflicts) {
        await this.resolveConflict(conflict, strategy);
      }
    }
    /**
     * Create a tag (named reference) to this version
     */
    async createTag(tagName) {
      const tagPrimitive = this.store.primitive.tagNode;
      const tagNode = this.store.create({
        data: { tag: { name: tagName, timestamp: Date.now() } },
        children: []
      }, `TAG_${tagName}`);
      const newTarget = this.targetNode.addEdge(tagPrimitive.getId(), tagNode.getId());
      await this.update(this.instructionNode, newTarget);
      return this.isAlias() ? this.followAlias() : this;
    }
    /**
     * Get all tags on this expression
     */
    getTags() {
      const tagPrimitive = this.store.primitive.tagNode;
      return this.getTargetChildren().filter((c) => c.instructionNode.getId() === tagPrimitive.getId()).map((c) => c.targetNode.getData().tag?.name).filter((name) => !!name);
    }
    // === Budget Methods (Linear Resources) ===
    /**
     * Create a budget as a child of this expression
     *
     * @param total Total amount available
     * @param currency Currency code (e.g., "USD")
     * @param name Optional budget name
     * @returns The new budget expression
     */
    async createBudget(total, currency = "USD", name) {
      const budgetPrimitive = this.store.primitive.budgetNode;
      const budgetTargetNode = this.store.create({
        data: {
          budget: {
            total,
            consumed: 0,
            currency,
            name
          },
          description: { content: name || `Budget: ${total} ${currency}` }
        },
        children: []
      });
      const newTarget = this.targetNode.addEdge(budgetPrimitive.getId(), budgetTargetNode.getId());
      await this.update(this.instructionNode, newTarget);
      return new _FosExpression(this.store, budgetPrimitive, budgetTargetNode, this);
    }
    /**
     * Check if this expression is a budget
     */
    isBudget() {
      return this.instructionNode.getId() === this.store.primitive.budgetNode.getId();
    }
    /**
     * Get budget data if this is a budget expression
     */
    getBudgetInfo() {
      const budgetData = this.targetNode.getData().budget;
      if (!budgetData) return null;
      return {
        total: budgetData.total,
        consumed: budgetData.consumed,
        available: budgetData.total - budgetData.consumed,
        currency: budgetData.currency,
        name: budgetData.name
      };
    }
    /**
     * Create a sub-allocation from this budget
     *
     * @param amount Amount to allocate
     * @param name Optional allocation name
     * @returns The new allocation expression
     */
    async allocateBudget(amount, name) {
      if (!this.isBudget()) {
        throw new Error("Can only allocate from a budget expression");
      }
      const budgetData = this.targetNode.getData().budget;
      if (!budgetData) {
        throw new Error("Invalid budget data");
      }
      const available = budgetData.total - budgetData.consumed;
      if (amount > available) {
        throw new Error(`Cannot allocate ${amount} from budget with ${available} available`);
      }
      const allocationPrimitive = this.store.primitive.allocationNode;
      const allocationNode = this.store.create({
        data: {
          budget: {
            total: amount,
            consumed: 0,
            currency: budgetData.currency,
            name,
            parentBudgetId: this.targetNode.getId()
          },
          description: { content: name || `Allocation: ${amount} ${budgetData.currency}` }
        },
        children: []
      });
      const updatedBudgetNode = this.store.create({
        data: {
          ...this.targetNode.getData(),
          budget: {
            ...budgetData,
            consumed: budgetData.consumed + amount
          }
        },
        children: [
          ...this.targetNode.getEdges(),
          [allocationPrimitive.getId(), allocationNode.getId()]
        ]
      });
      await this.update(this.instructionNode, updatedBudgetNode);
      return new _FosExpression(this.store, allocationPrimitive, allocationNode, this);
    }
    /**
     * Spend from this budget
     *
     * @param amount Amount to spend
     * @param description Optional description of the spending
     */
    async spendBudget(amount, description) {
      if (!this.isBudget()) {
        throw new Error("Can only spend from a budget expression");
      }
      const budgetData = this.targetNode.getData().budget;
      if (!budgetData) {
        throw new Error("Invalid budget data");
      }
      const available = budgetData.total - budgetData.consumed;
      if (amount > available) {
        throw new Error(`Cannot spend ${amount} from budget with ${available} available`);
      }
      const spentPrimitive = this.store.primitive.spentNode;
      const spentNode = this.store.create({
        data: {
          spent: {
            amount,
            description,
            timestamp: Date.now()
          }
        },
        children: []
      });
      const updatedBudgetNode = this.store.create({
        data: {
          ...this.targetNode.getData(),
          budget: {
            ...budgetData,
            consumed: budgetData.consumed + amount
          }
        },
        children: [
          ...this.targetNode.getEdges(),
          [spentPrimitive.getId(), spentNode.getId()]
        ]
      });
      await this.update(this.instructionNode, updatedBudgetNode);
    }
    /**
     * Get all budgets in this scope
     */
    getBudgets() {
      const budgetPrimitive = this.store.primitive.budgetNode;
      return this.getTargetChildren().filter(
        (child) => child.instructionNode.getId() === budgetPrimitive.getId()
      );
    }
    // === Calendar Methods (Linear Time Resources) ===
    /**
     * Create a calendar as a child of this expression
     *
     * @param name Calendar name
     * @returns The new calendar expression
     */
    async createCalendar(name) {
      const calendarPrimitive = this.store.primitive.calendarNode;
      const calendarTargetNode = this.store.create({
        data: {
          calendar: {
            name,
            slots: []
          },
          description: { content: name }
        },
        children: []
      });
      const newTarget = this.targetNode.addEdge(calendarPrimitive.getId(), calendarTargetNode.getId());
      await this.update(this.instructionNode, newTarget);
      const calendarExpr = new _FosExpression(this.store, calendarPrimitive, calendarTargetNode, this);
      return calendarExpr;
    }
    /**
     * Check if this expression is a calendar
     */
    isCalendar() {
      return this.instructionNode.getId() === this.store.primitive.calendarNode.getId();
    }
    /**
     * Get calendar data if this is a calendar expression
     */
    getCalendarInfo() {
      const calendarData = this.targetNode.getData().calendar;
      if (!calendarData) return null;
      return {
        name: calendarData.name,
        slots: calendarData.slots || []
      };
    }
    /**
     * Add a time slot to this calendar
     *
     * @param start Start time (ISO 8601)
     * @param end End time (ISO 8601)
     * @returns The updated calendar expression
     */
    async addTimeSlot(start, end) {
      if (!this.isCalendar()) {
        throw new Error("Can only add time slots to a calendar expression");
      }
      const calendarData = this.targetNode.getData().calendar;
      if (!calendarData) {
        throw new Error("Invalid calendar data");
      }
      const slotId = `slot_${Date.now()}`;
      const newSlot = {
        id: slotId,
        start,
        end,
        allocated: false
      };
      const updatedCalendarNode = this.store.create({
        data: {
          ...this.targetNode.getData(),
          calendar: {
            ...calendarData,
            slots: [...calendarData.slots || [], newSlot]
          }
        },
        children: this.targetNode.getEdges()
      });
      await this.update(this.instructionNode, updatedCalendarNode);
      return this.isAlias() ? this.followAlias() : this;
    }
    /**
     * Allocate a time slot in this calendar
     *
     * @param slotId The slot ID to allocate
     * @param allocatedTo Description of what the slot is allocated to
     */
    async allocateTimeSlot(slotId, allocatedTo) {
      if (!this.isCalendar()) {
        throw new Error("Can only allocate time slots in a calendar expression");
      }
      const calendarData = this.targetNode.getData().calendar;
      if (!calendarData) {
        throw new Error("Invalid calendar data");
      }
      const slots = calendarData.slots || [];
      const slotIndex = slots.findIndex((s) => s.id === slotId);
      if (slotIndex === -1) {
        throw new Error(`Time slot ${slotId} not found`);
      }
      if (slots[slotIndex].allocated) {
        throw new Error(`Time slot ${slotId} is already allocated`);
      }
      const updatedSlots = [...slots];
      updatedSlots[slotIndex] = {
        ...slots[slotIndex],
        allocated: true,
        allocatedTo
      };
      const updatedCalendarNode = this.store.create({
        data: {
          ...this.targetNode.getData(),
          calendar: {
            ...calendarData,
            slots: updatedSlots
          }
        },
        children: this.targetNode.getEdges()
      });
      await this.update(this.instructionNode, updatedCalendarNode);
    }
    /**
     * Get available (unallocated) time slots in this calendar
     */
    getAvailableTimeSlots() {
      const calendarInfo = this.getCalendarInfo();
      if (!calendarInfo) return [];
      return calendarInfo.slots.filter((s) => !s.allocated).map(({ id, start, end }) => ({ id, start, end }));
    }
    /**
     * Get all calendars in this scope
     */
    getCalendars() {
      const calendarPrimitive = this.store.primitive.calendarNode;
      return this.getTargetChildren().filter(
        (child) => child.instructionNode.getId() === calendarPrimitive.getId()
      );
    }
    removePattern(instruction, target) {
      throw new Error("Method not implemented");
    }
    createChildExpressionUnderTarget(instruction, target) {
      throw new Error("Method not implemented");
    }
    createChildExpressionUnderInstruction(instruction, target) {
      throw new Error("Method not implemented");
    }
    queryAvailableActionsForPrimitivePattern(instruction, target) {
      throw new Error("Method not implemented");
    }
    setSearchQuery(searchQuery) {
      throw new Error("Method not implemented");
    }
    completeTask() {
      const currentTargetVal = this.targetNode.value;
      const newTarget = this.targetNode.updateData({
        todo: {
          completed: true,
          time: Date.now()
        }
      });
      this.update(this.instructionNode, newTarget);
    }
    async addTodo(description) {
      console.log("addTodo - this route", this.route);
      if (this.isAlias()) {
        const dereferencedThis = this.followAlias();
        console.log("addTodo - dereferencedThis route", dereferencedThis.route);
        return dereferencedThis.addTodo(description);
      }
      if (!this.isRoot() && !this.isWorkflow() && !this.isGroup()) {
        console.log("addTodo - not root or workflow or group", this.route, this.store.primitive);
        throw new Error("Method only implemented for root expressions groups and workflows");
      }
      let thisExpr = this;
      const [newTarget, todoNode] = thisExpr.targetNode.addTodo(description);
      console.log("addTodo - newTarget", newTarget.getId(), "todoNode", todoNode.getId());
      await thisExpr.update(thisExpr.instructionNode, newTarget);
      console.log("addTodo - updated expression", thisExpr.instructionNode.getId(), thisExpr.targetNode.getId());
      return new _FosExpression(this.store, todoNode, this.store.primitive.completeField, thisExpr);
    }
    async addComment(comment) {
      const timestamp = Date.now();
      const newCommentNode = this.store.create({
        data: {
          description: {
            content: comment
          },
          comment: {
            content: comment,
            authorID: "global",
            authorName: "",
            time: timestamp,
            votes: {},
            scope: "global"
          },
          updated: {
            time: timestamp
          }
        },
        children: []
      });
      if (this.store.updateCtxCallback) {
        this.store.updateCtxCallback(this.store.exportContext(this.store.fosRoute));
      }
      const commentExpr = new _FosExpression(this.store, [[this.store.primitive.commentConstructor.getId(), newCommentNode.getId()]]);
      return commentExpr;
    }
    addTimeInterval(expr, startTime, stopTime) {
      throw new Error("Method not implemented");
    }
    startTimeInterval(expr) {
      throw new Error("Method not implemented");
    }
    stopTimeInterval(expr) {
      throw new Error("Method not implemented");
    }
    /**
     * Create a new group node
     */
    async createGroup(name, description, visibility = "private") {
      const { v4: uuidv4 } = await Promise.resolve().then(() => (init_esm_browser(), esm_browser_exports));
      const personFieldCid = this.store.primitive.personField.getId();
      const groupNode = this.store.create({
        data: {
          group: {
            id: uuidv4(),
            name,
            visibility,
            userProfiles: [this.targetNode.getId()],
            createdBy: this.targetNode.getId()
          },
          description: description ? { content: description } : void 0
        },
        children: [
          [personFieldCid, this.targetNode.getId()]
          // Creator is first member
        ]
      });
      const newTarget = this.targetNode.addEdge(this.store.primitive.groupField.getId(), groupNode.getId());
      await this.update(this.instructionNode, newTarget);
      return new _FosExpression(this.store, this.store.primitive.groupField, groupNode, this);
    }
    /**
     * Create a DM (direct message) group between current user and target user
     */
    async createDM(targetUserNodeCid) {
      const { v4: uuidv4 } = await Promise.resolve().then(() => (init_esm_browser(), esm_browser_exports));
      const personFieldCid = this.store.primitive.personField.getId();
      const existingDM = this.getTargetChildren().find((child) => {
        const groupData = child.targetNode.getData().group;
        if (!groupData) return false;
        const profiles = groupData.userProfiles || [];
        return profiles.length === 2 && profiles.includes(this.targetNode.getId()) && profiles.includes(targetUserNodeCid);
      });
      if (existingDM) {
        return existingDM;
      }
      const dmNode = this.store.create({
        data: {
          group: {
            id: uuidv4(),
            name: "Direct Message",
            userProfiles: [this.targetNode.getId(), targetUserNodeCid]
          }
        },
        children: [
          [personFieldCid, this.targetNode.getId()],
          [personFieldCid, targetUserNodeCid]
        ]
      });
      const newTarget = this.targetNode.addEdge(this.store.primitive.groupField.getId(), dmNode.getId());
      await this.update(this.instructionNode, newTarget);
      return new _FosExpression(this.store, this.store.primitive.groupField, dmNode, this);
    }
    /**
     * Add a member to a group (adds PERSON_FIELD child)
     */
    async addMemberToGroup(memberNodeCid) {
      if (!this.isGroup()) {
        throw new Error("Can only add members to group expressions");
      }
      const personFieldCid = this.store.primitive.personField.getId();
      const existingMembers = this.targetNode.getEdges().filter(([inst, _]) => inst === personFieldCid).map(([_, target]) => target);
      if (existingMembers.includes(memberNodeCid)) {
        return this;
      }
      const newTarget = this.targetNode.addEdge(personFieldCid, memberNodeCid);
      const groupData = this.targetNode.getData().group;
      if (groupData) {
        const updatedGroupData = {
          ...groupData,
          userProfiles: [...groupData.userProfiles || [], memberNodeCid]
        };
        const updatedTarget = this.store.create({
          data: {
            ...newTarget.getData(),
            group: updatedGroupData
          },
          children: newTarget.getEdges()
        });
        await this.update(this.instructionNode, updatedTarget);
      } else {
        await this.update(this.instructionNode, newTarget);
      }
      return this.isAlias() ? this.followAlias() : this;
    }
    /**
     * Send a message to a group (adds COMMENT_FIELD child)
     */
    async sendGroupMessage(message, authorCid, authorName) {
      if (!this.isGroup()) {
        throw new Error("Can only send messages to group expressions");
      }
      const commentNode = this.store.create({
        data: {
          comment: {
            content: message,
            authorID: authorCid,
            authorName,
            time: Date.now(),
            votes: {}
          }
        },
        children: []
      });
      const newTarget = this.targetNode.addEdge(this.store.primitive.commentConstructor.getId(), commentNode.getId());
      await this.update(this.instructionNode, newTarget);
      const actualExpr = this.isAlias() ? this.followAlias() : this;
      const newTargetChildren = actualExpr.getTargetChildren();
      const messageExpr = newTargetChildren.find(
        (child) => child.instructionNode.getId() === commentNode.getId()
      );
      if (!messageExpr) {
        throw new Error("Message expression not found");
      }
      return messageExpr;
    }
    inviteToGroup(expr, groupTarget) {
      throw new Error("Method not implemented - use addMemberToGroup instead");
    }
    addLink(expr, nodeToLink) {
      throw new Error("Method not implemented");
    }
    deleteLink(expr, linkNode) {
      throw new Error("Method not implemented");
    }
    deleteGroup(expr, group) {
      throw new Error("Method not implemented");
    }
    deleteComment(expr, comment) {
      throw new Error("Method not implemented");
    }
    editComment(expr, comment, newComment) {
      throw new Error("Method not implemented");
    }
    makeChoice(expr, option) {
      throw new Error("Method not implemented");
    }
    makeProposal(expr) {
      throw new Error("Method not implemented");
    }
    makeBranch(expr, branch) {
      throw new Error("Method not implemented");
    }
    revertToPrevious(previous) {
      throw new Error("Method not implemented");
    }
    createBid(bid) {
      throw new Error("Method not implemented");
    }
    createOffer(expr, offer) {
      throw new Error("Method not implemented");
    }
    upvote(expr, node) {
      throw new Error("Method not implemented");
    }
    downvote(expr, node) {
      throw new Error("Method not implemented");
    }
    approve(expr, node) {
      throw new Error("Method not implemented");
    }
    sendInvoice(expr, invoice) {
      throw new Error("Method not implemented");
    }
    addEntryToInvoice(expr, invoice, entry) {
      throw new Error("Method not implemented");
    }
    addCommentToInvoice(expr, invoice, comment) {
      throw new Error("Method not implemented");
    }
    updateEntryInInvoice(expr, invoice, entry, newEntry) {
      throw new Error("Method not implemented");
    }
    addPaymentToInvoice(expr, invoice, payment) {
      throw new Error("Method not implemented");
    }
    toggleMarketService(expr) {
      throw new Error("Method not implemented");
    }
    toggleServiceForGroup(expr, group) {
      throw new Error("Method not implemented");
    }
    toggleMarketRequest(expr) {
      throw new Error("Method not implemented");
    }
    async runTask() {
      await this.executeWorkflow([]);
      this.updateFocus(0);
    }
    async executeWorkflow(attachToRoute) {
      const newTodoNode = this.targetNode.clone();
      const targetExpr = new _FosExpression(this.store, attachToRoute);
      targetExpr.attachChild(newTodoNode, this.store.primitive.completeField, -1);
    }
    setVote(id, vote) {
      throw new Error("Method not implemented");
    }
    setApproval(id, approval) {
      throw new Error("Method not implemented");
    }
    addCommit(branch, tag) {
      throw new Error("Method not implemented");
    }
    createBidRequest(todoRoute, bidRequestInfo) {
      throw new Error("Method not implemented");
    }
    approveBid(bidRoute) {
      throw new Error("Method not implemented");
    }
    approveFulfillment(fulfillmentRoute) {
      throw new Error("Method not implemented");
    }
    approvePayment(paymentRoute) {
      throw new Error("Method not implemented");
    }
    createMergeRequest(route) {
      throw new Error("Method not implemented");
    }
    addPin(route) {
      throw new Error("Method not implemented");
    }
    removePin(route) {
      throw new Error("Method not implemented");
    }
    // updateNodeContent (newNodeContent: FosNodeContent) {
    //   throw new Error('Method not implemented')
    //   newNodeContent.children.forEach(([childType, childId]: FosPathElem) => {
    //     if (childId === this.targetNode.getId()) {
    //         throw new Error('Cannot add node as child of itself')
    //     }
    //   })
    //   const newNode = this.store.create(newNodeContent)
    //   this.targetNode = newNode
    // }
    async updateFocus(focusChar) {
      this.store.trellisData.focusChar = focusChar;
    }
    // updateNodeData(newNodeData: Partial<FosDataContent>) {
    //   throw new Error('Method not implemented')
    //   const newNode = this.targetNode.updateData(newNodeData)
    //   this.targetNode = newNode
    // }
    updateZoom() {
      this.store.fosRoute = this.route;
    }
    async addChild(newType, newNodeContent, index = -1) {
      const childTarget = this.store.create(newNodeContent);
      const newThisTarget = this.targetNode.addEdge(newType.getId(), childTarget.getId(), index);
      await this.update(this.instructionNode, newThisTarget);
      return new _FosExpression(this.store, newType, childTarget, this);
    }
    async attachChild(newRowType, newRowTarget, index = -1) {
      const newTarget = this.targetNode.addEdge(newRowType.getId(), newRowTarget.getId(), index);
      await this.update(this.instructionNode, newTarget);
    }
    attachTargetSibling(newRowType, newRowTarget, position) {
      const { parent, targetIndexInParent } = this.getParentInfo();
      if (targetIndexInParent === -1) {
        throw new Error("Node not found in parent");
      }
      let index = 0;
      const parentChildren = parent.getTargetChildren();
      const parentRoute = parent.route;
      if (typeof position === "number") {
        index = position;
      } else if (position === "after") {
        index = targetIndexInParent + 1;
      } else if (position === "before") {
        index = targetIndexInParent;
      } else if (position === "first") {
        index = 0;
      } else if (position === "last") {
        index = parentChildren.length;
      }
      const returnVal = this.attachChild(newRowType, newRowTarget, index);
      return returnVal;
    }
    addTargetSibling(newRowType, newNodeContent, position) {
      const newSiblingTarget = this.store.create(newNodeContent);
      this.attachTargetSibling(newRowType, newSiblingTarget, position);
      this.commit();
    }
    async removeNode() {
      const { targetIndexInParent, instructionIndexInParent, parent } = this.getParentInfo();
      this.moveFocusUp();
      if (targetIndexInParent !== -1) {
        const newTarget = parent.targetNode.removeEdgeByIndex(targetIndexInParent);
        return parent.update(parent.instructionNode, newTarget);
      }
      if (instructionIndexInParent !== -1) {
        const newInstruction = parent.instructionNode.removeEdgeByIndex(instructionIndexInParent);
        return parent.update(newInstruction, parent.targetNode);
      }
      throw new Error("Node not found in parent");
    }
    snipNodeTarget() {
      const { targetIndexInParent, parent } = this.getParentInfo();
      const parentContent = parent.targetNode.getContent();
      const parentChildren = parentContent.children;
      const newParentRows = parentContent.children.reduce((acc, child, i2) => {
        if (i2 !== targetIndexInParent) {
          return [...acc, ...parentChildren];
        }
        return [...acc, child];
      }, []);
      const newParentContent = {
        ...parentContent,
        children: newParentRows
      };
      const newParentTarget = parent.targetNode.mutate(newParentContent);
      parent.update(parent.instructionNode, newParentTarget);
      parent.commit();
    }
    moveNodeAboveRoute(targetRoute) {
      const myInstructionNode = this.instructionNode;
      const myTargetNode = this.targetNode;
      const myPathElem = this.pathElem();
      const targetExpression = new _FosExpression(this.store, targetRoute);
      const { parent: targetParent } = targetExpression.getParentInfo();
      const targetPathElem = targetExpression.pathElem();
      const targetInstrId = targetPathElem[0];
      const targetTargetId = targetPathElem[1];
      const targetParentRoute = targetParent.route;
      this.removeNode();
      const freshParent = new _FosExpression(this.store, targetParentRoute);
      const parentContent = freshParent.targetNode.getContent();
      const newParentRows = [];
      for (const child of parentContent.children) {
        if (child[0] === targetInstrId && child[1] === targetTargetId) {
          newParentRows.push(myPathElem);
        }
        newParentRows.push(child);
      }
      const newParentContent = {
        ...parentContent,
        children: newParentRows
      };
      const parentTargetNode = freshParent.targetNode.mutate(newParentContent);
      freshParent.update(freshParent.instructionNode, parentTargetNode);
      const movedExpr = new _FosExpression(this.store, myInstructionNode, myTargetNode, freshParent);
      movedExpr.updateFocus(this.focusChar() || 0);
    }
    moveNodeBelowRoute(targetRoute) {
      const myInstructionNode = this.instructionNode;
      const myTargetNode = this.targetNode;
      const myPathElem = this.pathElem();
      const targetExpression = new _FosExpression(this.store, targetRoute);
      const { parent } = targetExpression.getParentInfo();
      const targetPathElem = targetExpression.pathElem();
      const targetInstrId = targetPathElem[0];
      const targetTargetId = targetPathElem[1];
      const parentRoute = parent.route;
      this.removeNode();
      const freshParent = new _FosExpression(this.store, parentRoute);
      const parentContent = freshParent.targetNode.getContent();
      const newParentRows = [];
      for (const child of parentContent.children) {
        newParentRows.push(child);
        if (child[0] === targetInstrId && child[1] === targetTargetId) {
          newParentRows.push(myPathElem);
        }
      }
      const newParentContent = {
        ...parentContent,
        children: newParentRows
      };
      const parentTargetNode = freshParent.targetNode.mutate(newParentContent);
      freshParent.update(freshParent.instructionNode, parentTargetNode);
      const movedExpr = new _FosExpression(this.store, myInstructionNode, myTargetNode, freshParent);
      movedExpr.updateFocus(this.focusChar() || 0);
      return movedExpr;
    }
    moveNodeIntoRoute(targetRoute, index = 0) {
      const targetExpression = new _FosExpression(this.store, targetRoute);
      const targetContent = targetExpression.targetNode.getContent();
      const myInstructionNode = this.instructionNode;
      const myTargetNode = this.targetNode;
      const newElem = this.pathElem();
      const { parent: sourceParent, targetIndexInParent, instructionIndexInParent } = this.getParentInfo();
      const sourceParentRoute = sourceParent.route;
      const sourceInstrId = newElem[0];
      const sourceTargetId = newElem[1];
      let newParentRows;
      if (index < 0) {
        newParentRows = [...targetContent.children, newElem];
      } else if (index === 0) {
        newParentRows = [newElem, ...targetContent.children];
      } else {
        newParentRows = targetContent.children.reduce((acc, child, i2) => {
          if (i2 === index) {
            return [...acc, newElem, child];
          }
          return [...acc, child];
        }, []);
        if (index >= targetContent.children.length) {
          newParentRows = [...targetContent.children, newElem];
        }
      }
      console.log("[moveNodeIntoRoute] newParentRows", newParentRows, "targetRoute", targetRoute, "newElem", newElem, "index", index);
      const newParentContent = {
        ...targetContent,
        children: newParentRows
      };
      const newTargetNode = targetExpression.targetNode.mutate(newParentContent);
      targetExpression.update(targetExpression.instructionNode, newTargetNode);
      this.moveFocusUp();
      const freshParent = new _FosExpression(this.store, sourceParentRoute);
      const freshParentContent = freshParent.targetNode.getContent();
      const newSourceParentRows = freshParentContent.children.filter(
        (child) => !(child[0] === sourceInstrId && child[1] === sourceTargetId)
      );
      console.log("[moveNodeIntoRoute] removing from source parent, before:", freshParentContent.children.length, "after:", newSourceParentRows.length);
      const newSourceParentContent = {
        ...freshParentContent,
        children: newSourceParentRows
      };
      const newSourceParentTarget = freshParent.targetNode.mutate(newSourceParentContent);
      freshParent.update(freshParent.instructionNode, newSourceParentTarget);
      const movedExpr = new _FosExpression(this.store, myInstructionNode, myTargetNode, targetExpression);
      movedExpr.updateFocus(this.focusChar() || 0);
      return movedExpr;
    }
    reorderNodeChildren(newOrder) {
      const nodeContent = this.targetNode.getContent();
      const newTarget = this.targetNode.orderEdges(newOrder);
      const newExpr = this.update(this.instructionNode, newTarget);
      return newExpr;
    }
    moveLeft() {
      const {
        parent,
        targetIndexInParent,
        siblingRoutes
      } = this.getParentInfo();
      if (parent.route.length === 1) {
        return;
      }
      siblingRoutes().forEach((siblingRoute, i2) => {
        if (i2 < targetIndexInParent + 1) {
          return;
        } else {
          console.log("siblingRoute", siblingRoute, this.route, i2, targetIndexInParent);
          throw new Error("Not implemented");
          this.moveNodeIntoRoute(this.route, i2 - targetIndexInParent + 1);
        }
      });
      const exprInNewPath = this.moveNodeBelowRoute(parent.route);
    }
    moveRight() {
      const upSiblingExpr = getUpNode(this);
      const actualUpSiblingExpr = getUpSibling(this);
      console.log("upSiblingRoute", upSiblingExpr);
      if (upSiblingExpr) {
        if (actualUpSiblingExpr) {
          console.warn("this is a case that needs to be caught for better useability");
        }
        return this.moveNodeIntoRoute(upSiblingExpr.route, upSiblingExpr.getTargetChildren().length);
      }
      return this;
    }
    moveUp() {
      const upSibling = getUpSibling(this);
      console.log("upSibling", upSibling);
      if (upSibling) {
        return this.moveNodeAboveRoute(upSibling.route);
      } else {
        const leastUpSibling = getAncestorLeastUpSibling(this);
        console.log("leastUpSibling", leastUpSibling);
        if (leastUpSibling) {
          return this.moveNodeIntoRoute(leastUpSibling.route, -1);
        } else {
          const parent = this.getParent();
          return this.moveNodeAboveRoute(parent.route);
        }
      }
    }
    moveDown() {
      const downSibling = getDownSibling(this);
      if (downSibling) {
        return this.moveNodeBelowRoute(downSibling.route);
      } else {
        throw new Error("Not implemented");
      }
    }
    async doAction(action, setData) {
      action().then(() => {
        this.commit();
        const updatedContext = this.store.exportContext([]);
        setData(updatedContext);
      });
    }
    toggleOptionChildCollapse() {
      const isOptionChildCollapsed = this.isOptionChildCollapsed();
      const selectedOptionRoute = this.getOptionInfo().selectedChildRoute;
      const newCollapsedList = isOptionChildCollapsed ? this.store.trellisData.collapsedList.filter((route) => !pathEqual(route, selectedOptionRoute)) : [...this.store.trellisData.collapsedList, selectedOptionRoute];
      this.store.trellisData.collapsedList = newCollapsedList;
    }
    toggleCollapse() {
      const newCollapsedList = this.isCollapsed() ? this.store.trellisData.collapsedList.filter((route) => !pathEqual(route, this.route)) : [...this.store.trellisData.collapsedList, this.route];
      this.store.trellisData.collapsedList = newCollapsedList;
    }
    moveFocusDown() {
      console.log(this.store.trellisData);
      const downNodeExpr = getDownNode(this);
      if (downNodeExpr) {
        downNodeExpr.updateFocus(this.focusChar() || 0);
      }
    }
    moveFocusUp() {
      console.log(this.store.trellisData);
      const upNodeExpr = getUpNode(this);
      if (upNodeExpr) {
        upNodeExpr.updateFocus(this.focusChar() || 0);
      }
    }
    moveFocusToEnd() {
      const description = this.getDescription();
      this.updateFocus(description.length);
    }
    moveFocusToStart() {
      this.updateFocus(0);
    }
    async addDownSibling() {
      const { targetIndexInParent, parent } = this.getParentInfo();
      const newChild = await parent.addChild(
        this.instructionNode,
        { data: { description: { content: "" } }, children: [] },
        targetIndexInParent + 1
      );
      await newChild.updateFocus(this.focusChar() || 0);
      return newChild;
    }
    keyUpEvents(e) {
      const value = e.target;
      if (e.key === "Backspace" && this.focusChar() === 0) {
        this.moveFocusUp();
      }
      if (e.key === " ") {
        e.stopPropagation();
      }
      if (e.key === "Enter") {
        if (e.shiftKey) {
          return;
        } else {
          if (this.focusChar() === this.getDescription().length) {
            e.preventDefault();
            this.addDownSibling();
          }
        }
      }
      if (e.key === "ArrowUp") {
        if (!e.ctrlKey && !e.shiftKey && !e.metaKey && !e.altKey) {
          this.moveFocusUp();
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (e.ctrlKey) {
          if (e.altKey) {
            this.moveUp();
          } else {
            this.moveFocusToStart();
          }
          e.stopPropagation();
          return;
        }
      }
      if (e.key === "ArrowDown") {
        if (!e.ctrlKey && !e.shiftKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          e.stopPropagation();
          this.moveFocusDown();
          return;
        }
        if (e.ctrlKey) {
          if (e.altKey) {
            this.moveDown();
          } else {
            this.moveFocusToEnd();
          }
          e.stopPropagation();
          return;
        }
      }
      if (e.key === "ArrowRight") {
        if (e.altKey && e.ctrlKey) {
          console.log("moveRight - comboboxEditable", this.getDescription(), this.route);
          this.moveRight();
        }
      }
      if (e.key === "ArrowLeft") {
        if (e.altKey && e.ctrlKey) {
          this.moveLeft();
        }
      }
      if (e.key === " " && e.ctrlKey) {
        this.toggleCollapse();
      }
    }
    keyDownEvents(e) {
      if (e.key === " ") {
        e.stopPropagation();
      }
      if (e.key === "Enter") {
        e.stopPropagation();
      }
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
      }
      if (e.key === "Backspace" && !this.getDescription()) {
        console.log("deleteRow - comboboxEditable", this.getDescription(), this.route);
        if (this.hasFocus() && this.focusChar() === 0) {
          if (!e.shiftKey) {
            this.snipNodeTarget();
          } else {
            this.removeNode();
          }
        }
      }
    }
    keyPressEvents(event) {
    }
    async addRowAsChild(newType = this.instructionNode) {
      const newNodeContent = {
        data: {
          description: {
            content: ""
          },
          option: {
            selectedIndex: 0,
            defaultResolutionStrategy: "selected"
          },
          updated: {
            time: Date.now()
          }
        },
        children: []
      };
      const childExpr = await this.addChild(newType, newNodeContent);
      childExpr.updateFocus(0);
    }
  };

  // ../shared/defaults.ts
  init_prelude();

  // ../shared/utils.ts
  var getDownNode = (expression) => {
    const parent = expression.getParent();
    const children = parent.getTargetChildren();
    if (!parent.childrenVisible()) {
      throw new Error("Parent is not visible");
    }
    if (children.length > 0 && expression.childrenVisible()) {
      return children[0];
    }
    const downSibling = getDownSibling(expression);
    if (downSibling) {
      return downSibling;
    } else {
      return getAncestorLeastDownSibling(expression);
    }
  };
  var getAncestorLeastDownSibling = (expression) => {
    const parent = expression.getParent();
    console.log("leastDownSibling", parent);
    if (parent.route.length === 1) {
      return null;
    }
    const parentDownSibling = getDownSibling(parent);
    if (parentDownSibling) {
      return parentDownSibling;
    } else {
      return getAncestorLeastDownSibling(parent);
    }
  };
  var getAncestorLeastUpSibling = (expression) => {
    const parent = expression.getParent();
    if (parent.route.length === 1) {
      return null;
    }
    const parentUpSibling = getUpSibling(parent);
    if (parentUpSibling) {
      return parentUpSibling;
    } else {
      return getAncestorLeastUpSibling(parent);
    }
  };
  var getUpSibling = (expression) => {
    const { targetIndexInParent, parent } = expression.getParentInfo();
    const siblings = parent.getTargetChildren();
    if (targetIndexInParent === 0) {
      return null;
    }
    const newRoute = siblings[targetIndexInParent - 1];
    if (!newRoute) {
      return null;
    }
    return newRoute;
  };
  var getDownSibling = (expression) => {
    const { targetIndexInParent, parent } = expression.getParentInfo();
    const siblings = parent.getTargetChildren();
    if (targetIndexInParent === siblings.length - 1) {
      return null;
    }
    const newExpr = siblings[targetIndexInParent + 1];
    if (!newExpr) {
      return null;
    }
    return newExpr;
  };
  var getDownmostDescendent = (expression, depthLimit = -1) => {
    if (depthLimit === 0) {
      return expression;
    }
    const childRoutes = expression.childRoutes();
    const hasChildren = expression.hasChildren();
    const childrenVisible = expression.childrenVisible();
    const children = expression.getTargetChildren();
    if (childrenVisible && hasChildren) {
      return getDownmostDescendent(children[children.length - 1], depthLimit - 1);
    } else {
      return expression;
    }
  };
  var getUpNode = (expression) => {
    const { targetIndexInParent, parent, siblingRoutes } = expression.getParentInfo();
    const siblings = parent.getTargetChildren();
    if (targetIndexInParent > 0) {
      return getDownmostDescendent(siblings[targetIndexInParent - 1]);
    } else {
      return parent;
    }
  };
  var pathEqual = (path1, path2) => {
    if (!path1 || !path2) {
      return path1 === path2;
    }
    const sameLength = path1.length === path2.length;
    const sameValues = path1.every(([p1type, p1id], index) => {
      const p2elem = path2[index];
      if (!p2elem) {
        return false;
      }
      const [p2type, p2id] = p2elem;
      return p1type === p2type && p1id === p2id;
    });
    return sameLength && sameValues;
  };
  function assert(condition, message) {
    if (!condition) {
      throw new Error(`Assertion Failed: ${message}`);
    }
  }
  var aggMap = (edges) => {
    const result = /* @__PURE__ */ new Map();
    edges.forEach(([edgeType, target]) => {
      if (result.has(edgeType)) {
        result.set(edgeType, [...result.get(edgeType), target]);
      } else {
        result.set(edgeType, [target]);
      }
    });
    return result;
  };
  var mutableReduceToRouteMapFromExpression = (expression, operation) => {
    let resultMap = /* @__PURE__ */ new Map();
    const helper = (acc, expr) => {
      const nodeRoute = expr.route;
      for (let i2 = 0; i2 < nodeRoute.length; i2++) {
        for (let j = i2 + 1; j < nodeRoute.length; j++) {
          if (nodeRoute[i2]?.[0] === nodeRoute[j]?.[0] && nodeRoute[i2]?.[1] === nodeRoute[j]?.[1]) {
            return;
          }
        }
      }
      const childInstructionExpressions = expr.getInstructionChildren();
      const childExpressions = expr.getTargetChildren();
      for (const childExpr of childInstructionExpressions) {
        helper(acc, childExpr);
      }
      operation(acc, expr, childInstructionExpressions);
      for (const childExpr of childExpressions) {
        helper(acc, childExpr);
      }
      operation(acc, expr, childExpressions);
    };
    helper(resultMap, expression);
    return resultMap;
  };
  var getGroupFromRoute = (route, store) => {
    const groupFieldNode = store.primitive.groupField;
    if (route[0]?.[0] === groupFieldNode.getId()) {
      const addr = route[0][1];
      const groupNode = store.getNodeByAddress(route[0][1]);
      if (!groupNode) {
        throw new Error("Group node not found");
      }
      return groupNode;
    } else {
      return store.getRootNode();
    }
  };

  // ../shared/dag-implementation/node.ts
  init_prelude();
  var FosNode = class {
    constructor(value, store) {
      __publicField(this, "primitiveTag");
      __publicField(this, "cid");
      __publicField(this, "store");
      __publicField(this, "value");
      __publicField(this, "alias");
      /** Cached resolved edges (object references instead of CID strings) */
      __publicField(this, "_resolvedEdges", null);
      const address = store.insert(value);
      this.cid = address;
      this.store = store;
      this.value = value;
      store.cache.set(this.cid, this);
    }
    getId() {
      return this.cid;
    }
    /**
     * Get edges as resolved FosNode object references.
     * This is the preferred method for runtime navigation - no CID lookups needed after first access.
     */
    getEdgesResolved() {
      if (this._resolvedEdges === null) {
        this._resolvedEdges = this.value.children.map(([instrCid, targetCid]) => {
          const instrNode = this.store.getNodeByAddress(instrCid);
          const targetNode = this.store.getNodeByAddress(targetCid);
          if (!instrNode || !targetNode) {
            throw new Error(`Failed to resolve edge: instr=${instrCid}, target=${targetCid}`);
          }
          return [instrNode, targetNode];
        });
      }
      return this._resolvedEdges;
    }
    /**
     * Invalidate the resolved edges cache (call when edges change)
     */
    invalidateEdgesCache() {
      this._resolvedEdges = null;
    }
    mapTarget(instruction, mapTarget) {
      const newEdges = this.getEdges().map(([edgeType, target]) => {
        if (edgeType === instruction.getId()) {
          const targetNode = this.store.getNodeByAddress(target);
          if (!targetNode) {
            throw new Error("Target Node not found");
          }
          const newTarget = mapTarget(targetNode);
          return [edgeType, newTarget.getId()];
        }
        return [edgeType, target];
      });
      const newContent = {
        data: {
          ...this.value.data,
          updated: {
            time: Date.now()
          }
        },
        children: newEdges
      };
      return this.mutate(newContent);
    }
    mapInstruction(mapInstruction, target) {
      const newEdges = this.getEdges().map(([edgeType, targetId]) => {
        if (targetId === target.getId()) {
          const instructionNode = this.store.getNodeByAddress(edgeType);
          if (!instructionNode) {
            throw new Error("Instruction Node not found");
          }
          const newInstruction = mapInstruction(instructionNode);
          return [newInstruction.getId(), targetId];
        }
        return [edgeType, targetId];
      });
      const newContent = {
        data: {
          ...this.value.data,
          updated: {
            time: Date.now()
          }
        },
        children: newEdges
      };
      return this.mutate(newContent);
    }
    getEdges() {
      return this.value.children;
    }
    getContent() {
      const nodeContent = this.value;
      return nodeContent;
    }
    printTree() {
      throw new Error("Method not implemented.");
    }
    toString() {
      return JSON.stringify(this.value);
    }
    isDone() {
      throw new Error("Method not implemented.");
    }
    isLeaf() {
      return this.value.children.length == 0;
    }
    prevList() {
      const previousVersionNodeId = this.store.primitive.previousVersion.getId();
      const prevNodes = this.value.children.reduce((acc, [edgeType, target]) => {
        if (edgeType === previousVersionNodeId) {
          const node = this.store.getNodeByAddress(target);
          if (!node) {
            throw new Error("Node not found");
          }
          return [...acc, node];
        }
        return acc;
      }, []);
      return prevNodes;
    }
    getExprOfType(instructionType, targetType, route) {
      const exprs = this.getEdges().filter(([edgeType, target]) => {
        const instructionNode = this.store.getNodeByAddress(edgeType);
        if (!instructionNode) {
          throw new Error("Instructinon Node not found");
        }
        const targetNode = this.store.getNodeByAddress(target);
        if (!targetNode) {
          throw new Error("Target Node not found");
        }
        const instructionMatch = this.store.matchPattern(instructionType, instructionNode);
        const targetMatch = this.store.matchPattern(targetType, targetNode);
        return instructionMatch.length > 0 && targetMatch.length > 0;
      });
      if (exprs.length === 0) {
        return null;
      }
      const expressions = exprs.map(([edgeType, targetType2]) => {
        return new FosExpression(this.store, [...route, [edgeType, targetType2]]);
      });
      return expressions;
    }
    // isGroupInstructionNode(): boolean {
    //   const peerEdges = this.value.children.filter(([edgeType, target]) => edgeType === this.store.primitive.peerNode.getId())
    //   const hasPeerEdges = peerEdges.length > 0
    //   return hasPeerEdges
    // }
    isPrimitive() {
      const result = Object.entries(this.store.primitive).find(([key, primitive], number) => {
        if (primitive.getId() === this.getId()) {
          return true;
        }
      }) || null;
      return result;
    }
    getData() {
      return this.value.data;
    }
    followAllLinks() {
      throw new Error("Method not implemented.");
    }
    mutate(content2) {
      return this.store.create(content2);
    }
    addUuidAlias() {
      throw new Error("Method not implemented.");
    }
    clone() {
      throw new Error("Method not implemented.");
    }
    merge(nodeContent) {
      throw new Error("Method not implemented.");
    }
    delete() {
      this.store.remove(this);
    }
    addEdge(edgeType, target, index = -1) {
      if (index < -1 || index > this.getEdges().length - 1) {
        throw new Error("Index out of bounds");
      }
      if (index === -1) {
        return this.mutate({ ...this.value, children: [...this.getEdges(), [edgeType, target]] });
      } else {
        const newEdges = [...this.getEdges()];
        newEdges.splice(index, 0, [edgeType, target]);
        return this.mutate({ ...this.value, children: newEdges });
      }
    }
    removeEdge(edgeType, target) {
      return this.mutate({ ...this.value, children: this.getEdges().filter((item) => item[0] == edgeType && item[1] === target) });
    }
    removeEdgeByIndex(index) {
      if (index < 0 || index > this.getEdges().length - 1) {
        throw new Error("Index out of bounds");
      }
      const newEdges = [...this.getEdges()];
      newEdges.splice(index, 1);
      return this.mutate({ ...this.value, children: newEdges });
    }
    updateEdge(oldEdgeType, oldTarget, newEdgeType, newTarget) {
      const updated = this.mutate({ ...this.value, children: this.getEdges().map((item) => item[0] === oldEdgeType && item[1] === oldTarget ? [newEdgeType, newTarget] : item) });
      return updated;
    }
    orderEdges(orderArray) {
      if (orderArray.length != this.getEdges().length) {
        throw new Error("Order array length must match the number of edges");
      }
      const orderedEdges = orderArray.map((i2) => this.getEdges()[i2]).map((edge) => {
        if (edge === void 0) {
          throw new Error("Edge not found");
        }
        return edge;
      });
      return this.mutate({ ...this.value, children: orderedEdges });
    }
    addExpression(expression) {
      return this.addEdge(expression.instructionNode.getId(), expression.targetNode.getId());
    }
    removeExpression(expression) {
      return this.removeEdge(expression.instructionNode.getId(), expression.targetNode.getId());
    }
    updateExpression(oldExpression, newExpression) {
      return this.updateEdge(oldExpression.instructionNode.getId(), oldExpression.targetNode.getId(), newExpression.instructionNode.getId(), newExpression.targetNode.getId());
    }
    updateData(data) {
      return this.mutate({ ...this.value, data: { ...this.value.data, ...data } });
    }
    equals(node) {
      return this.getId() === node.getId();
    }
    getEdgeNodes(edge) {
      if (!edge) {
        throw new Error("Edge is not defined");
      }
      const [edgeType, target] = edge;
      const instructionNode = this.store.getNodeByAddress(edgeType);
      if (!instructionNode) {
        throw new Error("Instruction Node not found");
      }
      const targetNode = this.store.getNodeByAddress(target);
      if (!targetNode) {
        throw new Error("Target Node not found");
      }
      return [instructionNode, targetNode];
    }
    dereferenceNodes() {
      const target = this.getEdges().find(([edgeType, target2]) => edgeType === this.store.primitive.targetPointerConstructor.getId());
      if (!target) {
        throw new Error("Target not found");
      }
      const targetNode = this.store.getNodeByAddress(target[1]);
      if (!targetNode) {
        throw new Error("Target Node not found");
      }
      const instruction = this.getEdges().find(([edgeType, target2]) => edgeType === this.store.primitive.instructionPointerConstructor.getId());
      if (!instruction) {
        throw new Error("Instruction not found");
      }
      const instructionNode = this.store.getNodeByAddress(instruction[1]);
      if (!instructionNode) {
        throw new Error("Instruction Node not found");
      }
      const prevTarget = this.getEdges().find(([edgeType, target2]) => edgeType === this.store.primitive.prevTargetPointerConstructor.getId());
      if (prevTarget) {
        const prevTargetNode = this.store.getNodeByAddress(prevTarget[1]);
        if (prevTargetNode) {
          return { instruction: instructionNode, target: targetNode, prev: prevTargetNode };
        }
      }
      const prev = this.getEdges().find(([edgeType, target2]) => edgeType === this.store.primitive.previousVersion.getId());
      if (!prev) {
        throw new Error("Previous Node not found");
      }
      const prevNode = this.store.getNodeByAddress(prev[1]);
      if (!prevNode) {
        throw new Error("Previous Node not found");
      }
      return { instruction: instructionNode, target: targetNode, prev: prevNode };
    }
    setAliasInfo(info) {
      let hadTarget = false;
      let hadInstruction = false;
      let hadPrev = false;
      const newEdges = this.getEdges().map(([edgeType, target]) => {
        if (edgeType === this.store.primitive.targetPointerConstructor.getId()) {
          hadTarget = true;
          const newEdge = [edgeType, info.target.getId()];
          console.log("newEdge - target", newEdge);
          return newEdge;
        }
        if (edgeType === this.store.primitive.instructionPointerConstructor.getId()) {
          hadInstruction = true;
          const newEdge = [edgeType, info.instruction.getId()];
          console.log("newEdge - aliasInstruction", newEdge);
          return newEdge;
        }
        if (edgeType === this.store.primitive.previousVersion.getId()) {
          const newEdge = [edgeType, info.prev.getId()];
          console.log("newEdge - prev", newEdge);
          return newEdge;
        }
        return [edgeType, target];
      });
      if (!hadTarget) {
        throw new Error("Trying to set alias info on node without target");
      }
      if (!hadInstruction) {
        throw new Error("Trying to set alias info on node without instruction");
      }
      const newContent = {
        data: {
          ...this.value.data,
          updated: {
            time: Date.now()
          }
        },
        children: newEdges
      };
      return this.mutate(newContent);
    }
    getCommitNode() {
      let hadPrev = false;
      const newEdges = this.getEdges().map((edge) => {
        if (edge[0] === this.store.primitive.previousVersion.getId()) {
          hadPrev = true;
          return [this.store.primitive.previousVersion.getId(), this.getId()];
        }
        return edge;
      });
      if (!hadPrev) {
        throw new Error("Trying to create commit on node without history");
      }
      const newContent = {
        data: {
          ...this.value.data,
          updated: {
            time: Date.now()
          }
        },
        children: newEdges
      };
      return this.mutate(newContent);
    }
    // revertToPreviousVersion(n: number): FosNode {
    //   const prevNodes = this.prevList()
    //   if (prevNodes.length < n) {
    //     throw new Error("Not enough previous versions")
    //   }
    //   const prevNode = prevNodes[n]
    //   if (!prevNode) {
    //     throw new Error("Previous node not found")
    //   }
    //   const newContent: FosNodeContent = {
    //     data: {
    //       ...prevNode.value.data,
    //       updated: {
    //         time: Date.now()
    //       },
    //       reversion: {
    //         reversionedToAddress: prevNode.getId(),
    //         nStepsBack: n
    //       }
    //     },
    //     children: prevNode.getEdges()
    //   }
    //   const newNode = new FosNode(newContent, this.store, this.alias)
    //   return newNode
    // }
    // getPeers(): FosNode[] {
    //   const peers = this.getEdges().filter(([edgeType, target]) => edgeType === this.store.primitive.peerNode.getId())
    //   return peers.map(([edgeType, target]) => {
    //     const node = this.store.getNodeByAddress(target)
    //     if (!node) {
    //       throw new Error("Node not found")
    //     }
    //     return node
    //   })
    // }
    // addComment(comment: string): [FosNode, FosNode] {
    //   const newCommentData: FosNodeContent = {
    //     data: {
    //       ...this.value.data,
    //       comment: {
    //         content: comment,
    //         authorID: this.store.rootTarget.getId(),
    //         authorName: "Profile Not Created",
    //         time: Date.now(),
    //         votes: {}
    //       },
    //       updated: {
    //         time: Date.now()
    //       },
    //     },
    //     children: []
    //   }
    //   const newNode = new FosNode(newCommentData, this.store)
    //   const thisNewNode = this.addEdge(this.store.primitive.commentConstructor.getId(), newNode.getId())
    //   return [thisNewNode, newNode]
    // }
    addTodo(description) {
      const newTodoData = {
        data: {
          ...this.value.data,
          updated: {
            time: Date.now()
          },
          description: {
            content: description
          }
        },
        children: []
      };
      const newNode = this.store.create(newTodoData);
      const thisNewNode = this.addEdge(newNode.getId(), this.store.primitive.completeField.getId());
      return [thisNewNode, newNode];
    }
    // getComments(): FosNode[] {
    //   const comments = this.getEdges().filter(([edgeType, target]) => edgeType === this.store.primitive.commentConstructor.getId())
    //   return comments.map(([edgeType, target]) => {
    //     const node = this.store.getNodeByAddress(target)
    //     if (!node) {
    //       throw new Error("Node not found")
    //     }
    //     return node
    //   })
    // }
  };

  // ../shared/dag-implementation/primitive-node.ts
  init_prelude();
  init_esm_browser();
  var getTerminalNode = (store) => {
    const terminalNode = store.create({
      data: {},
      children: []
    }, "TERMINAL");
    return terminalNode;
  };
  var getUnitNode = (store) => {
    const terminalNode = getTerminalNode(store);
    const unitNode = store.create({
      data: {},
      children: [[terminalNode.getId(), terminalNode.getId()]]
    }, "UNIT");
    return unitNode;
  };
  var getAllOfNode = (store) => {
    const unitNode = getUnitNode(store);
    const allOfNode = store.create({
      data: {},
      children: [[unitNode.getId(), unitNode.getId()]]
    });
    return allOfNode;
  };
  var getStartRootAlias = (store, primitives) => {
    const newUuid = v4_default();
    const aliasNode = store.create({
      data: {
        alias: {
          id: newUuid
        }
      },
      children: [
        [primitives.targetPointerConstructor.getId(), primitives.terminal.getId()],
        [primitives.instructionPointerConstructor.getId(), primitives.rootInstructionNode.getId()],
        [primitives.previousVersion.getId(), primitives.terminal.getId()]
      ]
    });
    return aliasNode;
  };
  var getPreviousVersionNode = (store) => generateConstructor(store, "PREV", { description: { content: "Previous Version Constructor" } }, []);
  var getFieldFieldNode = (store) => generateConstructor(store, "FIELD", { description: { content: "Field Field Constructor" } }, []);
  var getStringFieldNode = (store) => generateConstructor(store, "STRING", { description: { content: "String Field Constructor" } }, []);
  var getDescriptionFieldNode = (store) => generateConstructor(store, "DESCRIPTION", { description: { content: "String Field Constructor" } }, [
    [getFieldFieldNode, getStringFieldNode]
  ]);
  var getNameFieldNode = (store) => generateConstructor(store, "NAME", { description: { content: "Name Field Constructor" } }, [
    [getFieldFieldNode, getStringFieldNode]
  ]);
  var getWorkflowInstructionNode = (store) => generateConstructor(store, "WORKFLOW", { description: { content: "Option Not Selected Constructor" } }, []);
  var getRootInstructionNode = (store) => generateConstructor(store, "ROOT", { description: { content: "Root Instruction Constructor" } }, []);
  var getCommentInstructionNode = (store) => generateConstructor(store, "COMMENT", { description: { content: "Comment Constructor" } }, []);
  var getDocumentInstructionNode = (store) => generateConstructor(store, "DOCUMENT", { description: { content: "Document Constructor" } }, []);
  var getOptionSelectedConstructor = (store) => generateConstructor(store, "SELECTED", { description: { content: "Option Selected Constructor" } }, []);
  var getOptionNotSelectedConstructor = (store) => generateConstructor(store, "NOTSELECTED", { description: { content: "Option Not Selected Constructor" } }, []);
  var getChoiceTargetNode = (store) => generateConstructor(store, "CHOICE", { description: { content: "Option Choice Target" } }, [
    // [store.optionSelectedConstructor.getId(), ],
    // [store.optionNotSelectedConstructor.getId(), ]
  ]);
  var getTimeIntervalNode = (store) => generateConstructor(store, "TIMEINTERVAL", { description: { content: "Time Interval Constructor" } }, []);
  var getCompleteFieldNode = (store) => generateConstructor(store, "COMPLETION", { description: { content: "Complete Field Constructor" } }, []);
  var getLinkActionNode = (store) => generateConstructor(store, "LINKACTION", { description: { content: "Link Action Constructor" } }, []);
  var getCopyActionNode = (store) => generateConstructor(store, "COPY", { description: { content: "Copy Action Constructor" } }, []);
  var getApprovalFieldNode = (store) => generateConstructor(store, "APPROVAL", { description: { content: "Approval Field Constructor" } }, []);
  var getVoteFieldNode = (store) => generateConstructor(store, "VOTE", { description: { content: "Vote Field Constructor" } }, []);
  var getContactFieldNode = (store) => generateConstructor(store, "CONTACT", { description: { content: "Contact Field Constructor" } }, []);
  var getRoleFieldNode = (store) => generateConstructor(store, "ROLE", { description: { content: "Role Field Constructor" } }, []);
  var getGroupFieldNode = (store) => generateConstructor(store, "GROUP", { description: { content: "Group Field Constructor" } }, []);
  var getPersonFieldNode = (store) => generateConstructor(store, "PERSON", { description: { content: "Person Field Constructor" } }, []);
  var getListFieldNode = (store) => generateConstructor(store, "LIST", { description: { content: "List Field Constructor" } }, []);
  var getNumberFieldNode = (store) => generateConstructor(store, "NUMBER", { description: { content: "Number Field Constructor" } }, []);
  var getBooleanFieldNode = (store) => generateConstructor(store, "BOOLEAN", { description: { content: "Boolean Field Constructor" } }, []);
  var getLinkFieldNode = (store) => generateConstructor(store, "LINK", { description: { content: "Link Field Constructor" } }, []);
  var getCommentFieldNode = (store) => generateConstructor(store, "COMMENT", { description: { content: "Comment Field Constructor - a row that comments on its parent; may hold sub-comments" } }, []);
  var getRequirementFieldNode = (store) => generateConstructor(store, "REQUIREMENT", { description: { content: "Requirement Field Constructor - a capability or effect handler a task needs supplied before completion" } }, []);
  var getSupplyFieldNode = (store) => generateConstructor(store, "SUPPLY", { description: { content: "Supply Field Constructor - satisfies a requirement (confirmation, choice, search result, allocation)" } }, []);
  var getQueryFieldNode = (store) => generateConstructor(store, "QUERY", { description: { content: "Query Field Constructor - a semantic search whose results are reference rows" } }, []);
  var getResourceFieldNode = (store) => generateConstructor(store, "RESOURCE", { description: { content: "Resource Field Constructor - a calendar, account or inventory bank" } }, []);
  var getAllocationFieldNode = (store) => generateConstructor(store, "ALLOCATION", { description: { content: "Allocation Field Constructor - an amount locked from a resource bank" } }, []);
  var getTemplateFieldNode = (store) => generateConstructor(store, "TEMPLATE", { description: { content: "Template Field Constructor - a row whose requirement children are copied under every task that executes it" } }, []);
  var getDirectConnectCapabilityNode = (store) => generateConstructor(store, "DIRECTCONNECT", { description: { content: "Capability - reachable device to device (WebRTC data channel)" } }, []);
  var getHttpConnectCapabilityNode = (store) => generateConstructor(store, "HTTPCONNECT", { description: { content: "Capability - reachable over HTTP (a server exposes it)" } }, []);
  var getWsConnectCapabilityNode = (store) => generateConstructor(store, "WSCONNECT", { description: { content: "Capability - reachable over WebSockets (a server exposes it)" } }, []);
  var getRelayCapabilityNode = (store) => generateConstructor(store, "RELAY", { description: { content: "Capability - relays messages for peers that cannot reach each other (the fos server always has it)" } }, []);
  var getSearchCapabilityNode = (store) => generateConstructor(store, "SEARCHCAPABILITY", { description: { content: "Capability - runs search requirements (semantic search over rows)" } }, []);
  var getMarketCapabilityNode = (store) => generateConstructor(store, "MARKETCAPABILITY", { description: { content: "Capability - lists tasks on the market and brings back proposals" } }, []);
  var getMailCapabilityNode = (store) => generateConstructor(store, "MAILCAPABILITY", { description: { content: "Capability - sends mail for mail requirements" } }, []);
  var getReadCapabilityNode = (store) => generateConstructor(store, "READ", { description: { content: "Capability - may read the content of the node" } }, []);
  var getReadRequestsCapabilityNode = (store) => generateConstructor(store, "READREQUESTS", { description: { content: "Capability - may read the requests (proposals) addressed to it on the node" } }, []);
  var getAutopushCapabilityNode = (store) => generateConstructor(store, "AUTOPUSH", { description: { content: "Capability - changes flow automatically on sync (merged), rather than only as explicit proposals" } }, []);
  var getAcceptsNode = (store) => generateConstructor(store, "ACCEPTS", { description: { content: "Accepts - the owner accepts this capability from the member (what may flow in from that peer)" } }, []);
  var getDurationFieldNode = (store) => generateConstructor(store, "DURATION", { description: { content: "Duration Field Constructor" } }, []);
  var getDateFieldNode = (store) => generateConstructor(store, "DATE", { description: { content: "Date Field Constructor" } }, []);
  var getTimeFieldNode = (store) => generateConstructor(store, "TIME", { description: { content: "Time Field Constructor" } }, []);
  var getEmailFieldNode = (store) => generateConstructor(store, "EMAIL", { description: { content: "Email Field Constructor" } }, []);
  var getPhoneFieldNode = (store) => generateConstructor(store, "PHONE", { description: { content: "Phone Field Constructor" } }, []);
  var getAddressFieldNode = (store) => generateConstructor(store, "ADDRESS", { description: { content: "Address Field Constructor" } }, []);
  var getPriceFieldNode = (store) => generateConstructor(store, "PRICE", { description: { content: "Price Field Constructor" } }, []);
  var getCurrencyFieldNode = (store) => generateConstructor(store, "CURRENCY", { description: { content: "Currency Field Constructor" } }, []);
  var getBusinessFieldNode = (store) => generateConstructor(store, "BUSINESS", { description: { content: "Business Field Constructor" } }, []);
  var getBusinessNameFieldNode = (store) => generateConstructor(store, "BUSINESSNAME", { description: { content: "Business Name Field Constructor" } }, []);
  var getPaymentFieldNode = (store) => generateConstructor(store, "PAYMENT", { description: { content: "Payment Field Constructor" } }, []);
  var getMarketServiceListingNode = (store) => generateConstructor(store, "MARKETSERVICE", { description: { content: "Market Listing Constructor" } }, []);
  var getMarketRequestListingNode = (store) => generateConstructor(store, "MARKETREQUEST", { description: { content: "Market Request Listing Constructor" } }, []);
  var getInvoiceFieldNode = (store) => generateConstructor(store, "INVOICE", { description: { content: "Invoice Field Constructor" } }, []);
  var getInvoiceCommentFieldNode = (store) => generateConstructor(store, "INVOICECOMMENT", { description: { content: "Invoice Comment Field Constructor" } }, []);
  var getProjectFieldNode = (store) => generateConstructor(store, "PROJECT", { description: { content: "Project Field Constructor" } }, []);
  var getActionFieldNode = (store) => generateConstructor(store, "ACTION", { description: { content: "Action Field Constructor" } }, []);
  var getCompleteActionNode = (store) => generateConstructor(store, "COMPLETE", { description: { content: "Complete Action Constructor" } }, []);
  var getStartActionNode = (store) => generateConstructor(store, "START", { description: { content: "Start Action Constructor" } }, []);
  var getStopActionNode = (store) => generateConstructor(store, "STOP", { description: { content: "Stop Action Constructor" } }, []);
  var getPauseActionNode = (store) => generateConstructor(store, "PAUSE", { description: { content: "Pause Action Constructor" } }, []);
  var getCancelActionNode = (store) => generateConstructor(store, "CANCEL", { description: { content: "Cancel Action Constructor" } }, []);
  var getResumeActionNode = (store) => generateConstructor(store, "RESUME", { description: { content: "Resume Action Constructor" } }, []);
  var getInputActionNode = (store) => generateConstructor(store, "INPUT", { description: { content: "Input Action Constructor" } }, []);
  var getApproveActionNode = (store) => generateConstructor(store, "APPROVE", { description: { content: "Approve Action Constructor" } }, []);
  var getProposeActionNode = (store) => generateConstructor(store, "PROPOSE", { description: { content: "Propose Action Constructor - may propose changes to a link node" } }, []);
  var getProposalFieldNode = (store) => generateConstructor(store, "PROPOSAL", { description: { content: "Proposal Field Constructor" } }, []);
  var getRevisionFieldNode = (store) => generateConstructor(store, "REVISION", { description: { content: "Revision Field Constructor" } }, []);
  var getPeerFieldNode = (store) => generateConstructor(store, "PEER", { description: { content: "Peer Reference Constructor" } }, []);
  var getMemberFieldNode = (store) => generateConstructor(store, "MEMBER", { description: { content: "Member Edge Constructor - points to peer reference" } }, []);
  var getPeerIdFieldNode = (store) => generateConstructor(store, "PEERID", { description: { content: "Peer ID Field" } }, []);
  var getPeerPublicKeyFieldNode = (store) => generateConstructor(store, "PEERPUBKEY", { description: { content: "Peer Public Key Field" } }, []);
  var getProposedContentNode = (store) => generateConstructor(store, "PROPOSEDCONTENT", { description: { content: "Proposed Content Constructor" } }, []);
  var getProposalNameNode = (store) => generateConstructor(store, "PROPOSALNAME", { description: { content: "Proposal/Branch Name Constructor" } }, []);
  var getParentBranchNode = (store) => generateConstructor(store, "PARENTBRANCH", { description: { content: "Parent Branch Constructor" } }, []);
  var getSenderNode = (store) => generateConstructor(store, "SENDER", { description: { content: "Sender Constructor (peer ID)" } }, []);
  var getTimestampNode = (store) => generateConstructor(store, "TIMESTAMP", { description: { content: "Timestamp Constructor" } }, []);
  var getSignatureNode = (store) => generateConstructor(store, "SIGNATURE", { description: { content: "Signature Constructor (Ed25519)" } }, []);
  var getTransactionFieldNode = (store) => generateConstructor(store, "TRANSACTION", { description: { content: "Transaction Field Constructor" } }, []);
  var getLabelFieldNode = (store) => generateConstructor(store, "LABEL", { description: { content: "Label Field Constructor" } }, []);
  var getComboFieldNode = (store) => generateConstructor(store, "COMBO", { description: { content: "Combo Field Constructor" } }, []);
  var getTagFieldNode = (store) => generateConstructor(store, "TAG", { description: { content: "Tag Field Constructor" } }, []);
  var getInvoiceLineFieldNode = (store) => generateConstructor(store, "INVOICECOMMENT", { description: { content: "Invoice Comment Field Constructor" } }, []);
  var getInvoiceItemLineFieldNode = (store) => generateConstructor(store, "INVOICEITEM", { description: { content: "Invoice Item Field Constructor" } }, []);
  var getReceiptLineFieldNode = (store) => generateConstructor(store, "RECEIPT", { description: { content: "Receipt Field Constructor" } }, []);
  var getExpressionFieldNode = (store) => generateConstructor(store, "EXPRESSION", { description: { content: "Expression Field Constructor" } }, []);
  var getFirstNameFieldNode = (store) => generateConstructor(store, "FIRSTNAME", { description: { content: "First Name Field Constructor" } }, []);
  var getLastNameFieldNode = (store) => generateConstructor(store, "LASTNAME", { description: { content: "Last Name Field Constructor" } }, []);
  var getMiddleNameFieldNode = (store) => generateConstructor(store, "MIDDLENAME", { description: { content: "Middle Name Field Constructor" } }, []);
  var getSearchQueryNode = (store) => generateConstructor(store, "SEARCHQUERY", { description: { content: "Search Query Constructor" } }, []);
  var getSearchResultsNode = (store) => generateConstructor(store, "SEARCHRESULT", { description: { content: "Search Result Constructor" } }, []);
  var getErrorNode = (store) => generateConstructor(store, "ERROR", { description: { content: "Error Constructor" } }, []);
  var getPeerNode = (store) => generateConstructor(store, "PEER", { description: { content: "Peer Constructor" } }, []);
  var getRevertChangeNode = (store) => generateConstructor(store, "REVERT", { description: { content: "Revert Change Constructor" } }, []);
  var getPublishNode = (store) => generateConstructor(store, "PUBLISH", { description: { content: "Publish Constructor" } }, []);
  var getAppNode = (store) => generateConstructor(store, "APP", { description: { content: "App Constructor" } }, []);
  var getSubscriptionNode = (store) => generateConstructor(store, "SUBSCRIPTION", { description: { content: "Subscription Constructor" } }, []);
  var getOneTimeBuyNode = (store) => generateConstructor(store, "ONETIMEBUY", { description: { content: "One Time Buy Constructor" } }, []);
  var getRecurringBuyNode = (store) => generateConstructor(store, "RECURRINGBUY", { description: { content: "Recurring Buy Constructor" } }, []);
  var getConflictNode = (store) => generateConstructor(store, "CONFLICT", { description: { content: "Conflict Constructor" } }, []);
  var getPeriodicTriggerNode = (store) => generateConstructor(store, "PERIODIC", { description: { content: "Periodic Trigger Constructor" } }, []);
  var getRequestTriggerNode = (store) => generateConstructor(store, "REQUEST", { description: { content: "Request Trigger Constructor" } }, []);
  var getManualTriggerNode = (store) => generateConstructor(store, "MANUAL", { description: { content: "Manual Trigger Constructor" } }, []);
  var getDailyTriggerNode = (store) => generateConstructor(store, "DAILY", { description: { content: "Daily Trigger Constructor" } }, []);
  var getWeeklyTriggerNode = (store) => generateConstructor(store, "WEEKLY", { description: { content: "Weekly Trigger Constructor" } }, []);
  var getMonthlyTriggerNode = (store) => generateConstructor(store, "MONTHLY", { description: { content: "Monthly Trigger Constructor" } }, []);
  var getYearlyTriggerNode = (store) => generateConstructor(store, "YEARLY", { description: { content: "Yearly Trigger Constructor" } }, []);
  var getDelayTriggerNode = (store) => generateConstructor(store, "DELAY", { description: { content: "Delay Trigger Constructor" } }, []);
  var getGroupShadowNode = (store) => generateConstructor(store, "GROUPSHADOW", { description: { content: "Group Shadow Constructor" } }, []);
  var getDereferenceAliasActionNode = (store) => generateConstructor(store, "DEREFALIAS", { description: { content: "Dereference Alias Node" } }, []);
  var getAliasConstructorNode = (store) => generateConstructor(store, "ALIAS", { description: { content: "Alias Constructor Node" } }, []);
  var getTargetPointerConstructorNode = (store) => generateConstructor(store, "TARGETPOINTER", { description: { content: "Target Constructor Node" } }, []);
  var getInstructionPointerConstructorNode = (store) => generateConstructor(store, "INSTRUCTIONPOINTER", { description: { content: "Alias Instruction Constructor Node" } }, []);
  var getBrachConstructorNode = (store) => generateConstructor(store, "BRANCH", { description: { content: "Branch Constructor Node" } }, []);
  var createGroupAction = (store) => generateConstructor(store, "CREATEGROUP", { description: { content: "Create Group Action Node" } }, []);
  var addMemberToGroupAction = (store) => generateConstructor(store, "ADDMEMBERTOGROUP", { description: { content: "Add Member To Group Action Node" } }, []);
  var removeMemberFromGroupAction = (store) => generateConstructor(store, "REMOVEMEMBERFROMGROUP", { description: { content: "Remove Member From Group Action Node" } }, []);
  var createDMAction = (store) => generateConstructor(store, "CREATEDM", { description: { content: "Create DM Action Node" } }, []);
  var sendGroupMessageAction = (store) => generateConstructor(store, "SENDGROUPMESSAGE", { description: { content: "Send Group Message Action Node" } }, []);
  var getUpdateActionNode = (store) => generateConstructor(store, "UPDATE", { description: { content: "Update Action Node" } }, []);
  var getPrevInstructionPointerConstructor = (store) => generateConstructor(store, "PREVINSTPTR", { description: { content: "Previous Instruction Pointer Constructor" } }, []);
  var getPrevTargetPointerConstructor = (store) => generateConstructor(store, "PREVTRGTPTR", { description: { content: "Previous Target Pointer Constructor" } }, []);
  var getFactNode = (store) => generateConstructor(store, "FACT", { description: { content: "Fact - Ground truth in scope" } }, []);
  var getRuleNode = (store) => generateConstructor(store, "RULE", { description: { content: "Rule - Derivation rule" } }, []);
  var getRuleHeadNode = (store) => generateConstructor(store, "RULEHEAD", { description: { content: "Rule Head - What this rule derives" } }, []);
  var getRuleBodyNode = (store) => generateConstructor(store, "RULEBODY", { description: { content: "Rule Body - Conditions to match" } }, []);
  var getVariableNode = (store) => generateConstructor(store, "VARIABLE", { description: { content: "Variable - Unbound query variable" } }, []);
  var getQueryNode = (store) => generateConstructor(store, "QUERY", { description: { content: "Query - Query against scope" } }, []);
  var getBindingNode = (store) => generateConstructor(store, "BINDING", { description: { content: "Binding - Variable binding result" } }, []);
  var getScopeNode = (store) => generateConstructor(store, "SCOPE", { description: { content: "Scope - Datalog database container" } }, []);
  var getParentScopeNode = (store) => generateConstructor(store, "PARENTSCOPE", { description: { content: "Parent Scope - Lexical parent" } }, []);
  var getAssertNode = (store) => generateConstructor(store, "ASSERT", { description: { content: "Assert - Add fact to scope" } }, []);
  var getRetractNode = (store) => generateConstructor(store, "RETRACT", { description: { content: "Retract - Remove fact from scope" } }, []);
  var getTaskEffectNode = (store) => generateConstructor(store, "TASKEFFECT", { description: { content: "Task Effect - On-complete effects" } }, []);
  var getCompletedNode = (store) => generateConstructor(store, "COMPLETED", { description: { content: "Completed - Task completion marker" } }, []);
  var getCommitNode = (store) => generateConstructor(store, "COMMIT", { description: { content: "Commit - Versioned snapshot" } }, []);
  var getHeadNode = (store) => generateConstructor(store, "HEAD", { description: { content: "Head - Current branch pointer" } }, []);
  var getMergeNode = (store) => generateConstructor(store, "MERGE", { description: { content: "Merge - Branch merge operation" } }, []);
  var getMergeSourceNode = (store) => generateConstructor(store, "MERGESOURCE", { description: { content: "Merge Source - Branch being merged" } }, []);
  var getAncestorNode = (store) => generateConstructor(store, "ANCESTOR", { description: { content: "Ancestor - Common ancestor" } }, []);
  var getHistoryNode = (store) => generateConstructor(store, "HISTORY", { description: { content: "History - Version history container" } }, []);
  var getBranchNameNode = (store) => generateConstructor(store, "BRANCHNAME", { description: { content: "Branch Name - Branch identifier" } }, []);
  var getTagNode = (store) => generateConstructor(store, "TAG", { description: { content: "Tag - Named commit reference" } }, []);
  var getConflictOursNode = (store) => generateConstructor(store, "CONFLICTOURS", { description: { content: "Conflict Ours - Local version" } }, []);
  var getConflictTheirsNode = (store) => generateConstructor(store, "CONFLICTTHEIRS", { description: { content: "Conflict Theirs - Remote version" } }, []);
  var getConflictBaseNode = (store) => generateConstructor(store, "CONFLICTBASE", { description: { content: "Conflict Base - Common ancestor version" } }, []);
  var getLinearNode = (store) => generateConstructor(store, "LINEAR", { description: { content: "Linear - Must be consumed exactly once" } }, []);
  var getConsumeNode = (store) => generateConstructor(store, "CONSUME", { description: { content: "Consume - Use linear value" } }, []);
  var getSplitNode = (store) => generateConstructor(store, "SPLIT", { description: { content: "Split - Divide linear value" } }, []);
  var getSendNode = (store) => generateConstructor(store, "SEND", { description: { content: "Send - Send value in protocol" } }, []);
  var getRecvNode = (store) => generateConstructor(store, "RECV", { description: { content: "Recv - Receive value in protocol" } }, []);
  var getChoiceNode = (store) => generateConstructor(store, "CHOICE", { description: { content: "Choice - Offer selection" } }, []);
  var getSelectNode = (store) => generateConstructor(store, "SELECT", { description: { content: "Select - Make selection" } }, []);
  var getEndNode = (store) => generateConstructor(store, "END", { description: { content: "End - Session complete" } }, []);
  var getDualNode = (store) => generateConstructor(store, "DUAL", { description: { content: "Dual - Opposite session type" } }, []);
  var getBudgetNode = (store) => generateConstructor(store, "BUDGET", { description: { content: "Budget - Linear monetary resource" } }, []);
  var getCalendarNode = (store) => generateConstructor(store, "CALENDAR", { description: { content: "Calendar - Linear time resource" } }, []);
  var getAllocationNode = (store) => generateConstructor(store, "ALLOCATION", { description: { content: "Allocation - Resource sub-division" } }, []);
  var getBalanceNode = (store) => generateConstructor(store, "BALANCE", { description: { content: "Balance - Current budget amount" } }, []);
  var getSpentNode = (store) => generateConstructor(store, "SPENT", { description: { content: "Spent - Consumed budget amount" } }, []);
  var getTimeslotNode = (store) => generateConstructor(store, "TIMESLOT", { description: { content: "Timeslot - Calendar time period" } }, []);
  var getAvailableNode = (store) => generateConstructor(store, "AVAILABLE", { description: { content: "Available - Remaining resource" } }, []);
  var getBoxNode = (store) => generateConstructor(store, "BOX", { description: { content: "Box - Modal necessity" } }, []);
  var getDiamondNode = (store) => generateConstructor(store, "DIAMOND", { description: { content: "Diamond - Modal possibility" } }, []);
  var getModalityNode = (store) => generateConstructor(store, "MODALITY", { description: { content: "Modality - Storage context" } }, []);
  var getLocalModNode = (store) => generateConstructor(store, "LOCALMOD", { description: { content: "Local Modality - Local .fos storage" } }, []);
  var getHomeModNode = (store) => generateConstructor(store, "HOMEMOD", { description: { content: "Home Modality - ~/.fos storage" } }, []);
  var getOnlineModNode = (store) => generateConstructor(store, "ONLINEMOD", { description: { content: "Online Modality - Server storage" } }, []);
  var getPeerModNode = (store) => generateConstructor(store, "PEERMOD", { description: { content: "Peer Modality - Peer storage" } }, []);
  var getUnboxNode = (store) => generateConstructor(store, "UNBOX", { description: { content: "Unbox - Extract modal value" } }, []);
  var getActorNode = (store) => generateConstructor(store, "ACTOR", { description: { content: "Actor - Protocol participant" } }, []);
  var getCapabilityNode = (store) => generateConstructor(store, "CAPABILITY", { description: { content: "Capability - Actor capability" } }, []);
  var getEffectNode = (store) => generateConstructor(store, "EFFECT", { description: { content: "Effect - Side effect" } }, []);
  var getHandlerNode = (store) => generateConstructor(store, "HANDLER", { description: { content: "Handler - Effect handler" } }, []);
  var generateConstructor = (store, alias, data, children) => {
    const constructedChildren = children.map(([left, right]) => [left(store).getId(), right(store).getId()]);
    const nodeContent = {
      data,
      children: constructedChildren
    };
    const newNode = store.create(nodeContent, alias);
    if (!newNode) throw new Error("could not create node");
    return newNode;
  };
  var constructPrimitiveAliases = (store) => {
    const voidNode = getTerminalNode(store);
    const terminal = getTerminalNode(store);
    const unit = getUnitNode(store);
    const previousVersion = getPreviousVersionNode(store);
    const fieldField = getFieldFieldNode(store);
    const stringField = getStringFieldNode(store);
    const descriptionField = getDescriptionFieldNode(store);
    const choiceTarget = getChoiceTargetNode(store);
    const linkField = getLinkFieldNode(store);
    const groupField = getGroupFieldNode(store);
    const roleField = getRoleFieldNode(store);
    const personField = getPersonFieldNode(store);
    const linkAction = getLinkActionNode(store);
    const copyAction = getCopyActionNode(store);
    const inputAction = getInputActionNode(store);
    const completeAction = getCompleteActionNode(store);
    const cancelAction = getCancelActionNode(store);
    const comboField = getComboFieldNode(store);
    const labelField = getLabelFieldNode(store);
    const numberField = getNumberFieldNode(store);
    const booleanField = getBooleanFieldNode(store);
    const listField = getListFieldNode(store);
    const completeField = getCompleteFieldNode(store);
    const approvalField = getApprovalFieldNode(store);
    const voteField = getVoteFieldNode(store);
    const workflowField = getWorkflowInstructionNode(store);
    const expressionField = getExpressionFieldNode(store);
    const contactField = getContactFieldNode(store);
    const emailField = getEmailFieldNode(store);
    const phoneField = getPhoneFieldNode(store);
    const addressField = getAddressFieldNode(store);
    const nameField = getNameFieldNode(store);
    const firstNameField = getFirstNameFieldNode(store);
    const lastNameField = getLastNameFieldNode(store);
    const middleNameField = getMiddleNameFieldNode(store);
    const businessField = getBusinessFieldNode(store);
    const businessNameField = getBusinessNameFieldNode(store);
    const dateField = getDateFieldNode(store);
    const timeField = getTimeFieldNode(store);
    const durationField = getDurationFieldNode(store);
    const invoiceLineField = getInvoiceLineFieldNode(store);
    const commentConstructor = getCommentInstructionNode(store);
    const timeIntervale = getTimeIntervalNode(store);
    const invoiceCommentsField = getInvoiceCommentFieldNode(store);
    const priceField = getPriceFieldNode(store);
    const currencyField = getCurrencyFieldNode(store);
    const invoiceNode = getInvoiceFieldNode(store);
    const documentField = getDocumentInstructionNode(store);
    const paymentNode = getPaymentFieldNode(store);
    const transactionNode = getTransactionFieldNode(store);
    const actionNode = getActionFieldNode(store);
    const optionSelectedConstructor = getOptionSelectedConstructor(store);
    const optionNotSelectedConstructor = getOptionNotSelectedConstructor(store);
    const tagField = getTagFieldNode(store);
    const optionConstructor = getOptionNotSelectedConstructor(store);
    const searchQueryNode = getSearchQueryNode(store);
    const searchResultsNode = getSearchResultsNode(store);
    const errorNode = getErrorNode(store);
    const peerNode = getPeerNode(store);
    const marketServiceNode = getMarketServiceListingNode(store);
    const marketRequestNode = getMarketRequestListingNode(store);
    const revertNode = getRevertChangeNode(store);
    const publishNode = getPublishNode(store);
    const appNode = getAppNode(store);
    const oneTimeBuyNode = getOneTimeBuyNode(store);
    const subscriptionNode = getSubscriptionNode(store);
    const recurringBuyNode = getRecurringBuyNode(store);
    const conflictNode = getConflictNode(store);
    const nameNode = getNameFieldNode(store);
    const allOfNode = getAllOfNode(store);
    const invoiceItemLineField = getInvoiceItemLineFieldNode(store);
    const receiptLineField = getReceiptLineFieldNode(store);
    const proposalField = getProposalFieldNode(store);
    const revisionField = getRevisionFieldNode(store);
    const projectField = getProjectFieldNode(store);
    const proposedContentField = getProposedContentNode(store);
    const proposalNameField = getProposalNameNode(store);
    const parentBranchField = getParentBranchNode(store);
    const senderField = getSenderNode(store);
    const timestampField = getTimestampNode(store);
    const signatureField = getSignatureNode(store);
    const peerField = getPeerFieldNode(store);
    const memberField = getMemberFieldNode(store);
    const peerIdField = getPeerIdFieldNode(store);
    const peerPublicKeyField = getPeerPublicKeyFieldNode(store);
    const periodicTrigger = getPeriodicTriggerNode(store);
    const requestTrigger = getRequestTriggerNode(store);
    const manualTrigger = getManualTriggerNode(store);
    const dailyTrigger = getDailyTriggerNode(store);
    const weeklyTrigger = getWeeklyTriggerNode(store);
    const monthlyTrigger = getMonthlyTriggerNode(store);
    const yearlyTrigger = getYearlyTriggerNode(store);
    const delayTrigger = getDelayTriggerNode(store);
    const startAction = getStartActionNode(store);
    const stopAction = getStopActionNode(store);
    const pauseAction = getPauseActionNode(store);
    const resumeAction = getResumeActionNode(store);
    const groupShadowNode = getGroupShadowNode(store);
    const aliasConstructor = getAliasConstructorNode(store);
    const targetPointerConstructor = getTargetPointerConstructorNode(store);
    const instructionPointerConstructor = getInstructionPointerConstructorNode(store);
    const dereferenceAlias = getDereferenceAliasActionNode(store);
    const rootInstructionNode = getRootInstructionNode(store);
    const startRootAlias = getStartRootAlias(store, {
      terminal,
      previousVersion,
      targetPointerConstructor,
      instructionPointerConstructor,
      rootInstructionNode
    });
    const brachConstructorNode = getBrachConstructorNode(store);
    const updateAction = getUpdateActionNode(store);
    const prevInstructionPointerConstructor = getPrevInstructionPointerConstructor(store);
    const prevTargetPointerConstructor = getPrevTargetPointerConstructor(store);
    const createGroupActionNode = createGroupAction(store);
    const addMemberToGroupActionNode = addMemberToGroupAction(store);
    const removeMemberFromGroupActionNode = removeMemberFromGroupAction(store);
    const createDMActionNode = createDMAction(store);
    const sendGroupMessageActionNode = sendGroupMessageAction(store);
    const factNode = getFactNode(store);
    const ruleNode = getRuleNode(store);
    const ruleHeadNode = getRuleHeadNode(store);
    const ruleBodyNode = getRuleBodyNode(store);
    const variableNode = getVariableNode(store);
    const queryNode = getQueryNode(store);
    const bindingNode = getBindingNode(store);
    const scopeNode = getScopeNode(store);
    const parentScopeNode = getParentScopeNode(store);
    const assertNode = getAssertNode(store);
    const retractNode = getRetractNode(store);
    const taskEffectNode = getTaskEffectNode(store);
    const completedNode = getCompletedNode(store);
    const commitNode = getCommitNode(store);
    const headNode = getHeadNode(store);
    const mergeNode2 = getMergeNode(store);
    const mergeSourceNode = getMergeSourceNode(store);
    const ancestorNode = getAncestorNode(store);
    const historyNode = getHistoryNode(store);
    const branchNameNode = getBranchNameNode(store);
    const tagNode = getTagNode(store);
    const conflictOursNode = getConflictOursNode(store);
    const conflictTheirsNode = getConflictTheirsNode(store);
    const conflictBaseNode = getConflictBaseNode(store);
    const linearNode = getLinearNode(store);
    const consumeNode = getConsumeNode(store);
    const splitNode = getSplitNode(store);
    const sendNode = getSendNode(store);
    const recvNode = getRecvNode(store);
    const choiceNode = getChoiceNode(store);
    const selectNode = getSelectNode(store);
    const endNode = getEndNode(store);
    const dualNode = getDualNode(store);
    const budgetNode = getBudgetNode(store);
    const calendarNode = getCalendarNode(store);
    const allocationNode = getAllocationNode(store);
    const balanceNode = getBalanceNode(store);
    const spentNode = getSpentNode(store);
    const timeslotNode = getTimeslotNode(store);
    const availableNode = getAvailableNode(store);
    const boxNode = getBoxNode(store);
    const diamondNode = getDiamondNode(store);
    const modalityNode = getModalityNode(store);
    const localModNode = getLocalModNode(store);
    const homeModNode = getHomeModNode(store);
    const onlineModNode = getOnlineModNode(store);
    const peerModNode = getPeerModNode(store);
    const unboxNode = getUnboxNode(store);
    const actorNode = getActorNode(store);
    const capabilityNode = getCapabilityNode(store);
    const proposeAction = getProposeActionNode(store);
    const commentField = getCommentFieldNode(store);
    const requirementField = getRequirementFieldNode(store);
    const supplyField = getSupplyFieldNode(store);
    const queryField = getQueryFieldNode(store);
    const resourceField = getResourceFieldNode(store);
    const allocationField = getAllocationFieldNode(store);
    const templateField = getTemplateFieldNode(store);
    const directConnectCapability = getDirectConnectCapabilityNode(store);
    const httpConnectCapability = getHttpConnectCapabilityNode(store);
    const wsConnectCapability = getWsConnectCapabilityNode(store);
    const relayCapability = getRelayCapabilityNode(store);
    const searchCapability = getSearchCapabilityNode(store);
    const marketCapability = getMarketCapabilityNode(store);
    const mailCapability = getMailCapabilityNode(store);
    const readCapability = getReadCapabilityNode(store);
    const readRequestsCapability = getReadRequestsCapabilityNode(store);
    const autopushCapability = getAutopushCapabilityNode(store);
    const acceptsNode = getAcceptsNode(store);
    const approveAction = getApproveActionNode(store);
    const effectNode = getEffectNode(store);
    const handlerNode = getHandlerNode(store);
    return {
      voidNode,
      terminal,
      unit,
      allOfNode,
      previousVersion,
      fieldField,
      stringField,
      descriptionField,
      choiceTarget,
      linkField,
      groupField,
      roleField,
      personField,
      linkAction,
      copyAction,
      inputAction,
      completeAction,
      cancelAction,
      comboField,
      labelField,
      numberField,
      booleanField,
      listField,
      completeField,
      approvalField,
      voteField,
      workflowField,
      expressionField,
      contactField,
      emailField,
      phoneField,
      addressField,
      nameField,
      firstNameField,
      lastNameField,
      middleNameField,
      businessField,
      businessNameField,
      dateField,
      timeField,
      durationField,
      invoiceLineField,
      commentConstructor,
      timeIntervale,
      invoiceCommentsField,
      priceField,
      currencyField,
      invoiceNode,
      documentField,
      paymentNode,
      transactionNode,
      actionNode,
      optionSelectedConstructor,
      optionNotSelectedConstructor,
      tagField,
      optionConstructor,
      searchQueryNode,
      searchResultsNode,
      errorNode,
      peerNode,
      marketServiceNode,
      marketRequestNode,
      revertNode,
      publishNode,
      appNode,
      oneTimeBuyNode,
      subscriptionNode,
      recurringBuyNode,
      conflictNode,
      nameNode,
      invoiceItemLineField,
      receiptLineField,
      proposalField,
      proposedContentField,
      proposalNameField,
      parentBranchField,
      senderField,
      timestampField,
      signatureField,
      peerField,
      memberField,
      peerIdField,
      peerPublicKeyField,
      revisionField,
      projectField,
      periodicTrigger,
      requestTrigger,
      manualTrigger,
      dailyTrigger,
      weeklyTrigger,
      monthlyTrigger,
      yearlyTrigger,
      delayTrigger,
      startAction,
      stopAction,
      pauseAction,
      resumeAction,
      groupShadowNode,
      aliasConstructor,
      targetPointerConstructor,
      instructionPointerConstructor,
      dereferenceAlias,
      getStartRootAlias,
      startRootAlias,
      brachConstructorNode,
      // allOf: getAllOfNode(store),
      updateAction,
      prevInstructionPointerConstructor,
      prevTargetPointerConstructor,
      rootInstructionNode,
      // Group actions
      createGroupActionNode,
      addMemberToGroupActionNode,
      removeMemberFromGroupActionNode,
      createDMActionNode,
      sendGroupMessageActionNode,
      // Datalog primitives
      factNode,
      ruleNode,
      ruleHeadNode,
      ruleBodyNode,
      variableNode,
      queryNode,
      bindingNode,
      scopeNode,
      parentScopeNode,
      assertNode,
      retractNode,
      taskEffectNode,
      completedNode,
      // Version control primitives
      commitNode,
      headNode,
      mergeNode: mergeNode2,
      mergeSourceNode,
      ancestorNode,
      historyNode,
      branchNameNode,
      tagNode,
      conflictOursNode,
      conflictTheirsNode,
      conflictBaseNode,
      // Linear type primitives
      linearNode,
      consumeNode,
      splitNode,
      // Session type primitives
      sendNode,
      recvNode,
      choiceNode,
      selectNode,
      endNode,
      dualNode,
      // Resource primitives
      budgetNode,
      calendarNode,
      allocationNode,
      balanceNode,
      spentNode,
      timeslotNode,
      availableNode,
      // Modal type primitives
      boxNode,
      diamondNode,
      modalityNode,
      localModNode,
      homeModNode,
      onlineModNode,
      peerModNode,
      unboxNode,
      // Actor primitives
      actorNode,
      capabilityNode,
      proposeAction,
      approveAction,
      commentField,
      requirementField,
      supplyField,
      queryField,
      resourceField,
      allocationField,
      templateField,
      directConnectCapability,
      httpConnectCapability,
      wsConnectCapability,
      relayCapability,
      searchCapability,
      marketCapability,
      mailCapability,
      readCapability,
      readRequestsCapability,
      autopushCapability,
      acceptsNode,
      effectNode,
      handlerNode
    };
  };

  // ../shared/dag-implementation/migrations.ts
  init_prelude();
  var MIGRATIONS = [
    {
      from: 0,
      to: 1,
      description: 'Prefix cids with their format version ("v1-"). Node data is unchanged; every node is rehashed because its edges now carry prefixed cids.'
    },
    {
      from: 1,
      to: 2,
      description: "Hash edges in order and direction so child order replicates. Node data is unchanged; stored edge order is kept as the canonical order."
    }
  ];
  var MigrationError = class extends Error {
    constructor(message, cid) {
      super(message);
      __publicField(this, "cid");
      this.name = "MigrationError";
      this.cid = cid;
    }
  };
  function needsMigration(nodes, target = CURRENT_CID_VERSION) {
    return Object.keys(nodes).some((cid) => cidVersion(cid) !== target);
  }
  function stepsBetween(from, to) {
    const steps = [];
    let at = from;
    while (at < to) {
      const step = MIGRATIONS.find((m) => m.from === at);
      if (!step) throw new Error(`no migration from cid version ${at}`);
      steps.push(step);
      at = step.to;
    }
    if (at !== to) throw new Error(`cannot migrate from cid version ${from} to ${to}`);
    return steps;
  }
  function migrateContext(context, target = CURRENT_CID_VERSION) {
    const input = context.nodes;
    const mapping = {};
    const output = {};
    const fromVersions = /* @__PURE__ */ new Set();
    const inProgress = /* @__PURE__ */ new Set();
    const migrate = (cid) => {
      const done = mapping[cid];
      if (done !== void 0) return done;
      const content2 = input[cid];
      if (!content2) throw new MigrationError(`node ${cid} referenced but not present in the context`, cid);
      if (inProgress.has(cid)) throw new MigrationError(`cycle through node ${cid}`, cid);
      inProgress.add(cid);
      const version2 = cidVersion(cid);
      if (version2 === null) throw new MigrationError(`node ${cid} is not a recognised cid`, cid);
      if (version2 > target) throw new MigrationError(`node ${cid} is newer (v${version2}) than the target format v${target}`, cid);
      fromVersions.add(version2);
      let upgraded = content2;
      for (const step of stepsBetween(version2, target)) {
        if (step.upgrade) upgraded = step.upgrade(upgraded);
      }
      const children = upgraded.children.map(([instr, targetCid]) => [migrate(instr), migrate(targetCid)]);
      const next = { ...upgraded, children };
      const unchanged = version2 === target && children.every((edge, i2) => edge[0] === upgraded.children[i2]?.[0] && edge[1] === upgraded.children[i2]?.[1]);
      const newCid = unchanged ? cid : hashContentAt(next, target);
      inProgress.delete(cid);
      mapping[cid] = newCid;
      output[newCid] = unchanged ? content2 : next;
      return newCid;
    };
    for (const cid of Object.keys(input)) migrate(cid);
    const remapPath = (path) => path.map(([a, b]) => [mapping[a] ?? a, mapping[b] ?? b]);
    const changed = {};
    for (const [oldCid, newCid] of Object.entries(mapping)) if (oldCid !== newCid) changed[oldCid] = newCid;
    return {
      context: {
        nodes: output,
        route: remapPath(context.route ?? []),
        rootNodeId: mapping[context.rootNodeId] ?? context.rootNodeId
      },
      mapping: changed,
      fromVersions: [...fromVersions].sort(),
      target
    };
  }

  // ../node_modules/@n1ru4l/json-patch-plus/esm/index.js
  init_prelude();

  // ../node_modules/@n1ru4l/json-patch-plus/esm/diff.js
  init_prelude();

  // ../node_modules/@n1ru4l/json-patch-plus/esm/lcs.js
  init_prelude();
  function defaultMatch(array1, array2, index1, index2) {
    return array1[index1] === array2[index2];
  }
  function lengthMatrix(array1, array2, match, context) {
    const len1 = array1.length;
    const len2 = array2.length;
    let matrix = Object.assign([len1 + 1], {
      match
    });
    for (let x = 0; x < len1 + 1; x++) {
      matrix[x] = [len2 + 1];
      for (let y = 0; y < len2 + 1; y++) {
        matrix[x][y] = 0;
      }
    }
    for (let x = 1; x < len1 + 1; x++) {
      for (let y = 1; y < len2 + 1; y++) {
        if (match(array1, array2, x - 1, y - 1, context)) {
          matrix[x][y] = matrix[x - 1][y - 1] + 1;
        } else {
          matrix[x][y] = Math.max(matrix[x - 1][y], matrix[x][y - 1]);
        }
      }
    }
    return matrix;
  }
  function backtrack(matrix, array1, array2, context) {
    let index1 = array1.length;
    let index2 = array2.length;
    const subsequence = {
      sequence: [],
      indices1: [],
      indices2: []
    };
    while (index1 !== 0 && index2 !== 0) {
      const sameLetter = matrix.match(array1, array2, index1 - 1, index2 - 1, context);
      if (sameLetter) {
        subsequence.sequence.unshift(array1[index1 - 1]);
        subsequence.indices1.unshift(index1 - 1);
        subsequence.indices2.unshift(index2 - 1);
        --index1;
        --index2;
      } else {
        const valueAtMatrixAbove = matrix[index1][index2 - 1];
        const valueAtMatrixLeft = matrix[index1 - 1][index2];
        if (valueAtMatrixAbove > valueAtMatrixLeft) {
          --index2;
        } else {
          --index1;
        }
      }
    }
    return subsequence;
  }
  function get(array1, array2, match, context) {
    const innerContext = context || {};
    const matrix = lengthMatrix(array1, array2, match || defaultMatch, innerContext);
    return backtrack(matrix, array1, array2, innerContext);
  }

  // ../node_modules/@n1ru4l/json-patch-plus/esm/diff.js
  function diff(input, options) {
    var _a;
    const includePreviousValue = (_a = options === null || options === void 0 ? void 0 : options.includePreviousValue) !== null && _a !== void 0 ? _a : false;
    const objectHash = options === null || options === void 0 ? void 0 : options.objectHash;
    const matchByPosition = options === null || options === void 0 ? void 0 : options.matchByPosition;
    const context = {
      result: void 0,
      left: input.left,
      right: input.right,
      includePreviousValue,
      objectHash,
      matchByPosition,
      stopped: false
    };
    function process2(context2) {
      var _a2, _b;
      const steps = [
        nested_collectChildrenDiffFilter,
        trivialDiffFilter,
        nested_objectsDiffFilter,
        array_diffFilter
      ];
      for (const step of steps) {
        step(context2);
        if (context2.stopped) {
          context2.stopped = false;
          break;
        }
      }
      if ((_a2 = context2.children) === null || _a2 === void 0 ? void 0 : _a2.length) {
        for (const childrenContext of context2.children) {
          process2(childrenContext);
          if (childrenContext.result !== void 0) {
            context2.result = (_b = context2.result) !== null && _b !== void 0 ? _b : {};
            context2.result[childrenContext.name] = childrenContext.result;
          }
        }
        if (context2.result && context2.leftIsArray) {
          context2.result._t = "a";
        }
      }
    }
    process2(context);
    return context.result;
  }
  function trivialDiffFilter(context) {
    if (context.left === context.right) {
      context.result = void 0;
      context.stopped = true;
      return;
    }
    if (typeof context.left === "undefined") {
      context.result = [context.right];
      context.stopped = true;
      return;
    }
    if (typeof context.right === "undefined") {
      const previousValue = context.includePreviousValue ? context.left : null;
      context.result = [previousValue, 0, 0];
      context.stopped = true;
      return;
    }
    context.leftType = context.left === null ? "null" : typeof context.left;
    context.rightType = context.right === null ? "null" : typeof context.right;
    if (context.leftType !== context.rightType) {
      const previousValue = context.includePreviousValue ? context.left : null;
      context.result = [previousValue, context.right];
      context.stopped = true;
      return;
    }
    if (context.leftType === "boolean" || context.leftType === "number" || context.leftType === "string") {
      const previousValue = context.includePreviousValue ? context.left : null;
      context.result = [previousValue, context.right];
      context.stopped = true;
      return;
    }
    if (context.leftType === "object") {
      context.leftIsArray = Array.isArray(context.left);
    }
    if (context.rightType === "object") {
      context.rightIsArray = Array.isArray(context.right);
    }
    if (context.leftIsArray !== context.rightIsArray) {
      const previousValue = context.includePreviousValue ? context.left : null;
      context.result = [previousValue, context.right];
      context.stopped = true;
      return;
    }
  }
  function nested_collectChildrenDiffFilter(context) {
    if (!context || !context.children) {
      return;
    }
    const length = context.children.length;
    let child;
    let result = context.result;
    for (let index = 0; index < length; index++) {
      child = context.children[index];
      if (typeof child.result === "undefined") {
        continue;
      }
      result = result !== null && result !== void 0 ? result : {};
      result[child.name] = child.result;
    }
    if (result && context.leftIsArray) {
      result["_t"] = "a";
    }
    context.result = result;
    context.stopped = true;
  }
  function nested_objectsDiffFilter(context) {
    if (context.leftIsArray || context.leftType !== "object") {
      return;
    }
    const left = context.left;
    const right = context.right;
    for (const name in left) {
      if (!Object.prototype.hasOwnProperty.call(left, name)) {
        continue;
      }
      if (context.children === void 0) {
        context.children = [];
      }
      context.children.push({
        left: left[name],
        right: right[name],
        result: void 0,
        name,
        includePreviousValue: context.includePreviousValue,
        objectHash: context.objectHash,
        matchByPosition: context.matchByPosition,
        stopped: false
      });
    }
    for (const name in right) {
      if (!Object.prototype.hasOwnProperty.call(right, name)) {
        continue;
      }
      if (typeof left[name] === "undefined") {
        if (context.children === void 0) {
          context.children = [];
        }
        context.children.push({
          left: void 0,
          right: right[name],
          result: void 0,
          name,
          includePreviousValue: context.includePreviousValue,
          objectHash: context.objectHash,
          matchByPosition: context.matchByPosition,
          stopped: false
        });
      }
    }
    if (!context.children || context.children.length === 0) {
      context.result = void 0;
      context.stopped = true;
      return;
    }
    context.stopped = true;
  }
  var ARRAY_MOVE = 3;
  function array_diffFilter(context) {
    if (!context.leftIsArray) {
      return;
    }
    let matchContext = {
      objectHash: context.objectHash,
      matchByPosition: context.matchByPosition
    };
    let commonHead = 0;
    let commonTail = 0;
    let index;
    let index1;
    let index2;
    const array1 = context.left;
    const array2 = context.right;
    const len1 = array1.length;
    const len2 = array2.length;
    if (len1 > 0 && len2 > 0 && !matchContext.objectHash && typeof matchContext.matchByPosition !== "boolean") {
      matchContext.matchByPosition = !arraysHaveMatchByRef(array1, array2, len1, len2);
    }
    while (commonHead < len1 && commonHead < len2 && matchItems(array1, array2, commonHead, commonHead, matchContext)) {
      index = commonHead;
      const left = context.left;
      const right = context.right;
      if (context.children === void 0) {
        context.children = [];
      }
      context.children.push({
        left: left[index],
        right: right[index],
        result: void 0,
        name: index,
        includePreviousValue: context.includePreviousValue,
        objectHash: context.objectHash,
        matchByPosition: context.matchByPosition,
        stopped: false
      });
      commonHead++;
    }
    while (commonTail + commonHead < len1 && commonTail + commonHead < len2 && matchItems(array1, array2, len1 - 1 - commonTail, len2 - 1 - commonTail, matchContext)) {
      index1 = len1 - 1 - commonTail;
      index2 = len2 - 1 - commonTail;
      const left = context.left;
      const right = context.right;
      if (context.children === void 0) {
        context.children = [];
      }
      context.children.push({
        left: left[index1],
        right: right[index2],
        result: void 0,
        name: index2,
        includePreviousValue: context.includePreviousValue,
        objectHash: context.objectHash,
        matchByPosition: context.matchByPosition,
        stopped: false
      });
      commonTail++;
    }
    if (commonHead + commonTail === len1) {
      if (len1 === len2) {
        context.result = void 0;
        context.stopped = true;
        return;
      }
      const result2 = {
        _t: "a"
      };
      for (index = commonHead; index < len2 - commonTail; index++) {
        result2[index] = [array2[index]];
      }
      context.result = result2;
      context.stopped = true;
      return;
    }
    if (commonHead + commonTail === len2) {
      const result2 = {
        _t: "a"
      };
      for (index = commonHead; index < len1 - commonTail; index++) {
        result2[`_${index}`] = [
          context.includePreviousValue ? array1[index] : null,
          0,
          0
        ];
      }
      context.result = result2;
      context.stopped = true;
      return;
    }
    delete matchContext.hashCache1;
    delete matchContext.hashCache2;
    let trimmed1 = array1.slice(commonHead, len1 - commonTail);
    let trimmed2 = array2.slice(commonHead, len2 - commonTail);
    let seq = get(trimmed1, trimmed2, matchItems, matchContext);
    let removedItems = [];
    const result = {
      _t: "a"
    };
    for (index = commonHead; index < len1 - commonTail; index++) {
      if (seq.indices1.indexOf(index - commonHead) < 0) {
        result[`_${index}`] = [
          context.includePreviousValue ? array1[index] : null,
          0,
          0
        ];
        removedItems.push(index);
      }
    }
    const detectMove = true;
    let includeValueOnMove = true;
    let removedItemsLength = removedItems.length;
    for (index = commonHead; index < len2 - commonTail; index++) {
      let indexOnArray2 = seq.indices2.indexOf(index - commonHead);
      if (indexOnArray2 < 0) {
        let isMove = false;
        if (detectMove && removedItemsLength > 0) {
          for (let removeItemIndex1 = 0; removeItemIndex1 < removedItemsLength; removeItemIndex1++) {
            index1 = removedItems[removeItemIndex1];
            if (matchItems(trimmed1, trimmed2, index1 - commonHead, index - commonHead, matchContext)) {
              result[`_${index1}`].splice(1, 2, index, ARRAY_MOVE);
              if (!includeValueOnMove) {
                result[`_${index1}`][0] = "";
              }
              index2 = index;
              if (context.children === void 0) {
                context.children = [];
              }
              const left = context.left;
              const right = context.right;
              context.children.push({
                left: left[index1],
                right: right[index2],
                result: void 0,
                name: index2,
                includePreviousValue: context.includePreviousValue,
                objectHash: context.objectHash,
                matchByPosition: context.matchByPosition,
                stopped: false
              });
              removedItems.splice(removeItemIndex1, 1);
              isMove = true;
              break;
            }
          }
        }
        if (!isMove) {
          result[index] = [array2[index]];
        }
      } else {
        index1 = seq.indices1[indexOnArray2] + commonHead;
        index2 = seq.indices2[indexOnArray2] + commonHead;
        if (context.children === void 0) {
          context.children = [];
        }
        const left = context.left;
        const right = context.right;
        context.children.push({
          left: left[index1],
          right: right[index2],
          result: void 0,
          name: index2,
          includePreviousValue: context.includePreviousValue,
          objectHash: context.objectHash,
          matchByPosition: context.matchByPosition,
          stopped: false
        });
      }
    }
    context.result = result;
    context.stopped = true;
  }
  function arraysHaveMatchByRef(array1, array2, len1, len2) {
    for (let index1 = 0; index1 < len1; index1++) {
      let val1 = array1[index1];
      for (let index2 = 0; index2 < len2; index2++) {
        let val2 = array2[index2];
        if (index1 !== index2 && val1 === val2) {
          return true;
        }
      }
    }
    return false;
  }
  function matchItems(array1, array2, index1, index2, context) {
    let value1 = array1[index1];
    let value2 = array2[index2];
    if (value1 === value2) {
      return true;
    }
    if (typeof value1 !== "object" || typeof value2 !== "object") {
      return false;
    }
    let objectHash = context.objectHash;
    if (!objectHash) {
      return context.matchByPosition && index1 === index2;
    }
    let hash1;
    let hash2;
    if (typeof index1 === "number") {
      context.hashCache1 = context.hashCache1 || [];
      hash1 = context.hashCache1[index1];
      if (typeof hash1 === "undefined") {
        context.hashCache1[index1] = hash1 = objectHash(value1, index1);
      }
    } else {
      hash1 = objectHash(value1);
    }
    if (typeof hash1 === "undefined") {
      return false;
    }
    if (typeof index2 === "number") {
      context.hashCache2 = context.hashCache2 || [];
      hash2 = context.hashCache2[index2];
      if (typeof hash2 === "undefined") {
        context.hashCache2[index2] = hash2 = objectHash(value2, index2);
      }
    } else {
      hash2 = objectHash(value2);
    }
    if (typeof hash2 === "undefined") {
      return false;
    }
    return hash1 === hash2;
  }

  // ../node_modules/@n1ru4l/json-patch-plus/esm/patch.js
  init_prelude();

  // ../shared/dag-implementation/store.ts
  var FosStore = class _FosStore {
    constructor({
      fosCtxData,
      mutationCallback,
      commitCallback
    } = {}) {
      __publicField(this, "table", /* @__PURE__ */ new Map());
      __publicField(this, "rootsHistory", []);
      __publicField(this, "trellisData", {
        focusChar: null,
        focusRoute: [],
        collapsedList: [],
        rowDepth: 0,
        view: "Queue",
        activity: "todo",
        mode: "execute",
        dragInfo: {
          dragging: null,
          dragOverInfo: null
        }
      });
      __publicField(this, "updatedTime", 0);
      __publicField(this, "rootNodeId");
      __publicField(this, "fosRoute", []);
      __publicField(this, "cache", /* @__PURE__ */ new Map());
      // aliasMap = new Map<string, string>()
      __publicField(this, "peers", /* @__PURE__ */ new Map());
      __publicField(this, "workers", []);
      __publicField(this, "version", 0);
      __publicField(this, "primitive");
      __publicField(this, "hashCache", /* @__PURE__ */ new WeakMap());
      /** Set when the loaded context was in an older cid format and was migrated on load. */
      __publicField(this, "migration", null);
      __publicField(this, "updateCtxCallback");
      __publicField(this, "commitCallback");
      this.primitive = constructPrimitiveAliases(this);
      this.updateCtxCallback = mutationCallback || null;
      this.commitCallback = commitCallback || null;
      if (fosCtxData && needsMigration(fosCtxData.fosData.nodes)) {
        const report = migrateContext(fosCtxData.fosData);
        this.migration = report;
        const remapPath = (path) => path.map(([a, b]) => [report.mapping[a] ?? a, report.mapping[b] ?? b]);
        fosCtxData = {
          fosData: report.context,
          trellisData: {
            ...fosCtxData.trellisData,
            focusRoute: remapPath(fosCtxData.trellisData.focusRoute ?? []),
            collapsedList: (fosCtxData.trellisData.collapsedList ?? []).map(remapPath)
          }
        };
        console.info(`[FosStore] migrated ${Object.keys(report.mapping).length} nodes from cid format v${report.fromVersions.join("/v")} to v${report.target}`);
      }
      if (fosCtxData) {
        const rootNodeContent = fosCtxData.fosData.nodes[fosCtxData.fosData.rootNodeId];
        if (!rootNodeContent) {
          throw new Error(`root node ${fosCtxData.fosData.rootNodeId} not found --- bad data`);
        }
        this.fosRoute = fosCtxData.fosData.route;
        const existingCids = [...this.table.keys()];
        const newKeys = Object.keys(fosCtxData.fosData.nodes);
        const allValidKeys = /* @__PURE__ */ new Set([...existingCids, ...newKeys]);
        Object.keys(fosCtxData.fosData.nodes).forEach((key) => {
          const nodeContent = fosCtxData.fosData.nodes[key];
          nodeContent.children.forEach((edge, index) => {
            if (!allValidKeys.has(edge[0])) {
              throw new Error(`edge ${edge} has non-existent instruction node`);
            }
            if (!allValidKeys.has(edge[1])) {
              throw new Error(`edge ${edge} has non-existent target nodes`);
            }
          });
          const cid = this.hash(nodeContent);
          this.table.set(cid, nodeContent);
          if (key === "b3f17d6c4a0b8b5cee8a32d50d3af24c9bd665da316d4ec7824d03cc08e7d91c") {
            const hasKey = allValidKeys.has(key);
            const nodeContent2 = fosCtxData.fosData.nodes[key];
            console.log("key", key, hasKey, nodeContent2, cid);
          }
        });
        this.rootNodeId = fosCtxData.fosData.rootNodeId;
      } else {
        this.rootNodeId = this.primitive.startRootAlias.getId();
      }
    }
    // run(expr: FosExpression): Promise<FosExpression> {
    //   // console.log('run expr', expr)
    //   const taskPromise = new Promise<FosExpression>((resolve, reject) => {
    //     const result = runAvailableFunctions(expr)
    //     this.workers.push(taskPromise)
    //   })
    //   this.workers.push(taskPromise)
    //   return taskPromise
    // }
    /** The current address of a cid from a context loaded in an older format (identity otherwise). */
    remapCid(cid) {
      return this.migration?.mapping[cid] ?? cid;
    }
    getRootExpression() {
      return new FosExpression(
        this,
        this.primitive.voidNode,
        this.getRootNode(),
        null
      );
    }
    getRootNode() {
      const rootNode = this.getNodeByAddress(this.rootNodeId);
      if (!rootNode) {
        throw new Error(`root node ${this.rootNodeId} not found`);
      }
      return rootNode;
    }
    setRootNode(newTarget) {
      const prevRoot = this.getRootNode();
      const {
        instruction
      } = prevRoot.dereferenceNodes();
      const newRootAlias = this.create({
        data: {},
        children: [
          [this.primitive.targetPointerConstructor.getId(), newTarget.getId()],
          [this.primitive.instructionPointerConstructor.getId(), instruction.getId()],
          [this.primitive.previousVersion.getId(), prevRoot.getId()]
        ]
      });
      this.rootNodeId = newRootAlias.getId();
      console.log("newRootNode", this.rootNodeId);
      this.updateCtxCallback && this.updateCtxCallback(this.exportContext([]));
    }
    commit() {
      const newRootNode = this.getRootNode().getCommitNode();
      this.setRootNode(newRootNode);
      this.commitCallback && this.commitCallback(this.exportContext([]));
    }
    hash(nodeContent) {
      if (this.hashCache.has(nodeContent)) {
        return this.hashCache.get(nodeContent);
      } else {
        const hash = hashContent(nodeContent);
        return hash;
      }
    }
    checkAddress(address) {
      const isNode = this.table.get(address) !== void 0;
      if (isNode) {
        return address;
      } else {
        return null;
      }
    }
    create(value, alias) {
      const updatedChildren = value.children.map((item, index) => {
        if (Array.isArray(item) && item.length === 2 && typeof item[0] === "string" && typeof item[1] === "string") {
          if (!this.checkAddress(item[0]) && !this.checkAddress(item[1])) {
            throw new Error(`edge ${item} has non-existent instruction and target nodes`);
            const newErrorTargetContent = {
              data: {
                error: {
                  instructionIsError: true,
                  instruction: item[0],
                  targetIsError: true,
                  target: item[1],
                  message: `Error: edge referencing non-existent nodes - 
 ${item[0]} , ${item[1]} 
 Please report if this issue persists or caused data loss`
                }
              },
              children: []
            };
            const newErrorTargetAddress = this.insert(newErrorTargetContent);
            const newElem = [this.primitive.errorNode.getId(), newErrorTargetAddress];
            return newElem;
          } else if (!this.checkAddress(item[0])) {
            throw new Error(`edge ${item} has non-existent instruction node`);
            const newErrorTargetContent = {
              data: {
                error: {
                  instructionIsError: true,
                  instruction: item[0],
                  targetIsError: false,
                  target: item[1],
                  message: `Error: edge referencing non-existent nodes - 
 ${item[0]} 
 Please report if this issue persists or caused data loss`
                }
              },
              children: []
            };
            const newErrorTargetAddress = this.insert(newErrorTargetContent);
            const newElem = [this.primitive.errorNode.getId(), newErrorTargetAddress];
            return newElem;
          } else if (!this.checkAddress(item[1])) {
            throw new Error(`edge ${item} has non-existent target node`);
            const newErrorTargetContent = {
              data: {
                error: {
                  instructionIsError: false,
                  instruction: item[0],
                  targetIsError: true,
                  target: item[1],
                  message: `Error: edge referencing non-existent nodes - 
 ${item[1]} 
 Please report if this issue persists or caused data loss`
                }
              },
              children: []
            };
            const newErrorTargetAddress = this.insert(newErrorTargetContent);
            const newElem = [this.primitive.errorNode.getId(), newErrorTargetAddress];
            return newElem;
          }
          return item;
        } else {
          throw new Error(`inserting array that has malformed edges`);
          const newErrorTargetContent = {
            data: {
              error: {
                instructionIsError: true,
                instruction: "",
                targetIsError: true,
                target: "",
                message: `malformed edge - 
 ${JSON.stringify(item)} 
 Please report if this issue persists or caused data loss`
              }
            },
            children: []
          };
          const newErrorTargetAddress = this.insert(newErrorTargetContent);
          const newElem = [this.primitive.errorNode.getId(), newErrorTargetAddress];
          return newElem;
        }
      });
      const updatedValue = {
        ...value,
        children: updatedChildren
      };
      const hasDiff = diff({ left: value, right: updatedValue });
      const cid = this.hash(updatedValue);
      if (this.cache.has(cid)) {
        return this.cache.get(cid);
      }
      return new FosNode(updatedValue, this);
    }
    insert(nodeContent, alias) {
      nodeContent.children.map((edge, index) => {
        assert(!!this.checkAddress(edge[0]), `node ${edge[0]} not found at index ${index}`);
        assert(!!this.checkAddress(edge[1]), `node ${edge[1]} not found at index ${index}`);
        return [this.checkAddress(edge[0]), this.checkAddress(edge[1])];
      });
      let newCid = this.hash(nodeContent);
      this.table.set(newCid, nodeContent);
      this.table.set(newCid, nodeContent);
      return newCid;
    }
    // mutateAlias (alias: string, nodeContent: FosNodeContent, tentativeCid: string): FosNodeContent {
    //   // console.log('alias found', this.aliasMap, alias, nodeContent, this.aliasMap.get(alias) as string, tentativeCid)
    //   const prevCid = this.aliasMap.get(alias)
    //   if (!prevCid){
    //     this.aliasMap.set(alias, tentativeCid)
    //     return nodeContent
    //     // throw new Error(`alias ${alias} not found`)
    //   }
    //   const thisStoreInstance = this.table.get(this.aliasMap.get(alias) as string)
    //   if(!thisStoreInstance){
    //     throw new Error(`alias ${alias} not found`)
    //   }
    //   const storeNodeContent = this.table.get(prevCid)
    //   if (!storeNodeContent){
    //     throw new Error(`node ${prevCid} not found`)
    //   }
    //   const nodeContentDiff = diff({ left: thisStoreInstance, right: nodeContent })
    //   if (!nodeContentDiff){
    //     return nodeContent
    //   } 
    //   // determine if prev Cid exists in current node content prevList
    //   // if it does, then we need to just need to insert the new content and update the alias
    //   const currPrevItem = nodeContent.children.find((item) => item[0] === this.primitive.previousVersion.getId())
    //   if (!currPrevItem){
    //     console.trace('currPrevItem not found', nodeContent, tentativeCid, storeNodeContent, prevCid)
    //     console.log('currPrevItem not found', nodeContent, tentativeCid, storeNodeContent, prevCid)
    //     //resolve with conflict
    //     return this.getConflictNodeContent(nodeContent, tentativeCid, storeNodeContent, prevCid, alias)
    //   }
    //   const storePrevItem = storeNodeContent.children.find((item) => item[0] === this.primitive.previousVersion.getId())
    //   if (!storePrevItem){
    //     //resolve with conflict
    //     return this.getConflictNodeContent(nodeContent, tentativeCid, storeNodeContent, prevCid, alias)
    //   }
    //   const currPrevList = this.getPrevList(currPrevItem[1])
    //   if (currPrevList.includes(prevCid)){
    //     this.aliasMap.set(alias,tentativeCid)
    //     return nodeContent
    //   }
    //   const storePrevList = this.getPrevList(storePrevItem[1])
    //   if (storePrevList.includes(tentativeCid)){
    //     // keep alias same, but pass old content
    //     return storeNodeContent
    //   }
    //   const removeSharedSuffix = <T>(arr1: T[], arr2: T[]): [T[], T[], T[]] => {
    //     let suffixLen = 0;
    //     while (
    //       suffixLen < arr1.length && 
    //       suffixLen < arr2.length && 
    //       arr1[arr1.length - 1 - suffixLen] === arr2[arr2.length - 1 - suffixLen]
    //     ) {
    //       suffixLen++;
    //     }
    //     return [
    //       arr1.slice(0, arr1.length - suffixLen),
    //       arr2.slice(0, arr2.length - suffixLen),
    //       arr1.slice(arr1.length - suffixLen)
    //     ];
    //   }
    //   const [storePrevListNoSuffix, currPrevListNoSuffix, suffix] = removeSharedSuffix<string>(storePrevList, currPrevList)
    //   const storeStateInfo: {
    //     nodeContent: FosNodeContent,
    //     backwardDeltas: Delta[],
    //     forwardDeltas: Delta[],
    //   } = storePrevListNoSuffix.reduce((acc: {
    //     nodeContent: FosNodeContent,
    //     backwardDeltas: Delta[],
    //     forwardDeltas: Delta[],
    //   }, cid: string)=>{
    //     const thisContent = this.table.get(cid) as FosNodeContent
    //     const thisContentReverseDiff = thisContent.data.versionControl?.delta
    //     if (!thisContentReverseDiff){
    //       throw new Error(`no diffs found for ${cid}`)
    //     }
    //     const reversedState = patch({ left: acc.nodeContent, delta: thisContentReverseDiff })
    //     const forwardDelta = diff({ left: reversedState, right: acc.nodeContent })
    //     return {
    //       nodeContent: reversedState,
    //       backwardDeltas: [...acc.backwardDeltas, thisContentReverseDiff],
    //       forwardDeltas: [...acc.forwardDeltas, forwardDelta]
    //     }
    //   }, { 
    //     backwardDeltas: [],
    //     forwardDeltas: [],
    //     nodeContent: storeNodeContent
    //   })
    //   const incomingStateInfo: {
    //     nodeContent: FosNodeContent,
    //     backwardDeltas: Delta[],
    //     forwardDeltas: Delta[],
    //   } = currPrevListNoSuffix.reduce((acc: {
    //     nodeContent: FosNodeContent,
    //     backwardDeltas: Delta[],
    //     forwardDeltas: Delta[],
    //   }, cid: string)=>{
    //     const thisContent = this.table.get(cid) as FosNodeContent
    //     const thisContentReverseDiff = thisContent.data.versionControl?.delta
    //     if (!thisContentReverseDiff){
    //       throw new Error(`no diffs found for ${cid}`)
    //     }
    //     const reversedState = patch({ left: acc.nodeContent, delta: thisContentReverseDiff })
    //     const forwardDelta = diff({ left: reversedState, right: acc.nodeContent })
    //     return {
    //       nodeContent: reversedState,
    //       backwardDeltas: [...acc.backwardDeltas, thisContentReverseDiff],
    //       forwardDeltas: [...acc.forwardDeltas, forwardDelta]
    //     }
    //   }, { 
    //     backwardDeltas: [],
    //     forwardDeltas: [],
    //     nodeContent: nodeContent
    //   })
    //   const baseStateDiff = diff({ left: storeStateInfo.nodeContent, right: incomingStateInfo.nodeContent })
    //   if (baseStateDiff){
    //     throw new Error(`doing something wrong... rewinding didn't get back to the same state`)
    //   }
    //   const finalState1: FosNodeContent = [...storeStateInfo.forwardDeltas, ...incomingStateInfo.forwardDeltas].reduce((acc: FosNodeContent, delta) => {
    //     return patch<FosNodeContent>({ left: acc, delta })
    //   }, storeStateInfo.nodeContent)
    //   const finalState2: FosNodeContent = [...incomingStateInfo.forwardDeltas, ...storeStateInfo.forwardDeltas].reduce((acc: FosNodeContent, delta) => {
    //     return patch({ left: acc, delta })
    //   }, incomingStateInfo.nodeContent)
    //   const hasFinalDiff = diff({ left: finalState1, right: finalState2 })
    //   if (hasFinalDiff){
    //     return this.getConflictNodeContent(nodeContent, tentativeCid, storeNodeContent, prevCid, alias)
    //   } else {
    //     const newNodeContent = this.addPrevNodeToContent(finalState1, prevCid)
    //     this.hash(newNodeContent)
    //     return newNodeContent
    //   }
    // }
    // getConflictNodeContent (content: FosNodeContent, currId: string, existingContent: FosNodeContent, existingId: string, alias: string ): FosNodeContent {
    //   this.table.set(currId, content)
    //   const newElemForCurrent: FosPathElem = [this.primitive.conflictNode.getId(), currId]
    //   const newElemForExisting: FosPathElem = [this.primitive.conflictNode.getId(), existingId]
    //   const conflictNodeConent: FosNodeContent = {
    //     data: {
    //     },
    //     children: [newElemForCurrent, newElemForExisting],
    //   }
    //   return conflictNodeConent
    // }
    addPrevNodeToContent(content2, oldNodeCid) {
      const oldNodeContent = this.table.get(oldNodeCid);
      const diffToPrev = diff({ left: content2, right: oldNodeContent });
      if (!diffToPrev) {
        throw new Error(`no diff found between ${oldNodeCid} and ${content2}`);
      }
      const newElem = [this.primitive.previousVersion.getId(), oldNodeCid];
      const newContent = {
        data: {
          ...content2.data,
          versionControl: {
            delta: diffToPrev,
            branches: [],
            tags: []
          }
        },
        children: [newElem, ...content2.children.filter((item) => item[0] !== this.primitive.previousVersion.getId())]
      };
      return newContent;
    }
    // addRowToContent (content: FosNodeContent, instruction: string, target: string): FosNodeContent {
    // }
    addErrorNodeToContent(content2, item, instruction, target, instructionIsError, targetIsError, message) {
      const newErrorTargetContent = {
        data: {
          error: {
            instructionIsError,
            instruction,
            targetIsError,
            target,
            message: `malformed edge - 
 ${JSON.stringify(item)} 
 Please report if this issue persists or caused data loss`
          }
        },
        children: []
      };
      const newErrorTargetAddress = this.insert(newErrorTargetContent);
      const newElem = [this.primitive.errorNode.getId(), newErrorTargetAddress];
      const newContent = {
        ...content2,
        children: [newElem, ...content2.children]
      };
      return newContent;
    }
    getPrevList(cid) {
      const helper = (cid2) => {
        const currentContent = this.table.get(cid2);
        if (!currentContent) {
          throw new Error(`node ${cid2} not found`);
        }
        const prevItem = currentContent.children.find((item) => item[0] === this.primitive.previousVersion.getId());
        if (!prevItem) {
          return [];
        } else {
          return [...helper(prevItem[1]), prevItem[1]];
        }
      };
      const thisStorePrevList = helper(cid);
      return thisStorePrevList;
    }
    remove(node) {
      const cid = node.getId();
      assert(!!this.checkAddress(cid), `address ${cid} not found`);
      this.table.has(cid) && this.table.delete(cid);
      this.cache.has(cid) && this.cache.delete(cid);
    }
    async provideNodeToPeer(nodeId) {
      const node = this.getNodeByAddress(nodeId);
      if (!node) {
        return null;
      }
      return node;
    }
    exportContext(route) {
      const nodes = {};
      Array.from(this.table.entries()).forEach(([address, content2], i2) => {
        nodes[address] = content2;
      });
      const rootContent = nodes[this.rootNodeId];
      if (!rootContent) {
        console.log("rootNodeId", this.rootNodeId, nodes);
        throw new Error(`root node not found --- exporting bad data`);
      }
      if (!this.rootNodeId) {
        throw new Error(`root node not found`);
      }
      return {
        fosData: {
          nodes,
          route,
          rootNodeId: this.rootNodeId
        },
        trellisData: this.trellisData
      };
    }
    getNodeByAddress(address) {
      if (this.cache.has(address)) return this.cache.get(address);
      if (!this.checkAddress(address)) {
        throw new Error(`address ${address} not found`);
      }
      const nodeContent = this.table.get(address);
      const result = this.create(nodeContent);
      if (!result) throw new Error(`Unable to construct node for address ${address}`);
      this.cache.set(result.cid, result);
      return result;
    }
    getContent(node) {
      const maybeContent = this.table.get(node.getId());
      if (!maybeContent) {
        throw new Error(`node ${node.getId()} not found`);
      }
      return maybeContent;
    }
    insertRoute(route) {
      throw new Error("Method not implemented.");
    }
    deleteRoute(route) {
      throw new Error("Method not implemented.");
    }
    checkRoute(route) {
      throw new Error("Method not implemented.");
    }
    pickRoute(route) {
      throw new Error("Method not implemented.");
    }
    query(query) {
      const queryCid = query.getId();
      const result = [];
      const tableEntries = [...this.table.entries()];
      tableEntries.forEach(([entrykey, entryvalue]) => {
        if (entrykey === queryCid) return;
        this.create(entryvalue);
        try {
          const thisNode = this.getNodeByAddress(entrykey);
          if (!thisNode) {
            throw new Error(`node ${entrykey} not found`);
          }
          const matches = this.matchPattern(query, thisNode);
          result.push(thisNode);
        } catch (e) {
          if (!e.cause?.patternFailed) {
            throw e;
          }
        }
      });
      return result;
    }
    matchPattern(pattern, entry) {
      const patternMap = aggMap(pattern.getEdges());
      const nodeMap = aggMap(entry.getEdges());
      const patternCid = pattern.getId();
      const entryCid = entry.getId();
      if (patternCid === this.primitive.voidNode.getId()) {
        return [];
      }
      if (patternCid === entryCid) {
        return [entry];
      }
      if (patternCid === this.primitive.unit.getId()) {
        return [entry];
      }
      if (patternCid === this.primitive.voidNode.getId()) {
        throw new Error(`pattern expecte void --- pattern ${pattern} does not match entry ${entry}`);
      }
      const patternResult = [];
      for (const [patternKey, patternValues] of patternMap.entries()) {
        if (!nodeMap.has(patternKey)) {
          throw new Error(`pattern ${patternKey} does not exist on node entry.  Cannot resolve pattern`);
        } else {
          const entryTargetsForKey = nodeMap.get(patternKey);
          if (patternValues.length !== entryTargetsForKey.length) {
            throw new Error(`pattern ${patternKey} has ${patternValues.length} entries, but node ${patternKey} has ${nodeMap.get(patternKey)?.length} entries.  Cannot resolve pattern`);
          } else {
            patternValues.forEach((patternValue, index) => {
              if (patternValue === this.primitive.unit.getId()) {
                const entryNode = this.getNodeByAddress(entryTargetsForKey[index]);
                if (!entryNode) {
                  throw new Error(`node ${entryTargetsForKey[index]} not found`);
                }
                patternResult.push(entryNode);
              } else if (entryTargetsForKey[index] !== patternValue) {
                const patternNode = this.getNodeByAddress(patternValue);
                if (!patternNode) {
                  throw new Error(`node ${patternValue} not found`);
                }
                const thisNode = this.getNodeByAddress(entryTargetsForKey[index]);
                if (!thisNode) {
                  throw new Error(`node ${entryTargetsForKey[index]} not found`);
                }
                const subQueryResults = this.matchPattern(patternNode, thisNode);
                patternResult.push(...subQueryResults);
              }
            });
          }
        }
      }
      return patternResult;
    }
    queryTriple(subject, predicate, object) {
      const subjectMatches = this.query(subject);
      const result = [];
      const tripleResults = subjectMatches.flatMap((subjectMatch) => {
        const edgeMatches = subjectMatch.getEdges().filter(([predicateKey, objectKey]) => {
          try {
            const thisNode = this.getNodeByAddress(predicateKey);
            if (!thisNode) {
              throw new Error(`node ${predicateKey} not found`);
            }
            this.matchPattern(predicate, thisNode);
            return true;
          } catch (e) {
            if (!e.cause?.patternFailed) {
              throw e;
            }
            return false;
          }
        });
        const allMatches = edgeMatches.filter(([predicateKey, objectKey]) => {
          try {
            const thisNode = this.getNodeByAddress(objectKey);
            if (!thisNode) {
              throw new Error(`node ${objectKey} not found`);
            }
            this.matchPattern(object, thisNode);
            return true;
          } catch (e) {
            if (!e.cause?.patternFailed) {
              throw e;
            }
            return false;
          }
        });
        return allMatches.map(([predicateKey, objectKey]) => [subjectMatch, this.getNodeByAddress(predicateKey), this.getNodeByAddress(objectKey)]);
      });
      return tripleResults;
    }
    negativeQueryTriple(subject, predicate, object) {
      const subjectCid = subject.getId();
      const predicateCid = predicate.getId();
      const objectCid = predicate.getId();
      if (subjectCid === this.primitive.voidNode.getId()) {
        const nodesToTest = this.query(object);
        const result = nodesToTest.filter((nodeToTest) => {
          const thisUnitNode = this.getNodeByAddress(this.primitive.unit.getId());
          if (!thisUnitNode) {
            throw new Error(`node ${this.primitive.unit.getId()} not found`);
          }
          const test = this.queryTriple(thisUnitNode, predicate, nodeToTest);
          return test.length === 0;
        });
        return result.map((node) => [subject, predicate, node]);
      } else if (predicateCid === this.primitive.voidNode.getId()) {
        throw new Error("not implemented");
      } else if (objectCid === this.primitive.voidNode.getId()) {
        throw new Error("not implemented");
      } else {
        throw new Error("not a negative query");
      }
    }
    cloneNodeFromOtherStore(otherStoreNode) {
      const otherStoreChildren = otherStoreNode.getEdges();
      if (otherStoreChildren.length === 0) {
        return this.create(otherStoreNode.value);
      } else {
        const nodeData = otherStoreNode.value.data;
        const otherStore = otherStoreNode.store;
        const thisStoreEdges = otherStoreNode.value.children.map(([childInstuction, childTarget]) => {
          const childInstuctionNode = otherStore.getNodeByAddress(childInstuction);
          if (!childInstuctionNode) {
            throw new Error("child instruction node from other store not found");
          }
          const childTargetNode = otherStore.getNodeByAddress(childTarget);
          if (!childTargetNode) {
            throw new Error("child target node from other store not found");
          }
          const thisStoreInstruction = this.cloneNodeFromOtherStore(childInstuctionNode);
          const thisStoreTarget = this.cloneNodeFromOtherStore(childTargetNode);
          const result = [thisStoreInstruction.getId(), thisStoreTarget.getId()];
          return result;
        });
        return this.create({
          data: nodeData,
          children: thisStoreEdges
        });
      }
    }
    updateWithContext(context) {
      const otherStore = new _FosStore({ fosCtxData: context });
      this.updateFromStore(otherStore);
      const newContext = this.exportContext(otherStore.fosRoute);
      return newContext;
    }
    updateFromStore(otherStore) {
      const existingCids = [...this.table.keys()];
      const otherCids = [...otherStore.table.keys()];
      const allValidKeys = /* @__PURE__ */ new Set([...existingCids, ...otherCids]);
      Array.from(otherStore.table.keys()).forEach((key) => {
        const nodeContent = otherStore.table.get(key);
        const cid = this.hash(nodeContent);
        nodeContent.children.forEach((edge, index) => {
          if (!allValidKeys.has(edge[0])) {
            throw new Error(`edge ${edge} has non-existent instruction node`);
          }
          if (!allValidKeys.has(edge[1])) {
            throw new Error(`edge ${edge} has non-existent target nodes`);
          }
        });
      });
      this.table = new Map([...otherStore.table, ...this.table]);
      Array.from(otherStore.table.entries()).filter(([x, _]) => this.table.has(x)).forEach(([otherAddress, otherContent], i2) => {
        if (this.insert(otherContent) !== otherAddress) {
          throw new Error(`stores mismatched`);
        }
      });
      this.trellisData = otherStore.trellisData;
    }
    addPeer(alias, peerStore) {
    }
    addGroup(description) {
      const rootExpression = this.getRootExpression();
      const startRootAlias = this.primitive.startRootAlias;
      const thisAlias = startRootAlias.getData().alias?.id;
      if (!thisAlias) {
        throw new Error(`no alias found in startRootAlias`);
      }
      const { target: rootTarget } = rootExpression.targetNode.dereferenceNodes();
      const groupContentNode = this.create({
        data: {
          description: {
            content: description
          }
        },
        children: []
      });
      const groupShadowNode = this.create({
        data: {
          description: {
            content: `Shadow node for group: ${description}`
          },
          peers: {}
        },
        children: [
          [this.primitive.targetPointerConstructor.getId(), groupContentNode.getId()]
        ]
      });
      const rootTargetWithShadow = rootTarget.addEdge(this.primitive.groupField.getId(), groupShadowNode.getId());
      const groupStore = new _FosStore();
      groupStore.create(groupContentNode.value);
      groupStore.create(groupShadowNode.value);
      groupStore.addPeer(thisAlias, this);
      const groupDefinitionNode = groupStore.create({
        data: {
          description: {
            content: description
          }
        },
        children: [
          [this.primitive.targetPointerConstructor.getId(), groupContentNode.getId()],
          [this.primitive.peerNode.getId(), groupShadowNode.getId()]
        ]
      });
      const groupDefinitionNodeClone = this.cloneNodeFromOtherStore(groupDefinitionNode);
      const newRootTarget = rootTargetWithShadow.addEdge(this.primitive.groupField.getId(), groupDefinitionNodeClone.getId());
      rootExpression.setTargetNode(newRootTarget);
      const groupExpr = new FosExpression(this, [[this.primitive.groupField.getId(), groupDefinitionNode.getId()]]);
      return [groupStore, groupExpr];
    }
  };

  // ../shared/sync/replica.ts
  function createReplica(peerId = newId()) {
    return {
      store: new FosStore(),
      meta: { version: SYNC_FORMAT_VERSION, peerId, scope: [], scopeNames: [], baseCid: null, lastSyncAt: null, serverPeerId: null }
    };
  }
  function normalizeReplicaRefs(store) {
    const head = rootTargetCid(store);
    const next = normalizeRefs(store, head);
    if (next === head) return false;
    commitRoot(store, next, 0);
    return true;
  }
  function serializeReplica(replica) {
    return { meta: replica.meta, context: exportReachableContext(replica.store, [replica.meta.baseCid]) };
  }
  function loadReplica(input) {
    const fresh = createReplica();
    if (!input || typeof input !== "object") return fresh;
    const raw = input;
    const meta = raw.meta;
    if (!meta || typeof meta !== "object") return fresh;
    const peerId = typeof meta.peerId === "string" && meta.peerId ? meta.peerId : fresh.meta.peerId;
    const scope = Array.isArray(meta.scope) ? meta.scope.filter((s) => typeof s === "string" && s.length > 0) : [];
    let store;
    try {
      const ctx = raw.context;
      if (!ctx || typeof ctx !== "object" || typeof ctx.rootNodeId !== "string") throw new Error("no context");
      store = new FosStore({ fosCtxData: { fosData: { nodes: ctx.nodes ?? {}, route: [], rootNodeId: ctx.rootNodeId }, trellisData: fresh.store.trellisData } });
      rootTargetCid(store);
      normalizeReplicaRefs(store);
    } catch (error) {
      console.warn("stored replica unreadable, starting fresh", error);
      store = fresh.store;
    }
    const remappedBase = typeof meta.baseCid === "string" ? store.remapCid(meta.baseCid) : null;
    const baseCid = remappedBase && store.table.has(remappedBase) ? remappedBase : null;
    return {
      store,
      meta: {
        version: SYNC_FORMAT_VERSION,
        peerId,
        scope,
        scopeNames: Array.isArray(meta.scopeNames) && meta.scopeNames.length === scope.length ? meta.scopeNames.map(String) : [...scope],
        baseCid,
        lastSyncAt: typeof meta.lastSyncAt === "number" ? meta.lastSyncAt : null,
        serverPeerId: typeof meta.serverPeerId === "string" ? meta.serverPeerId : null
      }
    };
  }
  function headCid(replica) {
    return rootTargetCid(replica.store);
  }
  function isDirty(replica) {
    const head = headCid(replica);
    if (replica.meta.baseCid) return head !== replica.meta.baseCid;
    return valueContent(replica.store, head).children.length > 0;
  }
  function view(replica, at) {
    const cid = resolveScope(replica.store, headCid(replica), at);
    return cid ? viewNode(replica.store, cid) : null;
  }
  function pathNames(replica, at = []) {
    return [...replica.meta.scopeNames, ...scopeNames(replica.store, headCid(replica), at)];
  }
  function edit(replica, at, now, fn) {
    const next = updateAtScope(replica.store, headCid(replica), at, fn);
    commitRoot(replica.store, next, now);
    return { ...replica };
  }
  function editNode(replica, at, now, fn) {
    const next = updateAtScope(replica.store, headCid(replica), at, fn, "node");
    commitRoot(replica.store, next, now);
    return { ...replica };
  }
  function findChildEdge(replica, value, aliasId) {
    const edge = findEdge(replica.store, value, `a:${aliasId}`);
    return edge && isRowEdge(replica.store, edge) ? edge : void 0;
  }
  function addTask(replica, at, title, now, id = newId()) {
    const trimmed = title.trim();
    if (!trimmed) return replica;
    return edit(replica, at, now, (value) => {
      const cid = put(replica.store, taskContent(id, trimmed, false, now, now));
      return { ...value, children: [...value.children, taskEdge(replica.store, cid)] };
    });
  }
  function addRow(replica, at, kind, text, now, options = {}) {
    const body = kind === "note" ? text.replace(/\s+$/, "") : text.trim();
    if (!body && !["ref", "plain", "comment", "supply", "allocation"].includes(kind)) return replica;
    if (kind === "ref" && !options.refId) return replica;
    const id = options.id ?? newId();
    return edit(replica, at, now, (value) => {
      const { position: _p, id: _i, ...extras } = options;
      const cid = put(replica.store, rowContent(kind, id, body, now, { ...extras, store: replica.store }));
      const edge = rowEdge(replica.store, kind, cid);
      const children = [...value.children];
      const pos = options.position;
      if (pos && "relativeTo" in pos) {
        const sibling = findEdge(replica.store, value, `a:${pos.relativeTo}`);
        const index = sibling ? children.indexOf(sibling) : -1;
        if (index >= 0) {
          children.splice(pos.position === "above" ? index : index + 1, 0, edge);
          return { ...value, children };
        }
      }
      children.push(edge);
      return { ...value, children };
    });
  }
  function setRowKind(replica, at, aliasId, kind, now) {
    return edit(replica, at, now, (value) => {
      const edge = findChildEdge(replica, value, aliasId);
      if (!edge) return value;
      if (rowKindOf(replica.store, edge) === kind && !isPartitionEdge(replica.store, edge)) return value;
      const node = valueContent(replica.store, identityCid(replica.store, edge));
      const converted = withChildValue(replica.store, edge, convertRowContent(node, kind, now), now);
      return replaceEdge(replica.store, value, `a:${aliasId}`, rowEdge(replica.store, kind, identityCid(replica.store, converted)));
    });
  }
  function addRef(replica, at, targetAliasId, now, position) {
    const found = resolveRef(replica, targetAliasId);
    let r = replica;
    if (found && !found.row.isLink) r = makeLinkAt(r, [...found.path, targetAliasId], now);
    const targetPath = found ? [...found.path, targetAliasId] : null;
    const targetCid = targetPath ? resolveScope(r.store, headCid(r), targetPath) : null;
    const options = { refId: targetAliasId, targetCid: targetCid ?? void 0 };
    if (position && "into" in position) return addRow(r, [...at, position.into], "ref", "", now, options);
    return addRow(r, at, "ref", "", now, { ...options, position });
  }
  function copyNode(replica, fromPath, aliasId, toPath, position, now) {
    const from = resolveScope(replica.store, headCid(replica), fromPath);
    if (!from) return replica;
    const found = findEdge(replica.store, valueContent(replica.store, from), `a:${aliasId}`);
    if (!found) return replica;
    const kind = rowKindOf(replica.store, found);
    if (!kind) return replica;
    const copied = copyRowContent(replica.store, identityCid(replica.store, found), now, newId);
    const edge = rowEdge(replica.store, kind, copied);
    const target = "into" in position ? [...toPath, position.into] : toPath;
    return edit(replica, target, now, (value) => {
      const children = [...value.children];
      if ("relativeTo" in position) {
        const sibling = findEdge(replica.store, value, `a:${position.relativeTo}`);
        const index = sibling ? children.indexOf(sibling) : -1;
        if (index >= 0) {
          children.splice(position.position === "above" ? index : index + 1, 0, edge);
          return { ...value, children };
        }
      }
      children.push(edge);
      return { ...value, children };
    });
  }
  function resolveRef(replica, targetAliasId) {
    const root = headCid(replica);
    return root ? findRowByAlias(replica.store, root, targetAliasId) : null;
  }
  function updateTask(replica, at, taskId, now, change) {
    return edit(replica, at, now, (value) => {
      const edge = findChildEdge(replica, value, taskId);
      if (!edge) return value;
      const node = valueContent(replica.store, identityCid(replica.store, edge));
      const next = change(node);
      if (!next) return value;
      const nextValue = { ...next, data: { ...next.data, updated: { time: now } } };
      return replaceEdge(replica.store, value, `a:${taskId}`, withChildValue(replica.store, edge, nextValue, now));
    });
  }
  function setTaskDone(replica, at, taskId, done, now) {
    if (done) {
      const parent = resolveScope(replica.store, headCid(replica), at);
      const taskCid = parent ? findChild(replica.store, parent, taskId) : null;
      if (taskCid && taskBlockers(replica.store, taskCid).length) return replica;
    }
    return updateTask(replica, at, taskId, now, (task) => {
      if (!task.data.todo) return null;
      if (!!task.data.todo?.completed === done) return null;
      return { ...task, data: { ...task.data, todo: { completed: done, time: task.data.todo?.time ?? now } } };
    });
  }
  function renameTask(replica, at, taskId, title, now) {
    const trimmed = title.trim();
    if (!trimmed) return replica;
    return updateTask(replica, at, taskId, now, (task) => {
      if (task.data.description?.content === trimmed) return null;
      return { ...task, data: { ...task.data, description: { content: trimmed } } };
    });
  }
  function deleteTask(replica, at, taskId, now) {
    return edit(replica, at, now, (value) => {
      if (!findChildEdge(replica, value, taskId)) return value;
      return replaceEdge(replica.store, value, `a:${taskId}`, null);
    });
  }
  function resolve(replica, at, choiceId, pick, now) {
    return edit(replica, at, now, (value) => resolveChoiceIn(replica.store, value, choiceId, pick, now));
  }
  function moveNode(replica, fromPath, aliasId, toPath, position, now) {
    const next = moveChild(replica.store, headCid(replica), fromPath, aliasId, toPath, position);
    if (!next || next === headCid(replica)) return replica;
    commitRoot(replica.store, next, now);
    return { ...replica };
  }
  function makeLinkAt(replica, at, now) {
    return editNode(replica, at, now, (node) => makeLink(replica.store, node, now));
  }
  function applyProposalAt(replica, at, proposalCid, approverPeerId, now) {
    const store = replica.store;
    return editNode(replica, at, now, (value) => {
      const proposal = readProposal(store, proposalCid);
      if (!proposal) return value;
      const main = putStripped(store, value);
      const mergedCid = proposal.baseCid === main ? proposal.contentCid : mergeNodes(store, proposal.baseCid, main, proposal.contentCid, { ours: approverPeerId, theirs: proposal.peerId }).cid;
      const linkCid = put(store, value);
      const relinked = relinkContent(store, value, linkCid, content(store, mergedCid), now);
      return removeProposalByCid(store, relinked, proposalCid);
    });
  }
  function rejectProposalAt(replica, at, proposalCid, now) {
    return editNode(replica, at, now, (node) => markProposalRejected(replica.store, node, proposalCid));
  }
  function buildSyncRequest(replica, branch, options = {}) {
    const base = replica.meta.baseCid;
    const head = options.push === false ? base ?? put(replica.store, { data: {}, children: [] }) : headCid(replica);
    const known = base ? reachableSet(replica.store, [base]) : /* @__PURE__ */ new Set();
    return {
      version: SYNC_FORMAT_VERSION,
      cidVersion: CURRENT_CID_VERSION,
      peerId: replica.meta.peerId,
      scope: replica.meta.scope,
      baseCid: base,
      headCid: head,
      nodes: reachableNodes(replica.store, [head], known),
      ...branch ? { branch } : {}
    };
  }
  function completeSync(replica, request, response, now = Date.now()) {
    if (response.scope.length !== request.scope.length || response.scope.some((s, i2) => s !== request.scope[i2])) {
      throw new Error("sync response scope does not match request scope");
    }
    const applied = applySyncResponse(replica.store, request, response, replica.meta.peerId, now);
    return {
      replica: {
        store: replica.store,
        meta: { ...replica.meta, baseCid: response.resultCid, lastSyncAt: now, serverPeerId: response.peerId }
      },
      reMerged: applied.reMerged,
      newChoiceIds: applied.newChoiceIds
    };
  }
  function reattach(replica, newScope, now, names) {
    if (isDirty(replica)) throw new Error("cannot change scope with unsynced local changes");
    const { store, meta } = replica;
    const isPrefix = meta.scope.length <= newScope.length && meta.scope.every((s, i2) => newScope[i2] === s);
    const relative = newScope.slice(meta.scope.length);
    const target = isPrefix ? resolveScope(store, headCid(replica), relative) : null;
    if (target) {
      const scopeNamesNext = names ?? pathNames(replica, relative);
      commitRoot(store, target, now);
      return { store, meta: { ...meta, scope: [...newScope], scopeNames: scopeNamesNext, baseCid: resolveScope(store, meta.baseCid, relative) } };
    }
    commitRoot(store, put(store, { data: {}, children: [] }), now);
    return { store, meta: { ...meta, scope: [...newScope], scopeNames: names ?? [...newScope], baseCid: null } };
  }

  // ../shared/sync/project.ts
  init_prelude();

  // ../shared/sync/embed.ts
  var replicas = /* @__PURE__ */ new Map();
  function get2(handle) {
    const r = replicas.get(handle);
    if (!r) throw new Error(`no replica ${handle}`);
    return r;
  }
  function set(handle, r) {
    replicas.set(handle, r);
  }
  var parse2 = (json, fallback) => json ? JSON.parse(json) : fallback;
  var api = {
    /** Load a serialized replica (or start a fresh one) under `handle`, forcing the device id. */
    open(handle, serialized, peerId) {
      const loaded = serialized ? loadReplica(JSON.parse(serialized)) : createReplica(peerId);
      set(handle, { store: loaded.store, meta: { ...loaded.meta, peerId } });
    },
    close(handle) {
      replicas.delete(handle);
    },
    serialize(handle) {
      return JSON.stringify(serializeReplica(get2(handle)));
    },
    meta(handle) {
      const r = get2(handle);
      return JSON.stringify({ ...r.meta, headCid: headCid(r), dirty: isDirty(r) });
    },
    setScope(handle, scopeJson, namesJson) {
      const r = get2(handle);
      set(handle, { store: r.store, meta: { ...r.meta, scope: parse2(scopeJson, []), scopeNames: parse2(namesJson, []), baseCid: null } });
    },
    view(handle, atJson) {
      return JSON.stringify(view(get2(handle), parse2(atJson, [])));
    },
    /** Add a row of `kind` ('task' | 'plain' | 'note' | 'comment' | 'ref') under `at`; returns its view. */
    addRow(handle, atJson, kind, text, now, optionsJson) {
      const r = get2(handle);
      const at = parse2(atJson, []);
      const options = parse2(optionsJson, {});
      const id = options.id ?? crypto.randomUUID();
      set(handle, addRow(r, at, kind, text, now, { ...options, id }));
      const added = view(get2(handle), at)?.tasks.find((t) => t.id === id) ?? null;
      return JSON.stringify(added);
    },
    setRowKind(handle, atJson, id, kind, now) {
      set(handle, setRowKind(get2(handle), parse2(atJson, []), id, kind, now));
    },
    addRef(handle, atJson, targetId, now) {
      set(handle, addRef(get2(handle), parse2(atJson, []), targetId, now));
    },
    copyNode(handle, fromJson, id, toJson, positionJson, now) {
      set(handle, copyNode(get2(handle), parse2(fromJson, []), id, parse2(toJson, []), parse2(positionJson, { into: "" }), now));
    },
    /** Text lines of the tree below `at` (for the CLI/REPL), with short ids. */
    tree(handle, atJson) {
      const r = get2(handle);
      const lines = [];
      const walk = (at, depth) => {
        const node = view(r, at);
        if (!node) return;
        for (const t of node.tasks) {
          lines.push(`${"  ".repeat(depth)}${t.kind === "task" ? t.done ? "[x]" : "[ ]" : t.kind === "note" ? " \u2261 " : t.kind === "comment" ? ' " ' : t.kind === "ref" ? " \u2192 " : " \xB7 "} ${t.id.slice(0, 8)} ${t.kind === "ref" ? `ref ${t.refId?.slice(0, 8) ?? ""}` : t.title.split("\n")[0]}${t.childCount ? ` (${t.subtreeDone}/${t.subtreeTasks})` : ""}${t.isLink ? " \u26D3" : ""}`);
          if (t.childCount) walk([...at, t.id], depth + 1);
        }
        for (const c of node.choices) lines.push(`${"  ".repeat(depth)}[?] ${c.id.slice(0, 8)} ${c.subject} (conflict, ${c.options.length} versions)`);
        for (const p of node.proposals) lines.push(`${"  ".repeat(depth)}[>] ${p.id.slice(0, 8)} proposal "${p.name}" by ${p.peerId.slice(0, 8)} (${p.status}) +${p.summary.added.length} ~${p.summary.changed.length} -${p.summary.removed.length}`);
      };
      walk(parse2(atJson, []), 0);
      return JSON.stringify(lines);
    },
    /** Locate a task by id prefix anywhere below `at`: { id, at } or null. */
    findTask(handle, atJson, prefix) {
      const r = get2(handle);
      const search = (at) => {
        const node = view(r, at);
        if (!node) return null;
        const direct = node.tasks.find((t) => t.id.startsWith(prefix));
        if (direct) return { id: direct.id, at };
        for (const t of node.tasks) {
          const f2 = search([...at, t.id]);
          if (f2) return f2;
        }
        return null;
      };
      return JSON.stringify(search(parse2(atJson, [])));
    },
    addTask(handle, atJson, title, now) {
      const next = addTask(get2(handle), parse2(atJson, []), title, now);
      set(handle, next);
      const node = view(next, parse2(atJson, []));
      return JSON.stringify(node?.tasks.at(-1) ?? null);
    },
    setTaskDone(handle, atJson, id, done, now) {
      set(handle, setTaskDone(get2(handle), parse2(atJson, []), id, done, now));
    },
    renameTask(handle, atJson, id, title, now) {
      set(handle, renameTask(get2(handle), parse2(atJson, []), id, title, now));
    },
    deleteTask(handle, atJson, id, now) {
      set(handle, deleteTask(get2(handle), parse2(atJson, []), id, now));
    },
    moveNode(handle, fromJson, id, toJson, positionJson, now) {
      set(handle, moveNode(get2(handle), parse2(fromJson, []), id, parse2(toJson, []), JSON.parse(positionJson), now));
    },
    resolveChoice(handle, atJson, choiceId, pick, now) {
      set(handle, resolve(get2(handle), parse2(atJson, []), choiceId, pick < 0 ? null : pick, now));
    },
    applyProposal(handle, atJson, proposalId, approver, now) {
      set(handle, applyProposalAt(get2(handle), parse2(atJson, []), proposalId, approver, now));
    },
    rejectProposal(handle, atJson, proposalId, now) {
      set(handle, rejectProposalAt(get2(handle), parse2(atJson, []), proposalId, now));
    },
    reattach(handle, scopeJson, now, namesJson) {
      set(handle, reattach(get2(handle), parse2(scopeJson, []), now, namesJson ? parse2(namesJson, []) : void 0));
    },
    buildSyncRequest(handle, branch) {
      return JSON.stringify(buildSyncRequest(get2(handle), branch ?? void 0));
    },
    completeSync(handle, requestJson, responseJson, now) {
      const done = completeSync(get2(handle), JSON.parse(requestJson), JSON.parse(responseJson), now);
      set(handle, done.replica);
      return JSON.stringify({ reMerged: done.reMerged, newChoiceIds: done.newChoiceIds });
    },
    /** Serve another peer against this replica (the directory as a node). */
    serveSync(handle, requestJson, serverPeerId, now, optionsJson) {
      const parsed = parseSyncRequest(JSON.parse(requestJson));
      if ("error" in parsed) return JSON.stringify({ error: parsed.error, code: parsed.code });
      const r = get2(handle);
      const served = serveSync(r.store, parsed, serverPeerId, now, parse2(optionsJson, {}));
      if ("error" in served) return JSON.stringify(served);
      if (served.changed) set(handle, { ...r });
      return JSON.stringify({ changed: served.changed, response: served.response });
    }
  };
  globalThis.fosCore = api;
})();
/*! Bundled license information:

js-sha3/src/sha3.js:
  (**
   * [js-sha3]{@link https://github.com/emn178/js-sha3}
   *
   * @version 0.9.3
   * @author Chen, Yi-Cyuan [emn178@gmail.com]
   * @copyright Chen, Yi-Cyuan 2015-2023
   * @license MIT
   *)
*/
