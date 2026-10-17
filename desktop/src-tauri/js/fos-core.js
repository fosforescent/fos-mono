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
        var empty2 = function(message) {
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
            if (empty2(n) && empty2(s)) {
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
              f(s);
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
          f(s);
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
              f(s);
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
              f(s);
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
              f(s);
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
        var f = function(s) {
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

  // ../shared/sync/embed.ts
  init_prelude();

  // ../shared/sync/index.ts
  init_prelude();

  // ../shared/sync/graph.ts
  init_prelude();

  // ../shared/sync/destructure.ts
  init_prelude();

  // ../shared/sync/replica.ts
  init_prelude();

  // ../shared/sync/node-sync.ts
  init_prelude();

  // ../shared/sync/node-context.ts
  init_prelude();

  // ../shared/sync/branches.ts
  init_prelude();

  // ../shared/sync/merge.ts
  init_prelude();
  var EMPTY = { data: {}, children: [] };
  function mergeNodes(store, baseCid, oursCid, theirsCid, labels) {
    const newChoiceCids = [];
    const outcome = mergeNode(store, baseCid, oursCid, theirsCid, labels, newChoiceCids, true);
    if (outcome.kind !== "node") throw new Error("conflicting typed refs must be merged through their owning node to resolve the choice");
    return { cid: outcome.cid, newChoiceCids };
  }
  function mergeNode(store, baseCid, oursCid, theirsCid, labels, newChoiceCids, isTop) {
    if (oursCid === theirsCid) return { kind: "node", cid: oursCid };
    if (baseCid === oursCid) return { kind: "node", cid: theirsCid };
    if (baseCid === theirsCid) return { kind: "node", cid: oursCid };
    const base = baseCid ? content(store, baseCid) : EMPTY;
    const ours = content(store, oursCid);
    const theirs = content(store, theirsCid);
    if (isBranchChoice(store, ours) !== isBranchChoice(store, theirs)) {
      const choice = readChoice(store, isBranchChoice(store, ours) ? oursCid : theirsCid);
      const main = choice.options.find((option) => option.peerId === choice.defaultName) ?? choice.options[0];
      const mainEdge = main?.edge;
      if (main && mainEdge) {
        const lift = (cid) => putBranches(store, choice.id, choice.base, [{ peerId: main.peerId, edge: withIdentity(store, mainEdge, cid) }], choice.defaultName);
        return mergeNode(
          store,
          baseCid && !isBranchChoice(store, base) ? lift(baseCid) : baseCid,
          isBranchChoice(store, ours) ? oursCid : lift(oursCid),
          isBranchChoice(store, theirs) ? theirsCid : lift(theirsCid),
          labels,
          newChoiceCids,
          isTop
        );
      }
    }
    if (isBranchChoice(store, ours) && isBranchChoice(store, theirs)) {
      const o = readChoice(store, oursCid), t = readChoice(store, theirsCid);
      const b = baseCid && isBranchChoice(store, base) ? readChoice(store, baseCid) : null;
      const options = [];
      for (const name of new Set([...o.options, ...t.options].map((option) => option.peerId))) {
        const oo = o.options.find((x) => x.peerId === name), tt = t.options.find((x) => x.peerId === name);
        const oe = oo?.edge, te = tt?.edge;
        const be = b?.options.find((x) => x.peerId === name)?.edge;
        if (!oe || !te) {
          const edge = oe ?? te;
          if (edge) options.push({ ...oo ?? tt, peerId: name, edge });
          continue;
        }
        if (!sameShape(store, oe, te)) return { kind: "conflict" };
        const merged = mergeNode(store, be ? identityCid(store, be) : null, identityCid(store, oe), identityCid(store, te), labels, newChoiceCids, false);
        if (merged.kind === "conflict") return merged;
        const beforeRequest = b?.options.find((x) => x.peerId === name)?.requestMerge;
        let requestMerge = oo.requestMerge === beforeRequest ? tt.requestMerge : oo.requestMerge;
        if (oo.requestMerge !== beforeRequest && tt.requestMerge !== beforeRequest && oo.requestMerge !== tt.requestMerge) {
          if (!oo.requestMerge || !tt.requestMerge) return { kind: "conflict" };
          const request = mergeNode(store, beforeRequest ?? null, oo.requestMerge, tt.requestMerge, labels, newChoiceCids, false);
          if (request.kind === "conflict") return request;
          requestMerge = request.cid;
        }
        options.push({ ...oo, peerId: name, edge: withIdentity(store, oe, merged.cid), requestMerge });
      }
      return { kind: "node", cid: putBranches(store, o.id, b?.base ?? o.base, options, b?.defaultName ?? o.defaultName) };
    }
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
      const typed = refTypeCid(store, o.node) || refTypeCid(store, t.node);
      if (typed && refTypeCid(store, o.node) !== refTypeCid(store, t.node)) return { kind: "conflict" };
      let mergedValue;
      if (typed) {
        const ov = valueOf(o), tv = valueOf(t), bv = valueOf(b);
        if (ov === tv || tv === bv) mergedValue = ov;
        else if (ov === bv) mergedValue = tv;
        else {
          const baseChoice = bv && isBranchChoice(store, content(store, bv)) ? readChoice(store, bv) : null;
          const defaultValue = baseChoice ? baseChoice.options.find((option) => option.peerId === baseChoice.defaultName)?.edge?.[0] : bv;
          mergedValue = putRefValueBranches(store, o.node, [bv, ...[ov, tv].filter((cid) => !!cid).sort()], "main", defaultValue);
        }
      } else {
        const merged = mergeNode(store, valueOf(b), oursValue, theirsValue, labels, newChoiceCids, true);
        mergedValue = merged.kind === "node" ? merged.cid : oursValue;
      }
      const book = (r) => ({ data: {}, children: r ? bookkeepingOf(store, r.node).filter((e) => !isPrevEdge(store, e)) : [] });
      const bookkeeping2 = mergeChildren(store, book(b), book(o), book(t), labels, newChoiceCids);
      const valueChanged = mergedValue !== oursValue || mergedValue !== theirsValue;
      const prevEdge = (cid) => [store.primitive.previousVersion.getId(), cid];
      const existingPrev = (r) => r ? r.node.children.filter((e) => isPrevEdge(store, e)) : [];
      const prev = valueChanged ? o.cid === t.cid ? [prevEdge(o.cid)] : [prevEdge(o.cid), prevEdge(t.cid)] : [...existingPrev(o), ...existingPrev(t).filter((e) => !existingPrev(o).some((x) => x[1] === e[1]))];
      const data2 = mergeData(b?.node.data ?? {}, o.node.data, t.node.data, true) ?? o.node.data;
      return { kind: "node", cid: put(store, refNodeContent(store, data2, mergedValue, [...bookkeeping2, ...prev], refTypeCid(store, o.node) ?? refTypeCid(store, t.node))) };
    }
    const data = mergeData(base.data, ours.data, theirs.data, isTop);
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
      if (o && t && sameShape(store, o, t) && (!isChoiceEdge(store, o) || isBranchChoice(store, content(store, o[1])))) {
        const baseIdentity = b && sameShape(store, b, o) && (!isChoiceEdge(store, b) || isBranchChoice(store, content(store, b[1]))) ? identityCid(store, b) : null;
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
      const choiceCid = putChoice(store, id, b && (!isChoiceEdge(store, b) || isBranchChoice(store, content(store, b[1]))) ? b : null, options);
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

  // ../shared/sync/branches.ts
  function createBranch(r, at, name, now, baseName = "main") {
    if (!name.trim() || name.length > 200) throw new Error("A branch name is required (at most 200 characters).");
    if (!at.length) throw new Error("Select a node to branch.");
    const id = at.at(-1), parent = at.slice(0, -1), store = r.store;
    const next = updateAtScope(store, headCid(r), parent, (value) => {
      const found = findAliasEdge(store, value, id);
      if (!found) throw new Error("Node not found");
      const cid = identityCid(store, found.edge);
      const record = isBranchChoice(store, content(store, cid)) ? readChoice(store, cid) : null;
      if (record?.options.some((o) => o.peerId === name) || !record && name === baseName) throw new Error("That branch already exists.");
      const base = record?.base ?? found.edge;
      const active = record ? branchEdge(store, cid) : found.edge;
      const options = record?.options ?? [{ peerId: baseName, edge: found.edge }];
      const choice = putBranches(store, id, base, [...options, { peerId: name, edge: active, base: active }], record?.defaultName ?? baseName);
      return { ...value, children: value.children.map((edge, i2) => i2 === found.index ? [store.primitive.choiceTarget.getId(), choice] : edge) };
    });
    commitRoot(store, next, now);
    selectBranch(store, id, name);
    return { ...r };
  }

  // ../shared/sync/node-provider.ts
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
      const version = Number(prefixed[1]);
      return version in CID_FORMATS ? { version, digest: prefixed[2] } : null;
    }
    if (LEGACY.test(cid)) return { version: 0, digest: cid };
    return null;
  }
  function cidVersion(cid) {
    return parseCid(cid)?.version ?? null;
  }
  function formatCid(version, digest) {
    if (!(version in CID_FORMATS)) throw new Error(`unknown cid version ${version}`);
    return version === 0 ? digest : `v${version}-${digest}`;
  }
  function isCurrentCid(cid) {
    return cidVersion(cid) === CURRENT_CID_VERSION;
  }
  function hashContentAt(content2, version) {
    const format = CID_FORMATS[version];
    if (!format) throw new Error(`unknown cid version ${version}`);
    return formatCid(version, format.digest(content2));
  }
  function hashContent(content2) {
    return hashContentAt(content2, CURRENT_CID_VERSION);
  }
  function verifyCid(cid, content2) {
    const parsed = parseCid(cid);
    if (!parsed) return false;
    return hashContentAt(content2, parsed.version) === cid;
  }

  // ../shared/sync/node-provider.ts
  var LINK_NAME = "fos:node-link:";
  var NodeAccessError = class extends Error {
  };
  function maskOf(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new NodeAccessError("Invalid node mask.");
    const mask = value;
    for (const list of [mask.fields, mask.children]) if (list !== void 0 && (!Array.isArray(list) || list.length > 1e4 || list.some((v) => typeof v !== "string"))) throw new NodeAccessError("Invalid node mask.");
    return { ...mask.fields ? { fields: [...new Set(mask.fields)] } : {}, ...mask.children ? { children: [...new Set(mask.children)] } : {} };
  }
  function sourceId(r, path) {
    if (!path.length) return content(r.store, r.store.rootNodeId).data.alias.id;
    const cid = resolveScope(r.store, headCid(r), path);
    if (!cid) throw new NodeAccessError("Linked node unavailable.");
    return content(r.store, cid).data.alias?.id ?? cid;
  }
  var linkName = (r, peer, path) => LINK_NAME + JSON.stringify([peer, sourceId(r, path)]);
  function linkAt(r, path, peer, remoteId) {
    const name = linkName(r, peer, path);
    const edge = content(r.store, r.store.rootNodeId).children.find((e) => e[0] === capabilityTarget(r.store, "provideNode") && content(r.store, e[1]).data.name?.content === name);
    return edge ? { cid: edge[1] } : void 0;
  }
  function readMask(r, path, peer, remoteId) {
    const link = linkAt(r, path, peer, remoteId);
    if (!link) return {};
    const target = refValueCid(r.store, content(r.store, link.cid));
    if (!target) throw new NodeAccessError("Node link has no policy.");
    try {
      return maskOf(JSON.parse(content(r.store, target).data.description?.content ?? "null"));
    } catch {
      throw new NodeAccessError("Invalid node link policy.");
    }
  }
  var NODE_PERMISSION_DEFAULT = "fos:all-linked-peers";
  function nodeLinkMaskAt(r, path, peer) {
    let fields, children;
    for (let i2 = 0; i2 <= path.length; i2++) {
      const at = path.slice(0, i2);
      if (!resolveScope(r.store, headCid(r), at)) break;
      for (const target of [NODE_PERMISSION_DEFAULT, peer]) {
        const mask = readMask(r, at, target, "");
        if (mask.fields) fields = fields ? fields.filter((f) => mask.fields.includes(f)) : [...mask.fields];
        if (i2 < path.length && mask.children && !mask.children.includes(path[i2])) throw new NodeAccessError("Parent permissions mask this child.");
        if (i2 === path.length && mask.children) children = children ? children.filter((id) => mask.children.includes(id)) : [...mask.children];
      }
    }
    return { ...fields ? { fields } : {}, ...children ? { children } : {} };
  }
  function inheritedNodeGrants(r, path, authority) {
    let grants = authority.owner ? [...CAPABILITIES] : [];
    for (let i2 = 0; i2 <= path.length; i2++) {
      const cid = resolveScope(r.store, headCid(r), path.slice(0, i2));
      if (!cid) throw new NodeAccessError("Attachment unavailable.");
      const member = readMembers(r.store, content(r.store, cid)).find((m) => m.peerId === authority.peerId);
      if (!member) continue;
      grants = member.capabilities.filter((cap) => !member.disabled?.includes(cap));
      if (member.disabled?.includes("read") || member.disabled?.includes("provideNode") || !grants.includes("read") && !grants.includes("edit")) throw new NodeAccessError("Parent permissions deny node access.");
    }
    return grants;
  }
  function permitted(r, cid, peer, inherited) {
    const member = readMembers(r.store, content(r.store, cid)).find((m) => m.peerId === peer);
    if (!member) return inherited;
    if (member.disabled?.includes("read") || member.disabled?.includes("provideNode")) return false;
    return member.capabilities.some((cap) => (cap === "read" || cap === "edit") && !member.disabled?.includes(cap));
  }
  function hasNodeLinkMasks(store, peer, scope) {
    const sourceIds = /* @__PURE__ */ new Set([content(store, store.rootNodeId).data.alias?.id ?? store.rootNodeId]);
    for (let i2 = 1; i2 <= scope.length; i2++) {
      const cid = resolveScope(store, rootTargetCid(store), scope.slice(0, i2));
      if (cid) sourceIds.add(content(store, cid).data.alias?.id ?? cid);
    }
    const scoped = resolveScope(store, rootTargetCid(store), scope);
    const pending = scoped ? [scoped] : [], visited = /* @__PURE__ */ new Set();
    while (pending.length) {
      const cid = pending.pop();
      if (visited.has(cid)) continue;
      visited.add(cid);
      const node = content(store, cid);
      sourceIds.add(node.data.alias?.id ?? cid);
      if (isHandle(node)) continue;
      for (const edge of valueContent(store, cid).children) if (rowKindOf(store, edge)) pending.push(identityCid(store, edge));
    }
    return content(store, store.rootNodeId).children.some((edge) => {
      if (edge[0] !== capabilityTarget(store, "provideNode")) return false;
      const ref = content(store, edge[1]), name = ref.data.name?.content;
      if (!name?.startsWith(LINK_NAME) || peer && ref.data.ref?.peer !== peer && ref.data.ref?.peer !== NODE_PERMISSION_DEFAULT) return false;
      try {
        const [, id] = JSON.parse(name.slice(LINK_NAME.length));
        if (!sourceIds.has(id)) return false;
        if (ref.data.description?.content === "fos:node-projection") return true;
        const target = refValueCid(store, ref);
        const mask = maskOf(JSON.parse(target ? content(store, target).data.description?.content ?? "null" : "null"));
        return mask.fields !== void 0 || mask.children !== void 0;
      } catch {
        return true;
      }
    });
  }
  function hasNodeReadBoundary(r, scope, peer) {
    return withMainBranchPolicy(r.store, () => {
      const root = resolveScope(r.store, headCid(r), scope);
      if (!root) return false;
      const pending = [root], seen = /* @__PURE__ */ new Set();
      while (pending.length) {
        const cid = pending.pop();
        if (seen.has(cid)) continue;
        seen.add(cid);
        if (!permitted(r, cid, peer, true)) return true;
        if (isHandle(content(r.store, cid))) continue;
        for (const edge of valueContent(r.store, cid).children) if (rowKindOf(r.store, edge)) pending.push(identityCid(r.store, edge));
      }
      return false;
    });
  }

  // ../shared/sync/node-context.ts
  var prefix = (a, b) => a.length <= b.length && a.every((v, i2) => v === b[i2]);
  function nodeAuthorityAt(r, path, authority) {
    return withMainBranchPolicy(r.store, () => {
      if (!prefix(authority.scope, path)) throw new NodeAccessError("Node is outside the attachment.");
      let grants = inheritedNodeGrants(r, authority.scope, authority);
      for (let i2 = authority.scope.length; i2 <= path.length; i2++) {
        const at = path.slice(0, i2), cid = resolveScope(r.store, headCid(r), at);
        if (!cid) {
          if (i2 === authority.scope.length) throw new NodeAccessError("Attachment unavailable.");
          break;
        }
        const member = readMembers(r.store, content(r.store, cid)).find((m) => m.peerId === authority.peerId);
        if (member) grants = member.capabilities.filter((c) => !member.disabled?.includes(c) && !(c === "read" && member.disabled?.includes("provideNode")));
        if (!grants.includes("read") && !grants.includes("edit")) throw new NodeAccessError("Node access denied.");
        if (member?.disabled?.includes("read") || member?.disabled?.includes("provideNode")) throw new NodeAccessError("Node access denied.");
        const mask = nodeLinkMaskAt(r, at, authority.peerId);
        if (i2 < path.length && mask?.children && !mask.children.includes(path[i2])) throw new NodeAccessError("Node child is masked.");
        if (i2 < path.length && isHandle(content(r.store, cid))) throw new NodeAccessError("Reference targets require their own attachment.");
      }
      return grants;
    });
  }

  // ../shared/sync/node-sync.ts
  var forbidden = /* @__PURE__ */ new Set(["alias", "ref", "versionControl", "disabledCapabilities", "peerId", "__proto__", "constructor", "prototype"]);
  var empty = () => ({ data: {}, children: [] });
  var equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  var childValue = (child) => child && { id: child.id, kind: child.kind, ...child.kind === "ref" ? { address: child.address } : {} };
  var nodeSyncKey = (peer, path, branches) => JSON.stringify(branches?.length ? [peer, path, [...branches].sort((a, b) => JSON.stringify(a.scope).localeCompare(JSON.stringify(b.scope)))] : [peer, path]);
  function nodeShape(r, path, root = headCid(r)) {
    const cid = resolveScope(r.store, root, path);
    if (!cid || isHandle(content(r.store, cid))) return empty();
    const value = valueContent(r.store, cid);
    const children = [];
    for (const edge of value.children) {
      const kind = rowKindOf(r.store, edge);
      if (!kind) continue;
      const child = content(r.store, identityCid(r.store, edge)), id = child.data.alias?.id;
      if (!id) continue;
      const ref = isPeerReference(child) ? child.data.ref : void 0;
      children.push({ id, kind: ref?.kind && ROW_KINDS.includes(ref.kind) ? ref.kind : kind, address: { peerId: ref?.peer ?? r.meta.peerId, scope: ref?.scope ?? [...path, id], ...ref?.branches ? { branches: ref.branches } : !ref && nodeBranches(r, path, false).length ? { branches: nodeBranches(r, path, false) } : {} } });
    }
    return { data: Object.fromEntries(Object.entries(value.data).filter(([key]) => !forbidden.has(key))), children };
  }
  function sameNodeShape(a, b) {
    return equal(a.data, b.data) && equal(a.children.map(childValue), b.children.map(childValue));
  }
  function materializedNodePaths(r, at) {
    const paths = [], queue = [at];
    while (queue.length) {
      const path = queue.pop(), cid = resolveScope(r.store, headCid(r), path);
      if (!cid || isHandle(content(r.store, cid))) continue;
      paths.push(path);
      for (const child of nodeShape(r, path).children) if (child.kind !== "ref") queue.push([...path, child.id]);
    }
    return paths.sort((a, b) => a.length - b.length);
  }
  function nodePersistenceAllowed(r, path) {
    for (let i2 = 0; i2 <= path.length; i2++) {
      const cid = resolveScope(r.store, headCid(r), path.slice(0, i2));
      if (!cid) return false;
      if (readMembers(r.store, content(r.store, cid)).some((m) => m.peerId === "fos" && m.disabled?.includes("persist"))) return false;
    }
    return true;
  }
  function nodeBranches(r, path, remote = true) {
    const result = [];
    const offset = remote ? r.meta.scope : [];
    const root = r.meta.localScope ?? [];
    if (r.meta.branch) result.push({ scope: [...offset, ...root], name: r.meta.branch });
    const selections = scopeBranches(r.store, headCid(r), path);
    for (let i2 = root.length; i2 <= path.length; i2++) {
      const name = selections[path[i2 - 1]];
      const scope = [...offset, ...path.slice(0, i2)];
      if (name && !result.some((b) => JSON.stringify(b.scope) === JSON.stringify(scope))) result.push({ scope, name });
    }
    return result;
  }

  // ../shared/dag-implementation/store.ts
  init_prelude();

  // ../shared/utils.ts
  init_prelude();

  // ../shared/defaults.ts
  init_prelude();

  // ../shared/utils.ts
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

  // ../shared/node_modules/uuid/dist/esm-browser/index.js
  init_prelude();

  // ../shared/node_modules/uuid/dist/esm-browser/stringify.js
  init_prelude();
  var byteToHex = [];
  for (i = 0; i < 256; ++i) {
    byteToHex.push((i + 256).toString(16).slice(1));
  }
  var i;
  function unsafeStringify(arr, offset = 0) {
    return (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + "-" + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + "-" + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + "-" + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + "-" + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase();
  }

  // ../shared/node_modules/uuid/dist/esm-browser/rng.js
  init_prelude();
  var getRandomValues;
  var rnds8 = new Uint8Array(16);
  function rng() {
    if (!getRandomValues) {
      getRandomValues = typeof crypto !== "undefined" && crypto.getRandomValues && crypto.getRandomValues.bind(crypto);
      if (!getRandomValues) {
        throw new Error("crypto.getRandomValues() not supported. See https://github.com/uuidjs/uuid#getrandomvalues-not-supported");
      }
    }
    return getRandomValues(rnds8);
  }

  // ../shared/node_modules/uuid/dist/esm-browser/v4.js
  init_prelude();

  // ../shared/node_modules/uuid/dist/esm-browser/native.js
  init_prelude();
  var randomUUID = typeof crypto !== "undefined" && crypto.randomUUID && crypto.randomUUID.bind(crypto);
  var native_default = {
    randomUUID
  };

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
  var v4_default = v4;

  // ../shared/dag-implementation/primitive-node.ts
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
  var getCalendarCapabilityNode = (store) => generateConstructor(store, "CALENDARCAPABILITY", { description: { content: "Capability - provides a calendar (time allocations) for calendar requirements" } }, []);
  var getLlmCapabilityNode = (store) => generateConstructor(store, "LLMCAPABILITY", { description: { content: "Capability - a language model that can answer or act on rows" } }, []);
  var getRepoCapabilityNode = (store) => generateConstructor(store, "REPOCAPABILITY", { description: { content: "Capability - code repositories (issues, pull requests) as rows" } }, []);
  var getToolCapabilityNode = (store) => generateConstructor(store, "TOOLCAPABILITY", { description: { content: "Capability - runs tools (an MCP server attached to the node) for tool requirements under it" } }, []);
  var getSendPaymentCapabilityNode = (store) => generateConstructor(store, "SENDPAYMENTCAPABILITY", { description: { content: "Capability - send payment" } }, []);
  var getReceivePaymentCapabilityNode = (store) => generateConstructor(store, "RECEIVEPAYMENTCAPABILITY", { description: { content: "Capability - receive payment" } }, []);
  var getAllocateCapabilityNode = (store) => generateConstructor(store, "ALLOCATECAPABILITY", { description: { content: "Capability - allocate" } }, []);
  var getRequestPaymentCapabilityNode = (store) => generateConstructor(store, "REQUESTPAYMENTCAPABILITY", { description: { content: "Capability - request payment" } }, []);
  var getNotifyCapabilityNode = (store) => generateConstructor(store, "NOTIFYCAPABILITY", { description: { content: "Capability - notify" } }, []);
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
    const calendarCapability = getCalendarCapabilityNode(store);
    const llmCapability = getLlmCapabilityNode(store);
    const repoCapability = getRepoCapabilityNode(store);
    const toolCapability = getToolCapabilityNode(store);
    const sendPaymentCapability = getSendPaymentCapabilityNode(store);
    const receivePaymentCapability = getReceivePaymentCapabilityNode(store);
    const allocateCapability = getAllocateCapabilityNode(store);
    const requestPaymentCapability = getRequestPaymentCapabilityNode(store);
    const notifyCapability = getNotifyCapabilityNode(store);
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
      calendarCapability,
      llmCapability,
      repoCapability,
      toolCapability,
      sendPaymentCapability,
      receivePaymentCapability,
      allocateCapability,
      requestPaymentCapability,
      notifyCapability,
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
      const version = cidVersion(cid);
      if (version === null) throw new MigrationError(`node ${cid} is not a recognised cid`, cid);
      if (version > target) throw new MigrationError(`node ${cid} is newer (v${version}) than the target format v${target}`, cid);
      fromVersions.add(version);
      let upgraded = content2;
      for (const step of stepsBetween(version, target)) {
        if (step.upgrade) upgraded = step.upgrade(upgraded);
      }
      const children = upgraded.children.map(([instr, targetCid]) => [migrate(instr), migrate(targetCid)]);
      const next = { ...upgraded, children };
      const unchanged = version === target && children.every((edge, i2) => edge[0] === upgraded.children[i2]?.[0] && edge[1] === upgraded.children[i2]?.[1]);
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
    /** The current address of a cid from a context loaded in an older format (identity otherwise). */
    remapCid(cid) {
      return this.migration?.mapping[cid] ?? cid;
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
  };

  // ../shared/sync/replication.ts
  init_prelude();
  function replicationView(store, roots, provider) {
    const nodes = reachableNodes(store, roots);
    const excluded = /* @__PURE__ */ new Map();
    for (const node of Object.values(nodes)) {
      const id = node.data.alias?.id;
      if (!id) continue;
      if (isPeerReference(node)) excluded.set(id, node.data.ref.peer);
      else if (readMembers(store, node).some((m) => m.peerId === "fos" && m.disabled?.includes("persist"))) {
        const peers = node.children.filter((edge) => isPeerEdge(store, edge)).map(([, cid]) => content(store, cid).data.peerId?.content).filter((id2) => !!id2 && id2 !== "fos").sort();
        if (!excluded.has(id)) excluded.set(id, peers[0] ?? provider);
      }
    }
    const visited = /* @__PURE__ */ new Set();
    const protect = (cid, peer) => {
      if (visited.has(cid)) return;
      visited.add(cid);
      const node = content(store, cid), id = node.data.alias?.id;
      if (id && !excluded.has(id)) excluded.set(id, peer);
      for (const edge of node.children) {
        if (isMemberEdge(store, edge) || isPeerEdge(store, edge)) continue;
        for (const child of edge) protect(child, peer);
      }
    };
    for (const [cid, node] of Object.entries(nodes)) {
      const peer = excluded.get(node.data.alias?.id ?? "");
      if (peer && !isPeerReference(node)) protect(cid, peer);
    }
    const allowed = /* @__PURE__ */ new Set(), liveSeen = /* @__PURE__ */ new Set();
    const live = (cid, inherited = false) => {
      const key = cid + ":" + inherited;
      if (liveSeen.has(key)) return;
      liveSeen.add(key);
      const node = content(store, cid);
      if (isHandle(node)) return;
      const fos = readMembers(store, node).find((m) => m.peerId === "fos");
      if (fos?.disabled?.includes("persist")) return;
      const enabled = fos ? !fos.disabled?.includes("persist") && (fos.capabilities.includes("persist") || fos.accepts?.includes("persist") === true) : inherited;
      if (enabled) allowed.add(cid);
      for (const edge of node.children) {
        if (isBookkeepingEdge(store, edge)) continue;
        for (const child of edge) live(child, enabled);
      }
    };
    const liveRoot = roots[0];
    if (liveRoot && store.table.has(liveRoot)) live(liveRoot);
    const memo = /* @__PURE__ */ new Map();
    const project = (cid) => {
      const cached = memo.get(cid);
      if (cached) return cached;
      const node = content(store, cid), id = node.data.alias?.id;
      if (isPeerReference(node)) {
        memo.set(cid, cid);
        return cid;
      }
      const peer = id && excluded.get(id);
      if (peer && !allowed.has(cid)) {
        let ref = { data: { alias: { id }, ref: { id, peer, version: cid } }, children: [] };
        ref = withPeer(store, withMember(store, ref, "fos", "fos", CAPABILITIES, CAPABILITIES, []), peer);
        const result2 = put(store, ref);
        memo.set(cid, result2);
        return result2;
      }
      const children = node.children.map(([left, right]) => [project(left), project(right)]);
      const result = children.every((edge, i2) => edge[0] === node.children[i2][0] && edge[1] === node.children[i2][1]) ? cid : put(store, { ...node, children });
      memo.set(cid, result);
      return result;
    };
    return { project };
  }
  function restorePeerReferences(store, root, availableRoots) {
    const available = new Set(Object.keys(reachableNodes(store, availableRoots)));
    const memo = /* @__PURE__ */ new Map();
    const restore = (cid) => {
      const cached = memo.get(cid);
      if (cached) return cached;
      const node = content(store, cid);
      if (isPeerReference(node)) {
        const version = node.data.ref.version;
        if (available.has(version) && store.table.has(version) && content(store, version).data.alias?.id === node.data.ref.id && !isPeerReference(content(store, version))) {
          memo.set(cid, version);
          return version;
        }
        memo.set(cid, cid);
        return cid;
      }
      const children = node.children.map(([left, right]) => [restore(left), restore(right)]);
      const result = children.every((edge, i2) => edge[0] === node.children[i2][0] && edge[1] === node.children[i2][1]) ? cid : put(store, { ...node, children });
      memo.set(cid, result);
      return result;
    };
    return restore(root);
  }

  // ../shared/sync/protocol.ts
  init_prelude();
  function parseSyncRequest(body) {
    if (!body || typeof body !== "object") return { error: "request body must be an object", code: "bad-request" };
    const raw = body;
    if (raw.version !== SYNC_FORMAT_VERSION) return { error: `unsupported sync version ${String(raw.version)}; update the app`, code: "version-mismatch" };
    if (typeof raw.cidVersion !== "number") return { error: "cidVersion required", code: "bad-request" };
    if (typeof raw.peerId !== "string" || !raw.peerId || raw.peerId.length > 128) return { error: "peerId must be a non-empty string", code: "bad-request" };
    if (!Array.isArray(raw.scope) || raw.scope.length > 32 || !raw.scope.every((s) => typeof s === "string" && s.length > 0 && s.length <= 128)) {
      return { error: "scope must be an array of ids", code: "bad-request" };
    }
    if (typeof raw.headCid !== "string" || !raw.headCid) return { error: "headCid required", code: "bad-request" };
    if (raw.baseCid !== null && raw.baseCid !== void 0 && typeof raw.baseCid !== "string") return { error: "baseCid must be a cid or null", code: "bad-request" };
    if (raw.nodes !== void 0 && (typeof raw.nodes !== "object" || raw.nodes === null)) return { error: "nodes must be an object", code: "bad-request" };
    if (raw.branches !== void 0 && (!raw.branches || typeof raw.branches !== "object" || Array.isArray(raw.branches) || Object.keys(raw.branches).length > 32 || Object.entries(raw.branches).some(([id, name]) => !id || id.length > 128 || typeof name !== "string" || !name || name.length > 200))) return { error: "Invalid ancestor branch selections", code: "bad-request" };
    return {
      version: SYNC_FORMAT_VERSION,
      cidVersion: raw.cidVersion,
      peerId: raw.peerId,
      scope: [...raw.scope],
      baseCid: raw.baseCid ?? null,
      headCid: raw.headCid,
      nodes: raw.nodes ?? {},
      ...raw.selective === true ? { selective: true } : {},
      ...raw.wholeNode === true ? { wholeNode: true } : {},
      ...raw.branches ? { branches: { ...raw.branches } } : {},
      ...typeof raw.branch === "string" && raw.branch.length > 0 && raw.branch.length <= 200 ? { branch: raw.branch } : {}
    };
  }
  function serveSync(store, request, serverPeerId, now = Date.now(), options = {}) {
    if (hasNodeLinkMasks(store, request.peerId, request.scope)) return { error: "This attachment has node masks; use provideNode for permission-filtered traversal.", code: "bad-request" };
    if (hasNodeReadBoundary(createReplica(serverPeerId, store), request.scope, request.peerId)) return { error: "This attachment has a read boundary; use provideNode for permission-filtered traversal.", code: "bad-request" };
    if (Object.values(request.nodes).some((node) => node?.data?.ref?.version === "unloaded")) return { error: "An unloaded node cannot be merged as a complete subtree.", code: "bad-request" };
    if (request.branches) return withBranches(store, request.branches, () => serveSync(store, { ...request, branches: void 0 }, serverPeerId, now, options));
    if (request.version !== SYNC_FORMAT_VERSION) return { error: "Sync format changed; update the app", code: "version-mismatch" };
    if (request.cidVersion !== CURRENT_CID_VERSION) {
      return { error: `peer uses cid format v${request.cidVersion}, this side uses v${CURRENT_CID_VERSION}`, code: "version-mismatch" };
    }
    importNodes(store, request.nodes);
    if (!hasNode(store, request.headCid)) {
      const sent = request.nodes[request.headCid];
      const references = (node) => node && Array.isArray(node.children) ? node.children.flat().filter((cid) => typeof cid === "string") : [];
      const missing = references(sent).filter((cid) => !store.table.has(cid));
      const detail = !sent ? "the head node itself was not sent" : missing.length ? `head references unknown nodes: ${missing.map((c) => c.slice(0, 16)).join(", ")}` : "the head node did not verify";
      const missingNodeIds = [.../* @__PURE__ */ new Set([request.headCid, ...Object.values(request.nodes).flatMap(references)])].filter((cid) => !store.table.has(cid) && !request.nodes[cid]);
      return { error: `head node not provided (${detail})`, code: "missing-nodes", missingNodeIds };
    }
    const peerKnown = reachableSet(store, [request.headCid, request.baseCid]);
    const rootTarget = rootTargetCid(store);
    if (!request.scope.length && findChild(store, rootTarget, HOME_ID) && !findChild(store, request.headCid, HOME_ID)) {
      request = { ...request, headCid: homeContextCid(store, request.headCid, 0), baseCid: request.baseCid ? homeContextCid(store, request.baseCid, 0) : null };
    }
    const scope = contextScope(store, rootTarget, request.scope);
    const scopedRequest = scope === request.scope ? request : { ...request, scope };
    if (scopedRequest !== request) {
      const result = serveSync(store, scopedRequest, serverPeerId, now, options);
      if (!("error" in result)) result.response.scope = request.scope;
      return result;
    }
    let currentCid = resolveScope(store, rootTarget, request.scope);
    if (!currentCid) return { error: "scope not found", code: "scope-not-found" };
    const originalCurrent = currentCid;
    if (request.selective || options.recipient === "server") {
      const sent = content(store, request.headCid);
      const live = request.headCid === request.baseCid || !Object.keys(sent.data).length && !sent.children.length ? currentCid : request.headCid;
      const projection = replicationView(store, [live, currentCid, request.headCid, request.baseCid], request.peerId);
      currentCid = projection.project(currentCid);
      request = { ...request, headCid: projection.project(request.headCid), baseCid: request.baseCid && hasNode(store, request.baseCid) ? projection.project(request.baseCid) : null };
    }
    if (!request.selective && options.recipient !== "server") {
      const available = [currentCid, request.headCid];
      currentCid = restorePeerReferences(store, currentCid, available);
      request = { ...request, headCid: restorePeerReferences(store, request.headCid, available), baseCid: request.baseCid && hasNode(store, request.baseCid) ? restorePeerReferences(store, request.baseCid, available) : null };
    }
    if ((!request.wholeNode || options.proposeOnly) && isBranchChoice(store, content(store, currentCid))) {
      const choice = readChoice(store, currentCid);
      const name = request.branch ?? branchSelection(store, currentCid);
      const selected = choice.options.find((option) => option.peerId === name)?.edge;
      if (!selected) return { error: `branch not found: ${name}`, code: "scope-not-found" };
      const branchStore = new FosStore();
      importNodes(branchStore, reachableNodes(store, [identityCid(store, selected), request.headCid, request.baseCid]));
      commitRoot(branchStore, identityCid(store, selected), now);
      const served = serveSync(branchStore, { ...request, scope: [], branch: void 0, nodes: {} }, serverPeerId, now, options);
      if ("error" in served) return served;
      const branchHead = rootTargetCid(branchStore);
      importNodes(store, reachableNodes(branchStore, [branchHead, served.response.resultCid]));
      if (served.changed) {
        const replacement = putBranches(store, choice.id, choice.base, choice.options.map((option) => option.peerId === name ? { ...option, edge: withIdentity(store, selected, branchHead) } : option), choice.defaultName);
        const next = request.scope.length ? updateAtScope(store, rootTarget, request.scope.slice(0, -1), (value) => ({ ...value, children: value.children.map((edge) => identityCid(store, edge) === currentCid ? withIdentity(store, edge, replacement) : edge) })) : replacement;
        commitRoot(store, next, now);
      }
      served.response.scope = request.scope;
      served.response.branch = name;
      return served;
    }
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
    const changed = resultCid !== originalCurrent;
    if (changed) {
      const newRootTarget = updateAtScope(store, rootTarget, request.scope, () => content(store, resultCid), request.wholeNode ? "replace" : "node");
      commitRoot(store, newRootTarget, now);
    }
    const known = /* @__PURE__ */ new Set([...Object.keys(request.nodes), ...peerKnown]);
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
    const peerEdited = baseStripped ? headStripped !== baseStripped : !existing || headStripped !== existing.contentCid;
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
    if (action === "propose" && existing?.status === "rejected" && peerEdited) {
      const fresh = mergeNodes(store, baseStripped ?? existing.contentCid, mainStripped, headStripped, { ours: serverPeerId, theirs: request.peerId });
      branchCid = fresh.cid;
      newChoiceCids = fresh.newChoiceCids;
    }
    if (action === "propose" && branchCid === mainStripped) {
      proposalCid = null;
      action = "pull";
    } else if (action === "propose") {
      const sameContent = existing && existing.contentCid === branchCid && existing.baseCid === mainStripped;
      const status = existing?.status === "rejected" && !peerEdited ? "rejected" : "open";
      const unchanged = sameContent && existing.status === status;
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
    const bookkeeping2 = bookkeepingOf(store, persisted);
    const resultContent = refNodeContent(store, { ...persisted.data, alias: persisted.data.alias ?? content(store, branchCid).data.alias ?? { id: request.scope[request.scope.length - 1] ?? "" } }, branchCid, bookkeeping2, refTypeCid(store, persisted));
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
  function applySyncResponse(store, request, response, localPeerId, now, localScope = []) {
    if (response.version !== SYNC_FORMAT_VERSION) throw new Error("Sync format changed; update the app and server");
    if (response.cidVersion !== CURRENT_CID_VERSION) {
      throw new Error(`server uses cid format v${response.cidVersion}, this client uses v${CURRENT_CID_VERSION}`);
    }
    importNodes(store, response.nodes);
    if (!hasNode(store, response.resultCid)) throw new Error("sync response did not include the result node");
    const root = rootTargetCid(store);
    let current = resolveScope(store, root, localScope);
    if (!current) throw new Error("The shared node was removed while sync was in flight.");
    const localContent = current;
    if (request.selective) {
      const projection = replicationView(store, [current, request.headCid, response.resultCid], localPeerId);
      current = projection.project(current);
      request = { ...request, headCid: projection.project(request.headCid) };
      response = { ...response, resultCid: projection.project(response.resultCid) };
    }
    const publish = (value) => {
      const cid = request.selective ? restorePeerReferences(store, value, [localContent]) : value;
      return commitRoot(store, localScope.length ? updateAtScope(store, root, localScope, () => content(store, cid), "replace") : cid, now);
    };
    if (current === request.headCid) {
      publish(response.resultCid);
      return { reMerged: false, newChoiceIds: [...response.newChoiceIds] };
    }
    const merged = mergeNodes(store, request.headCid, current, response.resultCid, { ours: localPeerId, theirs: response.peerId });
    publish(merged.cid);
    const localChoiceIds = merged.newChoiceCids.map((cid) => content(store, cid).data.alias?.id ?? cid);
    return { reMerged: true, newChoiceIds: [...response.newChoiceIds, ...localChoiceIds] };
  }

  // ../shared/sync/replica.ts
  function createReplica(peerId = newId(), store = new FosStore()) {
    return {
      store,
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
        ...meta.nodeSync && typeof meta.nodeSync === "object" ? { nodeSync: meta.nodeSync } : {},
        ...Array.isArray(meta.localScope) && meta.localScope.length <= 64 && meta.localScope.every((id) => typeof id === "string") ? { localScope: [...meta.localScope] } : {},
        lastSyncAt: typeof meta.lastSyncAt === "number" ? meta.lastSyncAt : null,
        serverPeerId: typeof meta.serverPeerId === "string" ? meta.serverPeerId : null,
        ...typeof meta.branch === "string" ? { branch: meta.branch } : {},
        ...meta.branches && typeof meta.branches === "object" ? { branches: Object.fromEntries(Object.entries(meta.branches).filter(([, name]) => typeof name === "string")) } : {}
      }
    };
  }
  function homePath(replica) {
    return findChild(replica.store, headCid(replica), HOME_ID) ? [HOME_ID] : [];
  }
  function shareHome(replica) {
    if (replica.meta.scope.length || replica.meta.localScope?.length || !homePath(replica).length) return replica;
    const baseCid = replica.meta.baseCid ? findChild(replica.store, replica.meta.baseCid, HOME_ID) : null;
    return { ...replica, meta: { ...replica.meta, localScope: [HOME_ID], baseCid } };
  }
  function headCid(replica) {
    return rootTargetCid(replica.store);
  }
  function isDirty(replica) {
    if (replica.meta.nodeSync && replica.meta.serverPeerId) return materializedNodePaths(replica, replica.meta.localScope ?? []).some((path) => {
      if (!nodePersistenceAllowed(replica, path)) return false;
      const state = replica.meta.nodeSync[nodeSyncKey(replica.meta.serverPeerId, path, nodeBranches(replica, path))];
      return !state || !sameNodeShape(nodeShape(replica, path), state.local);
    });
    const head = resolveScope(replica.store, headCid(replica), replica.meta.localScope ?? []);
    if (!head) return true;
    if (replica.meta.baseCid) return head !== replica.meta.baseCid && replicationView(replica.store, [head, replica.meta.baseCid], replica.meta.peerId).project(head) !== replica.meta.baseCid;
    return valueContent(replica.store, head).children.length > 0;
  }
  function view(replica, at, constructors = false) {
    const cid = resolveScope(replica.store, headCid(replica), at);
    return cid ? viewNode(replica.store, cid, constructors) : null;
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
    return edge && (isRowEdge(replica.store, edge) || content(replica.store, identityCid(replica.store, edge)).data.name?.content.startsWith("fos:setting:")) ? edge : void 0;
  }
  function withTextParameters(store, node) {
    const names = [...new Set(Array.from((node.data.description?.content ?? "").matchAll(/(?<![\\{@])\{([A-Za-z_][\w.-]*)\}(?!\})/g), (m) => m[1]))];
    const type = store.primitive.documentField.getId(), children = [...node.children];
    for (const name of names) {
      if (name === void 0) continue;
      if (children.some((edge) => content(store, identityCid(store, edge)).data.name?.content === name)) continue;
      const id = `${node.data.alias?.id ?? newId()}:param:${name}`;
      const ref = put(store, refNodeContent(store, { alias: { id }, name: { content: name } }, null, [], type));
      children.push([type, ref]);
    }
    return children.length === node.children.length ? node : { ...node, children };
  }
  function addTask(replica, at, title, now, id = newId()) {
    const trimmed = title.trim();
    if (!trimmed) return replica;
    return edit(replica, at, now, (value) => {
      const cid = put(replica.store, withTextParameters(replica.store, taskContent(id, trimmed, false, now, now)));
      return { ...value, children: [...value.children, taskEdge(replica.store, cid)] };
    });
  }
  function addRow(replica, at, kind, text, now, options = {}) {
    const body = kind === "note" ? text.replace(/\s+$/, "") : text.trim();
    if (!body && !["ref", "plain", "comment", "requirement", "supply", "allocation"].includes(kind)) return replica;
    if (kind === "ref" && !options.refId) return replica;
    const id = options.id ?? newId();
    return edit(replica, at, now, (value) => {
      const { position: _p, id: _i, ...extras } = options;
      const cid = put(replica.store, withTextParameters(replica.store, rowContent(kind, id, body, now, { ...extras, store: replica.store })));
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
  function addSupply(replica, at, requirementId, supply, now, id) {
    const labels = {
      confirmation: `confirmed by ${supply.by}`,
      choice: `chose option ${(supply.choice ?? 0) + 1}`,
      search: "search results",
      allocation: "allocation",
      task: "task done",
      market: `listed on the market by ${supply.by}`,
      mail: `mail sent by ${supply.by}`,
      peer: `done by ${supply.by}`,
      llm: `answered by ${supply.by}`,
      repo: `issue opened by ${supply.by}`,
      tool: `run by ${supply.by}`
    };
    return addRow(replica, [...at, requirementId], "supply", labels[supply.capability], now, { supply: { ...supply, at: now }, id });
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
      return withTextParameters(replica.store, { ...task, data: { ...task.data, description: { content: trimmed } } });
    });
  }
  function deleteTask(replica, at, taskId, now) {
    const parent = resolveScope(replica.store, headCid(replica), at);
    const edge = parent && findEdge(replica.store, content(replica.store, parent), `a:${taskId}`);
    if (edge && [replica.store.primitive.memberField.getId(), replica.store.primitive.peerField.getId()].includes(edge[0])) return editNode(replica, at, now, (node) => replaceEdge(replica.store, node, `a:${taskId}`, null));
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
  function addRefAt(replica, at, id, typeCid, now, defaultCid = null, name) {
    return edit(replica, at, now, (value) => {
      if (findEdge(replica.store, value, `a:${id}`)) return value;
      const ref = put(replica.store, refNodeContent(replica.store, { alias: { id }, ...name ? { name: { content: name } } : {}, updated: { time: now } }, defaultCid, [], typeCid));
      return { ...value, children: [...value.children, [typeCid, ref]] };
    });
  }
  function proposeRefAt(replica, at, targetCid, peerId, now) {
    const store = replica.store;
    const cid = resolveScope(store, headCid(replica), at);
    if (!cid || !store.table.has(targetCid)) throw new Error("ref or proposed value not found");
    const ref = content(store, cid);
    if (!isRefNode(store, ref) || !refTypeCid(store, ref)) throw new Error("expected a typed ref");
    const proposalCid = put(store, proposalContent(store, peerId, "binding", targetCid, refBindingBaseCid(store, ref), now));
    return { replica: editNode(replica, at, now, (node) => withProposal(store, node, peerId, proposalCid, "binding")), proposalCid };
  }
  function applyProposalAt(replica, at, proposalCid, approverPeerId, now) {
    const store = replica.store;
    return editNode(replica, at, now, (value) => {
      const proposal = readProposal(store, proposalCid);
      if (!proposal || proposal.status !== "open" || !readProposals(store, value).some((p) => p.cid === proposalCid)) return value;
      const main = putStripped(store, value);
      if (refTypeCid(store, value)) {
        if (proposal.baseCid !== refBindingBaseCid(store, value)) return value;
        const previous = refValueCid(store, value);
        let target = proposal.contentCid;
        if (previous && previous !== target) {
          const inherited = Object.values(scopeBranches(store, headCid(replica), at.slice(0, -1))).at(-1) ?? replica.meta.branch ?? "main";
          target = putRefValueBranches(store, value, [previous, target], inherited, target);
          selectBranch(store, value.data.alias.id, readChoice(store, target).defaultName);
        }
        const next = refNodeContent(store, { ...value.data, updated: { time: now } }, target, bookkeepingOf(store, value), refTypeCid(store, value));
        return removeProposalByCid(store, withPrev(store, next, put(store, value)), proposalCid);
      }
      const mergedCid = proposal.baseCid === main ? proposal.contentCid : mergeNodes(store, proposal.baseCid, main, proposal.contentCid, { ours: approverPeerId, theirs: proposal.peerId }).cid;
      const linkCid = put(store, value);
      const relinked = relinkContent(store, value, linkCid, content(store, mergedCid), now);
      return removeProposalByCid(store, relinked, proposalCid);
    });
  }
  function rejectProposalAt(replica, at, proposalCid, now) {
    return editNode(replica, at, now, (node) => markProposalRejected(replica.store, node, proposalCid));
  }
  function assertServerReplicationAllowed(replica) {
    const local = replica.meta.localScope ?? [];
    const excluded = withMainBranchPolicy(replica.store, () => Array.from({ length: local.length + 1 }, (_, i2) => view(replica, local.slice(0, i2))).some((node) => node?.members.some((m) => m.peerId === "fos" && m.disabled?.includes("persist"))));
    if (excluded) throw new Error("Fos storage is excluded by this shared node or its local parent context.");
  }
  function buildSyncRequest(replica, branch, options = {}) {
    if (hasNodeLinkMasks(replica.store, replica.meta.serverPeerId, replica.meta.localScope ?? [])) throw new Error("This attachment has node masks; use provideNode for permission-filtered traversal.");
    if (replica.meta.serverPeerId && hasNodeReadBoundary(replica, replica.meta.localScope ?? [], replica.meta.serverPeerId)) throw new Error("This attachment has a read boundary; use provideNode for permission-filtered traversal.");
    if (options.recipient !== "device") assertServerReplicationAllowed(replica);
    branch ?? (branch = replica.meta.branch);
    let base = replica.meta.baseCid;
    const localHead = resolveScope(replica.store, headCid(replica), replica.meta.localScope ?? []);
    if (!localHead) throw new Error("The shared node no longer exists locally.");
    const selective = options.recipient !== "device";
    const projection = selective ? replicationView(replica.store, [localHead, base], replica.meta.peerId) : null;
    if (base && projection) base = projection.project(base);
    const head = options.push === false ? base ?? put(replica.store, { data: {}, children: [] }) : projection ? projection.project(localHead) : localHead;
    if (Object.values(reachableNodes(replica.store, [head])).some((node) => node.data.ref?.version === "unloaded")) throw new Error("Unloaded peer nodes require node-by-node sync; a partial subtree cannot be pushed through legacy sync.");
    const known = replica.meta.baseCid && !options.full ? reachableSet(replica.store, [replica.meta.baseCid]) : /* @__PURE__ */ new Set();
    return {
      version: SYNC_FORMAT_VERSION,
      cidVersion: CURRENT_CID_VERSION,
      peerId: replica.meta.peerId,
      ...selective ? { selective: true } : {},
      scope: [...replica.meta.scope, ...replica.meta.localScope ?? []],
      ...replica.meta.localScope?.length ? { wholeNode: true } : {},
      baseCid: base,
      headCid: head,
      nodes: reachableNodes(replica.store, [head, base], known),
      ...branch ? { branch } : {},
      ...replica.meta.branches ? { branches: replica.meta.branches } : {}
    };
  }
  function completeSync(replica, request, response, now = Date.now()) {
    if (response.scope.length !== request.scope.length || response.scope.some((s, i2) => s !== request.scope[i2])) {
      throw new Error("sync response scope does not match request scope");
    }
    const applied = applySyncResponse(replica.store, request, response, replica.meta.peerId, now, replica.meta.localScope);
    return {
      replica: {
        store: replica.store,
        meta: { ...replica.meta, baseCid: response.resultCid, lastSyncAt: now, serverPeerId: response.peerId, branch: response.branch ?? request.branch }
      },
      reMerged: applied.reMerged,
      newChoiceIds: applied.newChoiceIds
    };
  }
  function reattach(replica, newScope, now, names) {
    if (isDirty(replica)) throw new Error("cannot change scope with unsynced local changes");
    const { store, meta } = replica;
    if (meta.localScope?.length) {
      const local = newScope.length ? newScope.slice(meta.scope.length) : [HOME_ID];
      if (!meta.scope.every((id, i2) => newScope[i2] === id) || !resolveScope(store, headCid(replica), local)) throw new Error("The requested shared node is not available below this device root.");
      const descends = meta.localScope.every((id, i2) => local[i2] === id);
      const baseCid = descends && meta.baseCid ? resolveScope(store, meta.baseCid, local.slice(meta.localScope.length)) : null;
      return { store, meta: { ...meta, localScope: local, baseCid, branch: void 0, branches: void 0 } };
    }
    const isPrefix = meta.scope.length <= newScope.length && meta.scope.every((s, i2) => newScope[i2] === s);
    const relative = newScope.slice(meta.scope.length);
    const target = isPrefix ? resolveScope(store, headCid(replica), relative) : null;
    if (target) {
      const scopeNamesNext = names ?? pathNames(replica, relative);
      const branches = { ...meta.branches, ...scopeBranches(store, headCid(replica), relative) };
      const selected = isBranchChoice(store, content(store, target)) ? branchEdge(store, target) : null;
      const branch = selected ? branchSelection(store, target) : void 0;
      const base = resolveScope(store, meta.baseCid, relative);
      const baseEdge = branch && base && isBranchChoice(store, content(store, base)) ? readChoice(store, base).options.find((o) => o.peerId === branch)?.edge : null;
      commitRoot(store, selected ? identityCid(store, selected) : target, now);
      return { store, meta: { ...meta, scope: [...newScope], branch, branches, scopeNames: scopeNamesNext, baseCid: baseEdge ? identityCid(store, baseEdge) : base } };
    }
    commitRoot(store, put(store, { data: {}, children: [] }), now);
    return { store, meta: { ...meta, scope: [...newScope], branch: void 0, branches: void 0, scopeNames: names ?? [...newScope], baseCid: null } };
  }

  // ../shared/sync/destructure.ts
  function requirementOutputs(store, cid) {
    return valueContent(store, cid).children.flatMap((edge) => {
      const ref = content(store, identityCid(store, edge)), type = refTypeCid(store, ref);
      return type && edge[0] === type && ref.data.ref ? [{ cid: identityCid(store, edge), id: ref.data.alias.id, name: ref.data.name?.content ?? "Value", amount: ref.data.allocation?.amount, type }] : [];
    });
  }
  function resolveRequirementOutput(store, cid) {
    const ref = content(store, cid);
    if (!refTypeCid(store, ref) || !ref.data.ref) return null;
    if (ref.data.ref.owner) return { error: "The source requirement is outside this workspace." };
    const source = findRowByAlias(store, rootTargetCid(store), ref.data.ref.id);
    if (!source) return { error: "The source requirement is unavailable." };
    const sourceCid = resolveScope(store, rootTargetCid(store), [...source.path, source.row.id]);
    const currentOutput = requirementOutputs(store, sourceCid).find((output) => output.id === ref.data.alias?.id);
    if (!currentOutput) return { error: "The placeholder is no longer part of the source requirement." };
    const req = demandOf(valueContent(store, sourceCid));
    if (!req || !["allocation", "choice"].includes(req.capability)) return { error: "The source is no longer an amount or choice requirement." };
    if (!requirementSatisfied(store, sourceCid)) return { error: "The source requirement must be fulfilled first." };
    if (req.capability === "allocation") {
      const slice = content(store, currentOutput.cid).data.allocation;
      const total = requirementOutputs(store, sourceCid).reduce((sum, o) => sum + (o.amount ?? 0), 0);
      if (!slice || !Number.isFinite(slice.amount) || slice.amount <= 0 || req.amount === void 0 || total > req.amount + 1e-9 || slice.amount > req.amount || slice.type !== (req.resource ?? "account") || slice.unit !== (req.unit ?? "USD")) return { error: "The pieces no longer fit the source requirement." };
      return { cid: put(store, { data: { allocation: slice, description: { content: `${slice.amount} ${slice.unit}` } }, children: [] }) };
    }
    const choices = [...new Set(childRows(store, sourceCid, "supply").map((row) => supplyOf(row.value)?.choice).filter((n) => n !== void 0))];
    if (choices.length !== 1 || !req.options?.[choices[0]]) return { error: "Choose exactly one constructor for the source requirement." };
    return { cid: put(store, { data: { description: { content: req.options[choices[0]] } }, children: [] }) };
  }
  var resolvingAllocations = /* @__PURE__ */ new WeakMap();
  function allocationValue(store, cid) {
    const value = valueContent(store, cid), original = value.data.allocation;
    if (!original) return void 0;
    const argument = value.children.find((edge) => edge[0] === store.primitive.allocationField.getId() && content(store, edge[1]).data.name?.content === "amount");
    if (!argument) return original;
    const active = resolvingAllocations.get(store) ?? /* @__PURE__ */ new Set();
    resolvingAllocations.set(store, active);
    if (active.has(cid)) return void 0;
    active.add(cid);
    try {
      let current = argument[1];
      const seen = /* @__PURE__ */ new Set();
      while (current && !seen.has(current) && seen.size < 100) {
        seen.add(current);
        const output = resolveRequirementOutput(store, current);
        if (output) return output.cid ? { ...original, ...content(store, output.cid).data.allocation } : void 0;
        current = refValueCid(store, content(store, current));
      }
      return void 0;
    } finally {
      active.delete(cid);
    }
  }

  // ../shared/sync/graph.ts
  var SYNC_FORMAT_VERSION = 3;
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
    return value.children.some(([i2]) => i2 === store.primitive.targetPointerConstructor.getId() || !!value.data.alias && i2 === store.primitive.instructionPointerConstructor.getId());
  }
  function isHandle(value) {
    return !!value.data.ref;
  }
  function isPeerReference(node) {
    return !!node.data.ref?.peer && !!node.data.ref.version && node.data.ref.id === node.data.alias?.id;
  }
  function refValueCid(store, value) {
    const edge = value.children.find(([i2]) => i2 === store.primitive.targetPointerConstructor.getId());
    return edge ? edge[1] : null;
  }
  function refBranches(store, ref) {
    const cid = refValueCid(store, ref);
    if (!cid || !isBranchChoice(store, content(store, cid))) return null;
    const record = readChoice(store, cid);
    if (record.id !== ref.data.alias?.id) return null;
    return { cid, id: record.id, names: record.options.map((o) => o.peerId), selected: branchSelection(store, cid) };
  }
  function putRefValueBranches(store, ref, values, baseName = "main", selectedValue) {
    const id = ref.data.alias.id;
    const incoming = put(store, refNodeContent(store, { alias: { id }, ...ref.data.name ? { name: ref.data.name } : {} }, null, [], refTypeCid(store, ref)));
    const options = [];
    const add = (cid, preferred) => {
      if (options.some((o) => o.edge?.[0] === cid)) return;
      const name = preferred && !options.some((o) => o.peerId === preferred) ? preferred : options.length ? `value-${cid}` : baseName;
      options.push({ peerId: name, edge: [cid, incoming] });
    };
    for (const cid of values) {
      if (!cid) continue;
      if (isBranchChoice(store, content(store, cid)) && readChoice(store, cid).id === id) {
        for (const option of readChoice(store, cid).options) if (option.edge) add(option.edge[0], option.peerId);
      } else {
        const prior = values.filter((value) => !!value && isBranchChoice(store, content(store, value)) && readChoice(store, value).id === id).flatMap((value) => readChoice(store, value).options).find((option) => option.edge?.[0] === cid);
        add(cid, prior?.peerId);
      }
    }
    const selected = options.find((o) => o.edge?.[0] === selectedValue)?.peerId ?? options[0]?.peerId ?? baseName;
    return putBranches(store, id, options[0]?.edge ?? null, options, selected);
  }
  function selectedBranchValue(store, cid) {
    const edge = branchEdge(store, cid);
    if (!edge) return null;
    const right = content(store, edge[1]);
    return refTypeCid(store, right) && right.data.alias?.id === readChoice(store, cid).id ? edge[0] : identityCid(store, edge);
  }
  function refTypeCid(store, value) {
    const edge = value.children.find(([i2]) => i2 === store.primitive.instructionPointerConstructor.getId());
    return edge ? edge[1] : null;
  }
  function valueContent(store, cid) {
    const value = content(store, cid);
    if (isBranchChoice(store, value)) {
      const selected = selectedBranchValue(store, cid);
      return selected ? valueContent(store, selected) : value;
    }
    if (isHandle(value)) return value;
    const target = refValueCid(store, value);
    return target && store.table.has(target) ? isBranchChoice(store, content(store, target)) ? valueContent(store, target) : content(store, target) : value;
  }
  function refBindingBaseCid(store, value) {
    return put(store, { ...value, children: value.children.filter((edge) => !isProposalEdge(store, edge)) });
  }
  function refNodeContent(store, data, valueCid, bookkeeping2 = [], typeCid = null) {
    const children = valueCid ? [[store.primitive.targetPointerConstructor.getId(), valueCid]] : [];
    if (typeCid) children.push([store.primitive.instructionPointerConstructor.getId(), typeCid]);
    return { data, children: [...children, ...bookkeeping2] };
  }
  function refArguments(store, value, typeCid) {
    return value.children.flatMap((edge) => {
      if (edge[0] !== typeCid) return [];
      const cid = identityCid(store, edge);
      const ref = content(store, cid);
      const id = aliasIdOf(ref);
      return id && refTypeCid(store, ref) === typeCid ? [{ id, cid, targetCid: refValueCid(store, ref) }] : [];
    });
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
  var ROW_KINDS = ["task", "plain", "note", "comment", "ref", "requirement", "supply", "query", "resource", "allocation", "template"];
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
        return store.primitive.allocationField.getId();
      case "supply":
        return store.primitive.allocationField.getId();
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
    if (isChoiceEdge(store, edge) && isPeerReference(content(store, edge[1]))) return "ref";
    if (isChoiceEdge(store, edge) && isBranchChoice(store, content(store, edge[1]))) {
      const active = branchEdge(store, edge[1]);
      return active ? rowKindOf(store, active) : null;
    }
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
    if (target === p.allocationField.getId()) return demandOf(valueContent(store, edge[0])) ? "requirement" : supplyOf(valueContent(store, edge[0])) ? "supply" : "allocation";
    if (target === p.templateField.getId()) return "template";
    return null;
  }
  function isRowEdge(store, edge) {
    return rowKindOf(store, edge) !== null;
  }
  function identityOnInstruction(store, edge) {
    return !isChoiceEdge(store, edge) && !isPartitionEdge(store, edge) && rowKindOf(store, edge) !== null;
  }
  function isPartitionEdge(store, edge) {
    return edge[0] === store.primitive.listField.getId();
  }
  function isChoiceEdge(store, edge) {
    return edge[0] === store.primitive.choiceTarget.getId();
  }
  var branchSelections = /* @__PURE__ */ new WeakMap();
  function isBranchChoice(store, node) {
    return !!node.data.option && !node.data.conflict && node.children.some((e) => e[0] === store.primitive.optionNotSelectedConstructor.getId());
  }
  function selectBranch(store, id, name) {
    let selections = branchSelections.get(store);
    if (!selections) {
      selections = /* @__PURE__ */ new Map();
      branchSelections.set(store, selections);
    }
    selections.set(id, name);
  }
  function withBranches(store, selections, run) {
    const previous = branchSelections.get(store);
    const next = new Map(previous);
    for (const [id, name] of Object.entries(selections)) next.set(id, name);
    branchSelections.set(store, next);
    try {
      return run();
    } finally {
      if (previous) branchSelections.set(store, previous);
      else branchSelections.delete(store);
    }
  }
  function scopeBranches(store, root, path) {
    const result = {};
    for (let i2 = 0; i2 <= path.length; i2++) {
      const cid = resolveScope(store, root, path.slice(0, i2));
      if (cid && isBranchChoice(store, content(store, cid))) result[readChoice(store, cid).id] = branchSelection(store, cid);
      else if (cid) {
        const branches = refBranches(store, content(store, cid));
        if (branches) result[branches.id] = branches.selected;
      }
    }
    return result;
  }
  var policyReads = /* @__PURE__ */ new WeakSet();
  function withMainBranchPolicy(store, run) {
    const nested = policyReads.has(store);
    policyReads.add(store);
    try {
      return run();
    } finally {
      if (!nested) policyReads.delete(store);
    }
  }
  function branchSelection(store, cid) {
    const choice = readChoice(store, cid);
    if (policyReads.has(store)) return choice.options.find((o) => o.peerId === "main")?.peerId ?? choice.defaultName ?? choice.options[0]?.peerId ?? "";
    const name = branchSelections.get(store)?.get(choice.id);
    return choice.options.find((o) => o.peerId === name)?.peerId ?? choice.defaultName ?? choice.options.map((o) => o.peerId).sort()[0] ?? "";
  }
  function branchEdge(store, cid) {
    const choice = readChoice(store, cid);
    return choice.options.find((o) => o.peerId === branchSelection(store, cid))?.edge ?? null;
  }
  function putBranches(store, id, base, options, defaultName = "main") {
    const cid = putChoice(store, id, base, options), node = content(store, cid);
    const { conflict: _conflict, ...data } = node.data;
    const selectedIndex = Math.max(0, readChoice(store, cid).options.findIndex((o) => o.peerId === defaultName));
    return put(store, { ...node, data: { ...data, option: { ...data.option, selectedIndex } } });
  }
  function updateBranch(store, cid, edge) {
    const record = readChoice(store, cid), name = branchSelection(store, cid);
    return putBranches(store, record.id, record.base, record.options.map((o) => o.peerId === name ? { ...o, edge } : o), record.defaultName);
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
    canonicalRowData(data);
    return { data, children: [] };
  }
  function canonicalRowData(data) {
    if (data.requirement) {
      const req = data.requirement;
      data.allocation = { ...req, capability: req.capability, resource: "", type: req.resource ?? "inventory", amount: req.capability === "allocation" ? -Math.abs(req.amount ?? 0) : -1, unit: req.unit ?? "unit", ...req.start !== void 0 ? { start: req.start } : {}, ...req.end !== void 0 ? { end: req.end } : {} };
      delete data.requirement;
    } else if (data.supply) {
      const supply = data.supply;
      data.allocation = { ...supply, resource: "", type: "inventory", amount: 1, unit: "unit" };
      delete data.supply;
    }
    return data;
  }
  function rowEdge(store, kind, cid) {
    if (isBranchChoice(store, content(store, cid))) {
      const active = branchEdge(store, cid);
      return [store.primitive.choiceTarget.getId(), active ? updateBranch(store, cid, rowEdge(store, kind, identityCid(store, active))) : cid];
    }
    return [cid, rowPrimitive(store, valueContent(store, cid).data.allocation ? "allocation" : kind)];
  }
  function convertRowContent(value, kind, now) {
    const { todo: _todo, comment: _comment, ref: _ref, requirement: _rq, supply: _su, query: _q, resource: _rs, allocation: _al, ...rest } = value.data;
    const data = { ...rest, updated: { time: now } };
    if (kind === "task") data.todo = { completed: !!value.data.todo?.completed, time: value.data.todo?.time ?? now };
    if (kind === "comment") data.comment = value.data.comment ?? { content: value.data.description?.content ?? "", authorID: "", authorName: "", time: now, votes: {} };
    if (kind === "ref") data.ref = value.data.ref ?? { id: "" };
    if (kind === "requirement") data.requirement = demandOf(value) ?? { capability: "confirmation" };
    if (kind === "supply") data.supply = supplyOf(value) ?? { capability: "confirmation", by: "", at: now };
    if (kind === "query") data.query = value.data.query ?? {};
    if (kind === "resource") data.resource = value.data.resource ?? { type: "inventory", unit: "unit" };
    if (kind === "allocation") data.allocation = value.data.allocation ?? { resource: "", type: "inventory", amount: 0, unit: "unit" };
    return { ...value, data: canonicalRowData(data) };
  }
  function peerRefContent(peerId) {
    return { data: { alias: { id: `fos:device:${peerId}` }, peerId: { content: peerId } }, children: [] };
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
  function mergeRequestEdge(store, id) {
    const type = capabilityTarget(store, "approve");
    return [type, put(store, refNodeContent(store, { alias: { id: `${id}:request-merge` }, name: { content: "request merge" } }, null, [], type))];
  }
  function putChoice(store, id, base, options) {
    const alternatives = options.map((o) => {
      const pointer = pointerContent(o.peerId, o.edge, store);
      if (o.requestMerge) pointer.children.push([capabilityTarget(store, "approve"), o.requestMerge]);
      if (o.base) pointer.children.push([store.primitive.conflictBaseNode.getId(), put(store, pointerContent(null, o.base, store))]);
      return { peerId: o.peerId, cid: put(store, pointer) };
    }).sort((a, b) => a.cid < b.cid ? -1 : a.cid > b.cid ? 1 : 0);
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
        const basePointer = content(store, target).children.find((e) => e[0] === store.primitive.conflictBaseNode.getId());
        const requestMerge = content(store, target).children.find((e) => content(store, e[1]).data.name?.content === "request merge")?.[1];
        options.push({ peerId: pointer.peerId ?? "unknown", edge: pointer.edge, ...requestMerge ? { requestMerge } : {}, ...basePointer ? { base: readPointer(store, basePointer[1]).edge } : {} });
      }
    }
    return { cid: choiceCid, id: aliasIdOf(value) ?? choiceCid, base, options, defaultName: options[value.data.option?.selectedIndex ?? 0]?.peerId };
  }
  function findEdge(store, value, key) {
    return value.children.find((edge) => edgeKey(store, edge) === key);
  }
  function resolveScope(store, nodeCid, scope) {
    let current = nodeCid;
    for (const step of scope) {
      if (!current) break;
      current = findChild(store, current, step);
    }
    if (!current && nodeCid && scope[0] !== "fos:home") {
      const home = findChild(store, nodeCid, "fos:home");
      if (home) return resolveScope(store, home, scope);
    }
    return current;
  }
  function contextScope(store, nodeCid, scope) {
    if (!scope.length || findChild(store, nodeCid, scope[0])) return scope;
    const home = findChild(store, nodeCid, "fos:home");
    return home && resolveScope(store, home, scope) ? ["fos:home", ...scope] : scope;
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
    const canonical = contextScope(store, nodeCid, scope);
    if (canonical !== scope) return updateAtScope(store, nodeCid, canonical, fn, mode);
    const identity = content(store, nodeCid);
    if (isPeerReference(identity) && mode !== "replace") throw new Error("This node is held by another peer. Connect to that peer before editing its content.");
    if (!scope.length && mode === "replace") {
      const next = fn(identity);
      return next === identity ? nodeCid : put(store, next);
    }
    if (isBranchChoice(store, identity)) {
      const active = branchEdge(store, nodeCid);
      if (!active) throw new Error("No selected branch");
      const next = updateAtScope(store, identityCid(store, active), scope, fn, mode);
      return next === identityCid(store, active) ? nodeCid : updateBranch(store, nodeCid, withIdentity(store, active, next));
    }
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
    if (!found && ref) {
      const argument = findAliasEdge(store, identity, step);
      if (argument) {
        const before = identityCid(store, argument.edge);
        const after = updateAtScope(store, before, rest, fn, mode);
        if (before === after) return nodeCid;
        const children2 = [...identity.children];
        children2[argument.index] = withIdentity(store, argument.edge, after);
        return put(store, withPrev(store, { ...identity, children: children2 }, nodeCid));
      }
    }
    if (!found || isChoiceEdge(store, found.edge) && !isBranchChoice(store, content(store, found.edge[1])) && !isPeerReference(content(store, found.edge[1]))) throw new Error(`node ${step} not found`);
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
    if (isPeerReference(identity)) throw new Error("This node is held by another peer. Connect to that peer before editing its content.");
    if (isBranchChoice(store, identity)) {
      const active = branchEdge(store, idCid);
      return active ? withIdentity(store, edge, updateBranch(store, idCid, withChildValue(store, active, nextValue, now))) : edge;
    }
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
  var HOME_ID = "fos:home";
  function withMemberOffers(store, value, peerId, name, consumes, offers) {
    const member = readMembers(store, value).find((m) => m.peerId === peerId);
    const wanted = [...new Set(offers)].sort();
    if (member && JSON.stringify([...member.accepts ?? []].sort()) === JSON.stringify(wanted)) return value;
    return withMember(store, value, peerId, member?.name ?? name, member?.capabilities ?? consumes, member?.disabled ?? [], wanted);
  }
  function homeContextCid(store, rootCid, now, offers = {}) {
    const root = valueContent(store, rootCid);
    const identity = makeLink(store, content(store, rootCid), 0);
    let bindings = identity;
    const serverOffers = [.../* @__PURE__ */ new Set([...SERVER_TRANSPORT_CAPABILITIES, ...offers.server ?? []])];
    if (!readMembers(store, bindings).some((member) => member.peerId === "fos")) bindings = withMember(store, bindings, "fos", "fos", [], [], serverOffers);
    else if (offers.server) bindings = withMemberOffers(store, bindings, "fos", "fos", [], serverOffers);
    const homeCid = findChild(store, rootCid, HOME_ID);
    if (homeCid && isBranchChoice(store, content(store, homeCid))) {
      const edge = root.children.find((edge2) => identityCid(store, edge2) === homeCid);
      const nextEdge = rowEdge(store, "plain", homeCid);
      if (nextEdge[0] === edge[0] && nextEdge[1] === edge[1] && bindings === identity && identity === content(store, rootCid)) return rootCid;
      const nextValue2 = put(store, { ...root, children: root.children.map((e) => e === edge ? nextEdge : e) });
      return put(store, refNodeContent(store, identity.data, nextValue2, bookkeepingOf(store, bindings), refTypeCid(store, identity)));
    }
    const movable = homeCid ? [] : root.children.filter((edge) => isRowEdge(store, edge) && rowKindOf(store, edge) !== "template" || isChoiceEdge(store, edge));
    const homeValue = homeCid ? valueContent(store, homeCid) : rowContent("plain", HOME_ID, "Home", 0);
    let home = homeCid ? makeLink(store, content(store, homeCid), 0) : makeLink(store, { ...homeValue, children: movable }, 0);
    const legacyIntegrations = bindings.children.filter((edge) => isMemberEdge(store, edge) && content(store, edge[1]).data.peerId?.content?.startsWith("integration:"));
    for (const edge of legacyIntegrations) if (!readMembers(store, home).some((member) => member.peerId === content(store, edge[1]).data.peerId?.content)) home = { ...home, children: [...home.children, edge] };
    if (legacyIntegrations.length) bindings = { ...bindings, children: bindings.children.filter((edge) => !legacyIntegrations.includes(edge)) };
    for (const peer of INTEGRATION_PEERS) {
      const provides = offers.integrations?.[peer.id];
      if (!readMembers(store, home).some((member) => member.peerId === `integration:${peer.id}`)) home = withMember(store, home, `integration:${peer.id}`, peer.name, peer.consumes, [], provides ?? []);
      else if (provides) home = withMemberOffers(store, home, `integration:${peer.id}`, peer.name, peer.consumes, provides);
    }
    const nextHome = put(store, home);
    const homeEdge = root.children.find((edge) => identityCid(store, edge) === homeCid);
    if (homeEdge && rowKindOf(store, homeEdge) === "plain" && homeCid === nextHome && bindings === identity && identity === content(store, rootCid)) return rootCid;
    const keep = root.children.filter((edge) => !movable.includes(edge) && (!homeCid || identityCid(store, edge) !== homeCid));
    const nextValue = put(store, { ...root, children: [...keep, rowEdge(store, "plain", nextHome)] });
    return put(store, refNodeContent(store, identity.data, nextValue, bookkeepingOf(store, bindings), refTypeCid(store, identity)));
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
    children.push(...previous.children.filter(([i2, t]) => i2 === capabilityTarget(store, "provideNode") && content(store, t).data.name?.content.startsWith("fos:node-link:")));
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
    if (isPeerReference(identity)) kind = "ref";
    const sub = countNode(store, nodeCid);
    const view2 = {
      id: aliasIdOf(identity) ?? aliasIdOf(value) ?? nodeCid,
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
    if (isPeerReference(identity)) {
      view2.refPeer = identity.data.ref.peer;
      view2.title = "Peer-held node";
    }
    const activeEdge = isBranchChoice(store, identity) ? branchEdge(store, nodeCid) : null;
    const constructor = activeEdge ? content(store, identityCid(store, activeEdge)) : identity;
    if (refTypeCid(store, constructor) === capabilityTarget(store, "peer") && constructor.data.name) view2.construction = { handler: constructor.data.name.content };
    if (kind === "ref") {
      view2.refId = identity.data.ref?.id ?? "";
      if (identity.data.ref?.owner) view2.refOwner = identity.data.ref.owner;
    }
    if (kind === "comment" && value.data.comment) view2.author = { id: value.data.comment.authorID, name: value.data.comment.authorName, time: value.data.comment.time };
    if (value.data.template) view2.template = value.data.template;
    if (kind === "task") {
      const blockers = taskBlockers(store, nodeCid);
      if (blockers.length) view2.blockedBy = blockers;
      if (value.data.template) view2.template = value.data.template;
    }
    if (isBranchChoice(store, identity)) view2.branches = { selected: branchSelection(store, nodeCid), names: readChoice(store, nodeCid).options.map((o) => o.peerId), mergeRequests: readChoice(store, nodeCid).options.filter((o) => o.requestMerge).map((o) => o.peerId) };
    const demand = demandOf(value);
    if (kind === "requirement" && demand) {
      const progress = requirementProgress(store, nodeCid);
      view2.requirement = { ...demand, satisfied: requirementSatisfied(store, nodeCid), summary: requirementSummary(demand), ...progress ? progress : {} };
    }
    if (kind === "supply") view2.supply = supplyOf(value);
    if (kind === "query") view2.query = value.data.query ?? {};
    if (kind === "resource" && value.data.resource) {
      const allocated = allocatedIn(store, nodeCid);
      view2.resource = { ...value.data.resource, allocated, available: value.data.resource.capacity === void 0 ? null : value.data.resource.capacity - allocated };
    }
    if (kind === "allocation" && value.data.allocation) view2.allocation = allocationValue(store, nodeCid);
    if (identity.data.listing) view2.market = true;
    return view2;
  }
  function supplyOf(value) {
    if (value.data.supply) return value.data.supply;
    const a = value.data.allocation;
    return a?.capability && a.amount > 0 ? { capability: a.capability, by: a.by ?? "", at: a.at ?? 0, ...a.ref ? { ref: a.ref } : {}, ...a.choice !== void 0 ? { choice: a.choice } : {} } : void 0;
  }
  function demandOf(value) {
    if (value.data.requirement) return value.data.requirement;
    const a = value.data.allocation;
    return a && (a.amount < 0 || a.amount === 0 && !!a.capability) ? { capability: a.capability ?? "allocation", ...!a.capability || a.capability === "allocation" ? { resource: a.type, amount: -a.amount, unit: a.unit } : {}, ...a.options ? { options: a.options } : {}, ...a.peer ? { peer: a.peer } : {}, ...a.repo ? { repo: a.repo } : {}, ...a.tool ? { tool: a.tool } : {}, ...a.start !== void 0 ? { start: a.start } : {}, ...a.end !== void 0 ? { end: a.end } : {} } : void 0;
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
      case "llm":
        return "llm";
      case "repo":
        return req.repo ? `repo ${req.repo}` : "repo";
      case "tool":
        return req.tool ? `tool ${req.tool}` : "tool";
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
    return allocationMatches(req, a) && (req.amount === void 0 || a.amount >= req.amount);
  }
  function allocationMatches(req, a) {
    return !!a && (!req.resource || a.type === req.resource) && (!req.unit || a.unit === req.unit) && (req.start === void 0 || a.start !== void 0 && a.start <= req.start) && (req.end === void 0 || a.end === void 0 || a.end >= req.end) && (!req.peer || a.person === req.peer);
  }
  function requirementProgress(store, requirementCid, root) {
    const req = demandOf(valueContent(store, requirementCid));
    if (!req || req.capability !== "allocation" || req.amount === void 0) return null;
    let have = 0;
    for (const { kind, value, cid } of childRows(store, requirementCid)) {
      if (kind === "allocation") {
        const allocation = allocationValue(store, cid);
        if (allocationMatches(req, allocation)) have += allocation?.amount ?? 0;
      }
      const supply = supplyOf(value);
      if (kind === "supply" && supply?.capability === "allocation" && supply.ref) {
        const found = findRowByAlias(store, root ?? rootTargetCid(store), supply.ref);
        if (!found) have += req.amount;
        else if (allocationMatches(req, found.row.allocation)) have += found.row.allocation?.amount ?? 0;
      }
    }
    return { have, need: req.amount };
  }
  function requirementSatisfied(store, requirementCid, root) {
    const req = demandOf(valueContent(store, requirementCid));
    if (!req) return true;
    const rows = childRows(store, requirementCid);
    const filledByChild = rows.some(({ kind, value, cid }) => {
      switch (req.capability) {
        case "task":
          return kind === "task" && !!value.data.todo?.completed;
        case "allocation":
          return kind === "allocation" && allocationFills(req, allocationValue(store, cid));
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
      const s = kind === "supply" ? supplyOf(value) : void 0;
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
        case "llm":
          return !!s.by;
        case "repo":
          return !!s.by;
        case "tool":
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
    return childRows(store, taskCid, "requirement").filter(({ cid }) => !requirementSatisfied(store, cid)).map(({ value }) => demandOf(value) ? requirementSummary(demandOf(value)) : "requirement");
  }
  function allocatedIn(store, bankCid) {
    const type = valueContent(store, bankCid).data.resource?.type;
    const sum = (cid) => childRows(store, cid).reduce((total, child) => {
      const allocation = child.kind === "allocation" ? allocationValue(store, child.cid) : void 0;
      const amount = allocation && (!type || allocation.type === type) ? allocation.amount : 0;
      return total + amount + sum(child.cid);
    }, 0);
    return sum(bankCid);
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
      if (rowKindOf(store, edge) === "task") {
        tasks++;
        const taskCid = identityCid(store, edge);
        if (valueContent(store, taskCid).data.todo?.completed) done++;
        const sub = countNode(store, taskCid);
        tasks += sub.tasks;
        done += sub.done;
        choices += sub.choices;
      } else if (isChoiceEdge(store, edge) && !isBranchChoice(store, content(store, edge[1])) && !isPeerReference(content(store, edge[1]))) {
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
  function viewNode(store, cid, constructors = false) {
    if (isBranchChoice(store, content(store, cid))) {
      const active = branchEdge(store, cid);
      if (active) return { ...viewNode(store, identityCid(store, active), constructors), members: readMembers(store, content(store, cid)) };
    }
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
      members: link || isPeerReference(identity) ? readMembers(store, identity) : [],
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
    if (constructors) {
      const seen = /* @__PURE__ */ new Set();
      for (const edge of [...value.children, ...identity === value ? [] : identity.children]) {
        const child = content(store, identityCid(store, edge));
        const peerId = isMemberEdge(store, edge) || isPeerEdge(store, edge) ? child.data.peerId?.content : void 0;
        const name = refTypeCid(store, child) ? child.data.name?.content : void 0;
        if (!peerId && (!name?.startsWith("fos:setting:") && name !== "fos:evaluation") || !child.data.alias?.id) continue;
        if (seen.has(peerId ?? child.data.alias.id)) continue;
        seen.add(peerId ?? child.data.alias.id);
        const row = rowView(store, identityCid(store, edge), "plain");
        row.title = name === "fos:evaluation" ? "Evaluation" : peerId ? child.data.name?.content ?? peerId : child.data.description?.content ?? name;
        row.construction = { ...name ? { name } : {}, ...peerId ? { peerId } : {} };
        view2.tasks.push(row);
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
  var CAPABILITIES = ["read", "read-requests", "edit", "approve", "autopush", "direct", "http", "ws", "relay", "search", "market", "mail", "calendar", "llm", "repo", "tool", "send-payment", "receive-payment", "allocate", "request-payment", "notify", "timer", "cron", "task-completion", "request", "rank", "poll", "peer", "persist", "provideNode", "sync", "response"];
  var INTEGRATION_PEERS = [
    { id: "github", name: "GitHub", kind: "oauth", consumes: ["read", "edit"] },
    { id: "google", name: "Google", kind: "oauth", consumes: ["read", "edit"] },
    { id: "stripe", name: "Stripe", kind: "platform", consumes: ["read"] },
    { id: "phone", name: "Phone (SMS)", kind: "channel", consumes: [] }
  ];
  var SERVER_TRANSPORT_CAPABILITIES = ["http", "ws", "relay", "peer", "persist", "provideNode", "sync"];
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
      case "calendar":
        return p.calendarCapability.getId();
      case "llm":
        return p.llmCapability.getId();
      case "repo":
        return p.repoCapability.getId();
      case "tool":
        return p.toolCapability.getId();
      case "send-payment":
        return p.sendPaymentCapability.getId();
      case "receive-payment":
        return p.receivePaymentCapability.getId();
      case "allocate":
        return p.allocateCapability.getId();
      case "request-payment":
        return p.requestPaymentCapability.getId();
      case "notify":
        return p.notifyCapability.getId();
      case "rank":
      case "poll":
      case "peer":
      case "persist":
      case "provideNode":
      case "sync":
      case "timer":
      case "cron":
      case "task-completion":
      case "request":
      case "response":
        return put(store, { data: { name: { content: `fos:capability:${capability}` } }, children: [] });
    }
  }
  function capabilityOfTarget(store, target) {
    const type = refTypeCid(store, content(store, target)) ?? target;
    return CAPABILITIES.find((c) => type === capabilityTarget(store, c)) ?? null;
  }
  function capabilityOf2(store, edge) {
    if (edge[0] !== store.primitive.capabilityNode.getId()) return null;
    return capabilityOfTarget(store, edge[1]);
  }
  function acceptsOf(store, edge) {
    if (edge[0] !== store.primitive.acceptsNode.getId()) return null;
    return capabilityOfTarget(store, edge[1]);
  }
  function memberRefContent(store, peerId, name, capabilities, disabled = [], accepts = []) {
    const unique = [...new Set(capabilities)];
    const from = [...new Set(accepts)];
    const off = [...new Set(disabled)].filter((c) => unique.includes(c) || from.includes(c));
    return {
      data: {
        alias: { id: `fos:peer:${peerId}` },
        peerId: { content: peerId },
        ...name ? { name: { content: name } } : {},
        ...off.length ? { disabledCapabilities: { content: off } } : {}
      },
      children: [
        ...unique.map((c) => [store.primitive.capabilityNode.getId(), capabilityTarget(store, c)]),
        ...from.map((c) => [store.primitive.acceptsNode.getId(), capabilityTarget(store, c)])
      ]
    };
  }
  function readMembers(store, value) {
    if (isBranchChoice(store, value)) {
      const edge = withMainBranchPolicy(store, () => branchEdge(store, put(store, value)));
      if (edge) return readMembers(store, content(store, identityCid(store, edge)));
    }
    const out = [];
    for (const edge of value.children) {
      if (!isMemberEdge(store, edge)) continue;
      const ref = content(store, edge[1]);
      const peerId = ref.data.peerId?.content;
      if (!peerId) continue;
      const caps = [...new Set(ref.children.map((e) => capabilityOf2(store, e)).filter((c) => c !== null))];
      const accepts = [...new Set(ref.children.map((e) => acceptsOf(store, e)).filter((c) => c !== null))];
      const off = (ref.data.disabledCapabilities?.content ?? []).filter((c) => CAPABILITIES.includes(c) && (caps.includes(c) || accepts.includes(c)));
      out.push({ peerId, name: ref.data.name?.content ?? null, capabilities: caps, ...off.length ? { disabled: off } : {}, ...accepts.length ? { accepts } : {} });
    }
    return out;
  }
  function memberHandlers(store, value, peerId, direction) {
    if (isBranchChoice(store, value)) {
      const edge = branchEdge(store, put(store, value));
      if (edge) return memberHandlers(store, content(store, identityCid(store, edge)), peerId, direction);
    }
    const member = value.children.find((e) => isMemberEdge(store, e) && content(store, e[1]).data.peerId?.content === peerId);
    return member ? content(store, member[1]).children.filter((e) => (!direction || e[0] === direction) && (e[0] === store.primitive.capabilityNode.getId() || e[0] === store.primitive.acceptsNode.getId()) && !!refTypeCid(store, content(store, e[1]))).map((e) => e[1]) : [];
  }
  function withMember(store, value, peerId, name, capabilities, disabled = [], accepts = []) {
    const next = memberRefContent(store, peerId, name, capabilities, disabled, accepts);
    const previous = value.children.find((edge) => isMemberEdge(store, edge) && content(store, edge[1]).data.peerId?.content === peerId);
    if (previous) {
      const old = content(store, previous[1]);
      next.children.push(...old.children.filter((edge) => edge[0] !== store.primitive.capabilityNode.getId() && edge[0] !== store.primitive.acceptsNode.getId() || !!refTypeCid(store, content(store, edge[1])) && !capabilityOfTarget(store, edge[1])));
      const custom = (old.data.disabledCapabilities?.content ?? []).filter((id) => !CAPABILITIES.includes(id));
      if (custom.length) next.data.disabledCapabilities = { content: [.../* @__PURE__ */ new Set([...next.data.disabledCapabilities?.content ?? [], ...custom])] };
    }
    next.children = next.children.flatMap((edge) => {
      const capability = capabilityOf2(store, edge) ?? acceptsOf(store, edge);
      const matching = capability ? memberHandlers(store, value, peerId, edge[0]).filter((cid) => capabilityOfTarget(store, cid) === capability) : [];
      return matching.length ? matching.map((cid) => [edge[0], cid]) : [edge];
    });
    const refCid = put(store, next);
    const children = value.children.filter((e) => !(isMemberEdge(store, e) && content(store, e[1]).data.peerId?.content === peerId));
    return { ...value, children: [...children, [store.primitive.memberField.getId(), refCid]] };
  }
  function hasCapability(store, value, peerId, capability) {
    return readMembers(store, value).some((m) => m.peerId === peerId && m.capabilities.includes(capability) && !(m.disabled ?? []).includes(capability));
  }
  function textNode(store, text) {
    return put(store, { data: { description: { content: text } }, children: [] });
  }
  function proposalContent(store, peerId, name, contentCid, baseCid, timestamp, status = "open") {
    const id = `proposal:${textNode(store, JSON.stringify([peerId, name]))}`;
    const branchType = store.primitive.rootInstructionNode.getId();
    const textType = store.primitive.documentField.getId();
    const argument = (key, type, target, history = []) => [type, put(store, refNodeContent(store, { alias: { id: `${id}:${key}` }, name: { content: key } }, target, history, type))];
    const constructor = put(store, {
      data: { description: { content: name || "Proposal" }, peerId: { content: peerId }, updated: { time: timestamp } },
      children: [
        argument("branch", branchType, contentCid, [[store.primitive.previousVersion.getId(), baseCid]]),
        mergeRequestEdge(store, id),
        argument("status", textType, textNode(store, status))
      ]
    });
    return refNodeContent(store, { alias: { id }, name: { content: "branch" }, updated: { time: timestamp } }, constructor, [], store.primitive.proposalField.getId());
  }
  function readProposal(store, cid) {
    const identity = content(store, cid);
    if (refTypeCid(store, identity) === store.primitive.proposalField.getId()) {
      const value2 = valueContent(store, cid);
      const args = value2.children.map((edge) => content(store, identityCid(store, edge)));
      const branch = args.find((arg) => arg.data.name?.content === "branch");
      const status = args.find((arg) => arg.data.name?.content === "status");
      const contentCid2 = branch && refValueCid(store, branch);
      const baseCid2 = branch?.children.find((edge) => isPrevEdge(store, edge))?.[1];
      const peerId2 = value2.data.peerId?.content;
      const statusCid = status && refValueCid(store, status);
      if (!contentCid2 || !baseCid2 || !peerId2) return null;
      return { cid, peerId: peerId2, name: value2.data.description?.content ?? "", contentCid: contentCid2, baseCid: baseCid2, timestamp: value2.data.updated?.time ?? 0, status: statusCid && ["rejected", '"rejected"'].includes(content(store, statusCid).data.description?.content ?? "") ? "rejected" : "open" };
    }
    const value = identity;
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
    const bookkeeping2 = previous.children.filter((e) => isBookkeepingEdge(store, e) && !isPrevEdge(store, e));
    const data = { alias: previous.data.alias ?? strippedContent.data.alias ?? { id: newId() }, updated: { time: now } };
    if (previous.data.ref) data.ref = previous.data.ref;
    if (previous.data.name) data.name = previous.data.name;
    const branches = refBranches(store, previous);
    const active = branches && branchEdge(store, branches.cid);
    const value = put(store, strippedContent);
    const target = branches && active ? updateBranch(store, branches.cid, [value, active[1]]) : value;
    const next = refNodeContent(store, data, target, bookkeeping2, refTypeCid(store, previous));
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
    const index = value.children.findIndex((e) => edgeKey(store, e) === key || aliasIdOf(content(store, identityCid(store, e))) === aliasId);
    return index >= 0 ? { edge: value.children[index], index } : null;
  }
  function findChild(store, nodeCid, aliasId) {
    const found = findAliasEdge(store, valueContent(store, nodeCid), aliasId) ?? findAliasEdge(store, content(store, nodeCid), aliasId);
    if (!found) return null;
    const { edge } = found;
    if (isChoiceEdge(store, edge) && !isBranchChoice(store, content(store, edge[1])) && !isPeerReference(content(store, edge[1]))) return null;
    return identityCid(store, edge);
  }
  function findRowByAlias(store, rootCid, aliasId, prefix2 = []) {
    for (const edge of valueContent(store, rootCid).children) {
      const kind = rowKindOf(store, edge);
      if (!kind) continue;
      const cid = identityCid(store, edge);
      const id = aliasIdOf(content(store, cid));
      if (!id) continue;
      if (id === aliasId) return { path: prefix2, row: rowView(store, cid, kind) };
      const found = findRowByAlias(store, cid, aliasId, [...prefix2, id]);
      if (found) return found;
    }
    return null;
  }
  function copyRowContent(store, nodeCid, now, freshId, options = {}) {
    const { instantiate = false } = options;
    const ids = /* @__PURE__ */ new Map();
    const owned = /* @__PURE__ */ new Set();
    const childEdges = (value) => value.children.filter((edge) => {
      const kind = rowKindOf(store, edge);
      const name = content(store, identityCid(store, edge)).data.name?.content;
      if (name === "fos:evaluation" || name === "fos:trigger-state" || instantiate && (name === "fos:trigger" || name === "fos:consumed" || name === "fos:execution-time" || name === "fos:sharing" || name?.startsWith("fos:guest:") || name?.startsWith("fos:execution:"))) return false;
      if (kind) return !(instantiate && kind === "supply");
      if (isBookkeepingEdge(store, edge) || edge[0] === store.primitive.targetPointerConstructor.getId() || edge[0] === store.primitive.instructionPointerConstructor.getId()) return false;
      return isRefNode(store, content(store, identityCid(store, edge)));
    });
    const collect = (cid) => {
      if (owned.has(cid)) return;
      owned.add(cid);
      const identity = content(store, cid);
      const id = aliasIdOf(identity);
      if (id && !ids.has(id)) ids.set(id, cid === nodeCid && options.rootId ? options.rootId : freshId());
      if (isBranchChoice(store, identity)) {
        const choice = readChoice(store, cid);
        for (const edge of [choice.base, ...choice.options.flatMap((o) => [o.edge, o.base])]) if (edge) collect(identityCid(store, edge));
        return;
      }
      if (refTypeCid(store, identity)) return;
      for (const edge of childEdges(stripLink(store, identity))) collect(identityCid(store, edge));
    };
    collect(nodeCid);
    const copied = /* @__PURE__ */ new Map();
    const copy = (cid) => {
      const cached = copied.get(cid);
      if (cached) return cached;
      const identity = content(store, cid);
      if (isBranchChoice(store, identity)) {
        const choice = readChoice(store, cid);
        const remap = (edge) => edge ? withIdentity(store, edge, copy(identityCid(store, edge))) : null;
        const result2 = putBranches(store, ids.get(choice.id), remap(choice.base), choice.options.map((o) => ({ ...o, edge: remap(o.edge), ...o.base ? { base: remap(o.base) } : {} })), choice.defaultName);
        copied.set(cid, result2);
        return result2;
      }
      const type = refTypeCid(store, identity);
      const value = type ? identity : stripLink(store, identity);
      const data = { ...value.data, alias: { id: ids.get(aliasIdOf(identity) ?? "") ?? freshId() }, updated: { time: now } };
      if (instantiate && data.todo) data.todo = { ...data.todo, completed: false, time: now };
      if (instantiate && data.query) data.query = { market: data.query.market };
      if (data.ref && !data.ref.owner) data.ref = { ...data.ref, id: ids.get(data.ref.id) ?? data.ref.id };
      if (data.supply?.ref) data.supply = { ...data.supply, ref: ids.get(data.supply.ref) ?? data.supply.ref };
      if (data.allocation) data.allocation = { ...data.allocation, resource: ids.get(data.allocation.resource) ?? data.allocation.resource, ...data.allocation.ref ? { ref: ids.get(data.allocation.ref) ?? data.allocation.ref } : {} };
      if (data.template) data.template = { ...data.template, id: ids.get(data.template.id) ?? data.template.id };
      const target = refValueCid(store, identity);
      const children = type ? [] : childEdges(value).map((edge) => withIdentity(store, edge, copy(identityCid(store, edge))));
      if (!type && isHandle(identity) && target) children.push([store.primitive.targetPointerConstructor.getId(), owned.has(target) ? copy(target) : target]);
      let bound = target && owned.has(target) ? copy(target) : target;
      const alternatives = type && refBranches(store, identity);
      if (alternatives) {
        const record = readChoice(store, alternatives.cid);
        const incoming = put(store, refNodeContent(store, { alias: data.alias, ...data.name ? { name: data.name } : {} }, null, [], type));
        const edge = (original) => original ? [owned.has(original[0]) ? copy(original[0]) : original[0], incoming] : null;
        bound = putBranches(store, data.alias.id, edge(record.base), record.options.map((option) => ({ ...option, edge: edge(option.edge) })), record.defaultName);
      }
      const result = put(store, type ? refNodeContent(store, data, bound, [], type) : { data, children });
      copied.set(cid, result);
      return result;
    };
    return copy(nodeCid);
  }
  function moveChild(store, rootCid, fromPath, aliasId, toPath, position) {
    if (toPath.includes(aliasId)) return null;
    const fromCid = resolveScope(store, rootCid, fromPath);
    if (!fromCid) return null;
    const found = findAliasEdge(store, valueContent(store, fromCid), aliasId);
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
        if (isChoiceEdge(store, edge)) {
          const choice = readChoice(store, edge[1]);
          for (const option of [choice.base, ...choice.options.map((o) => o.edge)]) {
            if (!option || !isRowEdge(store, option)) continue;
            const id2 = identityCid(store, option);
            map.set(edgeKey(store, option), { title: valueContent(store, id2).data.description?.content ?? "", cid: id2 });
          }
          continue;
        }
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

  // ../shared/sync/project.ts
  init_prelude();

  // ../shared/sync/work.ts
  init_prelude();

  // ../shared/sync/handlers.ts
  init_prelude();
  function contextMemberRefs(r, path) {
    return withMainBranchPolicy(r.store, () => {
      const peers = /* @__PURE__ */ new Map();
      for (let i2 = 0; i2 <= path.length; i2++) {
        const cid = resolveScope(r.store, headCid(r), path.slice(0, i2));
        if (!cid) continue;
        const node = content(r.store, policyIdentity(r.store, cid));
        for (const edge of node.children.filter((e) => isMemberEdge(r.store, e))) {
          const peer = content(r.store, edge[1]).data.peerId?.content;
          if (peer) peers.set(peer, edge[1]);
        }
      }
      return peers;
    });
  }
  function policyIdentity(store, cid) {
    const node = content(store, cid);
    const edge = isBranchChoice(store, node) ? branchEdge(store, cid) : null;
    return edge ? policyIdentity(store, identityCid(store, edge)) : cid;
  }
  function discoverHandlers(r, path, environment = {}) {
    const s = r.store, result = [];
    for (const [peerId, memberCid] of contextMemberRefs(r, path)) {
      const member = content(s, memberCid), disabled = member.data.disabledCapabilities?.content ?? [];
      for (const edge of member.children) {
        const source = content(s, edge[1]), type = refTypeCid(s, source) ?? edge[1];
        const capability = CAPABILITIES.find((c) => capabilityTarget(s, c) === type);
        const incoming = edge[0] === s.primitive.acceptsNode.getId();
        const legacyOffer = edge[0] === s.primitive.capabilityNode.getId() && (peerId === "fos" || peerId.startsWith("mcp:") && capability === "tool");
        if (!incoming && !legacyOffer) continue;
        if (legacyOffer && member.children.some((e) => e[0] === s.primitive.acceptsNode.getId() && (refTypeCid(s, content(s, e[1])) ?? e[1]) === type)) continue;
        if (!refTypeCid(s, source) && !capability) continue;
        const cid = refTypeCid(s, source) ? edge[1] : put(s, refNodeContent(
          s,
          { alias: { id: `fos:handler:${peerId}:${capability}` } },
          put(s, { data: { peerId: { content: peerId }, description: { content: capability } }, children: [] }),
          [],
          type
        ));
        const id = content(s, cid).data.alias?.id ?? cid;
        if (result.some((o) => o.peerId === peerId && o.cid === cid)) continue;
        result.push({
          id,
          cid,
          type,
          peerId,
          legacy: !refTypeCid(s, source),
          label: source.data.name?.content ?? valueContent(s, cid).data.description?.content ?? capability ?? "Capability",
          ...capability ? { capability } : {},
          enabled: !disabled.includes(id) && !(capability && disabled.includes(capability)),
          active: environment.isPeerActive?.(peerId) ?? true
        });
      }
    }
    return result;
  }

  // ../shared/sync/bindings.ts
  init_prelude();

  // ../shared/sync/notes.ts
  init_prelude();

  // ../shared/sync/bindings.ts
  function argumentRefs(store, cid) {
    return valueContent(store, cid).children.flatMap((edge) => {
      const id = identityCid(store, edge), ref = content(store, id), type = refTypeCid(store, ref);
      return type && ref.data.alias?.id && edge[0] === type ? [{ cid: id, type, name: ref.data.name?.content ?? ref.data.alias?.id }] : [];
    });
  }
  function capabilityPeers(r, path, capability) {
    return [...new Set(discoverHandlers(r, path).filter((o) => o.enabled && o.capability === capability).map((o) => o.peerId))];
  }

  // ../shared/sync/work.ts
  var slots = (r, cid, type) => refArguments(r.store, valueContent(r.store, cid), type);
  function isAttempt(r, cid) {
    return slots(r, cid, capabilityTarget(r.store, "llm")).length > 0 && slots(r, cid, r.store.primitive.documentField.getId()).length > 0;
  }

  // ../shared/sync/repository.ts
  init_prelude();

  // ../shared/sync/evaluation.ts
  init_prelude();
  var EVALUATION_ARGUMENT = "fos:evaluation";
  function readNodeValue(r, path, name) {
    const cid = resolveScope(r.store, headCid(r), path);
    const arg = cid && argumentRefs(r.store, cid).find((a) => a.name === name);
    if (!arg) return null;
    try {
      return JSON.parse(valueContent(r.store, arg.cid).data.description?.content ?? "");
    } catch {
      return null;
    }
  }
  function writeNodeValue(r, path, name, value, now, handler) {
    const cid = resolveScope(r.store, headCid(r), path);
    if (!cid) throw new Error("The node no longer exists.");
    const arg = argumentRefs(r.store, cid).find((a) => a.name === name);
    const type = handler?.type ?? arg?.type ?? r.store.primitive.documentField.getId();
    const previous = arg ? content(r.store, arg.cid) : null;
    const peer = handler?.peer ?? (arg ? valueContent(r.store, arg.cid).data.peerId?.content : void 0);
    const target = put(r.store, { data: { description: { content: JSON.stringify(value) }, ...peer ? { peerId: { content: peer } } : {} }, children: [] });
    if (!arg) return addRefAt(r, path, `${name}:${path.at(-1) ?? r.meta.peerId}`, type, now, target, name);
    const next = put(r.store, refNodeContent(r.store, previous.data, target, [[r.store.primitive.previousVersion.getId(), arg.cid]], type));
    commitRoot(r.store, updateAtScope(r.store, headCid(r), path, (node) => ({ ...node, children: node.children.map((edge) => identityCid(r.store, edge) === arg.cid ? [type, next] : edge) })), now);
    return { ...r };
  }
  function evaluationRecord(r, path) {
    const record = readNodeValue(r, path, EVALUATION_ARGUMENT);
    return record && typeof record.id === "string" && Array.isArray(record.effects) && typeof record.status === "string" ? record : null;
  }
  function evaluationSteps(r, path) {
    const steps = [];
    const walk = (at, depth) => {
      if (depth > 64 || steps.length >= 1e3) throw new Error("Narrow the evaluation to fewer than 1,000 rows and 64 levels.");
      const row = at.length ? view(r, at.slice(0, -1))?.tasks.find((t) => t.id === at.at(-1)) ?? null : null;
      if (row?.kind === "template" && row.id !== "fos:home") return;
      if (row && ["ref", "supply"].includes(row.kind)) return;
      const cid = resolveScope(r.store, headCid(r), at);
      if (depth > 0 && cid && isAttempt(r, cid)) return;
      if (depth > 0 && cid && argumentRefs(r.store, cid).some((a) => a.name === "fos:trigger")) return;
      const node = view(r, at);
      if (!node) throw new Error("The evaluated node no longer exists.");
      if (node.choices.length) throw new Error("Resolve conflicting choices before evaluation.");
      steps.push({ path: at, row });
      for (const child of node.tasks) walk([...at, child.id], depth + 1);
    };
    walk(path, 0);
    return steps;
  }

  // ../shared/sync/triggers.ts
  init_prelude();

  // ../shared/sync/sharing.ts
  init_prelude();
  function sharedInputs(r, path) {
    const cid = resolveScope(r.store, headCid(r), path);
    if (!cid) return [];
    const text = argumentRefs(r.store, cid).filter((a) => a.type === r.store.primitive.documentField.getId() && !refValueCid(r.store, content(r.store, a.cid)) && a.name && !a.name.startsWith("fos:")).map((a) => ({ key: content(r.store, a.cid).data.alias.id, name: a.name, kind: "text" }));
    const allocations = (view(r, path)?.tasks ?? []).flatMap((row) => row.requirement?.capability === "allocation" ? [{ key: row.id, name: row.title, kind: "allocation", type: row.requirement.resource ?? "inventory", unit: row.requirement.unit ?? "unit", amount: row.requirement.amount, ...row.requirement.start !== void 0 ? { start: row.requirement.start } : {}, ...row.requirement.end !== void 0 ? { end: row.requirement.end } : {} }] : []);
    return [...text, ...allocations].slice(0, 32);
  }
  function executionInputs(r, root) {
    const result = [];
    const walk = (path, depth) => {
      if (depth > 8 || result.length >= 32) return;
      for (const field of sharedInputs(r, path).filter((f) => f.kind === "text")) result.push({ ...field, key: JSON.stringify([...path.slice(root.length), field.key]), path: [...path.slice(root.length), field.key] });
      for (const row of view(r, path)?.tasks ?? []) {
        if (result.length >= 32) break;
        const req2 = row.requirement, relative = [...path.slice(root.length), row.id];
        if (row.allocation && !view(r, path)?.tasks.some((t) => t.supply?.ref === row.id) && !readNodeValue(r, [...path, row.id], "fos:consumed")) result.push({ key: JSON.stringify(relative), path: relative, name: row.title, kind: "allocation", direction: "consume", type: row.allocation.type, unit: row.allocation.unit, amount: row.allocation.amount, start: row.allocation.start, end: row.allocation.end });
        if (req2 && !req2.satisfied && ["allocation", "confirmation", "choice"].includes(req2.capability)) result.push({ key: JSON.stringify(relative), path: relative, name: row.title, kind: req2.capability, ...req2.capability === "choice" ? { options: req2.options } : {}, ...req2.capability === "allocation" ? { type: req2.resource ?? "inventory", unit: req2.unit ?? "unit", amount: req2.amount, start: req2.start, end: req2.end } : {} });
        if (row.kind !== "ref" && row.kind !== "template") walk([...path, row.id], depth + 1);
      }
    };
    const current = root.length ? view(r, root.slice(0, -1))?.tasks.find((row) => row.id === root.at(-1)) : null;
    const req = current?.requirement;
    if (req && !req.satisfied && ["allocation", "confirmation", "choice"].includes(req.capability)) result.push({ key: "[]", path: [], name: current.title, kind: req.capability, ...req.capability === "choice" ? { options: req.options } : {}, ...req.capability === "allocation" ? { type: req.resource ?? "inventory", unit: req.unit ?? "unit", amount: req.amount, start: req.start, end: req.end } : {} });
    if (current?.allocation && !readNodeValue(r, root, "fos:consumed")) result.push({ key: "[]", path: [], name: current.title, kind: "allocation", direction: "consume", ...current.allocation });
    walk(root, 0);
    return result.slice(0, 32);
  }

  // ../shared/sync/specifications.ts
  init_prelude();

  // ../shared/sync/events.ts
  init_prelude();

  // ../shared/sync/execution-access.ts
  init_prelude();
  function executionSnapshot(r, path, authority) {
    if (authority) nodeAuthorityAt(r, path, authority);
    const allowed = (at, field = "description") => {
      if (!authority) return true;
      try {
        nodeAuthorityAt(r, at, authority);
        const mask = nodeLinkMaskAt(r, at, authority.peerId);
        return !mask.fields || mask.fields.includes(field);
      } catch {
        return false;
      }
    };
    return { revision: headCid(r), status: evaluationRecord(r, path)?.status ?? "idle", inputs: executionInputs(r, path).filter((f) => allowed([...path, ...f.path], f.kind === "text" ? "description" : f.direction === "consume" ? "allocation" : "requirement")), nodes: evaluationSteps(r, path).filter((s) => !s.row?.construction && allowed(s.path)).map((s) => ({ path: s.path.slice(path.length), text: s.row?.title ?? "", kind: s.row?.kind ?? "task" })) };
  }
  function executionInput(r, path, body, peer, now) {
    if (body.revision !== headCid(r)) throw new Error("Evaluation changed. Read it again before submitting.");
    const status = evaluationRecord(r, path)?.status ?? "idle";
    if (!["idle", "rolled-back"].includes(status)) throw new Error("This evaluation no longer accepts input.");
    const field = executionInputs(r, path).find((f) => f.key === body.key);
    if (!field?.path) throw new Error("Only declared inputs may be submitted.");
    const target = [...path, ...field.path], value = body.value;
    if (field.kind === "text") {
      if (typeof value !== "string" || value.length > 8e3) throw new Error("Text must be at most 8000 characters.");
      const proposal = proposeRefAt(r, target, put(r.store, { data: { description: { content: value } }, children: [] }), peer, now);
      return applyProposalAt(proposal.replica, target, proposal.proposalCid, r.meta.peerId, now);
    }
    if (field.kind === "confirmation" || field.kind === "choice") {
      if (field.kind === "confirmation" ? value !== true : !Number.isInteger(value) || value < 0 || value >= (field.options?.length ?? 0)) throw new Error("Invalid requirement response.");
      return addSupply(r, target.slice(0, -1), target.at(-1), { capability: field.kind, by: peer, ...field.kind === "choice" ? { choice: value } : {} }, now);
    }
    if (!value || !Number.isFinite(value.amount) || value.amount < 0 || value.type !== field.type || value.unit !== field.unit || field.direction === "consume" && value.amount > (field.amount ?? 0) || field.direction !== "consume" && value.amount < (field.amount ?? 0) || field.start !== void 0 && (!Number.isFinite(value.start) || value.start > field.start) || field.end !== void 0 && (!Number.isFinite(value.end) || value.end < field.end)) throw new Error("Allocation does not match the declared bounds.");
    const allocation = { resource: "", type: field.type, amount: value.amount, unit: field.unit, ...field.start !== void 0 ? { start: field.start } : {}, ...field.end !== void 0 ? { end: field.end } : {} };
    if (field.direction === "consume") return writeNodeValue(r, target, "fos:consumed", { peer, value: allocation, time: now }, now);
    const id = crypto.randomUUID();
    r = addRow(r, target, "allocation", field.name, now, { id, allocation });
    return addSupply(r, target.slice(0, -1), target.at(-1), { capability: "allocation", by: peer, ref: id }, now);
  }

  // ../shared/sync/events.ts
  var EVALUATION_REQUEST = "fos:evaluation-request";
  var EVENT_KINDS = ["read", "search", "submit", "branch", "input", "complete", "decide"];
  var EventError = class extends Error {
  };
  function pathOf(value, fallback = []) {
    if (value === void 0) return fallback;
    if (!Array.isArray(value) || value.length > 32 || value.some((id) => typeof id !== "string" || !id || id.length > 128 || id === "." || id === "..")) throw new EventError("Use an array of child IDs within the attachment.");
    return value;
  }
  function branchesOf(value) {
    if (value === void 0) return void 0;
    if (!Array.isArray(value) || value.length > 32) throw new EventError("Invalid branch selections.");
    return value.map((s) => {
      if (!s || typeof s.name !== "string" || !s.name || s.name.length > 200) throw new EventError("Invalid branch name.");
      return { path: pathOf(s.path), name: s.name };
    }).sort((a, b) => a.path.length - b.path.length);
  }
  function textOf(value, max = 16e3) {
    if (typeof value !== "string" || !value.trim() || value.length > max) throw new EventError(`Text is required (at most ${max} characters).`);
    return value.trim();
  }
  function offsetOf(value, max = Number.MAX_SAFE_INTEGER) {
    const offset = value ?? 0;
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > max) throw new EventError("Invalid offset.");
    return offset;
  }
  function expectedOf(value) {
    if (typeof value !== "string" || !value) throw new EventError("Read the node first and pass its revision as `expected`.");
    return value;
  }
  function parseEvent(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new EventError("An event object is required.");
    const raw = input;
    const kind = raw.kind;
    if (!EVENT_KINDS.includes(kind)) throw new EventError(`Unknown event kind: ${String(raw.kind)}.`);
    const path = pathOf(raw.path), branches = branchesOf(raw.branches);
    switch (kind) {
      case "read":
        return { kind, path, branches, offset: offsetOf(raw.offset) };
      case "search":
        return { kind, path, branches, query: textOf(raw.query, 200), offset: offsetOf(raw.offset, 5e3) };
      case "submit": {
        if (!Array.isArray(raw.changes) || !raw.changes.length || raw.changes.length > 50) throw new EventError("Supply 1\u201350 changes.");
        const changes = raw.changes.map((change) => {
          if (!change || typeof change !== "object") throw new EventError("Invalid change.");
          if (!["add_task", "add_note", "add_plain", "rename", "complete"].includes(change.operation)) throw new EventError("Unknown change operation.");
          return { path: pathOf(change.path), operation: change.operation, ...change.text !== void 0 ? { text: textOf(change.text) } : {}, ...typeof change.done === "boolean" ? { done: change.done } : {} };
        });
        return { kind, path, branches, expected: expectedOf(raw.expected), ...raw.name !== void 0 ? { name: textOf(raw.name, 100) } : {}, changes };
      }
      case "branch":
        return { kind, path, branches, expected: expectedOf(raw.expected), name: textOf(raw.name, 200) };
      case "input": {
        if (typeof raw.key !== "string" || !raw.key) throw new EventError("An input key is required.");
        return { kind, path, branches, expected: expectedOf(raw.expected), key: raw.key, value: raw.value };
      }
      case "complete": {
        const selections = raw.selections;
        if (selections !== void 0 && (!selections || typeof selections !== "object" || Array.isArray(selections) || Object.entries(selections).length > 64 || Object.entries(selections).some(([id, name]) => id.length > 256 || typeof name !== "string" || name.length > 256))) throw new EventError("Invalid branch selections.");
        return { kind, path, branches, expected: expectedOf(raw.expected), ...selections ? { selections } : {}, ...raw.recover === true ? { recover: true } : {} };
      }
      case "decide": {
        if (typeof raw.proposalId !== "string" || !raw.proposalId) throw new EventError("A proposal id is required.");
        if (raw.decision !== "approve" && raw.decision !== "reject") throw new EventError("decision must be approve or reject.");
        return { kind, path, proposalId: raw.proposalId, decision: raw.decision };
      }
    }
  }
  function selectedIdentity(store, cid) {
    return isBranchChoice(store, content(store, cid)) ? selectedBranchValue(store, cid) ?? cid : cid;
  }
  function branchInfo(store, cid) {
    if (isBranchChoice(store, content(store, cid))) return { selected: branchSelection(store, cid), names: readChoice(store, cid).options.map((o) => o.peerId) };
    return refBranches(store, content(store, cid)) ?? null;
  }
  function descend(store, cid, path) {
    for (const id of path) {
      if (!viewNode(store, cid).tasks.some((row) => row.id === id)) throw new EventError("Node is not a visible child in this branch.");
      const next = findChild(store, cid, id);
      if (!next) throw new EventError("Node not found in this branch.");
      cid = next;
    }
    return cid;
  }
  var bookkeeping = /* @__PURE__ */ new Set(["alias", "ref", "versionControl", "disabledCapabilities", "peerId"]);
  function dispatchEvent(r, event, principal, now) {
    const store = r.store, root = rootTargetCid(store), owner = principal.owner;
    const canonical = contextScope(store, root, principal.scope);
    let attached = resolveScope(store, root, canonical);
    if (!attached) throw new EventError("Attachment no longer exists.");
    const permission = (cid, capability) => {
      if (owner) return true;
      const identity = content(store, selectedIdentity(store, cid));
      return hasCapability(store, identity, principal.peerId, capability) || capability === "read" && hasCapability(store, identity, principal.peerId, "edit");
    };
    if (!permission(attached, "read")) throw new EventError("Peer no longer has read access to this attachment.");
    const path = event.path ?? [];
    const branches = /* @__PURE__ */ Object.create(null);
    for (const s of "branches" in event && event.branches || []) withBranches(store, branches, () => {
      const target = descend(store, attached, s.path), info = branchInfo(store, target);
      if (!info?.names.includes(s.name)) throw new EventError("Branch not found.");
      branches[content(store, target).data.alias.id] = s.name;
    });
    return withBranches(store, branches, () => {
      attached = resolveScope(store, root, canonical);
      if (!permission(attached, "read")) throw new EventError("Peer has no access to this branch.");
      const resolve2 = (relative) => {
        let cid2 = attached;
        for (const id of relative) {
          cid2 = descend(store, cid2, [id]);
          const member = readMembers(store, content(store, selectedIdentity(store, cid2))).some((m) => m.peerId === principal.peerId);
          if (member && !permission(cid2, "read")) throw new EventError("Peer has no access to this child.");
        }
        return cid2;
      };
      const absolute = (relative) => [...canonical, ...relative];
      const editable = permission(attached, "edit");
      const describe = (at) => {
        const current = resolve2(at), v = viewNode(store, current);
        return { path: at, title: v.name, done: v.done, revision: current, valueRevision: put(store, valueContent(store, current)), branches: branchInfo(store, current) };
      };
      const cid = resolve2(path), node = viewNode(store, cid);
      const unchanged = (result) => ({ replica: r, changed: false, result });
      if (event.kind === "read") {
        const offset = event.offset ?? 0;
        const visible = node.tasks.filter((row) => {
          try {
            resolve2([...path, row.id]);
            return true;
          } catch {
            return false;
          }
        });
        const mask = owner ? null : nodeLinkMaskAt(r, absolute(path), principal.peerId);
        const data = Object.fromEntries(Object.entries(valueContent(store, cid).data).filter(([key]) => !bookkeeping.has(key) && (!mask?.fields || mask.fields.includes(key))));
        const children = visible.filter((row) => !mask?.children || mask.children.includes(row.id));
        const described = describe(path);
        let snapshot = null;
        try {
          snapshot = executionSnapshot(r, absolute(path), owner ? void 0 : { peerId: principal.peerId, scope: canonical, capabilities: [] });
        } catch {
          snapshot = null;
        }
        return unchanged({
          ...described,
          ...mask?.fields && !mask.fields.includes("description") ? { title: null } : {},
          data,
          ancestors: path.map((_id, i2) => describe(path.slice(0, i2))),
          children: children.slice(offset, offset + 100).map((row) => ({ ...row, path: [...path, row.id] })),
          nextOffset: offset + 100 < children.length ? offset + 100 : null,
          conflicts: node.choices.map((c) => ({ id: c.id, subject: c.subject })),
          proposals: node.proposals.filter((p) => owner || p.peerId === principal.peerId),
          evaluation: snapshot ? { status: snapshot.status, inputs: snapshot.inputs, nodes: snapshot.nodes } : null,
          actions: [...editable ? ["submit", "input", "complete"] : [], ...owner ? ["branch", "decide"] : []]
        });
      }
      if (event.kind === "search") {
        const query = event.query.toLowerCase(), offset = event.offset ?? 0;
        const stack = [path], seen = /* @__PURE__ */ new Set(), matches = [];
        let visited = 0;
        while (stack.length && visited < 5e3 && matches.length < 50) {
          const at = stack.pop();
          let current;
          try {
            current = resolve2(at);
          } catch {
            continue;
          }
          if (seen.has(current)) continue;
          seen.add(current);
          const v = viewNode(store, current);
          if (visited++ >= offset && (v.name ?? "").toLowerCase().includes(query)) matches.push(describe(at));
          if (at.length < 32) for (const row of [...v.tasks].reverse()) stack.push([...at, row.id]);
        }
        return unchanged({ matches, nextOffset: stack.length && visited < 5e3 ? visited : null, truncated: stack.length > 0, scanned: visited });
      }
      if (event.kind === "complete") {
        if (event.expected !== put(store, valueContent(store, cid))) throw new EventError("The node changed. Read and review it before evaluating.");
        if (owner) return { replica: r, changed: false, result: { status: "evaluating" }, evaluate: { path: absolute(path), branches: { ...branches, ...event.selections ?? {} }, expected: event.expected, ...event.recover ? { recover: true } : {} } };
        if (!editable) throw new EventError("Peer cannot request evaluation of this attachment.");
        if (!capabilityPeers(r, absolute(path), "request").length) throw new EventError("No peer accepts evaluation requests in this context.");
        const requestName = `evaluate ${path.length ? path.join("/") : "[]"}`;
        const identity2 = content(store, selectedIdentity(store, attached));
        if (readProposals(store, identity2).some((p) => p.peerId === principal.peerId && p.name === requestName && p.status === "open")) throw new EventError("This evaluation is already requested.");
        const base2 = put(store, valueContent(store, attached)), draftStore2 = new FosStore();
        importNodes(draftStore2, reachableNodes(store, [base2]));
        commitRoot(draftStore2, base2, now);
        const draft2 = writeNodeValue(createReplica(principal.peerId, draftStore2), path, EVALUATION_REQUEST, { peer: principal.peerId, expected: event.expected, time: now }, now);
        importNodes(store, reachableNodes(draftStore2, [headCid(draft2)]));
        const proposal2 = put(store, proposalContent(store, principal.peerId, requestName, headCid(draft2), base2, now));
        const next2 = updateAtScope(store, root, canonical, (current) => withProposal(store, makeLink(store, current, now), principal.peerId, proposal2, requestName), "node");
        commitRoot(store, next2, now);
        return { replica: { ...r }, changed: true, result: { status: "requested", proposalId: proposal2, request: requestName, node: absolute(path) } };
      }
      if (event.kind === "decide") {
        if (!permission(cid, "approve")) throw new EventError("The approve capability is required on this node.");
        const next2 = event.decision === "approve" ? applyProposalAt(r, absolute(path), event.proposalId, principal.peerId, now) : rejectProposalAt(r, absolute(path), event.proposalId, now);
        return { replica: next2, changed: headCid(next2) !== headCid(r), result: { decision: event.decision, proposalId: event.proposalId } };
      }
      if (event.kind === "input") {
        if (!editable) throw new EventError("Peer cannot interact with this node.");
        if (event.expected !== cid) throw new EventError("The node changed. Read it again before submitting.");
        const next2 = executionInput(r, absolute(path), { revision: headCid(r), key: event.key, value: event.value }, principal.peerId, now);
        return { replica: next2, changed: true, result: { ...executionSnapshot(next2, absolute(path)), revision: resolveScope(next2.store, headCid(next2), absolute(path)) } };
      }
      if (event.expected !== attached) throw new EventError("The attachment changed. Read [] and review before retrying.");
      if (event.kind === "branch") {
        if (!owner) throw new EventError("Only the account owner can create branches directly.");
        const next2 = createBranch(r, absolute(path), event.name, now);
        return { replica: next2, changed: true, result: { created: event.name, path } };
      }
      if (path.length) throw new EventError("Submissions attach at []. Put relative paths in changes[].path.");
      if (!editable) throw new EventError("Peer cannot propose edits on this attachment.");
      const apply = (draft2, draftStore2, base2) => {
        for (const change of event.changes) {
          const at = change.path, source = resolve2(at);
          for (let i2 = 1; i2 <= at.length; i2++) {
            const child = resolve2(at.slice(0, i2)), value = content(store, selectedIdentity(store, child));
            if (readMembers(store, value).some((m) => m.peerId === principal.peerId) && !permission(child, "edit")) throw new EventError("Peer cannot edit this child.");
          }
          if (!owner && nodeLinkMaskAt(r, absolute(at), principal.peerId).fields?.includes("description") === false) throw new EventError("Node text is not exposed to this peer.");
          const target = [...base2, ...at];
          if (change.operation === "add_task" || change.operation === "add_note" || change.operation === "add_plain") draft2 = addRow(draft2, target, change.operation === "add_task" ? "task" : change.operation === "add_note" ? "note" : "plain", textOf(change.text), now);
          else if (change.operation === "rename") {
            const text = textOf(change.text);
            if (!at.length) {
              const head = headCid(draft2);
              commitRoot(draftStore2, updateAtScope(draftStore2, head, base2, (value) => ({ ...value, data: { ...value.data, description: { content: text } } })), now);
              draft2 = { ...draft2 };
            } else draft2 = renameTask(draft2, target.slice(0, -1), target.at(-1), text, now);
          } else if (change.operation === "complete" && typeof change.done === "boolean") {
            if (!at.length) throw new EventError("Completion requires a child path.");
            if (!valueContent(store, source).data.todo) throw new EventError("Only tasks have a completion state.");
            const before = headCid(draft2);
            draft2 = setTaskDone(draft2, target.slice(0, -1), target.at(-1), change.done, now);
            if (before === headCid(draft2) && viewNode(draftStore2, descend(draftStore2, resolveScope(draftStore2, headCid(draft2), base2), at)).done !== change.done) throw new EventError("Task has unmet requirements.");
          } else throw new EventError("Unknown change operation.");
        }
        return draft2;
      };
      if (owner) {
        const before = headCid(r);
        const next2 = apply(r, store, canonical);
        return { replica: next2, changed: headCid(next2) !== before, result: { status: "applied" } };
      }
      const proposalName = event.name ? textOf(event.name, 100) : `${principal.name ?? principal.peerId} ${new Date(now).toISOString()}`;
      const identity = content(store, selectedIdentity(store, attached));
      if (readProposals(store, identity).some((p) => p.peerId === principal.peerId && p.name === proposalName)) throw new EventError("That proposal name already exists. Review it or choose a new name.");
      const base = put(store, valueContent(store, attached)), draftStore = new FosStore();
      importNodes(draftStore, reachableNodes(store, [base]));
      commitRoot(draftStore, base, now);
      let draft = createReplica(principal.peerId, draftStore);
      withBranches(draftStore, branches, () => {
        draft = apply(draft, draftStore, []);
      });
      if (headCid(draft) === base) throw new EventError("No changes to propose.");
      importNodes(store, reachableNodes(draftStore, [headCid(draft)]));
      const proposal = put(store, proposalContent(store, principal.peerId, proposalName, headCid(draft), base, now));
      const next = updateAtScope(store, root, canonical, (current) => withProposal(store, makeLink(store, current, now), principal.peerId, proposal, proposalName), "node");
      commitRoot(store, next, now);
      return { replica: { ...r }, changed: true, result: { proposalId: proposal, name: proposalName, status: "awaiting-review" } };
    });
  }

  // ../shared/sync/mcp-adapter.ts
  init_prelude();
  var pathSchema = { type: "array", items: { type: "string", minLength: 1, maxLength: 128 }, maxItems: 32 };
  var common = {
    path: { ...pathSchema, description: "Stable child IDs relative to the attachment. [] is its root; never titles or filesystem paths." },
    branches: { type: "array", maxItems: 32, items: { type: "object", properties: { path: pathSchema, name: { type: "string" } }, required: ["path", "name"], additionalProperties: false }, description: "Branch selections, outermost first. Paths are relative to the attachment." }
  };
  var tool = (name, kind, description, properties, required, readOnlyHint = true) => ({
    name,
    kind,
    description,
    inputSchema: { type: "object", properties: { ...common, ...properties }, required, additionalProperties: false },
    annotations: { readOnlyHint, destructiveHint: !readOnlyHint, idempotentHint: readOnlyHint, openWorldHint: kind === "complete" }
  });
  var MCP_TOOLS = [
    tool("fos_read", "read", "Read a node: its text, immediate children, branch choices, pending submissions, declared inputs of a running evaluation and the actions available to you. Start at []. Paginate children with offset.", { offset: { type: "integer", minimum: 0 } }, []),
    tool("fos_search", "search", "Search node text inside the attachment (bounded depth-first scan, active branches only). Returns paths for fos_read.", { query: { type: "string", minLength: 1, maxLength: 200 }, offset: { type: "integer", minimum: 0, maximum: 5e3 } }, ["query"]),
    tool("fos_propose", "submit", "Submit changes against the attachment. Read [] first; expected must equal its revision. An owner applies them; anyone else leaves a named proposal for the owner to review. Does not run effects. Batch related edits.", {
      expected: { type: "string" },
      name: { type: "string", minLength: 1, maxLength: 100 },
      changes: { type: "array", minItems: 1, maxItems: 50, items: { type: "object", properties: { path: pathSchema, operation: { enum: ["add_task", "add_note", "add_plain", "rename", "complete"] }, text: { type: "string", maxLength: 16e3 }, done: { type: "boolean" } }, required: ["path", "operation"], additionalProperties: false } }
    }, ["expected", "changes"], false),
    tool("fos_input", "input", "Provide one declared input of an evaluation (text, confirmation true, a zero-based choice, or an allocation {type, unit, amount, start?, end?}). Read the node first for keys, bounds and its revision (`expected`).", { expected: { type: "string" }, key: { type: "string" }, value: {} }, ["expected", "key", "value"], false),
    tool("fos_evaluate", "complete", "Evaluate a node. The owner's host runs it through its handler registry (checks, effect journal, recovery; can create external effects); anyone else leaves an evaluation request for the owner's rules to run or review. expected is valueRevision from fos_read(path). Never retry an uncertain effect automatically.", { expected: { type: "string" }, recover: { type: "boolean" } }, ["path", "expected"], false)
  ];
  var OWNER_TOOLS = [
    tool("fos_create_branch", "branch", "Create a content-addressed alternative at a node. Account owner only. expected is the revision from fos_read([]). Does not change other clients' selection.", { expected: { type: "string" }, name: { type: "string", minLength: 1, maxLength: 200 } }, ["path", "expected", "name"], false),
    tool("fos_decide", "decide", "Approve or reject a pending submission at a node. Requires the approve capability (owners have it).", { proposalId: { type: "string" }, decision: { enum: ["approve", "reject"] } }, ["proposalId", "decision"], false)
  ];
  function mcpTools(owner) {
    return [...MCP_TOOLS, ...owner ? OWNER_TOOLS : []].map(({ kind: _kind, ...t }) => t);
  }
  function mcpEvent(name, args, owner) {
    const found = [...MCP_TOOLS, ...owner ? OWNER_TOOLS : []].find((t) => t.name === name);
    if (!found) throw new Error("Tool unavailable for this credential.");
    if (args !== void 0 && (!args || typeof args !== "object" || Array.isArray(args))) throw new Error("Tool arguments must be an object.");
    return parseEvent({ ...args ?? {}, kind: found.kind });
  }
  var invalid = (id, code, message) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
  function handleMcp(message, host) {
    const m = message;
    if (!m || Array.isArray(m) || m.jsonrpc !== "2.0" || typeof m.method !== "string" || "id" in m && typeof m.id !== "string" && typeof m.id !== "number") return invalid(null, -32600, "Invalid JSON-RPC request");
    if (!("id" in m)) return null;
    const ok = (result) => ({ jsonrpc: "2.0", id: m.id, result });
    if (m.method === "initialize") return ok({ protocolVersion: host.protocolVersion ?? "2025-03-26", capabilities: { tools: {} }, serverInfo: { name: host.serverName ?? "fos", version: "1.0.0" } });
    if (m.method === "ping") return ok({});
    if (m.method === "tools/list") return ok({ tools: mcpTools(host.owner) });
    if (m.method !== "tools/call") return invalid(m.id, -32601, "Unknown method");
    const failure = (error) => ok({ isError: true, content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }] });
    const success = (result) => ok({ content: [{ type: "text", text: JSON.stringify(result) }] });
    try {
      const event = mcpEvent(m.params?.name, m.params?.arguments, host.owner);
      const outcome = host.dispatch(event);
      return outcome instanceof Promise ? outcome.then(success, failure) : success(outcome);
    } catch (error) {
      return failure(error);
    }
  }

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
  var parse = (json, fallback) => json ? JSON.parse(json) : fallback;
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
      const requested = parse(scopeJson, []);
      const home = requested.length === 1 && requested[0] === HOME_ID && homePath(r).length;
      set(handle, shareHome({ store: r.store, meta: { ...r.meta, localScope: void 0, scope: home ? [] : requested, scopeNames: home ? [] : parse(namesJson, []), baseCid: null } }));
    },
    view(handle, atJson) {
      return JSON.stringify(view(get2(handle), parse(atJson, [])));
    },
    /** Add a row of `kind` ('task' | 'plain' | 'note' | 'comment' | 'ref') under `at`; returns its view. */
    addRow(handle, atJson, kind, text, now, optionsJson) {
      const r = get2(handle);
      const at = parse(atJson, []);
      const options = parse(optionsJson, {});
      const id = options.id ?? crypto.randomUUID();
      set(handle, addRow(r, at, kind, text, now, { ...options, id }));
      const added = view(get2(handle), at)?.tasks.find((t) => t.id === id) ?? null;
      return JSON.stringify(added);
    },
    setRowKind(handle, atJson, id, kind, now) {
      set(handle, setRowKind(get2(handle), parse(atJson, []), id, kind, now));
    },
    addRef(handle, atJson, targetId, now) {
      set(handle, addRef(get2(handle), parse(atJson, []), targetId, now));
    },
    copyNode(handle, fromJson, id, toJson, positionJson, now) {
      set(handle, copyNode(get2(handle), parse(fromJson, []), id, parse(toJson, []), parse(positionJson, { into: "" }), now));
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
      walk(parse(atJson, []), 0);
      return JSON.stringify(lines);
    },
    /** Locate a task by id prefix anywhere below `at`: { id, at } or null. */
    findTask(handle, atJson, prefix2) {
      const r = get2(handle);
      const search = (at) => {
        const node = view(r, at);
        if (!node) return null;
        const direct = node.tasks.find((t) => t.id.startsWith(prefix2));
        if (direct) return { id: direct.id, at };
        for (const t of node.tasks) {
          const f = search([...at, t.id]);
          if (f) return f;
        }
        return null;
      };
      return JSON.stringify(search(parse(atJson, [])));
    },
    addTask(handle, atJson, title, now) {
      const next = addTask(get2(handle), parse(atJson, []), title, now);
      set(handle, next);
      const node = view(next, parse(atJson, []));
      return JSON.stringify(node?.tasks.at(-1) ?? null);
    },
    setTaskDone(handle, atJson, id, done, now) {
      set(handle, setTaskDone(get2(handle), parse(atJson, []), id, done, now));
    },
    renameTask(handle, atJson, id, title, now) {
      set(handle, renameTask(get2(handle), parse(atJson, []), id, title, now));
    },
    deleteTask(handle, atJson, id, now) {
      set(handle, deleteTask(get2(handle), parse(atJson, []), id, now));
    },
    moveNode(handle, fromJson, id, toJson, positionJson, now) {
      set(handle, moveNode(get2(handle), parse(fromJson, []), id, parse(toJson, []), JSON.parse(positionJson), now));
    },
    resolveChoice(handle, atJson, choiceId, pick, now) {
      set(handle, resolve(get2(handle), parse(atJson, []), choiceId, pick < 0 ? null : pick, now));
    },
    applyProposal(handle, atJson, proposalId, approver, now) {
      set(handle, applyProposalAt(get2(handle), parse(atJson, []), proposalId, approver, now));
    },
    rejectProposal(handle, atJson, proposalId, now) {
      set(handle, rejectProposalAt(get2(handle), parse(atJson, []), proposalId, now));
    },
    reattach(handle, scopeJson, now, namesJson) {
      set(handle, reattach(get2(handle), parse(scopeJson, []), now, namesJson ? parse(namesJson, []) : void 0));
    },
    buildSyncRequest(handle, branch, push = true) {
      set(handle, shareHome(get2(handle)));
      return JSON.stringify(buildSyncRequest(get2(handle), branch ?? void 0, { push }));
    },
    completeSync(handle, requestJson, responseJson, now) {
      const done = completeSync(get2(handle), JSON.parse(requestJson), JSON.parse(responseJson), now);
      set(handle, done.replica);
      return JSON.stringify({ reMerged: done.reMerged, newChoiceIds: done.newChoiceIds });
    },
    /** One MCP message (JSON-RPC) through the event grammar as this directory's owner. Returns {response, changed}. */
    mcp(handle, messageJson, peerId, now) {
      let changed = false;
      const response = handleMcp(JSON.parse(messageJson), { owner: true, serverName: "fos", dispatch: (event) => {
        const dispatched = dispatchEvent(get2(handle), event, { peerId, owner: true, scope: [] }, now);
        if (dispatched.changed) {
          set(handle, dispatched.replica);
          changed = true;
        }
        if (dispatched.evaluate) throw new Error("Evaluation is not available through the local server yet; run it from the app.");
        return dispatched.result;
      } });
      if (response instanceof Promise) throw new Error("unexpected asynchronous dispatch");
      return JSON.stringify({ response, changed });
    },
    /** Serve another peer against this replica (the directory as a node). */
    serveSync(handle, requestJson, serverPeerId, now, optionsJson) {
      const parsed = parseSyncRequest(JSON.parse(requestJson));
      if ("error" in parsed) return JSON.stringify({ error: parsed.error, code: parsed.code });
      const r = get2(handle);
      const served = serveSync(r.store, parsed, serverPeerId, now, parse(optionsJson, {}));
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
