var __supercopwasm = (function() {
  var _scriptDir = typeof document !== 'undefined' && document.currentScript ? document.currentScript.src: undefined;
  if (typeof __filename !== 'undefined') _scriptDir = _scriptDir || __filename;
  return (function(__supercopwasm) {
    __supercopwasm = __supercopwasm || {};

    var a;
    a || (a = typeof __supercopwasm !== 'undefined' ? __supercopwasm: {});
    var h;
    a.ready = new Promise(function(b) {
      h = b
    });
    var m = {},
      n;
    for (n in a) a.hasOwnProperty(n) && (m[n] = a[n]);
    var p = !1,
      q = !1,
      r = !1,
      t = !1;
    p = "object" === typeof window;
    q = "function" === typeof importScripts;
    r = "object" === typeof process && "object" === typeof process.versions && "string" === typeof process.versions.node;
    t = !p && !r && !q;
    var u = "",
      v, w, x, y;
    if (r) u = q ? require("path").dirname(u) + "/": __dirname + "/",
      v = function(b, d) {
        x || (x = require("fs"));
        y || (y = require("path"));
        b = y.normalize(b);
        return x.readFileSync(b, d ? null: "utf8")
      },
      w = function(b) {
        b = v(b, !0);
        b.buffer || (b = new Uint8Array(b));
        b.buffer || z("Assertion failed: undefined");
        return b
      },
    1 < process.argv.length && process.argv[1].replace(/\\/g, "/"),
      process.argv.slice(2),
      process.on("uncaughtException",
        function(b) {
          throw b;
        }),
      process.on("unhandledRejection", z),
      a.inspect = function() {
        return "[Emscripten Module object]"
      };
    else if (t)"undefined" != typeof read && (v = function(b) {
      return read(b)
    }),
      w = function(b) {
        if ("function" === typeof readbuffer) return new Uint8Array(readbuffer(b));
        b = read(b, "binary");
        "object" === typeof b || z("Assertion failed: undefined");
        return b
      },
    "undefined" !== typeof print && ("undefined" === typeof console && (console = {}), console.log = print, console.warn = console.error = "undefined" !== typeof printErr ? printErr: print);
    else if (p || q) q ? u = self.location.href: document.currentScript && (u = document.currentScript.src),
    _scriptDir && (u = _scriptDir),
      0 !== u.indexOf("blob:") ? u = u.substr(0, u.lastIndexOf("/") + 1) : u = "",
      v = function(b) {
        var d = new XMLHttpRequest;
        d.open("GET", b, !1);
        d.send(null);
        return d.responseText
      },
    q && (w = function(b) {
      var d = new XMLHttpRequest;
      d.open("GET", b, !1);
      d.responseType = "arraybuffer";
      d.send(null);
      return new Uint8Array(d.response)
    });
    var aa = a.print || console.log.bind(console),
      A = a.printErr || console.warn.bind(console);
    for (n in m) m.hasOwnProperty(n) && (a[n] = m[n]);
    m = null;
    var B;
    a.wasmBinary && (B = a.wasmBinary);
    var noExitRuntime;
    a.noExitRuntime && (noExitRuntime = a.noExitRuntime);
    "object" !== typeof WebAssembly && A("no native wasm support detected");
    var C, ba = new WebAssembly.Table({
        initial: 1,
        maximum: 1,
        element: "anyfunc"
      }),
      D = !1,
      E,
      F,
      G,
      H = a.INITIAL_MEMORY || 16777216;
    a.wasmMemory ? C = a.wasmMemory: C = new WebAssembly.Memory({
      initial: H / 65536,
      maximum: H / 65536
    });
    C && (E = C.buffer);
    H = E.byteLength;
    var I = E;
    E = I;
    a.HEAP8 = new Int8Array(I);
    a.HEAP16 = new Int16Array(I);
    a.HEAP32 = G = new Int32Array(I);
    a.HEAPU8 = F = new Uint8Array(I);
    a.HEAPU16 = new Uint16Array(I);
    a.HEAPU32 = new Uint32Array(I);
    a.HEAPF32 = new Float32Array(I);
    a.HEAPF64 = new Float64Array(I);
    G[8500] = 5277040;
    function J(b) {
      for (; 0 < b.length;) {
        var d = b.shift();
        if ("function" == typeof d) d(a);
        else {
          var k = d.j;
          "number" === typeof k ? void 0 === d.i ? a.dynCall_v(k) : a.dynCall_vi(k, d.i) : k(void 0 === d.i ? null: d.i)
        }
      }
    }
    var K = [],
      L = [],
      ca = [],
      M = [];
    function da() {
      var b = a.preRun.shift();
      K.unshift(b)
    }
    var N = 0,
      O = null,
      P = null;
    a.preloadedImages = {};
    a.preloadedAudios = {};
    function z(b) {
      if (a.onAbort) a.onAbort(b);
      aa(b);
      A(b);
      D = !0;
      throw new WebAssembly.RuntimeError("abort(" + b + "). Build with -s ASSERTIONS=1 for more info.");
    }
    function Q(b) {
      var d = R;
      return String.prototype.startsWith ? d.startsWith(b) : 0 === d.indexOf(b)
    }
    function S() {
      return Q("data:application/octet-stream;base64,")
    }
    var R = "supercop.wasm";
    if (!S()) {
      var T = R;
      R = a.locateFile ? a.locateFile(T, u) : u + T
    }
    function U() {
      try {
        if (B) return new Uint8Array(B);
        if (w) return w(R);
        throw "both async and sync fetching of the wasm failed";
      } catch(b) {
        z(b)
      }
    }
    function ea() {
      return B || !p && !q || "function" !== typeof fetch || Q("file://") ? new Promise(function(b) {
        b(U())
      }) : fetch(R, {
        credentials: "same-origin"
      }).then(function(b) {
        if (!b.ok) throw "failed to load wasm binary file at '" + R + "'";
        return b.arrayBuffer()
      }).
      catch(function() {
        return U()
      })
    }
    L.push({
      j: function() {
        V()
      }
    });
    var fa = {
      a: function() {
        z("OOM")
      },
      memory: C,
      table: ba
    }; (function() {
      function b(c) {
        a.asm = c.exports;
        N--;
        a.monitorRunDependencies && a.monitorRunDependencies(N);
        0 == N && (null !== O && (clearInterval(O), O = null), P && (c = P, P = null, c()))
      }
      function d(c) {
        b(c.instance)
      }
      function k(c) {
        return ea().then(function(e) {
          return WebAssembly.instantiate(e, l)
        }).then(c,
          function(e) {
            A("failed to asynchronously prepare wasm: " + e);
            z(e)
          })
      }
      var l = {
        a: fa
      };
      N++;
      a.monitorRunDependencies && a.monitorRunDependencies(N);
      if (a.instantiateWasm) try {
        return a.instantiateWasm(l, b)
      } catch(c) {
        return A("Module.instantiateWasm callback failed with error: " + c),
          !1
      } (function() {
        if (B || "function" !== typeof WebAssembly.instantiateStreaming || S() || Q("file://") || "function" !== typeof fetch) return k(d);
        fetch(R, {
          credentials: "same-origin"
        }).then(function(c) {
          return WebAssembly.instantiateStreaming(c, l).then(d,
            function(e) {
              A("wasm streaming compile failed: " + e);
              A("falling back to ArrayBuffer instantiation");
              return k(d)
            })
        })
      })();
      return {}
    })();
    var V = a.___wasm_call_ctors = function() {
      return (V = a.___wasm_call_ctors = a.asm.b).apply(null, arguments)
    };
    a._ed25519_create_keypair = function() {
      return (a._ed25519_create_keypair = a.asm.c).apply(null, arguments)
    };
    a._ed25519_sign = function() {
      return (a._ed25519_sign = a.asm.d).apply(null, arguments)
    };
    a._ed25519_key_exchange = function() {
      return (a._ed25519_key_exchange = a.asm.e).apply(null, arguments)
    };
    a._ed25519_verify = function() {
      return (a._ed25519_verify = a.asm.f).apply(null, arguments)
    };
    var W = a._free = function() {
        return (W = a._free = a.asm.g).apply(null, arguments)
      },
      X = a._malloc = function() {
        return (X = a._malloc = a.asm.h).apply(null, arguments)
      },
      Y;
    P = function ha() {
      Y || Z();
      Y || (P = ha)
    };
    function Z() {
      function b() {
        if (!Y && (Y = !0, a.calledRun = !0, !D)) {
          J(L);
          J(ca);
          h(a);
          if (a.onRuntimeInitialized) a.onRuntimeInitialized();
          if (a.postRun) for ("function" == typeof a.postRun && (a.postRun = [a.postRun]); a.postRun.length;) {
            var d = a.postRun.shift();
            M.unshift(d)
          }
          J(M)
        }
      }
      if (! (0 < N)) {
        if (a.preRun) for ("function" == typeof a.preRun && (a.preRun = [a.preRun]); a.preRun.length;) da();
        J(K);
        0 < N || (a.setStatus ? (a.setStatus("Running..."), setTimeout(function() {
            setTimeout(function() {
                a.setStatus("")
              },
              1);
            b()
          },
          1)) : b())
      }
    }
    a.run = Z;
    if (a.preInit) for ("function" == typeof a.preInit && (a.preInit = [a.preInit]); 0 < a.preInit.length;) a.preInit.pop()();
    noExitRuntime = !0;
    Z(); (function() {
      function b(c) {
        if (c && c.buffer instanceof ArrayBuffer) c = new Uint8Array(c.buffer, c.byteOffset, c.byteLength);
        else if ("string" === typeof c) {
          for (var e = c.length,
                 f = new Uint8Array(e + 1), g = 0; g < e; ++g) f[g] = c.charCodeAt(g);
          return f
        }
        return c
      }
      function d(c, e) {
        var f = new Number(c);
        f.length = e;
        f.get = function(g) {
          g = g || Uint8Array;
          return (new g(E, f, e / g.BYTES_PER_ELEMENT)).slice()
        };
        f.dereference = function(g) {
          g = g || 4;
          return d(f.get(Uint32Array)[0], g)
        };
        f.set = function(g) {
          g = b(g);
          if (g.length > e) throw RangeError("invalid array length");
          F.set(g, f)
        };
        f.free = function() {
          W(f);
          l.splice(l.indexOf(f), 1)
        };
        l.push(f);
        return f
      }
      function k(c, e) {
        e = b(e);
        0 === c && (c = e.length);
        var f = d(X(c), c);
        void 0 !== e ? (f.set(e), e.length < c && F.fill(0, f + e.length, f + c)) : F.fill(0, f, f + c);
        return f
      }
      var l = [];
      a.createPointer = d;
      a.allocatePointer = function(c) {
        c && (c = Uint32Array.of(c));
        return k(4, c)
      };
      a.allocateBytes = k;
      a.freeBytes = function() {
        for (var c = 0,
               e = l.length; c < e; ++c) W(l[c]);
        l = []
      }
    })();

    return __supercopwasm.ready
  });
})();
if (typeof exports === 'object' && typeof module === 'object') module.exports = __supercopwasm;
else if (typeof define === 'function' && define['amd']) define([],
  function() {
    return __supercopwasm;
  });
else if (typeof exports === 'object') exports["__supercopwasm"] = __supercopwasm;
