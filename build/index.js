import BenzAMRRecorder from 'benz-amr-recorder';

function isAudio(file) {
  return /audio/.test(file.type);
}
function getExtName(name) {
  if (name === void 0)
    return null;
  const matches = name.match(/.*\.([^\.\?]+)\??[^\.\?]*/);
  return matches && matches.length > 0 ? matches[1] : null;
}

let raf;
class AudioPlayer {
  constructor(opt) {
    this.extName = null;
    this.playUrl = "";
    this.commonPlayer = null;
    this.amrPlayer = null;
    this.duration = 0;
    this.startTime = 0;
    this.temporary = 0;
    if (!opt.url && !opt.file) {
      console.error("url\u548Cfile\u53C2\u6570\u81F3\u5C11\u9700\u8981\u4E00\u4E2A");
      return;
    }
    if (opt.file) {
      if (!isAudio(opt.file))
        console.error("\u6587\u4EF6\u7C7B\u578B\u53EA\u80FD\u662F\u97F3\u9891\u6587\u4EF6");
      this._file = opt.file;
    }
    if (opt.url)
      this.playUrl = opt.url;
    this.extName = opt.fileType ? opt.fileType : opt.file ? getExtName(opt.file.name) : getExtName(opt.url);
    this.afterInit = opt.afterInit;
    this.createPlayer();
  }
  createPlayer() {
    if (this.extName === "amr") {
      this.amrPlayer = new BenzAMRRecorder();
      if (this.playUrl) {
        this.amrPlayer.initWithUrl(this.playUrl).then(() => {
          this.duration = this.amrPlayer.getDuration();
          this.afterInit && this.afterInit();
          this.amrPlayer.onStop(() => {
            this._onEnd && this._onEnd();
          });
        });
      } else {
        this.amrPlayer.initWithBlob(this._file).then(() => {
          this.duration = this.amrPlayer.getDuration();
          this.afterInit && this.afterInit();
          this.amrPlayer.onStop(() => {
            this._onEnd && this._onEnd();
          });
        });
      }
    } else {
      if (!this.playUrl && this._file)
        this.playUrl = URL.createObjectURL(this._file);
      const audio = document.createElement("audio");
      audio.src = this.playUrl;
      audio.onloadedmetadata = () => {
        this.duration = audio.duration;
        this.commonPlayer = audio;
        this.afterInit && this.afterInit();
        audio.addEventListener("timeupdate", () => {
          const now = new Date().valueOf();
          this.timeUpdateFn && this.startTime !== 0 && this.timeUpdateFn((now - this.startTime) / 1e3 + this.temporary);
        });
        audio.addEventListener("ended", () => {
          this.temporary = 0;
          this._onEnd && this._onEnd();
        });
        audio.addEventListener("playing", () => {
          this.startTime = new Date().valueOf();
        });
        audio.addEventListener("pause", () => {
          this.temporary += (new Date().valueOf() - this.startTime) / 1e3;
        });
      };
    }
  }
  play() {
    if (this.amrPlayer && this.amrPlayer.isInit()) {
      if (this.amrPlayer.isPlaying())
        return;
      raf = requestAnimationFrame(this.amrTimeUpdate.bind(this));
      this.amrPlayer.play(this.temporary);
      this.amrPlayer.onEnded(() => {
        raf && cancelAnimationFrame(raf);
      });
    }
    this.commonPlayer && this.commonPlayer.play();
  }
  pause() {
    this.amrPlayer && this.amrPlayer.pause();
    raf && cancelAnimationFrame(raf);
    this.commonPlayer && this.commonPlayer.pause();
  }
  setTime(time) {
    this.temporary = time;
    if (this.commonPlayer)
      this.commonPlayer.currentTime = time;
  }
  destroy() {
    this.pause();
    this.amrPlayer && this.amrPlayer.stop() && this.amrPlayer.destroy();
    this.commonPlayer = null;
    this.amrPlayer = null;
  }
  onTimeUpdate(fn) {
    this.timeUpdateFn = fn;
  }
  onEnd(fn) {
    this._onEnd = fn;
  }
  amrTimeUpdate() {
    if (this.amrPlayer && this.amrPlayer.isPlaying())
      this.timeUpdateFn && this.timeUpdateFn(this.amrPlayer.getCurrentPosition());
    raf = requestAnimationFrame(this.amrTimeUpdate.bind(this));
  }
}

var AMR = function() {
  var AMR = { toWAV: function(amr) {
    var decoded = this._decode(amr);
    if (!decoded) {
      return null;
    }
    var raw = new Uint8Array(decoded.buffer, decoded.byteOffset, decoded.byteLength);
    var out = new Uint8Array(raw.length + this.WAV_HEADER_SIZE);
    var offset = 0;
    var write_int16 = function(value) {
      var a = new Uint8Array(2);
      new Int16Array(a.buffer)[0] = value;
      out.set(a, offset);
      offset += 2;
    };
    var write_int32 = function(value) {
      var a = new Uint8Array(4);
      new Int32Array(a.buffer)[0] = value;
      out.set(a, offset);
      offset += 4;
    };
    var write_string = function(value) {
      var d = new TextEncoder("utf-8").encode(value);
      out.set(d, offset);
      offset += d.length;
    };
    write_string("RIFF");
    write_int32(4 + 8 + 16 + 8 + raw.length);
    write_string("WAVEfmt ");
    write_int32(16);
    var bits_per_sample = 16;
    var sample_rate = 8e3;
    var channels = 1;
    var bytes_per_frame = bits_per_sample / 8 * channels;
    var bytes_per_sec = bytes_per_frame * sample_rate;
    write_int16(1);
    write_int16(1);
    write_int32(sample_rate);
    write_int32(bytes_per_sec);
    write_int16(bytes_per_frame);
    write_int16(bits_per_sample);
    write_string("data");
    write_int32(raw.length);
    out.set(raw, offset);
    return out;
  }, decode: function(amr) {
    var raw = this._decode(amr);
    if (!raw) {
      return null;
    }
    var out = new Float32Array(raw.length);
    for (var i2 = 0; i2 < out.length; i2++) {
      out[i2] = raw[i2] / 32768;
    }
    return out;
  }, _decode: function(amr) {
    if (String.fromCharCode.apply(null, amr.subarray(0, this.AMR_HEADER.length)) !== this.AMR_HEADER) {
      return null;
    }
    var decoder = this.Decoder_Interface_init();
    if (!decoder) {
      return null;
    }
    var out = new Int16Array(Math.floor(amr.length / 6 * this.PCM_BUFFER_COUNT));
    var buf = Module._malloc(this.AMR_BUFFER_COUNT);
    var decodeInBuffer = new Uint8Array(Module.HEAPU8.buffer, buf, this.AMR_BUFFER_COUNT);
    buf = Module._malloc(this.PCM_BUFFER_COUNT * 2);
    var decodeOutBuffer = new Int16Array(Module.HEAPU8.buffer, buf, this.PCM_BUFFER_COUNT);
    var inOffset = 6;
    var outOffset = 0;
    while (inOffset + 1 < amr.length && outOffset + 1 < out.length) {
      var size = this.SIZES[amr[inOffset] >> 3 & 15];
      if (inOffset + size + 1 > amr.length) {
        break;
      }
      decodeInBuffer.set(amr.subarray(inOffset, inOffset + size + 1));
      this.Decoder_Interface_Decode(decoder, decodeInBuffer.byteOffset, decodeOutBuffer.byteOffset, 0);
      if (outOffset + this.PCM_BUFFER_COUNT > out.length) {
        var newOut = new Int16Array(out.length * 2);
        newOut.set(out.subarray(0, outOffset));
        out = newOut;
      }
      out.set(decodeOutBuffer, outOffset);
      outOffset += this.PCM_BUFFER_COUNT;
      inOffset += size + 1;
    }
    Module._free(decodeInBuffer.byteOffset);
    Module._free(decodeOutBuffer.byteOffset);
    this.Decoder_Interface_exit(decoder);
    return out.subarray(0, outOffset);
  }, encode: function(pcm, pcmSampleRate, mode) {
    if (pcmSampleRate < 8e3) {
      console.error("pcmSampleRate should not be less than 8000.");
      return null;
    }
    if (typeof mode === "undefined") {
      mode = this.Mode.MR795;
    }
    var encoder = this.Encoder_Interface_init();
    if (!encoder) {
      return null;
    }
    var buf = Module._malloc(this.PCM_BUFFER_COUNT * 2);
    var encodeInBuffer = new Int16Array(Module.HEAPU8.buffer, buf, this.PCM_BUFFER_COUNT);
    buf = Module._malloc(this.AMR_BUFFER_COUNT);
    var encodeOutBuffer = new Uint8Array(Module.HEAPU8.buffer, buf, this.AMR_BUFFER_COUNT);
    var ratio = pcmSampleRate / 8e3;
    var inLength = Math.floor(pcm.length / ratio);
    var inData = new Int16Array(inLength);
    for (var i2 = 0; i2 < inLength; i2++) {
      inData[i2] = pcm[Math.floor(i2 * ratio)] * (32768 - 1);
    }
    var blockSize = this.SIZES[mode] + 1;
    var out = new Uint8Array(Math.ceil(inLength / this.PCM_BUFFER_COUNT * blockSize) + this.AMR_HEADER.length);
    out.set(new TextEncoder("utf-8").encode(this.AMR_HEADER));
    var inOffset = 0;
    var outOffset = this.AMR_HEADER.length;
    while (inOffset + this.PCM_BUFFER_COUNT < inData.length && outOffset + blockSize < out.length) {
      encodeInBuffer.set(inData.subarray(inOffset, inOffset + this.PCM_BUFFER_COUNT));
      var n = this.Encoder_Interface_Encode(encoder, mode, encodeInBuffer.byteOffset, encodeOutBuffer.byteOffset, 0);
      if (n != blockSize) {
        console.error([n, blockSize]);
        break;
      }
      out.set(encodeOutBuffer.subarray(0, n), outOffset);
      inOffset += this.PCM_BUFFER_COUNT;
      outOffset += n;
    }
    Module._free(encodeInBuffer.byteOffset);
    Module._free(encodeOutBuffer.byteOffset);
    this.Encoder_Interface_exit(encoder);
    return out.subarray(0, outOffset);
  }, Decoder_Interface_init: function() {
    console.warn("Decoder_Interface_init not initialized.");
    return 0;
  }, Decoder_Interface_exit: function(state) {
    console.warn("Decoder_Interface_exit not initialized.");
  }, Decoder_Interface_Decode: function(state, inBuffer, outBuffer, bfi) {
    console.warn("Decoder_Interface_Decode not initialized.");
  }, Encoder_Interface_init: function(dtx) {
    console.warn("Encoder_Interface_init not initialized.");
    return 0;
  }, Encoder_Interface_exit: function(state) {
    console.warn("Encoder_Interface_exit not initialized.");
  }, Encoder_Interface_Encode: function(state, mode, speech, out, forceSpeech) {
    console.warn("Encoder_Interface_Encode not initialized.");
  }, Mode: { MR475: 0, MR515: 1, MR59: 2, MR67: 3, MR74: 4, MR795: 5, MR102: 6, MR122: 7, MRDTX: 8 }, SIZES: [12, 13, 15, 17, 19, 20, 26, 31, 5, 6, 5, 5, 0, 0, 0, 0], AMR_BUFFER_COUNT: 32, PCM_BUFFER_COUNT: 160, AMR_HEADER: "#!AMR\n", WAV_HEADER_SIZE: 44 };
  var Module = { canvas: {}, print: function(text) {
    console.log(text);
  }, _main: function() {
    AMR.Decoder_Interface_init = Module._Decoder_Interface_init;
    AMR.Decoder_Interface_exit = Module._Decoder_Interface_exit;
    AMR.Decoder_Interface_Decode = Module._Decoder_Interface_Decode;
    AMR.Encoder_Interface_init = Module._Encoder_Interface_init;
    AMR.Encoder_Interface_exit = Module._Encoder_Interface_exit;
    AMR.Encoder_Interface_Encode = Module._Encoder_Interface_Encode;
    return 0;
  } };
  var Module;
  if (!Module)
    Module = (typeof Module !== "undefined" ? Module : null) || {};
  var moduleOverrides = {};
  for (var key in Module) {
    if (Module.hasOwnProperty(key)) {
      moduleOverrides[key] = Module[key];
    }
  }
  var ENVIRONMENT_IS_WEB = typeof window === "object";
  var ENVIRONMENT_IS_WORKER = typeof importScripts === "function";
  var ENVIRONMENT_IS_NODE = typeof process === "object" && typeof require === "function" && !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_WORKER;
  var ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;
  if (ENVIRONMENT_IS_NODE) {
    if (!Module["print"])
      Module["print"] = function print2(x) {
        process["stdout"].write(x + "\n");
      };
    if (!Module["printErr"])
      Module["printErr"] = function printErr2(x) {
        process["stderr"].write(x + "\n");
      };
    var nodeFS = require("fs");
    var nodePath = require("path");
    Module["read"] = function read2(filename, binary) {
      filename = nodePath["normalize"](filename);
      var ret = nodeFS["readFileSync"](filename);
      if (!ret && filename != nodePath["resolve"](filename)) {
        filename = path.join(__dirname, "..", "src", filename);
        ret = nodeFS["readFileSync"](filename);
      }
      if (ret && !binary)
        ret = ret.toString();
      return ret;
    };
    Module["readBinary"] = function readBinary(filename) {
      return Module["read"](filename, true);
    };
    Module["load"] = function load(f) {
      globalEval(read(f));
    };
    if (!Module["thisProgram"]) {
      if (process["argv"].length > 1) {
        Module["thisProgram"] = process["argv"][1].replace(/\\/g, "/");
      } else {
        Module["thisProgram"] = "unknown-program";
      }
    }
    Module["arguments"] = process["argv"].slice(2);
    if (typeof module !== "undefined") {
      module["exports"] = Module;
    }
    process["on"]("uncaughtException", function(ex) {
      if (!(ex instanceof ExitStatus)) {
        throw ex;
      }
    });
    Module["inspect"] = function() {
      return "[Emscripten Module object]";
    };
  } else if (ENVIRONMENT_IS_SHELL) {
    if (!Module["print"])
      Module["print"] = print;
    if (typeof printErr != "undefined")
      Module["printErr"] = printErr;
    if (typeof read != "undefined") {
      Module["read"] = read;
    } else {
      Module["read"] = function read2() {
        throw "no read() available (jsc?)";
      };
    }
    Module["readBinary"] = function readBinary(f) {
      if (typeof readbuffer === "function") {
        return new Uint8Array(readbuffer(f));
      }
      var data = read(f, "binary");
      assert(typeof data === "object");
      return data;
    };
    if (typeof scriptArgs != "undefined") {
      Module["arguments"] = scriptArgs;
    } else if (typeof arguments != "undefined") {
      Module["arguments"] = arguments;
    }
  } else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
    Module["read"] = function read2(url) {
      var xhr = new XMLHttpRequest();
      xhr.open("GET", url, false);
      xhr.send(null);
      return xhr.responseText;
    };
    if (typeof arguments != "undefined") {
      Module["arguments"] = arguments;
    }
    if (typeof console !== "undefined") {
      if (!Module["print"])
        Module["print"] = function print2(x) {
          console.log(x);
        };
      if (!Module["printErr"])
        Module["printErr"] = function printErr2(x) {
          console.log(x);
        };
    } else {
      var TRY_USE_DUMP = false;
      if (!Module["print"])
        Module["print"] = TRY_USE_DUMP && typeof dump !== "undefined" ? function(x) {
          dump(x);
        } : function(x) {
        };
    }
    if (ENVIRONMENT_IS_WORKER) {
      Module["load"] = importScripts;
    }
    if (typeof Module["setWindowTitle"] === "undefined") {
      Module["setWindowTitle"] = function(title) {
        document.title = title;
      };
    }
  } else {
    throw "Unknown runtime environment. Where are we?";
  }
  function globalEval(x) {
    eval.call(null, x);
  }
  if (!Module["load"] && Module["read"]) {
    Module["load"] = function load(f) {
      globalEval(Module["read"](f));
    };
  }
  if (!Module["print"]) {
    Module["print"] = function() {
    };
  }
  if (!Module["printErr"]) {
    Module["printErr"] = Module["print"];
  }
  if (!Module["arguments"]) {
    Module["arguments"] = [];
  }
  if (!Module["thisProgram"]) {
    Module["thisProgram"] = "./this.program";
  }
  Module.print = Module["print"];
  Module.printErr = Module["printErr"];
  Module["preRun"] = [];
  Module["postRun"] = [];
  for (var key in moduleOverrides) {
    if (moduleOverrides.hasOwnProperty(key)) {
      Module[key] = moduleOverrides[key];
    }
  }
  var Runtime = { setTempRet0: function(value) {
    tempRet0 = value;
  }, getTempRet0: function() {
    return tempRet0;
  }, stackSave: function() {
    return STACKTOP;
  }, stackRestore: function(stackTop) {
    STACKTOP = stackTop;
  }, getNativeTypeSize: function(type2) {
    switch (type2) {
      case "i1":
      case "i8":
        return 1;
      case "i16":
        return 2;
      case "i32":
        return 4;
      case "i64":
        return 8;
      case "float":
        return 4;
      case "double":
        return 8;
      default: {
        if (type2[type2.length - 1] === "*") {
          return Runtime.QUANTUM_SIZE;
        } else if (type2[0] === "i") {
          var bits = parseInt(type2.substr(1));
          assert(bits % 8 === 0);
          return bits / 8;
        } else {
          return 0;
        }
      }
    }
  }, getNativeFieldSize: function(type2) {
    return Math.max(Runtime.getNativeTypeSize(type2), Runtime.QUANTUM_SIZE);
  }, STACK_ALIGN: 16, prepVararg: function(ptr, type2) {
    if (type2 === "double" || type2 === "i64") {
      if (ptr & 7) {
        assert((ptr & 7) === 4);
        ptr += 4;
      }
    } else {
      assert((ptr & 3) === 0);
    }
    return ptr;
  }, getAlignSize: function(type2, size, vararg) {
    if (!vararg && (type2 == "i64" || type2 == "double"))
      return 8;
    if (!type2)
      return Math.min(size, 8);
    return Math.min(size || (type2 ? Runtime.getNativeFieldSize(type2) : 0), Runtime.QUANTUM_SIZE);
  }, dynCall: function(sig, ptr, args) {
    if (args && args.length) {
      if (!args.splice)
        args = Array.prototype.slice.call(args);
      args.splice(0, 0, ptr);
      return Module["dynCall_" + sig].apply(null, args);
    } else {
      return Module["dynCall_" + sig].call(null, ptr);
    }
  }, functionPointers: [], addFunction: function(func2) {
    for (var i2 = 0; i2 < Runtime.functionPointers.length; i2++) {
      if (!Runtime.functionPointers[i2]) {
        Runtime.functionPointers[i2] = func2;
        return 2 * (1 + i2);
      }
    }
    throw "Finished up all reserved function pointers. Use a higher value for RESERVED_FUNCTION_POINTERS.";
  }, removeFunction: function(index) {
    Runtime.functionPointers[(index - 2) / 2] = null;
  }, warnOnce: function(text) {
    if (!Runtime.warnOnce.shown)
      Runtime.warnOnce.shown = {};
    if (!Runtime.warnOnce.shown[text]) {
      Runtime.warnOnce.shown[text] = 1;
      Module.printErr(text);
    }
  }, funcWrappers: {}, getFuncWrapper: function(func2, sig) {
    assert(sig);
    if (!Runtime.funcWrappers[sig]) {
      Runtime.funcWrappers[sig] = {};
    }
    var sigCache = Runtime.funcWrappers[sig];
    if (!sigCache[func2]) {
      sigCache[func2] = function dynCall_wrapper() {
        return Runtime.dynCall(sig, func2, arguments);
      };
    }
    return sigCache[func2];
  }, getCompilerSetting: function(name) {
    throw "You must build with -s RETAIN_COMPILER_SETTINGS=1 for Runtime.getCompilerSetting or emscripten_get_compiler_setting to work";
  }, stackAlloc: function(size) {
    var ret = STACKTOP;
    STACKTOP = STACKTOP + size | 0;
    STACKTOP = STACKTOP + 15 & -16;
    return ret;
  }, staticAlloc: function(size) {
    var ret = STATICTOP;
    STATICTOP = STATICTOP + size | 0;
    STATICTOP = STATICTOP + 15 & -16;
    return ret;
  }, dynamicAlloc: function(size) {
    var ret = DYNAMICTOP;
    DYNAMICTOP = DYNAMICTOP + size | 0;
    DYNAMICTOP = DYNAMICTOP + 15 & -16;
    if (DYNAMICTOP >= TOTAL_MEMORY) {
      var success = enlargeMemory();
      if (!success) {
        DYNAMICTOP = ret;
        return 0;
      }
    }
    return ret;
  }, alignMemory: function(size, quantum) {
    var ret = size = Math.ceil(size / (quantum ? quantum : 16)) * (quantum ? quantum : 16);
    return ret;
  }, makeBigInt: function(low, high, unsigned) {
    var ret = unsigned ? +(low >>> 0) + +(high >>> 0) * 4294967296 : +(low >>> 0) + +(high | 0) * 4294967296;
    return ret;
  }, GLOBAL_BASE: 8, QUANTUM_SIZE: 4, __dummy__: 0 };
  Module["Runtime"] = Runtime;
  var ABORT = false;
  var tempDouble;
  var tempI64;
  var tempRet0;
  function assert(condition, text) {
    if (!condition) {
      abort("Assertion failed: " + text);
    }
  }
  function getCFunc(ident) {
    var func = Module["_" + ident];
    if (!func) {
      try {
        func = eval("_" + ident);
      } catch (e) {
      }
    }
    assert(func, "Cannot call unknown function " + ident + " (perhaps LLVM optimizations or closure removed it?)");
    return func;
  }
  var cwrap, ccall;
  (function() {
    var JSfuncs = { "stackSave": function() {
      Runtime.stackSave();
    }, "stackRestore": function() {
      Runtime.stackRestore();
    }, "arrayToC": function(arr) {
      var ret = Runtime.stackAlloc(arr.length);
      writeArrayToMemory(arr, ret);
      return ret;
    }, "stringToC": function(str) {
      var ret = 0;
      if (str !== null && str !== void 0 && str !== 0) {
        ret = Runtime.stackAlloc((str.length << 2) + 1);
        writeStringToMemory(str, ret);
      }
      return ret;
    } };
    var toC = { "string": JSfuncs["stringToC"], "array": JSfuncs["arrayToC"] };
    ccall = function ccallFunc(ident2, returnType2, argTypes2, args, opts) {
      var func2 = getCFunc(ident2);
      var cArgs = [];
      var stack = 0;
      if (args) {
        for (var i2 = 0; i2 < args.length; i2++) {
          var converter = toC[argTypes2[i2]];
          if (converter) {
            if (stack === 0)
              stack = Runtime.stackSave();
            cArgs[i2] = converter(args[i2]);
          } else {
            cArgs[i2] = args[i2];
          }
        }
      }
      var ret = func2.apply(null, cArgs);
      if (returnType2 === "string")
        ret = Pointer_stringify(ret);
      if (stack !== 0) {
        if (opts && opts.async) {
          EmterpreterAsync.asyncFinalizers.push(function() {
            Runtime.stackRestore(stack);
          });
          return;
        }
        Runtime.stackRestore(stack);
      }
      return ret;
    };
    var sourceRegex = /^function\s*\(([^)]*)\)\s*{\s*([^*]*?)[\s;]*(?:return\s*(.*?)[;\s]*)?}$/;
    function parseJSFunc(jsfunc) {
      var parsed = jsfunc.toString().match(sourceRegex).slice(1);
      return { arguments: parsed[0], body: parsed[1], returnValue: parsed[2] };
    }
    var JSsource = {};
    for (var fun in JSfuncs) {
      if (JSfuncs.hasOwnProperty(fun)) {
        JSsource[fun] = parseJSFunc(JSfuncs[fun]);
      }
    }
    cwrap = function cwrap(ident, returnType, argTypes) {
      argTypes = argTypes || [];
      var cfunc = getCFunc(ident);
      var numericArgs = argTypes.every(function(type2) {
        return type2 === "number";
      });
      var numericRet = returnType !== "string";
      if (numericRet && numericArgs) {
        return cfunc;
      }
      var argNames = argTypes.map(function(x, i2) {
        return "$" + i2;
      });
      var funcstr = "(function(" + argNames.join(",") + ") {";
      var nargs = argTypes.length;
      if (!numericArgs) {
        funcstr += "var stack = " + JSsource["stackSave"].body + ";";
        for (var i = 0; i < nargs; i++) {
          var arg = argNames[i], type = argTypes[i];
          if (type === "number")
            continue;
          var convertCode = JSsource[type + "ToC"];
          funcstr += "var " + convertCode.arguments + " = " + arg + ";";
          funcstr += convertCode.body + ";";
          funcstr += arg + "=" + convertCode.returnValue + ";";
        }
      }
      var cfuncname = parseJSFunc(function() {
        return cfunc;
      }).returnValue;
      funcstr += "var ret = " + cfuncname + "(" + argNames.join(",") + ");";
      if (!numericRet) {
        var strgfy = parseJSFunc(function() {
          return Pointer_stringify;
        }).returnValue;
        funcstr += "ret = " + strgfy + "(ret);";
      }
      if (!numericArgs) {
        funcstr += JSsource["stackRestore"].body.replace("()", "(stack)") + ";";
      }
      funcstr += "return ret})";
      return eval(funcstr);
    };
  })();
  Module["ccall"] = ccall;
  Module["cwrap"] = cwrap;
  function setValue(ptr, value, type2, noSafe) {
    type2 = type2 || "i8";
    if (type2.charAt(type2.length - 1) === "*")
      type2 = "i32";
    switch (type2) {
      case "i1":
        HEAP8[ptr >> 0] = value;
        break;
      case "i8":
        HEAP8[ptr >> 0] = value;
        break;
      case "i16":
        HEAP16[ptr >> 1] = value;
        break;
      case "i32":
        HEAP32[ptr >> 2] = value;
        break;
      case "i64":
        tempI64 = [value >>> 0, (tempDouble = value, +Math_abs(tempDouble) >= 1 ? tempDouble > 0 ? (Math_min(+Math_floor(tempDouble / 4294967296), 4294967295) | 0) >>> 0 : ~~+Math_ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)], HEAP32[ptr >> 2] = tempI64[0], HEAP32[ptr + 4 >> 2] = tempI64[1];
        break;
      case "float":
        HEAPF32[ptr >> 2] = value;
        break;
      case "double":
        HEAPF64[ptr >> 3] = value;
        break;
      default:
        abort("invalid type for setValue: " + type2);
    }
  }
  Module["setValue"] = setValue;
  function getValue(ptr, type2, noSafe) {
    type2 = type2 || "i8";
    if (type2.charAt(type2.length - 1) === "*")
      type2 = "i32";
    switch (type2) {
      case "i1":
        return HEAP8[ptr >> 0];
      case "i8":
        return HEAP8[ptr >> 0];
      case "i16":
        return HEAP16[ptr >> 1];
      case "i32":
        return HEAP32[ptr >> 2];
      case "i64":
        return HEAP32[ptr >> 2];
      case "float":
        return HEAPF32[ptr >> 2];
      case "double":
        return HEAPF64[ptr >> 3];
      default:
        abort("invalid type for setValue: " + type2);
    }
    return null;
  }
  Module["getValue"] = getValue;
  var ALLOC_NORMAL = 0;
  var ALLOC_STACK = 1;
  var ALLOC_STATIC = 2;
  var ALLOC_DYNAMIC = 3;
  var ALLOC_NONE = 4;
  Module["ALLOC_NORMAL"] = ALLOC_NORMAL;
  Module["ALLOC_STACK"] = ALLOC_STACK;
  Module["ALLOC_STATIC"] = ALLOC_STATIC;
  Module["ALLOC_DYNAMIC"] = ALLOC_DYNAMIC;
  Module["ALLOC_NONE"] = ALLOC_NONE;
  function allocate(slab, types, allocator, ptr) {
    var zeroinit, size;
    if (typeof slab === "number") {
      zeroinit = true;
      size = slab;
    } else {
      zeroinit = false;
      size = slab.length;
    }
    var singleType = typeof types === "string" ? types : null;
    var ret;
    if (allocator == ALLOC_NONE) {
      ret = ptr;
    } else {
      ret = [_malloc, Runtime.stackAlloc, Runtime.staticAlloc, Runtime.dynamicAlloc][allocator === void 0 ? ALLOC_STATIC : allocator](Math.max(size, singleType ? 1 : types.length));
    }
    if (zeroinit) {
      var ptr = ret, stop;
      assert((ret & 3) == 0);
      stop = ret + (size & ~3);
      for (; ptr < stop; ptr += 4) {
        HEAP32[ptr >> 2] = 0;
      }
      stop = ret + size;
      while (ptr < stop) {
        HEAP8[ptr++ >> 0] = 0;
      }
      return ret;
    }
    if (singleType === "i8") {
      if (slab.subarray || slab.slice) {
        HEAPU8.set(slab, ret);
      } else {
        HEAPU8.set(new Uint8Array(slab), ret);
      }
      return ret;
    }
    var i2 = 0, type2, typeSize, previousType;
    while (i2 < size) {
      var curr = slab[i2];
      if (typeof curr === "function") {
        curr = Runtime.getFunctionIndex(curr);
      }
      type2 = singleType || types[i2];
      if (type2 === 0) {
        i2++;
        continue;
      }
      if (type2 == "i64")
        type2 = "i32";
      setValue(ret + i2, curr, type2);
      if (previousType !== type2) {
        typeSize = Runtime.getNativeTypeSize(type2);
        previousType = type2;
      }
      i2 += typeSize;
    }
    return ret;
  }
  Module["allocate"] = allocate;
  function getMemory(size) {
    if (!staticSealed)
      return Runtime.staticAlloc(size);
    if (typeof _sbrk !== "undefined" && !_sbrk.called || !runtimeInitialized)
      return Runtime.dynamicAlloc(size);
    return _malloc(size);
  }
  Module["getMemory"] = getMemory;
  function Pointer_stringify(ptr, length) {
    if (length === 0 || !ptr)
      return "";
    var hasUtf = 0;
    var t;
    var i2 = 0;
    while (1) {
      t = HEAPU8[ptr + i2 >> 0];
      hasUtf |= t;
      if (t == 0 && !length)
        break;
      i2++;
      if (length && i2 == length)
        break;
    }
    if (!length)
      length = i2;
    var ret = "";
    if (hasUtf < 128) {
      var MAX_CHUNK = 1024;
      var curr;
      while (length > 0) {
        curr = String.fromCharCode.apply(String, HEAPU8.subarray(ptr, ptr + Math.min(length, MAX_CHUNK)));
        ret = ret ? ret + curr : curr;
        ptr += MAX_CHUNK;
        length -= MAX_CHUNK;
      }
      return ret;
    }
    return Module["UTF8ToString"](ptr);
  }
  Module["Pointer_stringify"] = Pointer_stringify;
  function AsciiToString(ptr) {
    var str = "";
    while (1) {
      var ch = HEAP8[ptr++ >> 0];
      if (!ch)
        return str;
      str += String.fromCharCode(ch);
    }
  }
  Module["AsciiToString"] = AsciiToString;
  function stringToAscii(str, outPtr) {
    return writeAsciiToMemory(str, outPtr, false);
  }
  Module["stringToAscii"] = stringToAscii;
  function UTF8ArrayToString(u8Array, idx) {
    var u0, u1, u2, u3, u4, u5;
    var str = "";
    while (1) {
      u0 = u8Array[idx++];
      if (!u0)
        return str;
      if (!(u0 & 128)) {
        str += String.fromCharCode(u0);
        continue;
      }
      u1 = u8Array[idx++] & 63;
      if ((u0 & 224) == 192) {
        str += String.fromCharCode((u0 & 31) << 6 | u1);
        continue;
      }
      u2 = u8Array[idx++] & 63;
      if ((u0 & 240) == 224) {
        u0 = (u0 & 15) << 12 | u1 << 6 | u2;
      } else {
        u3 = u8Array[idx++] & 63;
        if ((u0 & 248) == 240) {
          u0 = (u0 & 7) << 18 | u1 << 12 | u2 << 6 | u3;
        } else {
          u4 = u8Array[idx++] & 63;
          if ((u0 & 252) == 248) {
            u0 = (u0 & 3) << 24 | u1 << 18 | u2 << 12 | u3 << 6 | u4;
          } else {
            u5 = u8Array[idx++] & 63;
            u0 = (u0 & 1) << 30 | u1 << 24 | u2 << 18 | u3 << 12 | u4 << 6 | u5;
          }
        }
      }
      if (u0 < 65536) {
        str += String.fromCharCode(u0);
      } else {
        var ch = u0 - 65536;
        str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023);
      }
    }
  }
  Module["UTF8ArrayToString"] = UTF8ArrayToString;
  function UTF8ToString(ptr) {
    return UTF8ArrayToString(HEAPU8, ptr);
  }
  Module["UTF8ToString"] = UTF8ToString;
  function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
    if (!(maxBytesToWrite > 0))
      return 0;
    var startIdx = outIdx;
    var endIdx = outIdx + maxBytesToWrite - 1;
    for (var i2 = 0; i2 < str.length; ++i2) {
      var u = str.charCodeAt(i2);
      if (u >= 55296 && u <= 57343)
        u = 65536 + ((u & 1023) << 10) | str.charCodeAt(++i2) & 1023;
      if (u <= 127) {
        if (outIdx >= endIdx)
          break;
        outU8Array[outIdx++] = u;
      } else if (u <= 2047) {
        if (outIdx + 1 >= endIdx)
          break;
        outU8Array[outIdx++] = 192 | u >> 6;
        outU8Array[outIdx++] = 128 | u & 63;
      } else if (u <= 65535) {
        if (outIdx + 2 >= endIdx)
          break;
        outU8Array[outIdx++] = 224 | u >> 12;
        outU8Array[outIdx++] = 128 | u >> 6 & 63;
        outU8Array[outIdx++] = 128 | u & 63;
      } else if (u <= 2097151) {
        if (outIdx + 3 >= endIdx)
          break;
        outU8Array[outIdx++] = 240 | u >> 18;
        outU8Array[outIdx++] = 128 | u >> 12 & 63;
        outU8Array[outIdx++] = 128 | u >> 6 & 63;
        outU8Array[outIdx++] = 128 | u & 63;
      } else if (u <= 67108863) {
        if (outIdx + 4 >= endIdx)
          break;
        outU8Array[outIdx++] = 248 | u >> 24;
        outU8Array[outIdx++] = 128 | u >> 18 & 63;
        outU8Array[outIdx++] = 128 | u >> 12 & 63;
        outU8Array[outIdx++] = 128 | u >> 6 & 63;
        outU8Array[outIdx++] = 128 | u & 63;
      } else {
        if (outIdx + 5 >= endIdx)
          break;
        outU8Array[outIdx++] = 252 | u >> 30;
        outU8Array[outIdx++] = 128 | u >> 24 & 63;
        outU8Array[outIdx++] = 128 | u >> 18 & 63;
        outU8Array[outIdx++] = 128 | u >> 12 & 63;
        outU8Array[outIdx++] = 128 | u >> 6 & 63;
        outU8Array[outIdx++] = 128 | u & 63;
      }
    }
    outU8Array[outIdx] = 0;
    return outIdx - startIdx;
  }
  Module["stringToUTF8Array"] = stringToUTF8Array;
  function stringToUTF8(str, outPtr, maxBytesToWrite) {
    return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);
  }
  Module["stringToUTF8"] = stringToUTF8;
  function lengthBytesUTF8(str) {
    var len = 0;
    for (var i2 = 0; i2 < str.length; ++i2) {
      var u = str.charCodeAt(i2);
      if (u >= 55296 && u <= 57343)
        u = 65536 + ((u & 1023) << 10) | str.charCodeAt(++i2) & 1023;
      if (u <= 127) {
        ++len;
      } else if (u <= 2047) {
        len += 2;
      } else if (u <= 65535) {
        len += 3;
      } else if (u <= 2097151) {
        len += 4;
      } else if (u <= 67108863) {
        len += 5;
      } else {
        len += 6;
      }
    }
    return len;
  }
  Module["lengthBytesUTF8"] = lengthBytesUTF8;
  function UTF16ToString(ptr) {
    var i2 = 0;
    var str = "";
    while (1) {
      var codeUnit = HEAP16[ptr + i2 * 2 >> 1];
      if (codeUnit == 0)
        return str;
      ++i2;
      str += String.fromCharCode(codeUnit);
    }
  }
  Module["UTF16ToString"] = UTF16ToString;
  function stringToUTF16(str, outPtr, maxBytesToWrite) {
    if (maxBytesToWrite === void 0) {
      maxBytesToWrite = 2147483647;
    }
    if (maxBytesToWrite < 2)
      return 0;
    maxBytesToWrite -= 2;
    var startPtr = outPtr;
    var numCharsToWrite = maxBytesToWrite < str.length * 2 ? maxBytesToWrite / 2 : str.length;
    for (var i2 = 0; i2 < numCharsToWrite; ++i2) {
      var codeUnit = str.charCodeAt(i2);
      HEAP16[outPtr >> 1] = codeUnit;
      outPtr += 2;
    }
    HEAP16[outPtr >> 1] = 0;
    return outPtr - startPtr;
  }
  Module["stringToUTF16"] = stringToUTF16;
  function lengthBytesUTF16(str) {
    return str.length * 2;
  }
  Module["lengthBytesUTF16"] = lengthBytesUTF16;
  function UTF32ToString(ptr) {
    var i2 = 0;
    var str = "";
    while (1) {
      var utf32 = HEAP32[ptr + i2 * 4 >> 2];
      if (utf32 == 0)
        return str;
      ++i2;
      if (utf32 >= 65536) {
        var ch = utf32 - 65536;
        str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023);
      } else {
        str += String.fromCharCode(utf32);
      }
    }
  }
  Module["UTF32ToString"] = UTF32ToString;
  function stringToUTF32(str, outPtr, maxBytesToWrite) {
    if (maxBytesToWrite === void 0) {
      maxBytesToWrite = 2147483647;
    }
    if (maxBytesToWrite < 4)
      return 0;
    var startPtr = outPtr;
    var endPtr = startPtr + maxBytesToWrite - 4;
    for (var i2 = 0; i2 < str.length; ++i2) {
      var codeUnit = str.charCodeAt(i2);
      if (codeUnit >= 55296 && codeUnit <= 57343) {
        var trailSurrogate = str.charCodeAt(++i2);
        codeUnit = 65536 + ((codeUnit & 1023) << 10) | trailSurrogate & 1023;
      }
      HEAP32[outPtr >> 2] = codeUnit;
      outPtr += 4;
      if (outPtr + 4 > endPtr)
        break;
    }
    HEAP32[outPtr >> 2] = 0;
    return outPtr - startPtr;
  }
  Module["stringToUTF32"] = stringToUTF32;
  function lengthBytesUTF32(str) {
    var len = 0;
    for (var i2 = 0; i2 < str.length; ++i2) {
      var codeUnit = str.charCodeAt(i2);
      if (codeUnit >= 55296 && codeUnit <= 57343)
        ++i2;
      len += 4;
    }
    return len;
  }
  Module["lengthBytesUTF32"] = lengthBytesUTF32;
  function demangle(func2) {
    var hasLibcxxabi = !!Module["___cxa_demangle"];
    if (hasLibcxxabi) {
      try {
        var buf = _malloc(func2.length);
        writeStringToMemory(func2.substr(1), buf);
        var status = _malloc(4);
        var ret = Module["___cxa_demangle"](buf, 0, 0, status);
        if (getValue(status, "i32") === 0 && ret) {
          return Pointer_stringify(ret);
        }
      } catch (e) {
      } finally {
        if (buf)
          _free(buf);
        if (status)
          _free(status);
        if (ret)
          _free(ret);
      }
    }
    var i2 = 3;
    var basicTypes = { "v": "void", "b": "bool", "c": "char", "s": "short", "i": "int", "l": "long", "f": "float", "d": "double", "w": "wchar_t", "a": "signed char", "h": "unsigned char", "t": "unsigned short", "j": "unsigned int", "m": "unsigned long", "x": "long long", "y": "unsigned long long", "z": "..." };
    var subs = [];
    var first = true;
    function parseNested() {
      i2++;
      if (func2[i2] === "K")
        i2++;
      var parts = [];
      while (func2[i2] !== "E") {
        if (func2[i2] === "S") {
          i2++;
          var next = func2.indexOf("_", i2);
          var num = func2.substring(i2, next) || 0;
          parts.push(subs[num] || "?");
          i2 = next + 1;
          continue;
        }
        if (func2[i2] === "C") {
          parts.push(parts[parts.length - 1]);
          i2 += 2;
          continue;
        }
        var size = parseInt(func2.substr(i2));
        var pre = size.toString().length;
        if (!size || !pre) {
          i2--;
          break;
        }
        var curr = func2.substr(i2 + pre, size);
        parts.push(curr);
        subs.push(curr);
        i2 += pre + size;
      }
      i2++;
      return parts;
    }
    function parse(rawList, limit, allowVoid) {
      limit = limit || Infinity;
      var ret2 = "", list = [];
      function flushList() {
        return "(" + list.join(", ") + ")";
      }
      var name;
      if (func2[i2] === "N") {
        name = parseNested().join("::");
        limit--;
        if (limit === 0)
          return rawList ? [name] : name;
      } else {
        if (func2[i2] === "K" || first && func2[i2] === "L")
          i2++;
        var size = parseInt(func2.substr(i2));
        if (size) {
          var pre = size.toString().length;
          name = func2.substr(i2 + pre, size);
          i2 += pre + size;
        }
      }
      first = false;
      if (func2[i2] === "I") {
        i2++;
        var iList = parse(true);
        var iRet = parse(true, 1, true);
        ret2 += iRet[0] + " " + name + "<" + iList.join(", ") + ">";
      } else {
        ret2 = name;
      }
      paramLoop:
        while (i2 < func2.length && limit-- > 0) {
          var c = func2[i2++];
          if (c in basicTypes) {
            list.push(basicTypes[c]);
          } else {
            switch (c) {
              case "P":
                list.push(parse(true, 1, true)[0] + "*");
                break;
              case "R":
                list.push(parse(true, 1, true)[0] + "&");
                break;
              case "L":
                {
                  i2++;
                  var end = func2.indexOf("E", i2);
                  var size = end - i2;
                  list.push(func2.substr(i2, size));
                  i2 += size + 2;
                  break;
                }
              case "A":
                {
                  var size = parseInt(func2.substr(i2));
                  i2 += size.toString().length;
                  if (func2[i2] !== "_")
                    throw "?";
                  i2++;
                  list.push(parse(true, 1, true)[0] + " [" + size + "]");
                  break;
                }
              case "E":
                break paramLoop;
              default:
                ret2 += "?" + c;
                break paramLoop;
            }
          }
        }
      if (!allowVoid && list.length === 1 && list[0] === "void")
        list = [];
      if (rawList) {
        if (ret2) {
          list.push(ret2 + "?");
        }
        return list;
      } else {
        return ret2 + flushList();
      }
    }
    var parsed = func2;
    try {
      if (func2 == "Object._main" || func2 == "_main") {
        return "main()";
      }
      if (typeof func2 === "number")
        func2 = Pointer_stringify(func2);
      if (func2[0] !== "_")
        return func2;
      if (func2[1] !== "_")
        return func2;
      if (func2[2] !== "Z")
        return func2;
      switch (func2[3]) {
        case "n":
          return "operator new()";
        case "d":
          return "operator delete()";
      }
      parsed = parse();
    } catch (e) {
      parsed += "?";
    }
    if (parsed.indexOf("?") >= 0 && !hasLibcxxabi) {
      Runtime.warnOnce("warning: a problem occurred in builtin C++ name demangling; build with  -s DEMANGLE_SUPPORT=1  to link in libcxxabi demangling");
    }
    return parsed;
  }
  function demangleAll(text) {
    return text.replace(/__Z[\w\d_]+/g, function(x) {
      var y = demangle(x);
      return x === y ? x : x + " [" + y + "]";
    });
  }
  function jsStackTrace() {
    var err = new Error();
    if (!err.stack) {
      try {
        throw new Error(0);
      } catch (e) {
        err = e;
      }
      if (!err.stack) {
        return "(no stack trace available)";
      }
    }
    return err.stack.toString();
  }
  function stackTrace() {
    return demangleAll(jsStackTrace());
  }
  Module["stackTrace"] = stackTrace;
  var PAGE_SIZE = 4096;
  function alignMemoryPage(x) {
    if (x % 4096 > 0) {
      x += 4096 - x % 4096;
    }
    return x;
  }
  var HEAP;
  var HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;
  var STATIC_BASE = 0, STATICTOP = 0, staticSealed = false;
  var STACK_BASE = 0, STACKTOP = 0, STACK_MAX = 0;
  var DYNAMIC_BASE = 0, DYNAMICTOP = 0;
  function enlargeMemory() {
    abort("Cannot enlarge memory arrays. Either (1) compile with -s TOTAL_MEMORY=X with X higher than the current value " + TOTAL_MEMORY + ", (2) compile with ALLOW_MEMORY_GROWTH which adjusts the size at runtime but prevents some optimizations, or (3) set Module.TOTAL_MEMORY before the program runs.");
  }
  var TOTAL_STACK = Module["TOTAL_STACK"] || 65536;
  var TOTAL_MEMORY = Module["TOTAL_MEMORY"] || 524288;
  var totalMemory = 64 * 1024;
  while (totalMemory < TOTAL_MEMORY || totalMemory < 2 * TOTAL_STACK) {
    if (totalMemory < 16 * 1024 * 1024) {
      totalMemory *= 2;
    } else {
      totalMemory += 16 * 1024 * 1024;
    }
  }
  if (totalMemory !== TOTAL_MEMORY) {
    Module.printErr("increasing TOTAL_MEMORY to " + totalMemory + " to be compliant with the asm.js spec (and given that TOTAL_STACK=" + TOTAL_STACK + ")");
    TOTAL_MEMORY = totalMemory;
  }
  assert(typeof Int32Array !== "undefined" && typeof Float64Array !== "undefined" && !!new Int32Array(1)["subarray"] && !!new Int32Array(1)["set"], "JS engine does not provide full typed array support");
  var buffer;
  buffer = new ArrayBuffer(TOTAL_MEMORY);
  HEAP8 = new Int8Array(buffer);
  HEAP16 = new Int16Array(buffer);
  HEAP32 = new Int32Array(buffer);
  HEAPU8 = new Uint8Array(buffer);
  HEAPU16 = new Uint16Array(buffer);
  HEAPU32 = new Uint32Array(buffer);
  HEAPF32 = new Float32Array(buffer);
  HEAPF64 = new Float64Array(buffer);
  HEAP32[0] = 255;
  assert(HEAPU8[0] === 255 && HEAPU8[3] === 0, "Typed arrays 2 must be run on a little-endian system");
  Module["HEAP"] = HEAP;
  Module["buffer"] = buffer;
  Module["HEAP8"] = HEAP8;
  Module["HEAP16"] = HEAP16;
  Module["HEAP32"] = HEAP32;
  Module["HEAPU8"] = HEAPU8;
  Module["HEAPU16"] = HEAPU16;
  Module["HEAPU32"] = HEAPU32;
  Module["HEAPF32"] = HEAPF32;
  Module["HEAPF64"] = HEAPF64;
  function callRuntimeCallbacks(callbacks) {
    while (callbacks.length > 0) {
      var callback = callbacks.shift();
      if (typeof callback == "function") {
        callback();
        continue;
      }
      var func2 = callback.func;
      if (typeof func2 === "number") {
        if (callback.arg === void 0) {
          Runtime.dynCall("v", func2);
        } else {
          Runtime.dynCall("vi", func2, [callback.arg]);
        }
      } else {
        func2(callback.arg === void 0 ? null : callback.arg);
      }
    }
  }
  var __ATPRERUN__ = [];
  var __ATINIT__ = [];
  var __ATMAIN__ = [];
  var __ATEXIT__ = [];
  var __ATPOSTRUN__ = [];
  var runtimeInitialized = false;
  function preRun() {
    if (Module["preRun"]) {
      if (typeof Module["preRun"] == "function")
        Module["preRun"] = [Module["preRun"]];
      while (Module["preRun"].length) {
        addOnPreRun(Module["preRun"].shift());
      }
    }
    callRuntimeCallbacks(__ATPRERUN__);
  }
  function ensureInitRuntime() {
    if (runtimeInitialized)
      return;
    runtimeInitialized = true;
    callRuntimeCallbacks(__ATINIT__);
  }
  function preMain() {
    callRuntimeCallbacks(__ATMAIN__);
  }
  function exitRuntime() {
    callRuntimeCallbacks(__ATEXIT__);
  }
  function postRun() {
    if (Module["postRun"]) {
      if (typeof Module["postRun"] == "function")
        Module["postRun"] = [Module["postRun"]];
      while (Module["postRun"].length) {
        addOnPostRun(Module["postRun"].shift());
      }
    }
    callRuntimeCallbacks(__ATPOSTRUN__);
  }
  function addOnPreRun(cb) {
    __ATPRERUN__.unshift(cb);
  }
  Module["addOnPreRun"] = addOnPreRun;
  function addOnInit(cb) {
    __ATINIT__.unshift(cb);
  }
  Module["addOnInit"] = addOnInit;
  function addOnPreMain(cb) {
    __ATMAIN__.unshift(cb);
  }
  Module["addOnPreMain"] = addOnPreMain;
  function addOnExit(cb) {
    __ATEXIT__.unshift(cb);
  }
  Module["addOnExit"] = addOnExit;
  function addOnPostRun(cb) {
    __ATPOSTRUN__.unshift(cb);
  }
  Module["addOnPostRun"] = addOnPostRun;
  function intArrayFromString(stringy, dontAddNull, length) {
    var len = length > 0 ? length : lengthBytesUTF8(stringy) + 1;
    var u8array = new Array(len);
    var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
    if (dontAddNull)
      u8array.length = numBytesWritten;
    return u8array;
  }
  Module["intArrayFromString"] = intArrayFromString;
  function intArrayToString(array) {
    var ret = [];
    for (var i2 = 0; i2 < array.length; i2++) {
      var chr = array[i2];
      if (chr > 255) {
        chr &= 255;
      }
      ret.push(String.fromCharCode(chr));
    }
    return ret.join("");
  }
  Module["intArrayToString"] = intArrayToString;
  function writeStringToMemory(string, buffer2, dontAddNull) {
    var array = intArrayFromString(string, dontAddNull);
    var i2 = 0;
    while (i2 < array.length) {
      var chr = array[i2];
      HEAP8[buffer2 + i2 >> 0] = chr;
      i2 = i2 + 1;
    }
  }
  Module["writeStringToMemory"] = writeStringToMemory;
  function writeArrayToMemory(array, buffer2) {
    for (var i2 = 0; i2 < array.length; i2++) {
      HEAP8[buffer2++ >> 0] = array[i2];
    }
  }
  Module["writeArrayToMemory"] = writeArrayToMemory;
  function writeAsciiToMemory(str, buffer2, dontAddNull) {
    for (var i2 = 0; i2 < str.length; ++i2) {
      HEAP8[buffer2++ >> 0] = str.charCodeAt(i2);
    }
    if (!dontAddNull)
      HEAP8[buffer2 >> 0] = 0;
  }
  Module["writeAsciiToMemory"] = writeAsciiToMemory;
  if (!Math["imul"] || Math["imul"](4294967295, 5) !== -5)
    Math["imul"] = function imul(a, b) {
      var ah = a >>> 16;
      var al = a & 65535;
      var bh = b >>> 16;
      var bl = b & 65535;
      return al * bl + (ah * bl + al * bh << 16) | 0;
    };
  Math.imul = Math["imul"];
  if (!Math["clz32"])
    Math["clz32"] = function(x) {
      x = x >>> 0;
      for (var i2 = 0; i2 < 32; i2++) {
        if (x & 1 << 31 - i2)
          return i2;
      }
      return 32;
    };
  Math.clz32 = Math["clz32"];
  var Math_abs = Math.abs;
  var Math_ceil = Math.ceil;
  var Math_floor = Math.floor;
  var Math_min = Math.min;
  var runDependencies = 0;
  var dependenciesFulfilled = null;
  function addRunDependency(id) {
    runDependencies++;
    if (Module["monitorRunDependencies"]) {
      Module["monitorRunDependencies"](runDependencies);
    }
  }
  Module["addRunDependency"] = addRunDependency;
  function removeRunDependency(id) {
    runDependencies--;
    if (Module["monitorRunDependencies"]) {
      Module["monitorRunDependencies"](runDependencies);
    }
    if (runDependencies == 0) {
      if (dependenciesFulfilled) {
        var callback = dependenciesFulfilled;
        dependenciesFulfilled = null;
        callback();
      }
    }
  }
  Module["removeRunDependency"] = removeRunDependency;
  Module["preloadedImages"] = {};
  Module["preloadedAudios"] = {};
  STATIC_BASE = 8;
  STATICTOP = STATIC_BASE + 31776;
  __ATINIT__.push();
  allocate([154, 14, 0, 0, 188, 14, 0, 0, 226, 14, 0, 0, 8, 15, 0, 0, 46, 15, 0, 0, 84, 15, 0, 0, 130, 15, 0, 0, 208, 15, 0, 0, 66, 16, 0, 0, 108, 16, 0, 0, 42, 17, 0, 0, 248, 17, 0, 0, 228, 18, 0, 0, 240, 19, 0, 0, 24, 21, 0, 0, 86, 22, 0, 0, 238, 23, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 12, 0, 13, 0, 15, 0, 17, 0, 19, 0, 20, 0, 26, 0, 31, 0, 5, 0, 6, 0, 5, 0, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 252, 146, 252, 36, 253, 182, 253, 72, 254, 218, 254, 108, 255, 0, 0, 0, 0, 32, 78, 32, 78, 32, 78, 32, 78, 32, 78, 80, 70, 0, 64, 0, 32, 0, 0, 0, 0, 255, 127, 112, 125, 112, 125, 112, 125, 112, 125, 112, 125, 153, 89, 255, 127, 112, 125, 112, 125, 102, 102, 102, 38, 153, 25, 153, 25, 154, 89, 185, 62, 232, 43, 188, 30, 132, 21, 16, 15, 139, 10, 97, 7, 42, 5, 157, 3, 0, 96, 0, 72, 0, 54, 128, 40, 96, 30, 200, 22, 22, 17, 209, 12, 157, 9, 54, 7, 102, 70, 184, 38, 75, 21, 182, 11, 113, 6, 139, 3, 243, 1, 18, 1, 151, 0, 83, 0, 154, 89, 185, 62, 232, 43, 188, 30, 132, 21, 16, 15, 139, 10, 97, 7, 42, 5, 157, 3, 44, 3, 128, 0, 30, 2, 140, 0, 57, 11, 111, 4, 218, 8, 74, 13, 19, 8, 51, 2, 133, 49, 135, 2, 36, 16, 6, 7, 225, 21, 165, 20, 9, 30, 118, 1, 151, 14, 185, 1, 160, 42, 78, 10, 31, 46, 190, 9, 10, 80, 29, 3, 98, 20, 163, 2, 68, 26, 162, 32, 162, 20, 160, 6, 208, 5, 172, 1, 250, 22, 196, 1, 212, 20, 232, 15, 255, 13, 244, 4, 165, 9, 133, 3, 22, 62, 237, 3, 134, 58, 199, 12, 91, 40, 250, 18, 51, 14, 229, 7, 36, 10, 67, 3, 72, 48, 28, 19, 174, 47, 168, 6, 120, 52, 68, 6, 158, 35, 37, 9, 128, 15, 2, 6, 103, 21, 208, 38, 211, 14, 161, 1, 79, 5, 158, 1, 56, 14, 33, 6, 59, 31, 213, 13, 141, 44, 133, 2, 104, 33, 123, 2, 216, 15, 97, 5, 224, 64, 236, 23, 156, 44, 188, 2, 215, 7, 95, 2, 127, 48, 42, 6, 111, 43, 46, 18, 112, 53, 172, 6, 214, 46, 205, 4, 60, 31, 129, 28, 175, 51, 83, 22, 124, 9, 135, 4, 25, 8, 149, 7, 74, 24, 233, 23, 218, 13, 12, 7, 221, 34, 10, 7, 231, 33, 44, 6, 111, 54, 248, 13, 1, 52, 93, 24, 254, 23, 106, 4, 106, 23, 198, 6, 61, 55, 54, 18, 7, 44, 249, 12, 194, 47, 15, 6, 107, 54, 199, 11, 217, 19, 224, 40, 228, 36, 50, 26, 153, 6, 171, 2, 156, 5, 26, 5, 44, 28, 93, 15, 242, 15, 153, 10, 113, 30, 192, 2, 222, 58, 34, 3, 155, 24, 92, 20, 241, 16, 237, 20, 20, 26, 29, 2, 174, 23, 114, 2, 83, 53, 116, 14, 234, 44, 104, 9, 28, 63, 204, 2, 145, 47, 239, 2, 129, 31, 225, 44, 170, 24, 208, 8, 114, 17, 240, 1, 125, 28, 11, 2, 229, 39, 249, 14, 202, 32, 221, 11, 211, 32, 198, 3, 148, 55, 88, 7, 255, 33, 33, 21, 11, 64, 255, 18, 252, 28, 187, 7, 201, 23, 206, 4, 155, 36, 46, 17, 222, 56, 35, 13, 247, 52, 57, 11, 107, 51, 185, 5, 158, 21, 142, 6, 82, 51, 179, 57, 170, 28, 88, 2, 38, 5, 36, 2, 156, 16, 211, 13, 60, 39, 60, 9, 91, 41, 110, 2, 32, 51, 157, 2, 46, 55, 198, 13, 175, 19, 56, 38, 234, 59, 107, 2, 43, 12, 78, 2, 58, 64, 197, 11, 182, 60, 72, 16, 177, 60, 75, 6, 45, 60, 204, 4, 151, 62, 83, 36, 110, 29, 112, 19, 198, 7, 189, 4, 183, 44, 133, 4, 224, 48, 143, 21, 3, 37, 84, 10, 36, 30, 242, 7, 224, 51, 191, 8, 139, 62, 229, 19, 130, 31, 105, 26, 99, 39, 133, 5, 138, 19, 43, 9, 235, 48, 87, 23, 22, 59, 83, 11, 88, 71, 241, 8, 211, 61, 223, 9, 137, 63, 14, 40, 59, 57, 55, 44, 5, 7, 81, 1, 43, 12, 141, 1, 182, 13, 112, 11, 240, 17, 110, 10, 95, 29, 116, 2, 151, 44, 144, 2, 58, 23, 131, 9, 144, 25, 199, 28, 46, 32, 61, 3, 160, 15, 95, 3, 48, 39, 188, 9, 185, 62, 223, 13, 28, 71, 30, 4, 215, 23, 174, 5, 252, 22, 220, 30, 64, 73, 140, 13, 72, 7, 32, 2, 238, 35, 171, 2, 103, 45, 64, 16, 242, 17, 108, 6, 86, 12, 133, 4, 81, 62, 0, 10, 61, 48, 149, 14, 12, 68, 140, 20, 218, 23, 212, 7, 101, 11, 206, 6, 83, 64, 137, 20, 147, 65, 144, 6, 53, 67, 223, 6, 165, 18, 159, 12, 218, 28, 147, 23, 6, 56, 28, 39, 195, 15, 186, 1, 98, 16, 202, 1, 254, 35, 194, 8, 3, 29, 121, 16, 60, 50, 33, 3, 178, 43, 57, 3, 104, 49, 36, 8, 156, 50, 154, 25, 33, 37, 228, 3, 229, 25, 217, 3, 41, 41, 198, 9, 185, 59, 142, 19, 58, 49, 7, 8, 124, 60, 117, 6, 66, 63, 9, 27, 151, 55, 158, 22, 66, 10, 60, 3, 239, 21, 150, 6, 95, 53, 146, 22, 84, 14, 18, 6, 49, 44, 73, 10, 42, 38, 179, 5, 179, 54, 125, 18, 25, 62, 147, 24, 134, 24, 78, 7, 230, 30, 237, 8, 82, 66, 219, 17, 192, 64, 9, 15, 144, 59, 7, 9, 151, 62, 172, 12, 123, 56, 144, 69, 71, 46, 203, 10, 189, 7, 127, 5, 120, 5, 108, 3, 239, 16, 219, 13, 39, 17, 114, 16, 29, 21, 168, 2, 53, 68, 13, 3, 101, 25, 254, 19, 155, 31, 253, 29, 187, 28, 26, 3, 141, 32, 158, 4, 193, 58, 88, 12, 80, 58, 223, 11, 197, 79, 112, 3, 209, 56, 84, 3, 49, 48, 116, 57, 248, 26, 128, 7, 129, 16, 165, 3, 26, 32, 63, 4, 163, 41, 244, 15, 98, 39, 181, 17, 175, 10, 72, 3, 177, 80, 57, 4, 71, 65, 78, 23, 1, 62, 226, 17, 119, 42, 14, 10, 189, 14, 142, 4, 183, 56, 204, 15, 219, 80, 67, 10, 115, 59, 174, 10, 170, 59, 138, 8, 113, 24, 154, 12, 69, 51, 24, 76, 28, 28, 162, 3, 158, 9, 82, 6, 163, 17, 20, 12, 28, 54, 181, 16, 220, 40, 65, 3, 187, 67, 42, 3, 251, 65, 241, 8, 186, 60, 25, 32, 35, 53, 148, 6, 125, 12, 42, 7, 76, 62, 4, 11, 196, 61, 207, 20, 110, 66, 134, 9, 148, 65, 46, 5, 55, 61, 220, 31, 206, 45, 108, 33, 178, 14, 5, 8, 91, 37, 37, 5, 249, 52, 134, 26, 195, 47, 144, 7, 244, 31, 222, 13, 231, 51, 242, 6, 171, 63, 199, 25, 163, 63, 78, 30, 73, 33, 247, 9, 57, 28, 85, 10, 93, 71, 65, 29, 245, 65, 200, 8, 218, 69, 68, 11, 113, 67, 0, 13, 201, 36, 194, 78, 34, 43, 128, 32, 6, 5, 108, 2, 151, 5, 71, 2, 105, 23, 241, 8, 138, 15, 42, 14, 24, 20, 240, 2, 97, 52, 62, 3, 177, 21, 44, 11, 244, 45, 20, 23, 241, 41, 48, 2, 70, 21, 52, 2, 9, 52, 192, 11, 170, 46, 99, 14, 175, 77, 30, 3, 97, 38, 216, 2, 95, 53, 44, 34, 223, 28, 237, 11, 211, 9, 10, 3, 162, 23, 65, 3, 69, 25, 210, 19, 113, 32, 159, 9, 253, 23, 73, 7, 204, 59, 238, 4, 72, 56, 195, 17, 95, 53, 163, 17, 65, 12, 167, 11, 175, 9, 235, 4, 240, 58, 39, 18, 22, 60, 47, 10, 156, 56, 88, 9, 174, 48, 233, 9, 115, 29, 133, 11, 109, 50, 28, 47, 92, 21, 172, 2, 69, 12, 210, 2, 217, 19, 250, 4, 188, 49, 104, 16, 198, 59, 169, 2, 139, 30, 80, 2, 134, 25, 229, 7, 94, 64, 33, 34, 52, 52, 114, 3, 21, 21, 131, 3, 64, 57, 130, 8, 149, 57, 131, 16, 190, 55, 18, 5, 105, 54, 237, 7, 117, 60, 58, 29, 199, 61, 220, 17, 217, 9, 221, 7, 198, 19, 12, 7, 39, 20, 182, 25, 218, 27, 13, 14, 168, 42, 75, 6, 209, 45, 172, 6, 7, 66, 127, 13, 140, 63, 240, 25, 90, 36, 239, 3, 153, 36, 58, 8, 238, 74, 173, 19, 153, 48, 173, 16, 47, 62, 52, 5, 253, 59, 184, 13, 122, 46, 61, 55, 229, 62, 198, 26, 218, 7, 225, 2, 195, 14, 93, 3, 190, 44, 64, 11, 236, 13, 212, 13, 97, 35, 217, 4, 103, 48, 128, 3, 98, 33, 21, 18, 41, 45, 144, 22, 193, 31, 77, 2, 26, 32, 76, 2, 40, 73, 171, 14, 173, 50, 77, 12, 113, 61, 246, 2, 250, 64, 242, 2, 118, 59, 130, 43, 255, 61, 160, 8, 65, 18, 98, 2, 234, 39, 166, 2, 153, 59, 50, 16, 97, 22, 255, 12, 185, 32, 134, 6, 150, 77, 17, 9, 90, 60, 135, 21, 230, 54, 105, 21, 96, 22, 72, 11, 156, 29, 66, 5, 48, 56, 205, 20, 108, 63, 110, 15, 14, 59, 160, 14, 202, 59, 155, 5, 5, 57, 230, 15, 13, 48, 80, 61, 193, 29, 163, 6, 122, 8, 116, 3, 107, 17, 215, 17, 174, 70, 234, 12, 198, 49, 47, 3, 78, 58, 139, 3, 168, 58, 185, 16, 158, 60, 176, 32, 74, 70, 63, 4, 54, 9, 97, 3, 153, 63, 203, 14, 63, 61, 244, 17, 228, 63, 254, 5, 200, 64, 162, 8, 193, 65, 225, 37, 57, 62, 161, 17, 205, 12, 61, 4, 171, 37, 139, 8, 197, 46, 180, 23, 239, 35, 110, 17, 251, 34, 93, 6, 49, 40, 246, 11, 97, 64, 35, 20, 106, 60, 154, 27, 110, 53, 239, 9, 153, 20, 229, 8, 106, 65, 69, 24, 15, 65, 80, 13, 80, 79, 35, 13, 0, 73, 193, 7, 92, 55, 67, 50, 50, 59, 87, 61, 121, 17, 252, 3, 145, 6, 118, 3, 215, 16, 205, 16, 248, 34, 73, 14, 5, 23, 123, 4, 127, 45, 172, 5, 14, 62, 179, 8, 230, 17, 244, 25, 17, 27, 181, 4, 76, 24, 31, 3, 127, 48, 81, 13, 96, 62, 37, 15, 147, 77, 61, 8, 217, 37, 93, 8, 150, 57, 126, 34, 144, 56, 39, 10, 25, 7, 214, 4, 91, 30, 45, 3, 135, 74, 58, 17, 178, 21, 16, 8, 103, 14, 28, 11, 27, 68, 208, 8, 57, 65, 134, 17, 71, 63, 12, 21, 92, 31, 203, 10, 77, 13, 71, 8, 18, 68, 101, 21, 130, 53, 226, 10, 167, 77, 160, 10, 138, 35, 40, 15, 252, 70, 225, 18, 184, 67, 175, 47, 252, 19, 228, 3, 71, 19, 220, 3, 160, 38, 9, 12, 126, 23, 251, 20, 9, 62, 131, 6, 213, 32, 159, 4, 239, 58, 62, 9, 65, 77, 90, 27, 187, 46, 26, 6, 111, 28, 104, 4, 219, 65, 252, 5, 146, 61, 5, 21, 116, 57, 17, 8, 137, 78, 107, 8, 6, 67, 53, 32, 247, 69, 174, 24, 91, 21, 224, 5, 4, 16, 14, 10, 13, 68, 154, 26, 41, 22, 72, 11, 252, 64, 54, 13, 15, 35, 39, 7, 191, 78, 129, 18, 94, 76, 126, 28, 2, 26, 221, 10, 208, 44, 249, 12, 197, 75, 190, 19, 190, 73, 114, 18, 55, 64, 69, 9, 206, 79, 34, 17, 89, 44, 158, 103, 73, 45, 252, 11, 50, 11, 30, 6, 244, 19, 46, 4, 142, 37, 51, 19, 75, 19, 208, 13, 117, 29, 110, 3, 237, 80, 83, 3, 26, 27, 43, 17, 159, 65, 53, 30, 153, 39, 251, 3, 117, 38, 196, 3, 134, 60, 115, 15, 99, 60, 102, 13, 175, 73, 214, 3, 152, 78, 195, 3, 236, 65, 87, 50, 254, 55, 104, 16, 199, 25, 196, 4, 6, 36, 46, 3, 46, 66, 14, 20, 29, 22, 34, 19, 112, 21, 6, 7, 34, 79, 122, 15, 109, 66, 34, 24, 9, 70, 41, 23, 149, 36, 92, 13, 50, 29, 179, 7, 81, 76, 57, 20, 59, 74, 190, 11, 70, 64, 204, 14, 198, 62, 63, 9, 216, 33, 183, 10, 229, 36, 246, 102, 104, 42, 7, 5, 227, 13, 241, 3, 230, 21, 38, 14, 253, 75, 136, 21, 165, 48, 29, 3, 154, 80, 143, 3, 67, 60, 250, 11, 141, 66, 35, 40, 195, 73, 73, 10, 73, 15, 244, 4, 63, 76, 43, 13, 132, 70, 110, 20, 91, 75, 142, 6, 52, 76, 100, 12, 152, 70, 2, 42, 241, 64, 189, 26, 62, 12, 250, 8, 117, 42, 133, 9, 220, 60, 1, 27, 53, 49, 53, 13, 108, 43, 225, 12, 122, 65, 120, 9, 165, 73, 59, 26, 19, 67, 159, 38, 199, 49, 45, 10, 233, 34, 68, 12, 89, 74, 84, 30, 171, 71, 40, 15, 251, 79, 98, 14, 146, 76, 52, 13, 244, 50, 173, 75, 30, 41, 84, 90, 1, 0, 3, 0, 0, 0, 1, 0, 2, 0, 4, 0, 82, 120, 26, 113, 81, 106, 240, 99, 241, 93, 78, 88, 2, 83, 7, 78, 89, 73, 242, 68, 51, 115, 174, 103, 80, 93, 251, 83, 149, 75, 6, 68, 56, 61, 25, 55, 150, 49, 161, 44, 205, 76, 21, 46, 166, 27, 151, 16, 244, 9, 249, 5, 149, 3, 38, 2, 74, 1, 198, 0, 249, 79, 26, 80, 59, 80, 92, 80, 125, 80, 164, 80, 197, 80, 236, 80, 13, 81, 52, 81, 85, 81, 124, 81, 157, 81, 196, 81, 236, 81, 19, 82, 58, 82, 97, 82, 137, 82, 176, 82, 215, 82, 255, 82, 38, 83, 84, 83, 123, 83, 169, 83, 208, 83, 254, 83, 38, 84, 84, 84, 129, 84, 175, 84, 221, 84, 11, 85, 57, 85, 103, 85, 149, 85, 201, 85, 247, 85, 43, 86, 89, 86, 142, 86, 194, 86, 247, 86, 43, 87, 95, 87, 148, 87, 200, 87, 3, 88, 56, 88, 115, 88, 174, 88, 233, 88, 36, 89, 95, 89, 154, 89, 219, 89, 22, 90, 88, 90, 153, 90, 212, 90, 28, 91, 94, 91, 159, 91, 231, 91, 48, 92, 113, 92, 192, 92, 8, 93, 80, 93, 159, 93, 237, 93, 60, 94, 138, 94, 224, 94, 46, 95, 131, 95, 217, 95, 52, 96, 138, 96, 229, 96, 72, 97, 163, 97, 6, 98, 104, 98, 209, 98, 51, 99, 156, 99, 11, 100, 123, 100, 234, 100, 96, 101, 214, 101, 76, 102, 201, 102, 76, 103, 207, 103, 82, 104, 220, 104, 108, 105, 252, 105, 147, 106, 48, 107, 205, 107, 113, 108, 27, 109, 204, 109, 125, 110, 59, 111, 249, 111, 197, 112, 150, 113, 111, 114, 84, 115, 64, 116, 50, 117, 50, 118, 63, 119, 88, 120, 225, 122, 255, 127, 255, 127, 255, 127, 255, 127, 255, 127, 255, 127, 255, 127, 225, 122, 88, 120, 63, 119, 50, 118, 50, 117, 64, 116, 84, 115, 111, 114, 150, 113, 197, 112, 249, 111, 59, 111, 125, 110, 204, 109, 27, 109, 113, 108, 205, 107, 48, 107, 147, 106, 252, 105, 108, 105, 220, 104, 82, 104, 207, 103, 76, 103, 201, 102, 76, 102, 214, 101, 96, 101, 234, 100, 123, 100, 11, 100, 156, 99, 51, 99, 209, 98, 104, 98, 6, 98, 163, 97, 72, 97, 229, 96, 138, 96, 52, 96, 217, 95, 131, 95, 46, 95, 224, 94, 138, 94, 60, 94, 237, 93, 159, 93, 80, 93, 8, 93, 192, 92, 113, 92, 48, 92, 231, 91, 159, 91, 94, 91, 28, 91, 212, 90, 153, 90, 88, 90, 22, 90, 219, 89, 154, 89, 95, 89, 36, 89, 233, 88, 174, 88, 115, 88, 56, 88, 3, 88, 200, 87, 148, 87, 95, 87, 43, 87, 247, 86, 194, 86, 142, 86, 89, 86, 43, 86, 247, 85, 201, 85, 149, 85, 103, 85, 57, 85, 11, 85, 221, 84, 175, 84, 129, 84, 84, 84, 38, 84, 254, 83, 208, 83, 169, 83, 123, 83, 84, 83, 38, 83, 255, 82, 215, 82, 176, 82, 137, 82, 97, 82, 58, 82, 19, 82, 236, 81, 196, 81, 157, 81, 124, 81, 85, 81, 52, 81, 13, 81, 236, 80, 197, 80, 164, 80, 125, 80, 92, 80, 59, 80, 26, 80, 249, 79, 210, 79, 177, 79, 145, 79, 112, 79, 13, 0, 14, 0, 16, 0, 18, 0, 20, 0, 21, 0, 27, 0, 32, 0, 6, 0, 7, 0, 6, 0, 6, 0, 0, 0, 0, 0, 0, 0, 1, 0, 13, 0, 14, 0, 16, 0, 18, 0, 19, 0, 21, 0, 26, 0, 31, 0, 6, 0, 6, 0, 6, 0, 6, 0, 0, 0, 0, 0, 0, 0, 1, 0, 79, 115, 156, 110, 74, 97, 126, 77, 72, 54, 9, 31, 195, 10, 153, 251, 125, 242, 48, 239, 127, 240, 173, 244, 231, 249, 176, 254, 22, 2, 202, 3, 255, 3, 55, 3, 4, 2, 220, 0, 0, 0, 125, 255, 62, 255, 41, 255, 0, 0, 216, 127, 107, 127, 182, 126, 187, 125, 123, 124, 248, 122, 53, 121, 53, 119, 250, 116, 137, 114, 128, 46, 128, 67, 0, 120, 0, 101, 128, 94, 64, 113, 64, 95, 192, 28, 64, 76, 192, 57, 84, 0, 1, 0, 254, 255, 2, 0, 5, 0, 10, 0, 5, 0, 9, 0, 20, 0, 84, 0, 1, 0, 254, 255, 2, 0, 5, 0, 10, 0, 5, 0, 9, 0, 20, 0, 84, 0, 1, 0, 254, 255, 2, 0, 3, 0, 6, 0, 5, 0, 9, 0, 20, 0, 84, 0, 1, 0, 254, 255, 2, 0, 3, 0, 6, 0, 5, 0, 9, 0, 20, 0, 84, 0, 1, 0, 254, 255, 2, 0, 3, 0, 6, 0, 5, 0, 9, 0, 20, 0, 84, 0, 1, 0, 254, 255, 2, 0, 3, 0, 6, 0, 10, 0, 19, 0, 20, 0, 84, 0, 1, 0, 254, 255, 2, 0, 3, 0, 6, 0, 5, 0, 9, 0, 20, 0, 94, 0, 0, 0, 253, 255, 3, 0, 3, 0, 6, 0, 5, 0, 9, 0, 18, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 17, 0, 19, 0, 19, 0, 19, 0, 19, 0, 23, 0, 39, 0, 57, 0, 5, 0, 8, 0, 8, 0, 7, 0, 8, 0, 7, 0, 2, 0, 8, 0, 4, 0, 7, 0, 2, 0, 4, 0, 7, 0, 2, 0, 8, 0, 4, 0, 7, 0, 2, 0, 8, 0, 8, 0, 7, 0, 8, 0, 7, 0, 2, 0, 6, 0, 4, 0, 7, 0, 2, 0, 6, 0, 4, 0, 7, 0, 2, 0, 6, 0, 4, 0, 7, 0, 2, 0, 6, 0, 8, 0, 9, 0, 9, 0, 8, 0, 9, 0, 2, 0, 6, 0, 4, 0, 9, 0, 2, 0, 6, 0, 8, 0, 9, 0, 2, 0, 6, 0, 4, 0, 9, 0, 2, 0, 6, 0, 8, 0, 9, 0, 9, 0, 8, 0, 11, 0, 3, 0, 7, 0, 4, 0, 11, 0, 3, 0, 7, 0, 8, 0, 11, 0, 3, 0, 7, 0, 4, 0, 11, 0, 3, 0, 7, 0, 8, 0, 9, 0, 9, 0, 8, 0, 13, 0, 4, 0, 7, 0, 5, 0, 13, 0, 4, 0, 7, 0, 8, 0, 13, 0, 4, 0, 7, 0, 5, 0, 13, 0, 4, 0, 7, 0, 9, 0, 9, 0, 9, 0, 8, 0, 13, 0, 4, 0, 4, 0, 5, 0, 6, 0, 13, 0, 4, 0, 4, 0, 5, 0, 8, 0, 13, 0, 4, 0, 4, 0, 5, 0, 6, 0, 13, 0, 4, 0, 4, 0, 5, 0, 8, 0, 9, 0, 9, 0, 8, 0, 1, 0, 1, 0, 1, 0, 1, 0, 10, 0, 10, 0, 7, 0, 7, 0, 5, 0, 1, 0, 1, 0, 1, 0, 1, 0, 10, 0, 10, 0, 7, 0, 7, 0, 8, 0, 1, 0, 1, 0, 1, 0, 1, 0, 10, 0, 10, 0, 7, 0, 7, 0, 5, 0, 1, 0, 1, 0, 1, 0, 1, 0, 10, 0, 10, 0, 7, 0, 7, 0, 7, 0, 8, 0, 9, 0, 8, 0, 6, 0, 9, 0, 4, 0, 4, 0, 4, 0, 4, 0, 4, 0, 4, 0, 3, 0, 3, 0, 3, 0, 3, 0, 3, 0, 5, 0, 6, 0, 4, 0, 4, 0, 4, 0, 4, 0, 4, 0, 4, 0, 3, 0, 3, 0, 3, 0, 3, 0, 3, 0, 5, 0, 9, 0, 4, 0, 4, 0, 4, 0, 4, 0, 4, 0, 4, 0, 3, 0, 3, 0, 3, 0, 3, 0, 3, 0, 5, 0, 6, 0, 4, 0, 4, 0, 4, 0, 4, 0, 4, 0, 4, 0, 3, 0, 3, 0, 3, 0, 3, 0, 3, 0, 5, 0, 3, 0, 8, 0, 9, 0, 9, 0, 6, 0, 95, 0, 103, 0, 118, 0, 134, 0, 148, 0, 159, 0, 204, 0, 244, 0, 39, 0, 43, 0, 38, 0, 37, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 2, 0, 3, 0, 4, 0, 5, 0, 6, 0, 7, 0, 8, 0, 9, 0, 10, 0, 11, 0, 12, 0, 13, 0, 14, 0, 15, 0, 23, 0, 24, 0, 25, 0, 26, 0, 27, 0, 28, 0, 48, 0, 49, 0, 61, 0, 62, 0, 82, 0, 83, 0, 47, 0, 46, 0, 45, 0, 44, 0, 81, 0, 80, 0, 79, 0, 78, 0, 17, 0, 18, 0, 20, 0, 22, 0, 77, 0, 76, 0, 75, 0, 74, 0, 29, 0, 30, 0, 43, 0, 42, 0, 41, 0, 40, 0, 38, 0, 39, 0, 16, 0, 19, 0, 21, 0, 50, 0, 51, 0, 59, 0, 60, 0, 63, 0, 64, 0, 72, 0, 73, 0, 84, 0, 85, 0, 93, 0, 94, 0, 32, 0, 33, 0, 35, 0, 36, 0, 53, 0, 54, 0, 56, 0, 57, 0, 66, 0, 67, 0, 69, 0, 70, 0, 87, 0, 88, 0, 90, 0, 91, 0, 34, 0, 55, 0, 68, 0, 89, 0, 37, 0, 58, 0, 71, 0, 92, 0, 31, 0, 52, 0, 65, 0, 86, 0, 7, 0, 6, 0, 5, 0, 4, 0, 3, 0, 2, 0, 1, 0, 0, 0, 15, 0, 14, 0, 13, 0, 12, 0, 11, 0, 10, 0, 9, 0, 8, 0, 23, 0, 24, 0, 25, 0, 26, 0, 27, 0, 46, 0, 65, 0, 84, 0, 45, 0, 44, 0, 43, 0, 64, 0, 63, 0, 62, 0, 83, 0, 82, 0, 81, 0, 102, 0, 101, 0, 100, 0, 42, 0, 61, 0, 80, 0, 99, 0, 28, 0, 47, 0, 66, 0, 85, 0, 18, 0, 41, 0, 60, 0, 79, 0, 98, 0, 29, 0, 48, 0, 67, 0, 17, 0, 20, 0, 22, 0, 40, 0, 59, 0, 78, 0, 97, 0, 21, 0, 30, 0, 49, 0, 68, 0, 86, 0, 19, 0, 16, 0, 87, 0, 39, 0, 38, 0, 58, 0, 57, 0, 77, 0, 35, 0, 54, 0, 73, 0, 92, 0, 76, 0, 96, 0, 95, 0, 36, 0, 55, 0, 74, 0, 93, 0, 32, 0, 51, 0, 33, 0, 52, 0, 70, 0, 71, 0, 89, 0, 90, 0, 31, 0, 50, 0, 69, 0, 88, 0, 37, 0, 56, 0, 75, 0, 94, 0, 34, 0, 53, 0, 72, 0, 91, 0, 0, 0, 1, 0, 4, 0, 5, 0, 3, 0, 6, 0, 7, 0, 2, 0, 13, 0, 15, 0, 8, 0, 9, 0, 11, 0, 12, 0, 14, 0, 10, 0, 16, 0, 28, 0, 74, 0, 29, 0, 75, 0, 27, 0, 73, 0, 26, 0, 72, 0, 30, 0, 76, 0, 51, 0, 97, 0, 50, 0, 71, 0, 96, 0, 117, 0, 31, 0, 77, 0, 52, 0, 98, 0, 49, 0, 70, 0, 95, 0, 116, 0, 53, 0, 99, 0, 32, 0, 78, 0, 33, 0, 79, 0, 48, 0, 69, 0, 94, 0, 115, 0, 47, 0, 68, 0, 93, 0, 114, 0, 46, 0, 67, 0, 92, 0, 113, 0, 19, 0, 21, 0, 23, 0, 22, 0, 18, 0, 17, 0, 20, 0, 24, 0, 111, 0, 43, 0, 89, 0, 110, 0, 64, 0, 65, 0, 44, 0, 90, 0, 25, 0, 45, 0, 66, 0, 91, 0, 112, 0, 54, 0, 100, 0, 40, 0, 61, 0, 86, 0, 107, 0, 39, 0, 60, 0, 85, 0, 106, 0, 36, 0, 57, 0, 82, 0, 103, 0, 35, 0, 56, 0, 81, 0, 102, 0, 34, 0, 55, 0, 80, 0, 101, 0, 42, 0, 63, 0, 88, 0, 109, 0, 41, 0, 62, 0, 87, 0, 108, 0, 38, 0, 59, 0, 84, 0, 105, 0, 37, 0, 58, 0, 83, 0, 104, 0, 0, 0, 1, 0, 4, 0, 3, 0, 5, 0, 6, 0, 13, 0, 7, 0, 2, 0, 8, 0, 9, 0, 11, 0, 15, 0, 12, 0, 14, 0, 10, 0, 28, 0, 82, 0, 29, 0, 83, 0, 27, 0, 81, 0, 26, 0, 80, 0, 30, 0, 84, 0, 16, 0, 55, 0, 109, 0, 56, 0, 110, 0, 31, 0, 85, 0, 57, 0, 111, 0, 48, 0, 73, 0, 102, 0, 127, 0, 32, 0, 86, 0, 51, 0, 76, 0, 105, 0, 130, 0, 52, 0, 77, 0, 106, 0, 131, 0, 58, 0, 112, 0, 33, 0, 87, 0, 19, 0, 23, 0, 53, 0, 78, 0, 107, 0, 132, 0, 21, 0, 22, 0, 18, 0, 17, 0, 20, 0, 24, 0, 25, 0, 50, 0, 75, 0, 104, 0, 129, 0, 47, 0, 72, 0, 101, 0, 126, 0, 54, 0, 79, 0, 108, 0, 133, 0, 46, 0, 71, 0, 100, 0, 125, 0, 128, 0, 103, 0, 74, 0, 49, 0, 45, 0, 70, 0, 99, 0, 124, 0, 42, 0, 67, 0, 96, 0, 121, 0, 39, 0, 64, 0, 93, 0, 118, 0, 38, 0, 63, 0, 92, 0, 117, 0, 35, 0, 60, 0, 89, 0, 114, 0, 34, 0, 59, 0, 88, 0, 113, 0, 44, 0, 69, 0, 98, 0, 123, 0, 43, 0, 68, 0, 97, 0, 122, 0, 41, 0, 66, 0, 95, 0, 120, 0, 40, 0, 65, 0, 94, 0, 119, 0, 37, 0, 62, 0, 91, 0, 116, 0, 36, 0, 61, 0, 90, 0, 115, 0, 0, 0, 1, 0, 2, 0, 3, 0, 4, 0, 5, 0, 6, 0, 7, 0, 8, 0, 9, 0, 10, 0, 11, 0, 12, 0, 13, 0, 14, 0, 15, 0, 16, 0, 26, 0, 87, 0, 27, 0, 88, 0, 28, 0, 89, 0, 29, 0, 90, 0, 30, 0, 91, 0, 51, 0, 80, 0, 112, 0, 141, 0, 52, 0, 81, 0, 113, 0, 142, 0, 54, 0, 83, 0, 115, 0, 144, 0, 55, 0, 84, 0, 116, 0, 145, 0, 58, 0, 119, 0, 59, 0, 120, 0, 21, 0, 22, 0, 23, 0, 17, 0, 18, 0, 19, 0, 31, 0, 60, 0, 92, 0, 121, 0, 56, 0, 85, 0, 117, 0, 146, 0, 20, 0, 24, 0, 25, 0, 50, 0, 79, 0, 111, 0, 140, 0, 57, 0, 86, 0, 118, 0, 147, 0, 49, 0, 78, 0, 110, 0, 139, 0, 48, 0, 77, 0, 53, 0, 82, 0, 114, 0, 143, 0, 109, 0, 138, 0, 47, 0, 76, 0, 108, 0, 137, 0, 32, 0, 33, 0, 61, 0, 62, 0, 93, 0, 94, 0, 122, 0, 123, 0, 41, 0, 42, 0, 43, 0, 44, 0, 45, 0, 46, 0, 70, 0, 71, 0, 72, 0, 73, 0, 74, 0, 75, 0, 102, 0, 103, 0, 104, 0, 105, 0, 106, 0, 107, 0, 131, 0, 132, 0, 133, 0, 134, 0, 135, 0, 136, 0, 34, 0, 63, 0, 95, 0, 124, 0, 35, 0, 64, 0, 96, 0, 125, 0, 36, 0, 65, 0, 97, 0, 126, 0, 37, 0, 66, 0, 98, 0, 127, 0, 38, 0, 67, 0, 99, 0, 128, 0, 39, 0, 68, 0, 100, 0, 129, 0, 40, 0, 69, 0, 101, 0, 130, 0, 8, 0, 7, 0, 6, 0, 5, 0, 4, 0, 3, 0, 2, 0, 14, 0, 16, 0, 9, 0, 10, 0, 12, 0, 13, 0, 15, 0, 11, 0, 17, 0, 20, 0, 22, 0, 24, 0, 23, 0, 19, 0, 18, 0, 21, 0, 56, 0, 88, 0, 122, 0, 154, 0, 57, 0, 89, 0, 123, 0, 155, 0, 58, 0, 90, 0, 124, 0, 156, 0, 52, 0, 84, 0, 118, 0, 150, 0, 53, 0, 85, 0, 119, 0, 151, 0, 27, 0, 93, 0, 28, 0, 94, 0, 29, 0, 95, 0, 30, 0, 96, 0, 31, 0, 97, 0, 61, 0, 127, 0, 62, 0, 128, 0, 63, 0, 129, 0, 59, 0, 91, 0, 125, 0, 157, 0, 32, 0, 98, 0, 64, 0, 130, 0, 1, 0, 0, 0, 25, 0, 26, 0, 33, 0, 99, 0, 34, 0, 100, 0, 65, 0, 131, 0, 66, 0, 132, 0, 54, 0, 86, 0, 120, 0, 152, 0, 60, 0, 92, 0, 126, 0, 158, 0, 55, 0, 87, 0, 121, 0, 153, 0, 117, 0, 116, 0, 115, 0, 46, 0, 78, 0, 112, 0, 144, 0, 43, 0, 75, 0, 109, 0, 141, 0, 40, 0, 72, 0, 106, 0, 138, 0, 36, 0, 68, 0, 102, 0, 134, 0, 114, 0, 149, 0, 148, 0, 147, 0, 146, 0, 83, 0, 82, 0, 81, 0, 80, 0, 51, 0, 50, 0, 49, 0, 48, 0, 47, 0, 45, 0, 44, 0, 42, 0, 39, 0, 35, 0, 79, 0, 77, 0, 76, 0, 74, 0, 71, 0, 67, 0, 113, 0, 111, 0, 110, 0, 108, 0, 105, 0, 101, 0, 145, 0, 143, 0, 142, 0, 140, 0, 137, 0, 133, 0, 41, 0, 73, 0, 107, 0, 139, 0, 37, 0, 69, 0, 103, 0, 135, 0, 38, 0, 70, 0, 104, 0, 136, 0, 7, 0, 6, 0, 5, 0, 4, 0, 3, 0, 2, 0, 1, 0, 0, 0, 16, 0, 15, 0, 14, 0, 13, 0, 12, 0, 11, 0, 10, 0, 9, 0, 8, 0, 26, 0, 27, 0, 28, 0, 29, 0, 30, 0, 31, 0, 115, 0, 116, 0, 117, 0, 118, 0, 119, 0, 120, 0, 72, 0, 73, 0, 161, 0, 162, 0, 65, 0, 68, 0, 69, 0, 108, 0, 111, 0, 112, 0, 154, 0, 157, 0, 158, 0, 197, 0, 200, 0, 201, 0, 32, 0, 33, 0, 121, 0, 122, 0, 74, 0, 75, 0, 163, 0, 164, 0, 66, 0, 109, 0, 155, 0, 198, 0, 19, 0, 23, 0, 21, 0, 22, 0, 18, 0, 17, 0, 20, 0, 24, 0, 25, 0, 37, 0, 36, 0, 35, 0, 34, 0, 80, 0, 79, 0, 78, 0, 77, 0, 126, 0, 125, 0, 124, 0, 123, 0, 169, 0, 168, 0, 167, 0, 166, 0, 70, 0, 67, 0, 71, 0, 113, 0, 110, 0, 114, 0, 159, 0, 156, 0, 160, 0, 202, 0, 199, 0, 203, 0, 76, 0, 165, 0, 81, 0, 82, 0, 92, 0, 91, 0, 93, 0, 83, 0, 95, 0, 85, 0, 84, 0, 94, 0, 101, 0, 102, 0, 96, 0, 104, 0, 86, 0, 103, 0, 87, 0, 97, 0, 127, 0, 128, 0, 138, 0, 137, 0, 139, 0, 129, 0, 141, 0, 131, 0, 130, 0, 140, 0, 147, 0, 148, 0, 142, 0, 150, 0, 132, 0, 149, 0, 133, 0, 143, 0, 170, 0, 171, 0, 181, 0, 180, 0, 182, 0, 172, 0, 184, 0, 174, 0, 173, 0, 183, 0, 190, 0, 191, 0, 185, 0, 193, 0, 175, 0, 192, 0, 176, 0, 186, 0, 38, 0, 39, 0, 49, 0, 48, 0, 50, 0, 40, 0, 52, 0, 42, 0, 41, 0, 51, 0, 58, 0, 59, 0, 53, 0, 61, 0, 43, 0, 60, 0, 44, 0, 54, 0, 194, 0, 179, 0, 189, 0, 196, 0, 177, 0, 195, 0, 178, 0, 187, 0, 188, 0, 151, 0, 136, 0, 146, 0, 153, 0, 134, 0, 152, 0, 135, 0, 144, 0, 145, 0, 105, 0, 90, 0, 100, 0, 107, 0, 88, 0, 106, 0, 89, 0, 98, 0, 99, 0, 62, 0, 47, 0, 57, 0, 64, 0, 45, 0, 63, 0, 46, 0, 55, 0, 56, 0, 0, 0, 1, 0, 2, 0, 3, 0, 4, 0, 5, 0, 6, 0, 7, 0, 8, 0, 9, 0, 10, 0, 11, 0, 12, 0, 13, 0, 14, 0, 23, 0, 15, 0, 16, 0, 17, 0, 18, 0, 19, 0, 20, 0, 21, 0, 22, 0, 24, 0, 25, 0, 26, 0, 27, 0, 28, 0, 38, 0, 141, 0, 39, 0, 142, 0, 40, 0, 143, 0, 41, 0, 144, 0, 42, 0, 145, 0, 43, 0, 146, 0, 44, 0, 147, 0, 45, 0, 148, 0, 46, 0, 149, 0, 47, 0, 97, 0, 150, 0, 200, 0, 48, 0, 98, 0, 151, 0, 201, 0, 49, 0, 99, 0, 152, 0, 202, 0, 86, 0, 136, 0, 189, 0, 239, 0, 87, 0, 137, 0, 190, 0, 240, 0, 88, 0, 138, 0, 191, 0, 241, 0, 91, 0, 194, 0, 92, 0, 195, 0, 93, 0, 196, 0, 94, 0, 197, 0, 95, 0, 198, 0, 29, 0, 30, 0, 31, 0, 32, 0, 33, 0, 34, 0, 35, 0, 50, 0, 100, 0, 153, 0, 203, 0, 89, 0, 139, 0, 192, 0, 242, 0, 51, 0, 101, 0, 154, 0, 204, 0, 55, 0, 105, 0, 158, 0, 208, 0, 90, 0, 140, 0, 193, 0, 243, 0, 59, 0, 109, 0, 162, 0, 212, 0, 63, 0, 113, 0, 166, 0, 216, 0, 67, 0, 117, 0, 170, 0, 220, 0, 36, 0, 37, 0, 54, 0, 53, 0, 52, 0, 58, 0, 57, 0, 56, 0, 62, 0, 61, 0, 60, 0, 66, 0, 65, 0, 64, 0, 70, 0, 69, 0, 68, 0, 104, 0, 103, 0, 102, 0, 108, 0, 107, 0, 106, 0, 112, 0, 111, 0, 110, 0, 116, 0, 115, 0, 114, 0, 120, 0, 119, 0, 118, 0, 157, 0, 156, 0, 155, 0, 161, 0, 160, 0, 159, 0, 165, 0, 164, 0, 163, 0, 169, 0, 168, 0, 167, 0, 173, 0, 172, 0, 171, 0, 207, 0, 206, 0, 205, 0, 211, 0, 210, 0, 209, 0, 215, 0, 214, 0, 213, 0, 219, 0, 218, 0, 217, 0, 223, 0, 222, 0, 221, 0, 73, 0, 72, 0, 71, 0, 76, 0, 75, 0, 74, 0, 79, 0, 78, 0, 77, 0, 82, 0, 81, 0, 80, 0, 85, 0, 84, 0, 83, 0, 123, 0, 122, 0, 121, 0, 126, 0, 125, 0, 124, 0, 129, 0, 128, 0, 127, 0, 132, 0, 131, 0, 130, 0, 135, 0, 134, 0, 133, 0, 176, 0, 175, 0, 174, 0, 179, 0, 178, 0, 177, 0, 182, 0, 181, 0, 180, 0, 185, 0, 184, 0, 183, 0, 188, 0, 187, 0, 186, 0, 226, 0, 225, 0, 224, 0, 229, 0, 228, 0, 227, 0, 232, 0, 231, 0, 230, 0, 235, 0, 234, 0, 233, 0, 238, 0, 237, 0, 236, 0, 96, 0, 199, 0, 0, 0, 2, 0, 0, 0, 3, 0, 0, 0, 2, 0, 0, 0, 3, 0, 1, 0, 3, 0, 2, 0, 4, 0, 1, 0, 4, 0, 1, 0, 4, 0, 0, 0, 205, 12, 156, 25, 0, 32, 102, 38, 205, 44, 0, 48, 51, 51, 102, 54, 154, 57, 205, 60, 0, 64, 51, 67, 102, 70, 154, 73, 205, 76, 159, 0, 64, 241, 53, 167, 206, 0, 190, 242, 52, 176, 12, 1, 67, 244, 88, 185, 93, 1, 201, 245, 133, 194, 163, 1, 215, 246, 223, 200, 226, 1, 166, 247, 189, 205, 42, 2, 116, 248, 147, 210, 125, 2, 66, 249, 109, 215, 221, 2, 18, 250, 77, 220, 74, 3, 222, 250, 30, 225, 201, 3, 174, 251, 0, 230, 90, 4, 124, 252, 216, 234, 1, 5, 74, 253, 179, 239, 193, 5, 25, 254, 141, 244, 158, 6, 231, 254, 104, 249, 156, 7, 181, 255, 67, 254, 193, 8, 133, 0, 33, 3, 17, 10, 83, 1, 252, 7, 147, 11, 33, 2, 213, 12, 80, 13, 240, 2, 178, 17, 79, 15, 190, 3, 140, 22, 155, 17, 141, 4, 104, 27, 63, 20, 91, 5, 67, 32, 72, 23, 41, 6, 29, 37, 199, 26, 248, 6, 249, 41, 203, 30, 199, 7, 212, 46, 105, 35, 149, 8, 175, 51, 185, 40, 100, 9, 138, 56, 222, 48, 113, 10, 224, 62, 135, 63, 244, 11, 253, 71, 150, 82, 120, 13, 27, 81, 93, 107, 252, 14, 57, 90, 93, 107, 252, 14, 57, 90, 0, 0, 1, 0, 3, 0, 2, 0, 6, 0, 4, 0, 5, 0, 7, 0, 0, 0, 1, 0, 3, 0, 2, 0, 5, 0, 6, 0, 4, 0, 7, 0, 248, 127, 211, 127, 76, 127, 108, 126, 51, 125, 163, 123, 188, 121, 127, 119, 239, 116, 12, 114, 217, 110, 89, 107, 141, 103, 121, 99, 31, 95, 130, 90, 166, 85, 141, 80, 60, 75, 182, 69, 0, 64, 28, 58, 15, 52, 223, 45, 141, 39, 32, 33, 156, 26, 6, 20, 97, 13, 178, 6, 0, 0, 78, 249, 159, 242, 250, 235, 100, 229, 224, 222, 115, 216, 33, 210, 241, 203, 228, 197, 0, 192, 74, 186, 196, 180, 115, 175, 90, 170, 126, 165, 225, 160, 135, 156, 115, 152, 167, 148, 39, 145, 244, 141, 17, 139, 129, 136, 68, 134, 93, 132, 205, 130, 148, 129, 180, 128, 45, 128, 8, 128, 255, 127, 46, 124, 174, 120, 118, 117, 125, 114, 186, 111, 41, 109, 194, 106, 131, 104, 102, 102, 105, 100, 137, 98, 194, 96, 19, 95, 122, 93, 245, 91, 130, 90, 33, 89, 207, 87, 139, 86, 85, 85, 44, 84, 15, 83, 252, 81, 244, 80, 246, 79, 1, 79, 20, 78, 48, 77, 83, 76, 126, 75, 175, 74, 231, 73, 37, 73, 104, 72, 178, 71, 0, 71, 84, 70, 173, 69, 10, 69, 107, 68, 209, 67, 59, 67, 168, 66, 25, 66, 142, 65, 6, 65, 130, 64, 0, 64, 0, 0, 175, 5, 50, 11, 140, 16, 192, 21, 207, 26, 188, 31, 136, 36, 53, 41, 196, 45, 55, 50, 143, 54, 206, 58, 245, 62, 4, 67, 252, 70, 223, 74, 174, 78, 105, 82, 17, 86, 167, 89, 44, 93, 159, 96, 3, 100, 87, 103, 155, 106, 209, 109, 250, 112, 20, 116, 33, 119, 34, 122, 23, 125, 255, 127, 255, 127, 217, 127, 98, 127, 157, 126, 138, 125, 42, 124, 125, 122, 133, 120, 66, 118, 182, 115, 227, 112, 202, 109, 110, 106, 208, 102, 242, 98, 215, 94, 130, 90, 246, 85, 52, 81, 64, 76, 29, 71, 206, 65, 87, 60, 186, 54, 252, 48, 31, 43, 40, 37, 26, 31, 249, 24, 200, 18, 140, 12, 72, 6, 0, 0, 184, 249, 116, 243, 56, 237, 7, 231, 230, 224, 216, 218, 225, 212, 4, 207, 70, 201, 169, 195, 50, 190, 227, 184, 192, 179, 204, 174, 10, 170, 126, 165, 41, 161, 14, 157, 48, 153, 146, 149, 54, 146, 29, 143, 74, 140, 190, 137, 123, 135, 131, 133, 214, 131, 118, 130, 99, 129, 158, 128, 39, 128, 0, 128, 249, 150, 148, 221, 53, 235, 27, 241, 93, 244, 116, 246, 223, 247, 237, 248, 184, 249, 86, 250, 214, 250, 61, 251, 148, 251, 221, 251, 26, 252, 78, 252, 123, 252, 163, 252, 197, 252, 227, 252, 252, 252, 18, 253, 38, 253, 55, 253, 69, 253, 81, 253, 91, 253, 100, 253, 106, 253, 111, 253, 114, 253, 116, 253, 116, 253, 114, 253, 111, 253, 106, 253, 100, 253, 91, 253, 81, 253, 69, 253, 55, 253, 38, 253, 18, 253, 252, 252, 227, 252, 197, 252, 163, 252, 123, 252, 78, 252, 26, 252, 221, 251, 148, 251, 61, 251, 214, 250, 86, 250, 184, 249, 237, 248, 223, 247, 116, 246, 93, 244, 27, 241, 53, 235, 148, 221, 249, 150, 48, 117, 144, 101, 8, 82, 152, 58, 64, 31, 0, 0, 192, 224, 104, 197, 248, 173, 112, 154, 153, 104, 33, 3, 201, 9, 85, 253, 154, 250, 70, 2, 92, 2, 6, 251, 183, 13, 250, 232, 182, 17, 13, 254, 108, 248, 195, 11, 62, 236, 238, 21, 58, 248, 219, 251, 77, 250, 90, 17, 68, 253, 41, 235, 1, 18, 196, 1, 179, 253, 232, 242, 137, 11, 243, 4, 68, 251, 226, 245, 195, 6, 86, 14, 133, 238, 49, 252, 39, 17, 23, 246, 181, 3, 173, 250, 45, 252, 102, 22, 66, 118, 247, 14, 60, 240, 156, 11, 232, 251, 22, 252, 173, 9, 29, 244, 255, 10, 73, 247, 217, 6, 181, 249, 178, 6, 17, 249, 7, 6, 16, 252, 173, 1, 87, 255, 216, 1, 16, 251, 128, 8, 110, 245, 219, 9, 171, 249, 88, 1, 58, 3, 7, 250, 188, 6, 135, 249, 165, 6, 241, 247, 84, 10, 12, 244, 81, 11, 70, 248, 45, 2, 12, 3, 167, 250, 74, 3, 143, 2, 98, 57, 254, 44, 244, 4, 55, 245, 217, 233, 90, 29, 221, 255, 9, 245, 32, 244, 215, 18, 136, 11, 24, 223, 201, 14, 175, 5, 131, 8, 67, 222, 115, 31, 201, 247, 82, 250, 9, 3, 84, 4, 175, 246, 206, 8, 149, 254, 94, 253, 201, 247, 158, 23, 207, 233, 48, 4, 51, 12, 62, 236, 192, 20, 231, 246, 112, 241, 12, 27, 207, 240, 163, 2, 17, 249, 29, 0, 161, 39, 66, 118, 247, 14, 60, 240, 156, 11, 232, 251, 22, 252, 173, 9, 29, 244, 255, 10, 73, 247, 217, 6, 181, 249, 178, 6, 17, 249, 7, 6, 16, 252, 173, 1, 87, 255, 216, 1, 16, 251, 128, 8, 110, 245, 219, 9, 171, 249, 88, 1, 58, 3, 7, 250, 188, 6, 135, 249, 165, 6, 241, 247, 84, 10, 12, 244, 81, 11, 70, 248, 45, 2, 12, 3, 167, 250, 74, 3, 143, 2, 0, 64, 103, 65, 213, 66, 76, 68, 203, 69, 82, 71, 226, 72, 122, 74, 28, 76, 199, 77, 123, 79, 56, 81, 255, 82, 209, 84, 172, 86, 146, 88, 130, 90, 126, 92, 132, 94, 150, 96, 180, 98, 221, 100, 18, 103, 84, 105, 162, 107, 254, 109, 102, 112, 221, 114, 96, 117, 242, 119, 147, 122, 66, 125, 255, 127, 3, 115, 186, 110, 119, 98, 225, 79, 109, 57, 245, 33, 71, 12, 184, 250, 206, 238, 23, 233, 38, 233, 191, 237, 33, 245, 96, 253, 187, 4, 232, 9, 58, 12, 175, 11, 211, 8, 146, 4, 0, 0, 23, 252, 140, 249, 180, 248, 126, 249, 133, 251, 48, 254, 218, 0, 244, 2, 36, 4, 75, 4, 136, 3, 38, 2, 135, 0, 11, 255, 254, 253, 134, 253, 166, 253, 61, 254, 25, 255, 0, 0, 191, 0, 52, 1, 84, 1, 40, 1, 198, 0, 78, 0, 220, 255, 136, 255, 93, 255, 91, 255, 124, 255, 177, 255, 237, 255, 34, 0, 73, 0, 91, 0, 89, 0, 70, 0, 38, 0, 0, 0, 254, 254, 194, 254, 73, 254, 134, 253, 112, 253, 251, 252, 57, 253, 10, 254, 244, 254, 63, 255, 254, 255, 125, 0, 122, 0, 217, 255, 247, 255, 105, 0, 129, 0, 27, 1, 116, 1, 63, 2, 235, 254, 188, 254, 59, 255, 25, 254, 67, 254, 150, 254, 220, 254, 229, 255, 177, 0, 31, 2, 86, 1, 5, 2, 4, 2, 130, 0, 27, 0, 152, 255, 136, 255, 116, 255, 182, 255, 200, 255, 204, 253, 81, 252, 16, 250, 59, 252, 210, 252, 242, 253, 190, 254, 254, 255, 159, 0, 145, 2, 200, 254, 228, 254, 126, 254, 171, 253, 19, 254, 242, 253, 94, 254, 27, 255, 105, 0, 193, 1, 211, 253, 154, 252, 205, 251, 105, 252, 74, 252, 16, 253, 59, 253, 196, 254, 62, 0, 230, 1, 198, 254, 65, 255, 53, 255, 182, 254, 96, 255, 153, 255, 205, 255, 131, 0, 82, 1, 3, 2, 10, 6, 224, 8, 194, 14, 112, 21, 60, 27, 190, 32, 63, 39, 221, 43, 222, 49, 146, 53, 84, 37, 17, 42, 27, 49, 236, 51, 45, 56, 131, 45, 92, 41, 39, 38, 145, 33, 84, 25, 6, 0, 82, 0, 125, 255, 154, 0, 200, 255, 33, 253, 183, 0, 191, 255, 247, 254, 9, 0, 46, 255, 151, 254, 113, 0, 206, 2, 25, 7, 242, 3, 190, 4, 37, 6, 89, 3, 53, 5, 228, 8, 59, 3, 32, 6, 141, 7, 205, 2, 197, 7, 158, 8, 70, 3, 148, 4, 31, 7, 209, 2, 232, 3, 106, 8, 30, 1, 220, 1, 229, 5, 9, 255, 237, 253, 230, 0, 147, 0, 174, 255, 57, 2, 26, 0, 79, 255, 80, 252, 229, 255, 239, 254, 180, 2, 92, 255, 248, 254, 73, 255, 224, 0, 22, 3, 15, 4, 131, 3, 178, 3, 89, 2, 229, 1, 3, 3, 126, 4, 12, 2, 165, 2, 135, 3, 116, 255, 119, 1, 10, 3, 154, 1, 164, 2, 173, 1, 45, 1, 18, 2, 241, 3, 207, 2, 134, 2, 38, 0, 226, 0, 111, 1, 40, 0, 145, 0, 211, 255, 7, 254, 34, 1, 121, 0, 135, 255, 46, 1, 127, 0, 166, 0, 132, 255, 129, 254, 68, 252, 154, 254, 57, 254, 47, 252, 203, 2, 110, 3, 126, 3, 210, 3, 155, 3, 211, 0, 221, 1, 16, 1, 64, 0, 188, 0, 178, 255, 17, 0, 113, 255, 191, 255, 38, 0, 131, 2, 74, 2, 109, 2, 122, 255, 86, 254, 117, 253, 91, 1, 33, 2, 4, 11, 164, 4, 166, 10, 138, 9, 142, 0, 176, 255, 199, 6, 27, 1, 130, 0, 205, 1, 250, 254, 113, 254, 135, 251, 101, 254, 155, 0, 174, 1, 73, 1, 119, 1, 11, 3, 53, 0, 30, 255, 117, 255, 127, 255, 20, 255, 146, 6, 29, 1, 232, 2, 47, 5, 226, 2, 185, 2, 128, 6, 56, 1, 153, 1, 10, 1, 69, 1, 208, 2, 135, 0, 1, 0, 221, 0, 197, 1, 8, 0, 203, 0, 145, 0, 43, 1, 128, 2, 248, 2, 29, 0, 212, 1, 126, 2, 103, 0, 173, 1, 123, 1, 164, 1, 186, 3, 164, 3, 46, 5, 186, 4, 234, 4, 192, 2, 244, 3, 128, 4, 90, 255, 68, 254, 246, 254, 196, 254, 126, 255, 136, 254, 191, 0, 127, 4, 112, 7, 16, 255, 225, 253, 20, 251, 144, 255, 12, 1, 183, 4, 70, 0, 38, 4, 47, 6, 22, 1, 80, 5, 38, 6, 254, 254, 240, 254, 0, 253, 19, 0, 51, 2, 192, 8, 253, 255, 247, 254, 135, 0, 217, 254, 177, 253, 124, 254, 140, 0, 98, 1, 50, 255, 252, 254, 8, 254, 229, 252, 79, 254, 50, 253, 217, 250, 109, 0, 75, 1, 194, 3, 83, 254, 169, 255, 140, 2, 216, 254, 170, 1, 251, 3, 17, 255, 7, 3, 83, 3, 233, 1, 54, 5, 49, 4, 178, 254, 180, 254, 25, 0, 31, 2, 182, 4, 15, 7, 70, 1, 61, 0, 215, 2, 66, 2, 81, 3, 125, 5, 48, 255, 235, 254, 73, 1, 104, 255, 64, 0, 157, 2, 78, 254, 90, 253, 41, 253, 58, 254, 185, 255, 251, 0, 93, 2, 224, 1, 254, 0, 30, 254, 11, 0, 228, 3, 223, 254, 139, 1, 230, 1, 210, 2, 25, 4, 160, 5, 226, 255, 196, 254, 238, 252, 150, 255, 141, 255, 149, 253, 93, 3, 194, 5, 132, 5, 31, 4, 86, 5, 160, 4, 44, 3, 213, 4, 157, 3, 42, 0, 5, 255, 192, 253, 86, 1, 141, 0, 58, 254, 88, 255, 176, 255, 79, 5, 170, 254, 112, 253, 29, 249, 100, 0, 53, 3, 213, 2, 222, 3, 235, 2, 32, 3, 76, 1, 184, 1, 56, 2, 151, 2, 123, 1, 84, 3, 112, 0, 165, 0, 143, 254, 85, 2, 142, 3, 26, 1, 248, 255, 66, 3, 1, 5, 160, 254, 60, 2, 183, 2, 206, 1, 198, 8, 14, 7, 89, 1, 190, 0, 94, 5, 160, 1, 147, 3, 118, 8, 168, 0, 174, 255, 24, 1, 252, 253, 66, 254, 72, 3, 47, 0, 21, 2, 44, 0, 150, 254, 57, 253, 137, 251, 22, 0, 193, 0, 192, 5, 171, 255, 233, 0, 21, 7, 194, 255, 67, 2, 224, 5, 38, 2, 176, 3, 213, 6, 211, 2, 138, 2, 124, 4, 204, 3, 116, 3, 115, 5, 87, 254, 131, 2, 0, 0, 232, 3, 184, 3, 74, 4, 249, 0, 166, 5, 160, 2, 178, 254, 169, 255, 124, 8, 214, 253, 90, 7, 112, 10, 140, 0, 34, 7, 61, 7, 152, 3, 213, 6, 30, 10, 52, 4, 141, 7, 246, 7, 119, 255, 69, 254, 237, 249, 245, 4, 150, 4, 212, 1, 19, 254, 134, 255, 241, 5, 61, 254, 9, 4, 190, 4, 226, 1, 159, 6, 94, 4, 47, 3, 137, 2, 128, 1, 66, 254, 76, 253, 107, 0, 193, 254, 163, 253, 138, 255, 49, 255, 7, 254, 13, 2, 44, 254, 244, 255, 176, 10, 75, 0, 142, 7, 25, 5, 112, 3, 54, 9, 219, 8, 5, 5, 39, 6, 212, 7, 208, 255, 208, 254, 94, 251, 77, 254, 51, 254, 5, 255, 146, 254, 108, 254, 221, 253, 223, 254, 163, 253, 171, 253, 230, 253, 214, 252, 91, 255, 136, 255, 3, 0, 100, 1, 127, 2, 217, 4, 222, 5, 96, 0, 177, 0, 238, 2, 77, 254, 183, 253, 106, 251, 156, 254, 109, 0, 177, 255, 27, 254, 32, 1, 213, 7, 9, 0, 92, 4, 219, 2, 112, 3, 86, 8, 178, 3, 247, 254, 49, 6, 41, 4, 133, 4, 186, 4, 75, 3, 14, 254, 100, 253, 175, 1, 118, 1, 65, 1, 27, 255, 160, 5, 53, 8, 101, 5, 193, 1, 205, 1, 131, 4, 151, 255, 39, 0, 128, 254, 249, 254, 111, 1, 182, 0, 141, 254, 108, 253, 5, 3, 68, 255, 127, 4, 203, 3, 53, 5, 96, 6, 155, 5, 6, 3, 243, 4, 197, 4, 30, 254, 192, 252, 47, 250, 19, 255, 46, 255, 92, 3, 122, 3, 79, 6, 40, 4, 216, 1, 38, 4, 168, 4, 185, 0, 53, 4, 221, 3, 200, 253, 32, 252, 88, 249, 63, 254, 122, 252, 5, 248, 114, 255, 135, 254, 54, 254, 46, 255, 214, 253, 251, 251, 245, 255, 109, 4, 217, 8, 183, 254, 93, 253, 131, 252, 6, 255, 145, 2, 163, 4, 7, 2, 230, 5, 243, 6, 8, 2, 27, 2, 123, 5, 15, 2, 141, 5, 22, 5, 205, 253, 153, 252, 32, 251, 109, 255, 49, 254, 111, 3, 180, 255, 30, 9, 24, 11, 51, 2, 13, 10, 81, 9, 120, 2, 134, 7, 104, 11, 207, 2, 231, 7, 48, 7, 223, 253, 45, 253, 84, 4, 129, 0, 131, 255, 116, 3, 137, 5, 96, 6, 157, 3, 162, 255, 30, 6, 215, 6, 171, 254, 253, 5, 15, 6, 79, 2, 139, 1, 238, 254, 180, 255, 213, 3, 15, 11, 153, 0, 169, 11, 52, 7, 8, 4, 5, 10, 189, 10, 228, 5, 16, 11, 87, 7, 23, 3, 175, 4, 26, 2, 66, 255, 59, 254, 209, 5, 234, 254, 220, 253, 134, 4, 11, 255, 149, 7, 252, 7, 0, 4, 24, 6, 114, 6, 0, 2, 253, 0, 210, 1, 194, 255, 189, 254, 127, 4, 39, 254, 136, 254, 251, 1, 79, 254, 100, 5, 114, 8, 131, 3, 151, 7, 165, 5, 134, 0, 192, 2, 184, 1, 204, 1, 13, 2, 228, 255, 62, 254, 23, 1, 58, 5, 0, 0, 203, 3, 252, 0, 67, 254, 141, 253, 33, 252, 164, 254, 166, 253, 112, 250, 142, 1, 200, 2, 120, 6, 149, 255, 58, 1, 78, 255, 93, 0, 178, 8, 190, 8, 6, 2, 81, 3, 144, 2, 50, 254, 57, 253, 65, 254, 174, 0, 222, 255, 167, 4, 137, 255, 42, 0, 237, 3, 140, 254, 18, 1, 246, 2, 12, 4, 48, 9, 46, 7, 163, 2, 188, 6, 218, 5, 174, 1, 6, 5, 85, 8, 127, 255, 73, 254, 0, 0, 139, 254, 32, 3, 96, 8, 6, 0, 51, 6, 174, 9, 222, 1, 84, 2, 80, 8, 84, 254, 32, 253, 225, 5, 129, 1, 178, 0, 212, 3, 139, 0, 193, 1, 201, 4, 242, 253, 182, 252, 42, 252, 145, 0, 18, 6, 218, 4, 111, 2, 168, 5, 144, 2, 93, 1, 248, 3, 202, 5, 31, 0, 232, 254, 159, 1, 196, 254, 212, 2, 105, 6, 104, 1, 34, 4, 44, 2, 76, 254, 154, 254, 177, 4, 157, 254, 99, 4, 147, 7, 145, 1, 48, 6, 200, 8, 241, 253, 12, 252, 99, 1, 233, 0, 238, 0, 185, 8, 218, 253, 127, 252, 129, 253, 147, 254, 11, 254, 165, 7, 133, 1, 68, 7, 85, 6, 162, 0, 108, 4, 240, 4, 19, 255, 150, 4, 110, 5, 128, 253, 101, 254, 116, 0, 28, 255, 158, 6, 250, 8, 103, 6, 138, 8, 219, 8, 50, 2, 249, 4, 98, 10, 67, 1, 82, 1, 238, 6, 66, 2, 83, 4, 84, 3, 22, 0, 82, 2, 166, 3, 113, 255, 206, 2, 190, 1, 50, 0, 71, 0, 247, 255, 174, 254, 70, 253, 129, 250, 102, 0, 118, 255, 204, 252, 202, 254, 43, 254, 133, 251, 158, 1, 67, 0, 245, 254, 36, 4, 46, 3, 161, 5, 12, 6, 80, 5, 248, 4, 218, 6, 103, 7, 125, 6, 227, 7, 85, 8, 28, 7, 16, 7, 14, 9, 53, 7, 132, 2, 163, 255, 198, 1, 90, 3, 73, 1, 120, 255, 233, 1, 254, 254, 128, 255, 58, 255, 23, 253, 215, 255, 204, 255, 247, 254, 39, 252, 90, 1, 137, 0, 223, 1, 51, 249, 20, 253, 84, 253, 117, 251, 67, 249, 145, 254, 129, 252, 135, 251, 240, 252, 24, 254, 78, 252, 56, 252, 171, 255, 122, 254, 43, 253, 215, 0, 172, 254, 85, 255, 252, 3, 148, 3, 177, 7, 52, 2, 179, 0, 234, 2, 150, 2, 209, 3, 198, 6, 119, 3, 110, 2, 146, 3, 171, 3, 88, 3, 141, 4, 53, 1, 176, 2, 35, 3, 149, 3, 161, 0, 58, 2, 118, 0, 236, 255, 229, 254, 208, 252, 214, 255, 204, 0, 52, 251, 187, 254, 50, 254, 61, 252, 54, 255, 113, 255, 36, 252, 28, 254, 151, 254, 66, 253, 46, 252, 35, 254, 210, 254, 234, 252, 92, 251, 156, 255, 238, 252, 192, 251, 226, 251, 77, 252, 108, 249, 54, 255, 181, 252, 242, 252, 241, 251, 158, 250, 123, 252, 144, 253, 146, 255, 171, 255, 100, 1, 213, 0, 246, 255, 19, 254, 108, 1, 6, 3, 169, 1, 54, 3, 223, 1, 173, 255, 45, 2, 8, 2, 32, 252, 232, 249, 196, 253, 165, 253, 27, 253, 230, 255, 10, 254, 130, 253, 121, 252, 209, 0, 50, 1, 147, 0, 196, 254, 175, 253, 172, 253, 171, 255, 45, 255, 31, 255, 106, 252, 239, 253, 117, 0, 233, 0, 73, 254, 30, 253, 77, 4, 239, 2, 121, 2, 177, 5, 180, 6, 231, 5, 229, 6, 177, 5, 142, 3, 98, 4, 132, 4, 81, 3, 74, 5, 100, 3, 214, 1, 153, 252, 130, 251, 252, 248, 153, 252, 163, 252, 32, 252, 138, 255, 155, 0, 212, 0, 229, 251, 175, 252, 162, 253, 163, 251, 199, 248, 66, 245, 5, 252, 109, 250, 179, 248, 114, 1, 72, 255, 98, 254, 191, 3, 237, 1, 104, 0, 190, 3, 15, 4, 31, 2, 154, 0, 141, 2, 201, 0, 225, 4, 251, 1, 150, 0, 151, 2, 247, 1, 230, 0, 111, 2, 9, 3, 163, 2, 147, 2, 88, 0, 146, 255, 75, 3, 244, 0, 224, 0, 126, 1, 29, 2, 46, 1, 212, 2, 177, 1, 154, 2, 142, 4, 222, 2, 85, 1, 118, 255, 20, 0, 115, 254, 97, 251, 88, 254, 210, 255, 191, 254, 160, 254, 132, 255, 53, 5, 253, 3, 56, 4, 6, 1, 110, 1, 211, 2, 154, 3, 27, 1, 217, 253, 31, 0, 132, 253, 157, 253, 79, 253, 71, 253, 97, 254, 72, 252, 245, 252, 55, 255, 207, 250, 170, 253, 153, 254, 71, 252, 251, 250, 166, 0, 237, 1, 49, 1, 221, 0, 78, 3, 191, 2], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE);
  allocate([98, 2, 72, 3, 168, 3, 6, 3, 45, 253, 212, 250, 19, 251, 155, 254, 255, 251, 148, 250, 184, 251, 160, 250, 147, 254, 120, 250, 167, 248, 160, 253, 250, 248, 65, 249, 94, 253, 223, 253, 107, 251, 65, 253, 166, 2, 18, 3, 148, 0, 133, 255, 184, 2, 8, 5, 132, 2, 94, 1, 246, 255, 158, 1, 102, 2, 15, 0, 137, 0, 88, 1, 45, 255, 210, 252, 24, 250, 205, 252, 121, 254, 94, 252, 180, 253, 47, 0, 177, 253, 126, 252, 115, 252, 183, 251, 93, 255, 8, 251, 113, 251, 99, 255, 72, 250, 11, 250, 123, 254, 6, 251, 92, 251, 144, 253, 159, 2, 213, 0, 198, 1, 124, 0, 238, 254, 243, 253, 39, 253, 16, 254, 104, 255, 192, 250, 122, 0, 135, 0, 167, 244, 179, 253, 118, 254, 64, 249, 185, 1, 206, 255, 196, 5, 136, 3, 19, 3, 60, 1, 236, 0, 72, 254, 165, 254, 217, 0, 157, 1, 113, 252, 107, 252, 121, 0, 57, 254, 92, 252, 202, 0, 164, 255, 47, 254, 137, 254, 232, 1, 134, 1, 218, 1, 108, 3, 217, 2, 60, 1, 233, 248, 224, 250, 99, 253, 87, 0, 194, 3, 176, 1, 51, 2, 7, 255, 222, 251, 250, 0, 29, 1, 81, 4, 117, 4, 171, 1, 184, 2, 242, 251, 128, 249, 210, 249, 76, 252, 90, 1, 160, 0, 203, 254, 240, 254, 166, 252, 158, 2, 112, 2, 226, 4, 80, 252, 104, 254, 102, 253, 162, 253, 192, 254, 128, 254, 20, 254, 230, 0, 65, 0, 78, 1, 206, 255, 240, 255, 240, 255, 78, 253, 139, 250, 255, 6, 180, 6, 119, 5, 174, 9, 15, 8, 124, 5, 221, 4, 191, 5, 146, 5, 130, 254, 243, 251, 254, 255, 173, 0, 114, 254, 121, 4, 211, 5, 232, 7, 9, 7, 4, 3, 250, 4, 226, 5, 149, 5, 199, 6, 209, 7, 55, 4, 194, 4, 249, 4, 126, 251, 197, 248, 207, 250, 216, 252, 147, 251, 184, 251, 61, 254, 247, 251, 70, 249, 65, 0, 66, 2, 172, 255, 60, 250, 126, 246, 14, 249, 3, 253, 170, 250, 18, 254, 38, 255, 174, 253, 93, 252, 81, 1, 20, 255, 50, 2, 53, 9, 102, 10, 146, 7, 209, 5, 252, 4, 106, 3, 189, 0, 102, 1, 118, 1, 17, 250, 23, 247, 214, 246, 57, 252, 9, 251, 209, 247, 140, 253, 92, 251, 250, 249, 125, 6, 19, 4, 34, 2, 53, 2, 37, 4, 220, 2, 192, 255, 188, 252, 78, 254, 76, 254, 160, 255, 203, 0, 54, 4, 192, 4, 100, 6, 139, 3, 254, 5, 218, 3, 70, 1, 197, 3, 77, 3, 142, 0, 172, 255, 197, 0, 214, 1, 75, 9, 34, 6, 109, 4, 214, 1, 190, 4, 139, 1, 96, 5, 176, 4, 101, 4, 18, 4, 92, 1, 225, 253, 46, 251, 136, 254, 41, 255, 75, 255, 225, 1, 101, 248, 171, 249, 46, 255, 18, 253, 95, 251, 134, 1, 29, 0, 113, 254, 27, 0, 52, 3, 212, 4, 243, 2, 183, 2, 211, 3, 153, 1, 82, 255, 173, 4, 11, 4, 144, 3, 76, 5, 54, 7, 32, 252, 99, 250, 228, 1, 51, 250, 92, 249, 208, 0, 100, 254, 180, 4, 152, 5, 241, 254, 128, 3, 120, 4, 96, 254, 241, 6, 154, 5, 96, 249, 172, 245, 52, 255, 3, 249, 241, 249, 9, 4, 136, 249, 233, 249, 23, 5, 27, 251, 203, 249, 57, 4, 99, 253, 185, 251, 190, 255, 86, 253, 64, 1, 167, 254, 147, 2, 49, 1, 45, 4, 244, 250, 220, 252, 237, 255, 157, 249, 245, 250, 29, 0, 109, 249, 15, 254, 71, 0, 225, 254, 249, 255, 156, 255, 18, 254, 62, 252, 19, 255, 84, 3, 89, 7, 204, 6, 63, 251, 149, 250, 227, 0, 108, 253, 46, 1, 117, 1, 96, 0, 63, 4, 233, 4, 206, 251, 123, 249, 160, 0, 229, 1, 28, 8, 6, 7, 90, 252, 36, 255, 40, 2, 172, 253, 156, 253, 237, 0, 80, 1, 184, 6, 111, 3, 131, 2, 117, 2, 178, 1, 243, 4, 10, 2, 97, 6, 15, 0, 244, 0, 71, 254, 195, 5, 205, 2, 184, 0, 27, 7, 54, 6, 173, 6, 220, 3, 5, 1, 169, 3, 45, 8, 41, 9, 240, 5, 91, 8, 66, 7, 70, 6, 191, 253, 189, 253, 77, 251, 68, 252, 135, 0, 24, 254, 48, 254, 51, 0, 174, 254, 139, 253, 164, 254, 45, 253, 122, 4, 25, 8, 162, 5, 144, 8, 186, 5, 143, 3, 92, 250, 220, 249, 26, 247, 120, 5, 198, 2, 17, 5, 55, 5, 121, 2, 160, 3, 154, 5, 146, 8, 34, 10, 118, 9, 156, 8, 89, 7, 214, 3, 194, 8, 62, 7, 124, 1, 24, 3, 121, 4, 193, 255, 229, 253, 158, 1, 4, 255, 60, 252, 198, 254, 19, 251, 85, 253, 244, 252, 193, 252, 242, 253, 19, 252, 126, 249, 145, 251, 88, 254, 181, 249, 60, 254, 213, 254, 244, 4, 24, 4, 130, 2, 123, 4, 85, 3, 88, 3, 93, 253, 176, 254, 139, 0, 220, 8, 63, 5, 138, 5, 29, 0, 0, 3, 29, 3, 56, 251, 167, 1, 52, 2, 218, 250, 198, 251, 245, 0, 234, 250, 212, 252, 61, 2, 238, 250, 175, 249, 134, 2, 56, 252, 66, 3, 211, 2, 225, 3, 116, 6, 235, 7, 65, 255, 207, 252, 176, 1, 150, 2, 60, 0, 198, 0, 114, 2, 229, 3, 50, 5, 112, 6, 171, 7, 9, 5, 195, 249, 163, 255, 211, 255, 192, 251, 37, 0, 172, 255, 117, 6, 47, 10, 33, 9, 41, 4, 248, 7, 73, 9, 115, 4, 22, 9, 70, 8, 91, 3, 101, 1, 230, 5, 152, 2, 203, 4, 75, 4, 223, 1, 80, 5, 144, 3, 105, 7, 218, 6, 227, 7, 144, 4, 117, 7, 248, 6, 143, 1, 34, 0, 0, 1, 175, 253, 208, 254, 227, 251, 35, 2, 158, 6, 127, 5, 135, 2, 157, 255, 171, 254, 212, 5, 111, 6, 166, 4, 38, 0, 124, 253, 44, 255, 139, 1, 78, 3, 222, 0, 64, 253, 3, 253, 52, 253, 44, 253, 84, 248, 12, 245, 106, 255, 35, 1, 174, 255, 209, 4, 179, 5, 239, 3, 116, 255, 101, 255, 153, 0, 183, 1, 41, 1, 32, 6, 7, 250, 102, 254, 132, 253, 0, 6, 199, 1, 19, 255, 208, 250, 117, 255, 252, 254, 19, 2, 42, 2, 100, 3, 13, 1, 240, 4, 94, 2, 23, 255, 115, 3, 207, 1, 230, 2, 88, 2, 136, 255, 183, 255, 165, 1, 212, 0, 73, 254, 198, 255, 36, 3, 250, 250, 39, 251, 216, 2, 38, 1, 22, 254, 50, 0, 177, 253, 119, 252, 26, 251, 42, 0, 81, 253, 147, 0, 231, 255, 17, 1, 84, 2, 201, 254, 189, 4, 89, 2, 14, 253, 81, 3, 72, 2, 173, 1, 95, 2, 75, 2, 166, 253, 90, 255, 205, 1, 228, 252, 201, 252, 9, 3, 100, 5, 142, 3, 219, 6, 119, 0, 137, 5, 204, 3, 37, 255, 144, 252, 196, 249, 231, 251, 14, 252, 182, 1, 55, 253, 157, 250, 78, 0, 0, 0, 65, 254, 101, 251, 144, 251, 217, 250, 219, 249, 200, 8, 231, 6, 29, 5, 178, 3, 47, 6, 152, 5, 126, 4, 226, 1, 180, 1, 43, 254, 172, 251, 106, 2, 65, 254, 58, 252, 64, 4, 28, 251, 21, 250, 142, 255, 176, 251, 40, 248, 189, 253, 210, 0, 101, 2, 241, 1, 73, 248, 99, 250, 130, 2, 11, 251, 168, 252, 243, 3, 146, 249, 95, 251, 39, 4, 237, 249, 96, 253, 180, 4, 100, 249, 166, 251, 111, 2, 45, 252, 210, 250, 3, 251, 27, 2, 109, 255, 126, 3, 182, 250, 127, 252, 78, 254, 120, 3, 219, 1, 172, 1, 153, 0, 128, 254, 82, 1, 44, 250, 1, 254, 103, 1, 50, 252, 165, 251, 42, 254, 105, 0, 218, 253, 165, 2, 87, 252, 135, 251, 109, 3, 124, 1, 252, 254, 210, 0, 149, 6, 156, 3, 232, 4, 239, 6, 166, 4, 71, 4, 139, 5, 119, 2, 21, 2, 115, 2, 43, 1, 165, 254, 101, 254, 234, 253, 135, 2, 118, 253, 29, 0, 173, 253, 134, 254, 169, 250, 27, 6, 122, 5, 97, 4, 185, 5, 65, 4, 130, 5, 136, 2, 208, 247, 190, 251, 250, 255, 55, 1, 62, 255, 155, 252, 129, 253, 193, 252, 160, 1, 118, 251, 56, 251, 69, 5, 33, 251, 83, 252, 21, 7, 111, 247, 61, 248, 197, 1, 149, 253, 169, 250, 68, 252, 186, 249, 76, 248, 29, 250, 105, 251, 223, 251, 176, 251, 135, 254, 89, 2, 201, 0, 84, 7, 57, 3, 118, 1, 82, 254, 213, 250, 29, 0, 139, 250, 31, 251, 205, 250, 17, 252, 32, 250, 192, 3, 135, 250, 39, 248, 197, 0, 157, 250, 99, 248, 20, 255, 203, 251, 123, 0, 166, 1, 103, 2, 245, 4, 34, 2, 206, 254, 246, 5, 136, 3, 170, 4, 252, 6, 153, 4, 142, 253, 140, 252, 10, 250, 199, 0, 254, 2, 224, 5, 215, 251, 94, 3, 197, 0, 246, 251, 19, 249, 137, 252, 224, 252, 145, 0, 87, 2, 146, 251, 249, 253, 114, 2, 75, 251, 122, 248, 244, 1, 114, 252, 239, 251, 141, 250, 60, 250, 225, 249, 55, 252, 245, 253, 74, 3, 34, 0, 2, 7, 134, 2, 94, 3, 73, 251, 160, 248, 22, 252, 178, 255, 247, 255, 96, 253, 20, 4, 247, 2, 80, 0, 168, 253, 115, 4, 251, 3, 57, 0, 208, 7, 142, 5, 191, 252, 134, 5, 97, 4, 78, 251, 94, 6, 236, 4, 51, 254, 140, 5, 220, 4, 1, 6, 207, 3, 253, 0, 229, 254, 68, 1, 153, 254, 87, 2, 61, 255, 106, 0, 76, 2, 62, 0, 181, 253, 11, 253, 133, 2, 205, 0, 51, 0, 177, 4, 246, 2, 71, 251, 161, 2, 122, 254, 144, 253, 45, 6, 173, 3, 105, 255, 255, 3, 223, 2, 4, 11, 21, 5, 178, 2, 210, 254, 12, 2, 157, 255, 124, 252, 204, 249, 91, 251, 60, 4, 251, 0, 238, 0, 222, 7, 0, 7, 242, 3, 221, 4, 97, 6, 205, 6, 53, 251, 252, 249, 72, 251, 147, 253, 200, 1, 147, 255, 40, 0, 191, 255, 20, 3, 219, 252, 69, 253, 186, 250, 185, 253, 136, 3, 64, 3, 223, 252, 20, 2, 82, 2, 180, 7, 128, 5, 71, 5, 103, 251, 168, 248, 190, 247, 251, 252, 56, 2, 180, 3, 9, 252, 55, 4, 236, 4, 169, 251, 226, 1, 126, 255, 242, 6, 20, 4, 12, 3, 45, 250, 245, 0, 144, 3, 196, 254, 139, 251, 107, 252, 232, 253, 94, 250, 214, 246, 239, 252, 246, 249, 60, 248, 45, 248, 1, 1, 141, 3, 199, 248, 135, 253, 71, 251, 254, 249, 130, 248, 226, 251, 70, 6, 191, 8, 40, 6, 201, 253, 36, 250, 248, 249, 1, 251, 195, 0, 89, 5, 207, 252, 37, 1, 195, 4, 243, 253, 118, 2, 173, 4, 94, 249, 135, 246, 208, 248, 209, 254, 219, 2, 235, 2, 111, 251, 5, 255, 13, 1, 74, 252, 181, 255, 148, 6, 98, 251, 59, 254, 237, 3, 193, 249, 73, 2, 122, 1, 229, 247, 197, 253, 85, 254, 239, 253, 121, 251, 109, 251, 229, 254, 51, 255, 204, 253, 228, 252, 222, 4, 205, 2, 229, 8, 159, 3, 27, 2, 58, 254, 47, 2, 184, 1, 51, 253, 180, 5, 79, 6, 250, 251, 28, 4, 74, 6, 111, 251, 118, 255, 79, 3, 226, 0, 39, 0, 156, 253, 29, 251, 150, 255, 39, 253, 117, 253, 200, 3, 22, 5, 54, 253, 132, 253, 191, 6, 97, 1, 45, 4, 154, 1, 226, 252, 100, 255, 75, 4, 194, 253, 150, 3, 190, 1, 226, 250, 244, 3, 210, 1, 128, 5, 55, 6, 253, 2, 149, 5, 100, 5, 221, 6, 157, 7, 164, 7, 74, 9, 42, 6, 255, 7, 100, 8, 148, 3, 98, 0, 249, 255, 101, 7, 138, 5, 93, 8, 92, 1, 125, 5, 43, 6, 152, 0, 110, 4, 9, 7, 245, 254, 154, 0, 115, 5, 114, 251, 213, 1, 30, 4, 138, 251, 107, 254, 207, 251, 195, 250, 40, 247, 211, 249, 148, 254, 101, 3, 170, 6, 118, 251, 37, 2, 14, 6, 55, 251, 116, 248, 126, 249, 51, 250, 71, 248, 249, 247, 65, 249, 118, 252, 158, 255, 151, 248, 233, 0, 212, 5, 124, 3, 108, 0, 181, 254, 64, 249, 110, 251, 92, 249, 220, 251, 188, 7, 254, 6, 210, 251, 51, 249, 139, 248, 245, 255, 3, 6, 37, 5, 192, 249, 94, 0, 241, 1, 165, 1, 187, 1, 59, 255, 214, 249, 163, 254, 30, 252, 169, 253, 229, 253, 116, 4, 59, 252, 117, 250, 127, 255, 195, 250, 175, 0, 65, 254, 137, 254, 31, 5, 7, 8, 141, 254, 118, 253, 205, 254, 207, 251, 93, 2, 109, 1, 247, 247, 143, 255, 174, 1, 140, 2, 146, 3, 199, 3, 12, 252, 206, 249, 237, 246, 225, 5, 224, 4, 47, 2, 6, 1, 26, 254, 111, 254, 65, 249, 62, 5, 10, 6, 50, 0, 56, 0, 176, 1, 182, 254, 119, 0, 164, 253, 19, 250, 200, 251, 214, 252, 178, 3, 103, 4, 31, 4, 136, 250, 89, 249, 80, 249, 10, 251, 64, 253, 219, 250, 39, 3, 29, 7, 119, 4, 200, 10, 70, 6, 123, 8, 96, 4, 153, 1, 106, 255, 109, 255, 148, 1, 191, 3, 135, 9, 119, 7, 141, 8, 118, 252, 115, 255, 158, 252, 120, 252, 114, 255, 54, 254, 211, 253, 60, 253, 113, 249, 194, 252, 105, 250, 209, 249, 206, 248, 190, 250, 194, 251, 188, 249, 240, 254, 147, 3, 84, 251, 4, 3, 32, 4, 130, 253, 46, 251, 151, 248, 12, 254, 175, 255, 202, 252, 247, 250, 179, 249, 33, 253, 139, 255, 17, 3, 168, 0, 190, 251, 109, 4, 154, 3, 184, 251, 22, 253, 104, 5, 31, 1, 221, 253, 217, 251, 160, 250, 103, 247, 76, 251, 128, 247, 222, 249, 35, 249, 25, 250, 63, 247, 253, 252, 55, 249, 75, 4, 62, 3, 204, 249, 212, 2, 219, 4, 250, 249, 181, 2, 37, 3, 102, 249, 16, 255, 129, 6, 92, 249, 252, 255, 100, 253, 101, 8, 48, 3, 18, 4, 206, 252, 207, 248, 22, 0, 4, 253, 5, 254, 193, 1, 129, 251, 151, 253, 33, 1, 181, 252, 196, 249, 16, 255, 242, 1, 22, 255, 111, 253, 16, 253, 224, 1, 142, 6, 193, 254, 31, 254, 193, 0, 213, 252, 171, 0, 137, 255, 176, 247, 54, 255, 176, 252, 181, 6, 116, 4, 164, 6, 67, 0, 239, 255, 66, 0, 244, 255, 102, 249, 187, 253, 152, 255, 240, 254, 204, 251, 94, 251, 203, 248, 136, 254, 140, 251, 98, 252, 92, 254, 198, 255, 253, 254, 112, 253, 146, 251, 215, 253, 252, 6, 203, 4, 199, 1, 129, 0, 206, 1, 185, 1, 16, 255, 240, 253, 72, 3, 2, 2, 130, 0, 181, 255, 90, 4, 111, 2, 153, 0, 216, 0, 44, 4, 52, 2, 250, 255, 236, 254, 95, 4, 215, 2, 190, 0, 188, 255, 192, 2, 50, 1, 119, 0, 248, 254, 73, 1, 61, 0, 156, 255, 156, 0, 108, 1, 123, 0, 183, 0, 48, 255, 85, 255, 133, 255, 220, 0, 191, 255, 206, 254, 194, 255, 146, 1, 17, 0, 108, 253, 86, 252, 246, 254, 0, 0, 129, 1, 235, 0, 20, 1, 29, 1, 64, 1, 12, 1, 176, 254, 56, 255, 44, 253, 17, 0, 172, 255, 125, 1, 224, 253, 173, 1, 238, 1, 7, 2, 139, 255, 32, 1, 48, 1, 73, 1, 131, 2, 157, 0, 189, 2, 252, 1, 176, 4, 113, 2, 28, 3, 96, 2, 230, 3, 165, 1, 236, 1, 120, 2, 180, 4, 12, 3, 190, 1, 132, 0, 233, 4, 76, 3, 35, 2, 193, 1, 61, 3, 146, 2, 29, 2, 214, 1, 108, 4, 234, 4, 150, 3, 127, 2, 35, 2, 51, 0, 167, 1, 23, 1, 9, 0, 136, 1, 83, 0, 94, 0, 30, 2, 31, 2, 229, 0, 109, 255, 58, 255, 129, 0, 194, 0, 71, 255, 161, 252, 215, 250, 210, 254, 30, 0, 171, 253, 139, 253, 237, 255, 114, 0, 124, 252, 199, 251, 210, 1, 97, 1, 53, 250, 219, 249, 15, 0, 113, 255, 84, 249, 245, 247, 17, 253, 196, 0, 172, 248, 237, 247, 126, 253, 254, 254, 225, 246, 66, 250, 62, 254, 204, 253, 184, 253, 70, 255, 152, 252, 98, 254, 243, 248, 36, 252, 155, 251, 226, 250, 42, 253, 151, 251, 28, 0, 169, 0, 241, 251, 160, 252, 50, 253, 10, 255, 228, 1, 36, 0, 23, 255, 207, 255, 9, 1, 67, 0, 33, 1, 211, 1, 178, 0, 31, 2, 42, 3, 28, 2, 84, 0, 26, 1, 160, 2, 191, 2, 49, 252, 247, 252, 129, 0, 31, 1, 86, 252, 29, 255, 187, 3, 83, 2, 175, 249, 223, 254, 68, 3, 137, 2, 201, 248, 41, 255, 82, 4, 206, 2, 14, 248, 195, 251, 138, 2, 184, 1, 203, 247, 239, 253, 139, 3, 63, 2, 37, 248, 176, 254, 158, 2, 204, 0, 171, 246, 76, 253, 104, 1, 137, 0, 148, 247, 100, 247, 247, 255, 24, 1, 246, 254, 119, 0, 39, 0, 193, 0, 78, 0, 197, 255, 136, 255, 226, 0, 49, 252, 166, 252, 243, 252, 185, 251, 149, 253, 99, 254, 61, 254, 182, 252, 64, 251, 215, 250, 211, 252, 141, 252, 160, 250, 177, 249, 118, 254, 84, 254, 31, 253, 167, 251, 219, 253, 234, 252, 144, 252, 49, 252, 57, 252, 126, 253, 39, 252, 138, 252, 7, 251, 175, 250, 39, 254, 220, 252, 135, 250, 129, 250, 160, 0, 247, 254, 105, 252, 237, 254, 8, 255, 6, 255, 50, 253, 132, 254, 97, 0, 153, 255, 137, 254, 27, 255, 97, 254, 63, 255, 121, 255, 213, 253, 116, 2, 105, 1, 119, 0, 216, 0, 67, 2, 108, 1, 135, 1, 209, 0, 122, 2, 10, 2, 102, 255, 108, 255, 14, 2, 133, 1, 170, 0, 33, 0, 105, 0, 11, 1, 64, 0, 124, 1, 33, 250, 24, 252, 226, 255, 143, 254, 210, 251, 58, 0, 135, 2, 223, 0, 16, 250, 221, 254, 109, 2, 51, 1, 5, 250, 156, 0, 250, 2, 148, 1, 19, 248, 141, 0, 222, 2, 243, 1, 199, 248, 118, 253, 50, 1, 0, 2, 69, 255, 152, 255, 197, 255, 182, 1, 134, 0, 26, 255, 156, 0, 70, 255, 195, 255, 252, 254, 240, 255, 10, 0, 199, 253, 253, 255, 91, 254, 215, 254, 67, 249, 247, 253, 166, 254, 178, 0, 174, 250, 197, 255, 212, 255, 157, 0, 158, 247, 51, 254, 42, 254, 163, 254, 134, 247, 255, 255, 143, 254, 135, 255, 213, 249, 139, 254, 124, 252, 9, 252, 163, 251, 177, 253, 155, 253, 240, 252, 207, 253, 122, 0, 181, 255, 63, 254, 252, 255, 85, 255, 133, 255, 140, 254, 192, 0, 168, 0, 180, 255, 124, 255, 252, 0, 149, 255, 84, 1, 210, 0, 136, 1, 253, 1, 16, 1, 181, 0, 147, 255, 145, 0, 218, 0, 119, 0, 96, 254, 249, 254, 229, 1, 9, 1, 75, 255, 248, 255, 226, 254, 226, 0, 12, 255, 38, 255, 69, 0, 222, 254, 98, 255, 191, 0, 255, 255, 192, 255, 176, 253, 166, 255, 213, 0, 160, 255, 255, 0, 179, 1, 178, 0, 176, 255, 143, 254, 238, 255, 223, 255, 176, 255, 214, 255, 159, 1, 140, 0, 34, 255, 119, 4, 139, 2, 137, 2, 73, 1, 255, 2, 44, 2, 249, 0, 235, 0, 180, 3, 157, 1, 186, 1, 23, 1, 141, 0, 83, 1, 100, 1, 45, 2, 42, 254, 86, 255, 99, 0, 237, 0, 199, 253, 224, 252, 96, 1, 53, 2, 26, 1, 217, 1, 214, 1, 76, 1, 57, 255, 78, 253, 252, 250, 107, 252, 63, 255, 86, 254, 224, 252, 158, 251, 230, 255, 141, 254, 22, 254, 63, 255, 125, 2, 83, 2, 7, 2, 74, 1, 152, 1, 141, 255, 79, 0, 12, 0, 221, 1, 87, 0, 153, 255, 136, 254, 102, 253, 165, 254, 235, 254, 221, 254, 2, 254, 31, 254, 169, 0, 41, 1, 195, 252, 30, 253, 51, 255, 85, 255, 192, 254, 228, 253, 72, 1, 27, 1, 165, 252, 66, 252, 186, 1, 254, 255, 44, 2, 174, 2, 130, 0, 56, 0, 103, 5, 244, 3, 243, 2, 171, 1, 100, 2, 229, 2, 116, 2, 41, 2, 173, 254, 228, 252, 134, 0, 21, 1, 135, 253, 195, 251, 254, 255, 10, 255, 144, 252, 245, 251, 185, 249, 216, 251, 30, 252, 38, 254, 142, 251, 24, 254, 98, 254, 229, 252, 73, 0, 50, 255, 248, 255, 117, 255, 183, 1, 204, 0, 80, 255, 190, 253, 23, 0, 131, 0, 243, 254, 11, 253, 65, 255, 245, 0, 147, 255, 174, 254, 112, 0, 60, 1, 120, 0, 106, 254, 138, 255, 99, 2, 76, 255, 70, 255, 123, 253, 115, 0, 83, 255, 34, 0, 250, 253, 23, 254, 105, 255, 61, 0, 185, 253, 180, 252, 220, 0, 118, 255, 87, 253, 4, 252, 135, 1, 239, 255, 170, 253, 191, 254, 157, 0, 217, 254, 129, 0, 155, 0, 98, 252, 149, 252, 37, 252, 29, 1, 241, 0, 173, 255, 131, 255, 131, 255, 108, 2, 85, 2, 176, 1, 92, 0, 137, 1, 78, 0, 153, 1, 61, 0, 119, 254, 29, 253, 99, 254, 20, 253, 83, 0, 54, 0, 105, 1, 27, 0, 196, 251, 130, 0, 175, 254, 74, 253, 227, 249, 41, 1, 62, 1, 237, 255, 175, 248, 36, 0, 51, 0, 195, 254, 237, 246, 10, 255, 231, 0, 172, 255, 254, 246, 241, 252, 40, 0, 77, 255, 71, 247, 94, 252, 38, 254, 50, 254, 14, 253, 170, 255, 224, 254, 142, 253, 149, 246, 57, 254, 193, 255, 171, 0, 181, 251, 186, 251, 230, 255, 113, 255, 87, 251, 57, 254, 106, 254, 131, 254, 163, 253, 46, 255, 160, 255, 205, 255, 188, 253, 36, 254, 236, 254, 241, 255, 85, 251, 134, 253, 77, 251, 143, 252, 134, 254, 35, 255, 99, 253, 72, 252, 82, 2, 178, 0, 109, 254, 92, 253, 251, 2, 71, 1, 89, 2, 34, 1, 172, 0, 44, 1, 203, 0, 157, 0, 200, 255, 176, 254, 100, 1, 24, 0, 28, 255, 216, 254, 253, 254, 227, 255, 70, 255, 7, 1, 160, 1, 14, 0, 159, 254, 117, 1, 244, 255, 40, 255, 1, 1, 96, 0, 174, 0, 57, 0, 10, 250, 152, 253, 70, 252, 13, 254, 15, 254, 104, 255, 179, 254, 125, 0, 105, 0, 200, 0, 179, 0, 159, 255, 181, 254, 32, 255, 253, 2, 185, 2, 248, 2, 0, 1, 45, 1, 59, 0, 199, 1, 171, 255, 204, 0, 32, 1, 254, 253, 240, 0, 251, 0, 147, 255, 0, 1, 161, 1, 222, 255, 99, 254, 101, 0, 174, 1, 128, 1, 156, 0, 225, 255, 246, 255, 206, 0, 170, 1, 77, 2, 145, 0, 143, 0, 71, 0, 40, 3, 138, 3, 77, 1, 93, 1, 218, 3, 170, 3, 77, 2, 75, 1, 20, 5, 56, 3, 187, 0, 253, 1, 38, 4, 141, 2, 123, 1, 210, 1, 182, 5, 169, 3, 145, 1, 18, 1, 19, 3, 93, 3, 9, 1, 2, 0, 97, 2, 41, 2, 28, 0, 49, 1, 158, 3, 84, 1, 106, 0, 130, 1, 241, 0, 245, 254, 109, 255, 225, 0, 78, 255, 234, 253, 91, 1, 246, 1, 125, 253, 131, 254, 141, 1, 30, 0, 117, 253, 35, 253, 77, 254, 142, 1, 105, 254, 42, 253, 28, 254, 8, 255, 235, 252, 110, 252, 74, 254, 36, 254, 14, 254, 122, 254, 75, 0, 217, 254, 60, 252, 178, 253, 162, 253, 150, 0, 135, 255, 207, 255, 101, 255, 178, 255, 167, 3, 38, 2, 133, 1, 38, 0, 191, 254, 127, 0, 168, 1, 59, 1, 227, 254, 143, 255, 27, 1, 3, 1, 146, 2, 203, 0, 66, 1, 230, 1, 135, 3, 249, 1, 236, 2, 161, 1, 99, 2, 167, 1, 43, 2, 0, 2, 239, 0, 173, 255, 190, 253, 237, 255, 173, 254, 37, 253, 93, 1, 13, 0, 90, 252, 137, 250, 142, 255, 152, 254, 107, 0, 180, 2, 182, 0, 90, 0, 37, 251, 254, 249, 241, 249, 43, 253, 200, 253, 121, 252, 173, 250, 243, 253, 251, 253, 171, 252, 163, 252, 20, 252, 88, 255, 78, 253, 189, 252, 63, 0, 119, 255, 212, 253, 221, 253, 144, 0, 226, 254, 207, 252, 229, 1, 63, 1, 109, 255, 104, 254, 14, 2, 246, 0, 165, 254, 78, 254, 41, 1, 228, 255, 222, 254, 41, 254, 170, 251, 251, 250, 52, 254, 153, 254, 36, 252, 230, 252, 67, 5, 19, 5, 178, 2, 11, 2, 192, 4, 44, 4, 70, 4, 245, 2, 57, 3, 116, 4, 240, 2, 238, 1, 228, 4, 85, 5, 171, 4, 130, 3, 9, 2, 29, 4, 20, 2, 176, 1, 178, 254, 40, 255, 199, 254, 249, 254, 96, 255, 52, 0, 40, 254, 101, 255, 127, 0, 136, 0, 132, 254, 44, 0, 83, 3, 154, 1, 94, 255, 23, 254, 123, 0, 1, 255, 228, 252, 101, 253, 66, 4, 149, 3, 21, 3, 237, 1, 117, 5, 173, 4, 46, 2, 202, 0, 205, 255, 138, 255, 170, 254, 67, 253, 83, 0, 108, 0, 214, 255, 71, 254, 61, 0, 95, 0, 31, 1, 0, 1, 229, 255, 89, 0, 12, 2, 19, 2, 95, 1, 227, 0, 80, 2, 33, 2, 185, 2, 155, 0, 92, 255, 51, 1, 126, 2, 18, 1, 23, 254, 206, 255, 242, 2, 240, 0, 90, 255, 132, 255, 140, 255, 189, 253, 68, 251, 193, 255, 190, 0, 217, 254, 240, 251, 240, 250, 147, 0, 136, 254, 79, 255, 143, 255, 73, 3, 217, 4, 27, 4, 156, 2, 2, 0, 37, 1, 39, 2, 48, 1, 184, 251, 71, 252, 8, 255, 120, 1, 18, 253, 59, 252, 87, 0, 4, 2, 237, 254, 252, 253, 177, 2, 135, 1, 133, 254, 125, 253, 108, 3, 82, 2, 122, 254, 11, 252, 123, 253, 61, 2, 149, 255, 200, 253, 79, 253, 198, 252, 255, 251, 229, 255, 184, 254, 53, 255, 93, 3, 237, 2, 36, 2, 233, 0, 132, 249, 237, 251, 195, 1, 108, 0, 108, 253, 148, 253, 174, 1, 236, 0, 21, 0, 116, 254, 122, 251, 137, 253, 92, 5, 18, 5, 199, 3, 65, 2, 101, 4, 101, 4, 77, 2, 198, 1, 189, 254, 159, 252, 45, 254, 153, 0, 44, 254, 69, 253, 220, 252, 3, 254, 120, 254, 50, 253, 52, 255, 221, 255, 165, 253, 187, 251, 201, 253, 94, 255, 7, 254, 20, 252, 154, 255, 94, 1, 219, 0, 224, 0, 167, 1, 252, 0, 139, 1, 79, 2, 96, 2, 107, 1, 22, 253, 160, 255, 117, 1, 172, 0, 171, 0, 39, 1, 202, 2, 83, 1, 233, 0, 77, 0, 107, 0, 21, 1, 157, 0, 153, 0, 13, 254, 156, 254, 11, 6, 49, 4, 64, 2, 238, 1, 220, 254, 173, 254, 8, 254, 176, 253, 121, 252, 184, 255, 149, 253, 31, 254, 198, 249, 163, 251, 201, 253, 2, 255, 231, 252, 5, 254, 204, 253, 221, 254, 20, 254, 236, 253, 246, 1, 48, 2, 130, 254, 171, 1, 88, 2, 230, 0, 29, 255, 221, 1, 251, 0, 75, 0, 29, 1, 74, 3, 45, 3, 220, 1, 226, 250, 203, 250, 186, 0, 121, 1, 181, 253, 107, 252, 131, 2, 125, 1, 94, 251, 215, 253, 155, 1, 82, 0, 153, 251, 204, 252, 82, 255, 228, 253, 164, 253, 119, 0, 31, 2, 205, 0, 132, 254, 145, 2, 141, 3, 55, 2, 112, 0, 214, 254, 138, 254, 114, 0, 167, 252, 5, 255, 56, 0, 159, 0, 145, 1, 89, 1, 222, 255, 116, 255, 145, 255, 161, 253, 41, 0, 102, 2, 99, 1, 142, 255, 179, 255, 218, 1, 66, 2, 56, 0, 170, 5, 156, 3, 74, 4, 140, 5, 229, 2, 144, 1, 246, 0, 22, 0, 76, 2, 57, 1, 135, 255, 71, 1, 63, 3, 216, 1, 142, 251, 160, 253, 88, 3, 40, 2, 39, 251, 208, 251, 126, 2, 88, 2, 154, 254, 254, 0, 179, 254, 209, 254, 122, 253, 227, 2, 102, 1, 74, 0, 202, 4, 135, 6, 197, 4, 81, 3, 193, 8, 88, 6, 215, 3, 124, 2, 49, 7, 197, 5, 237, 2, 128, 1, 94, 1, 7, 1, 87, 0, 128, 0, 146, 248, 83, 252, 112, 255, 192, 255, 58, 249, 1, 255, 32, 1, 225, 255, 172, 245, 42, 251, 110, 1, 235, 0, 149, 249, 188, 251, 192, 250, 208, 254, 227, 253, 205, 251, 164, 251, 123, 0, 102, 251, 4, 255, 208, 252, 76, 255, 8, 252, 21, 2, 53, 2, 233, 0, 25, 254, 82, 254, 68, 255, 78, 1, 99, 3, 212, 4, 22, 2, 171, 0, 202, 249, 185, 249, 123, 2, 118, 2, 108, 247, 54, 1, 156, 3, 156, 1, 202, 246, 184, 254, 188, 3, 17, 2, 177, 245, 135, 254, 118, 2, 22, 1, 214, 245, 61, 1, 31, 3, 43, 1, 154, 246, 133, 0, 84, 1, 31, 0, 148, 247, 68, 250, 131, 0, 125, 0, 96, 251, 22, 254, 117, 255, 46, 0, 24, 253, 191, 1, 123, 3, 52, 2, 67, 0, 61, 254, 134, 2, 92, 2, 215, 253, 83, 254, 148, 252, 140, 1, 162, 0, 190, 255, 25, 5, 147, 3, 223, 1, 67, 2, 64, 4, 26, 3, 194, 1, 22, 1, 54, 2, 68, 1, 223, 251, 102, 255, 148, 0, 79, 255, 15, 246, 168, 0, 46, 4, 80, 2, 209, 246, 214, 255, 51, 3, 89, 1, 216, 246, 61, 253, 209, 2, 250, 0, 129, 247, 39, 250, 203, 254, 122, 0, 178, 255, 183, 255, 120, 0, 173, 0, 252, 255, 6, 1, 249, 254, 251, 254, 81, 254, 192, 255, 107, 254, 36, 253, 207, 245, 116, 0, 173, 255, 63, 255, 11, 250, 80, 252, 35, 254, 43, 253, 4, 254, 51, 1, 170, 0, 172, 0, 64, 3, 161, 1, 64, 3, 174, 2, 31, 255, 177, 0, 126, 3, 50, 3, 30, 254, 123, 254, 255, 4, 15, 4, 129, 254, 201, 0, 162, 254, 40, 0, 218, 2, 123, 2, 226, 0, 14, 2, 247, 1, 206, 1, 82, 1, 142, 1, 23, 2, 202, 2, 40, 0, 230, 254, 202, 5, 191, 5, 61, 4, 219, 2, 25, 6, 48, 4, 141, 3, 181, 2, 139, 5, 2, 5, 121, 3, 111, 3, 129, 4, 216, 2, 162, 4, 72, 3, 30, 255, 106, 4, 181, 3, 177, 2, 18, 254, 38, 252, 236, 249, 128, 255, 200, 253, 47, 253, 55, 253, 230, 255, 61, 1, 12, 2, 70, 0, 135, 0, 107, 254, 159, 252, 26, 249, 116, 253, 82, 255, 223, 252, 117, 3, 5, 3, 103, 255, 165, 255, 75, 4, 239, 2, 6, 254, 131, 251, 85, 3, 134, 2, 241, 0, 14, 3, 7, 2, 27, 2, 61, 7, 164, 6, 77, 4, 172, 2, 31, 251, 50, 250, 48, 254, 188, 0, 131, 252, 127, 250, 224, 250, 171, 254, 121, 255, 182, 1, 81, 255, 18, 0, 87, 4, 208, 3, 63, 1, 208, 0, 106, 250, 24, 249, 83, 0, 202, 1, 238, 253, 24, 252, 51, 1, 129, 0, 184, 252, 241, 255, 227, 255, 156, 254, 113, 252, 100, 252, 133, 251, 14, 255, 137, 255, 240, 253, 127, 0, 123, 255, 7, 253, 3, 253, 190, 0, 173, 255, 197, 254, 127, 3, 10, 2, 231, 0, 34, 255, 102, 0, 193, 255, 84, 254, 60, 1, 187, 2, 123, 1, 70, 0, 25, 0, 204, 2, 58, 1, 148, 255, 251, 1, 106, 3, 54, 2, 238, 0, 108, 0, 173, 3, 7, 2, 195, 0, 169, 1, 196, 255, 85, 254, 1, 1, 139, 0, 153, 255, 138, 253, 190, 1, 78, 1, 114, 1, 156, 1, 48, 0, 84, 255, 78, 253, 229, 254, 45, 2, 187, 0, 226, 254, 158, 0, 227, 1, 140, 0, 14, 1, 168, 254, 137, 253, 156, 3, 67, 2, 140, 255, 132, 0, 142, 0, 210, 1, 188, 255, 192, 255, 230, 0, 111, 255, 210, 254, 226, 253, 221, 252, 112, 252, 250, 3, 225, 2, 251, 252, 247, 3, 118, 2, 41, 1, 220, 245, 95, 0, 189, 1, 80, 1, 182, 247, 235, 1, 254, 1, 191, 0, 27, 251, 161, 0, 254, 255, 188, 254, 86, 250, 135, 253, 56, 253, 151, 255, 182, 252, 2, 255, 101, 254, 100, 0, 128, 253, 222, 254, 242, 3, 251, 2, 118, 253, 57, 1, 145, 4, 218, 2, 140, 0, 249, 1, 6, 4, 254, 2, 4, 3, 31, 1, 43, 4, 55, 3, 239, 1, 237, 2, 49, 1, 67, 1, 92, 255, 206, 1, 78, 0, 143, 1, 170, 254, 150, 252, 69, 0, 85, 2, 240, 255, 108, 2, 109, 2, 81, 1, 118, 255, 68, 254, 247, 254, 218, 0, 84, 0, 62, 254, 185, 3, 154, 2, 34, 255, 221, 252, 29, 2, 92, 2, 103, 252, 160, 250, 244, 0, 116, 0, 183, 252, 45, 253, 118, 2, 76, 2, 140, 0, 151, 2, 38, 1, 112, 1, 167, 3, 22, 4, 113, 3, 247, 2, 210, 6, 184, 5, 148, 3, 116, 2, 180, 1, 195, 3, 25, 1, 1, 0, 137, 255, 74, 0, 30, 2, 213, 0, 1, 0, 201, 253, 45, 1, 241, 0, 4, 1, 179, 1, 222, 0, 140, 1, 168, 3, 189, 3, 84, 4, 191, 2, 254, 1, 250, 1, 40, 3, 222, 1, 89, 2, 182, 2, 192, 3, 108, 2, 204, 3, 229, 2, 212, 3, 88, 2, 66, 3, 205, 2, 255, 2, 172, 2, 131, 2, 204, 3, 167, 3, 126, 2, 245, 1, 149, 2, 208, 2, 83, 3, 151, 255, 136, 253, 209, 254, 139, 255, 83, 254, 130, 0, 21, 3, 186, 1, 246, 253, 68, 255, 192, 2, 117, 1, 9, 253, 42, 0, 46, 3, 11, 2, 237, 253, 143, 251, 117, 1, 66, 2, 86, 253, 77, 251, 57, 254, 29, 1, 117, 251, 215, 249, 182, 251, 44, 0, 81, 0, 174, 255, 200, 2, 107, 1, 221, 1, 246, 0, 186, 3, 110, 2, 68, 6, 86, 6, 253, 4, 123, 3, 129, 5, 91, 3, 156, 3, 124, 3, 6, 3, 17, 4, 179, 3, 118, 4, 40, 0, 222, 253, 181, 255, 32, 1, 152, 253, 150, 255, 71, 253, 230, 255, 87, 255, 96, 255, 133, 252, 29, 253, 233, 254, 128, 254, 251, 251, 162, 254, 245, 6, 28, 5, 22, 4, 48, 3, 44, 6, 253, 5, 192, 5, 154, 4, 225, 5, 52, 4, 192, 4, 131, 3, 122, 3, 136, 3, 52, 2, 142, 2, 152, 3, 180, 2, 253, 3, 88, 3, 19, 254, 132, 0, 177, 0, 249, 1, 71, 0, 195, 0, 228, 255, 97, 0, 200, 1, 95, 1, 92, 255, 88, 0, 183, 1, 22, 1, 216, 255, 94, 1, 115, 5, 181, 3, 234, 0, 161, 255, 219, 252, 40, 254, 38, 0, 93, 255, 111, 1, 158, 255, 233, 1, 11, 2, 1, 4, 154, 4, 188, 4, 138, 3, 63, 1, 34, 5, 46, 3, 205, 1, 133, 255, 225, 253, 220, 252, 191, 1, 20, 253, 188, 254, 127, 252, 153, 251, 31, 253, 11, 254, 235, 252, 55, 253, 203, 2, 9, 3, 215, 4, 154, 3, 157, 7, 147, 7, 88, 5, 97, 3, 218, 2, 112, 3, 246, 2, 132, 1, 153, 252, 198, 1, 17, 0, 5, 255, 131, 254, 214, 252, 209, 249, 239, 0, 247, 253, 58, 252, 232, 252, 3, 1, 134, 252, 178, 250, 254, 252, 183, 255, 166, 0, 93, 1, 44, 255, 67, 1, 184, 252, 211, 254, 217, 1, 179, 1, 89, 253, 48, 254, 216, 2, 95, 1, 100, 255, 57, 255, 155, 2, 176, 1, 29, 0, 4, 255, 159, 1, 224, 1, 37, 253, 133, 254, 145, 0, 47, 2, 240, 253, 137, 253, 122, 251, 97, 255, 189, 1, 17, 1, 123, 0, 127, 2, 117, 1, 130, 255, 32, 3, 56, 2, 84, 0, 94, 255, 208, 2, 200, 2, 194, 252, 232, 253, 71, 255, 222, 0, 152, 1, 196, 1, 245, 1, 3, 3, 127, 252, 181, 250, 189, 255, 186, 1, 232, 252, 130, 250, 54, 2, 90, 2, 167, 0, 186, 254, 253, 1, 74, 1, 161, 255, 142, 253, 38, 253, 168, 254, 132, 6, 193, 4, 11, 3, 199, 1, 36, 5, 60, 3, 72, 2, 207, 2, 148, 1, 225, 255, 245, 3, 21, 3, 89, 0, 107, 0, 123, 3, 37, 2, 103, 3, 45, 6, 149, 3, 159, 2, 98, 3, 199, 5, 9, 5, 86, 3, 135, 1, 44, 4, 98, 4, 44, 3, 78, 0, 206, 253, 89, 1, 51, 2, 173, 1, 153, 255, 161, 1, 19, 3, 134, 255, 75, 254, 155, 1, 20, 3, 111, 252, 95, 254, 90, 2, 242, 2, 30, 255, 240, 255, 151, 0, 248, 2, 68, 253, 118, 0, 152, 255, 242, 255, 152, 251, 48, 0, 28, 1, 137, 1, 122, 254, 93, 254, 129, 253, 140, 255, 114, 252, 50, 1, 60, 1, 243, 255, 183, 4, 216, 3, 53, 3, 157, 2, 85, 251, 75, 253, 140, 0, 43, 255, 140, 252, 96, 254, 57, 255, 210, 253, 152, 253, 245, 0, 108, 254, 104, 253, 6, 1, 56, 0, 151, 253, 44, 253, 171, 255, 21, 254, 192, 254, 112, 253, 198, 253, 193, 252, 127, 255, 240, 253, 30, 250, 193, 255, 145, 254, 127, 254, 154, 254, 191, 254, 4, 0, 51, 0, 146, 254, 42, 255, 63, 1, 255, 1, 146, 0, 159, 2, 239, 255, 221, 254, 146, 255, 208, 1, 117, 255, 16, 254, 54, 255, 220, 0, 200, 254, 137, 253, 108, 253, 183, 255, 113, 253, 204, 252, 106, 253, 115, 253, 248, 250, 167, 252, 82, 254, 71, 252, 65, 252, 248, 254, 207, 255, 44, 254, 184, 255, 131, 254, 162, 254, 205, 253, 63, 255, 105, 254, 55, 0, 104, 254, 221, 252, 11, 0, 203, 254, 137, 2, 188, 0, 58, 255, 0, 254, 205, 1, 177, 255, 54, 254, 218, 250, 249, 254, 122, 255, 245, 253, 135, 249, 77, 254, 17, 254, 3, 253, 57, 0, 165, 254, 98, 254, 178, 1, 139, 251, 14, 255, 104, 253, 167, 252, 34, 0, 188, 255, 61, 253, 174, 254, 163, 1, 163, 0, 226, 255, 250, 254, 57, 254, 235, 252, 106, 250, 47, 253, 238, 3, 152, 2, 13, 1, 25, 0, 107, 2, 4, 1, 183, 0, 96, 0, 56, 252, 178, 250, 124, 254, 135, 0, 75, 253, 67, 3, 200, 1, 154, 0, 81, 4, 191, 2, 57, 2, 107, 1, 89, 6, 46, 5, 217, 3, 236, 2, 36, 255, 219, 0, 76, 0, 48, 255, 81, 250, 130, 249, 49, 0, 149, 0, 60, 252, 84, 255, 16, 253, 176, 254, 113, 2, 209, 0, 6, 255, 190, 255, 7, 252, 186, 252, 254, 255, 61, 1, 136, 247, 51, 250, 118, 255, 123, 0, 172, 248, 205, 247, 247, 253, 85, 0, 57, 252, 146, 254, 73, 253, 143, 252, 103, 252, 13, 252, 5, 253, 75, 252, 132, 255, 0, 255, 160, 254, 108, 253, 178, 0, 207, 1, 98, 1, 48, 1, 48, 249, 177, 253, 230, 254, 79, 0, 55, 247, 175, 0, 99, 3, 243, 1, 118, 255, 76, 255, 75, 255, 235, 255, 13, 247, 39, 251, 52, 254, 248, 253, 253, 252, 195, 1, 246, 255, 204, 254, 15, 1, 191, 255, 4, 0, 214, 0, 233, 254, 77, 254, 213, 255, 164, 254, 98, 253, 35, 0, 191, 255, 45, 255, 38, 3, 23, 2, 85, 0, 41, 1, 57, 0, 239, 0, 210, 2, 237, 1, 225, 0, 149, 2, 72, 3, 35, 2, 228, 253, 136, 254, 14, 0, 93, 1, 213, 1, 209, 2, 75, 1, 162, 0, 224, 253, 16, 253, 194, 255, 246, 255, 142, 1, 168, 255, 212, 2, 189, 2, 237, 255, 235, 253, 162, 255, 89, 2, 136, 0, 185, 255, 87, 253, 21, 253, 90, 255, 168, 254, 5, 1, 206, 255, 161, 0, 204, 255, 229, 1, 81, 1, 117, 249, 50, 0, 190, 0, 163, 255, 22, 247, 25, 255, 62, 255, 174, 255, 161, 255, 173, 253, 102, 255, 128, 0, 126, 3, 245, 1, 76, 2, 201, 1, 167, 254, 206, 0, 122, 0, 110, 0, 137, 253, 29, 255, 199, 253, 3, 0, 152, 1, 239, 0, 141, 1, 226, 0, 59, 255, 254, 255, 128, 0, 235, 1, 1, 5, 136, 3, 36, 1, 215, 0, 26, 2, 50, 1, 3, 1, 253, 1, 91, 253, 233, 251, 13, 0, 65, 1, 89, 253, 180, 253, 154, 254, 44, 255, 210, 253, 243, 0, 134, 2, 223, 1, 230, 1, 86, 1, 122, 2, 20, 2, 107, 0, 34, 3, 75, 1, 136, 0, 144, 255, 114, 254, 249, 251, 226, 254, 186, 254, 63, 253, 32, 1, 16, 1, 19, 5, 120, 4, 154, 4, 92, 3, 89, 254, 121, 0, 127, 254, 108, 255, 217, 254, 210, 254, 190, 252, 205, 252, 16, 0, 232, 255, 55, 255, 36, 254, 43, 2, 91, 0, 11, 255, 38, 1, 218, 255, 133, 254, 62, 252, 59, 251, 89, 251, 18, 250, 239, 254, 117, 254, 122, 254, 11, 252, 123, 253, 61, 2, 205, 248, 250, 251, 249, 1, 212, 1, 232, 2, 179, 3, 97, 2, 237, 1, 79, 253, 108, 251, 140, 253, 121, 255, 254, 251, 195, 0, 155, 1, 196, 0, 46, 6, 123, 4, 63, 2, 81, 1, 41, 251, 247, 252, 120, 253, 114, 255, 83, 2, 57, 3, 199, 3, 223, 2, 74, 251, 54, 252, 175, 255, 170, 254, 23, 253, 13, 0, 184, 255, 119, 1, 198, 1, 19, 0, 127, 5, 153, 3, 145, 249, 84, 255, 93, 3, 50, 2, 160, 3, 1, 6, 39, 4, 228, 2, 88, 246, 72, 252, 8, 1, 82, 0, 10, 254, 59, 252, 202, 250, 123, 0, 99, 3, 212, 4, 22, 2, 171, 0, 240, 246, 52, 254, 12, 3, 107, 1, 90, 251, 151, 253, 252, 0, 195, 255, 82, 255, 34, 0, 243, 3, 20, 3, 227, 246, 247, 0, 167, 1, 153, 0, 240, 255, 157, 254, 6, 1, 193, 1, 216, 249, 207, 251, 224, 253, 141, 254, 153, 253, 207, 254, 27, 4, 37, 3, 175, 2, 16, 2, 6, 0, 74, 255, 167, 3, 107, 3, 234, 3, 41, 3, 199, 0, 1, 1, 126, 0, 76, 0, 184, 253, 142, 251, 87, 2, 44, 2, 175, 251, 145, 250, 201, 249, 249, 253, 47, 252, 211, 250, 108, 0, 91, 1, 46, 253, 49, 252, 109, 1, 101, 0, 111, 255, 169, 2, 249, 0, 103, 255, 0, 0, 178, 254, 198, 253, 159, 0, 156, 1, 29, 1, 176, 254, 151, 253, 71, 252, 58, 252, 119, 3, 177, 2, 29, 251, 84, 0, 71, 255, 114, 254, 176, 253, 177, 1, 20, 4, 141, 2, 85, 0, 73, 1, 216, 255, 105, 1, 79, 254, 63, 253, 210, 1, 62, 2, 102, 255, 142, 2, 80, 2, 34, 1, 89, 255, 72, 0, 93, 1, 175, 0, 162, 2, 41, 1, 209, 3, 208, 2, 211, 4, 180, 4, 245, 2, 232, 1, 112, 254, 243, 254, 26, 2, 116, 1, 186, 250, 149, 250, 86, 251, 165, 255, 238, 4, 108, 3, 7, 3, 188, 2, 169, 253, 218, 255, 82, 254, 46, 253, 184, 7, 94, 6, 223, 3, 96, 2, 111, 0, 20, 1, 30, 255, 160, 255, 77, 252, 124, 254, 245, 255, 249, 255, 209, 254, 237, 253, 185, 252, 82, 1, 198, 6, 174, 6, 125, 5, 245, 3, 252, 253, 169, 252, 123, 253, 210, 0, 80, 253, 96, 254, 1, 2, 230, 0, 202, 252, 131, 253, 134, 251, 192, 254, 72, 252, 110, 253, 74, 253, 183, 0, 142, 255, 145, 253, 50, 3, 162, 2, 65, 255, 52, 255, 219, 2, 123, 2, 51, 0, 197, 4, 115, 3, 64, 2, 70, 252, 81, 254, 58, 3, 86, 2, 170, 254, 13, 253, 124, 252, 105, 254, 154, 251, 158, 254, 50, 255, 0, 254, 221, 253, 214, 252, 155, 254, 148, 253, 66, 0, 3, 2, 183, 255, 102, 254, 152, 252, 79, 252, 92, 250, 53, 251, 191, 0, 239, 255, 224, 253, 25, 255, 252, 249, 224, 253, 123, 252, 138, 252, 134, 252, 242, 249, 19, 246, 205, 252, 54, 252, 175, 0, 198, 252, 46, 251, 6, 253, 169, 253, 234, 255, 122, 2, 213, 252, 37, 252, 122, 252, 189, 254, 203, 0, 26, 0, 129, 254, 21, 255, 243, 252, 113, 254, 238, 4, 138, 3, 92, 252, 137, 250, 156, 250, 144, 253, 93, 0, 87, 0, 98, 254, 229, 253, 77, 253, 37, 0, 121, 2, 254, 1, 125, 254, 36, 254, 206, 250, 143, 1, 66, 0, 7, 1, 105, 254, 207, 255, 177, 254, 95, 254, 17, 4, 73, 7, 245, 252, 191, 251, 96, 250, 22, 253, 166, 252, 64, 3, 187, 253, 9, 253, 141, 254, 95, 253, 6, 254, 40, 8, 208, 253, 134, 253, 101, 251, 15, 1, 241, 0, 14, 0, 74, 254, 12, 255, 115, 254, 207, 1, 178, 4, 23, 4, 162, 253, 227, 252, 98, 250, 205, 255, 189, 254, 225, 1, 32, 255, 184, 253, 241, 253, 238, 1, 113, 3, 170, 2, 79, 254, 206, 254, 22, 252, 42, 2, 147, 2, 222, 0, 171, 0, 96, 255, 159, 254, 169, 2, 6, 7, 29, 6, 172, 252, 99, 251, 97, 249, 176, 254, 102, 253, 114, 0, 187, 253, 12, 253, 24, 253, 61, 255, 119, 1, 241, 1, 47, 254, 220, 252, 182, 251, 154, 0, 26, 1, 125, 255, 206, 255, 65, 255, 49, 253, 67, 1, 220, 2, 6, 6, 46, 253, 205, 252, 132, 250, 105, 0, 6, 255, 185, 0, 78, 255, 10, 254, 26, 253, 65, 1, 254, 1, 87, 4, 189, 254, 201, 253, 58, 252, 127, 0, 228, 1, 82, 1, 96, 255, 52, 0, 174, 254, 220, 2, 87, 5, 18, 6, 142, 253, 222, 252, 96, 249, 226, 254, 182, 253, 164, 2, 73, 253, 169, 254, 142, 254, 22, 254, 39, 1, 101, 7, 138, 253, 194, 253, 10, 252, 176, 255, 133, 2, 187, 255, 250, 255, 194, 254, 148, 254, 14, 3, 170, 5, 14, 4, 199, 254, 35, 253, 141, 250, 120, 0, 60, 0, 221, 1, 248, 254, 183, 253, 133, 255, 199, 2, 221, 4, 121, 2, 165, 255, 157, 254, 8, 252, 3, 3, 246, 2, 5, 1, 253, 0, 81, 0, 38, 254, 162, 3, 167, 8, 184, 6, 216, 252, 181, 251, 123, 248, 208, 253, 242, 252, 169, 0, 220, 252, 206, 251, 68, 255, 142, 253, 201, 255, 125, 5, 74, 253, 52, 253, 86, 251, 108, 253, 98, 1, 73, 1, 254, 253, 201, 255, 225, 253, 110, 1, 9, 4, 158, 4, 110, 253, 65, 252, 179, 250, 201, 255, 72, 255, 93, 0, 163, 253, 226, 254, 106, 253, 148, 1, 193, 1, 59, 3, 226, 254, 162, 254, 17, 251, 116, 2, 50, 1, 227, 0, 240, 255, 147, 0, 145, 253, 186, 0, 155, 3, 98, 8, 94, 253, 134, 252, 186, 249, 69, 254, 28, 255, 83, 1, 143, 254, 234, 252, 103, 254, 231, 0, 86, 0, 189, 5, 64, 254, 187, 253, 219, 251, 82, 2, 194, 1, 79, 255, 132, 255, 86, 255, 65, 254, 159, 2, 135, 4, 124, 5, 36, 254, 101, 253, 25, 250, 179, 255, 118, 255, 204, 2, 79, 255, 140, 254, 131, 254, 195, 1, 166, 3, 147, 3, 6, 255, 80, 254, 202, 252, 16, 1, 60, 3, 190, 1, 26, 0, 19, 0, 225, 255, 186, 2, 156, 6, 120, 8, 122, 253, 47, 252, 124, 248, 77, 255, 39, 254, 12, 1, 133, 254, 23, 253, 77, 253, 11, 0, 127, 0, 9, 4, 24, 254, 107, 252, 199, 252, 61, 0, 67, 1, 135, 0, 147, 0, 111, 255, 82, 253, 173, 2, 18, 3, 146, 6, 6, 254, 176, 252, 239, 250, 35, 0, 90, 0, 222, 0, 233, 255, 166, 254, 98, 253, 199, 1, 79, 2, 7, 5, 53, 255, 175, 253, 194, 251, 140, 2, 96, 1, 181, 1, 39, 0, 63, 0, 55, 254, 73, 3, 241, 4, 57, 8, 248, 253, 142, 252, 208, 249, 184, 254, 57, 253, 141, 5, 172, 253, 170, 254, 186, 255, 209, 0, 173, 0, 136, 7, 89, 254, 170, 253, 103, 252, 165, 1, 93, 2, 218, 255, 254, 255, 11, 255, 129, 255, 128, 3, 177, 7, 111, 4, 133, 254, 250, 253, 213, 249, 173, 0, 118, 0, 241, 2, 201, 255, 131, 254, 204, 255, 217, 3, 253, 3, 241, 2, 254, 255, 221, 254, 133, 252, 241, 2, 224, 3, 167, 1, 8, 1, 131, 0, 60, 255, 127, 3, 226, 8, 239, 9, 133, 253, 192, 251, 61, 246, 239, 253, 42, 252, 14, 2, 4, 253, 194, 252, 220, 253, 76, 254, 60, 1, 87, 2, 93, 253, 84, 252, 22, 253, 199, 255, 236, 0, 245, 255, 55, 255, 175, 255, 226, 252, 16, 0, 77, 3, 22, 6, 31, 253, 39, 252, 68, 251, 44, 254, 17, 0, 34, 1, 233, 254, 184, 253, 68, 253, 183, 0, 54, 3, 193, 2, 247, 254, 20, 254, 93, 251, 165, 1, 152, 0, 212, 1, 122, 254, 166, 0, 244, 254, 39, 0, 14, 6, 76, 7, 133, 253, 58, 252, 221, 249, 59, 254, 20, 254, 142, 3, 228, 254, 253, 251, 181, 255, 75, 255, 123, 255, 60, 7, 67, 254, 144, 253, 106, 251, 164, 1, 111, 1, 207, 255, 123, 254, 44, 255, 87, 255, 195, 2, 49, 4, 184, 4, 229, 253, 58, 253, 87, 250, 83, 0, 93, 255, 228, 1, 20, 255, 225, 253, 157, 254, 82, 1, 151, 4, 46, 3, 10, 255, 203, 254, 66, 252, 94, 2, 248, 2, 60, 0, 166, 0, 248, 255, 93, 255, 206, 254, 57, 7, 3, 10, 21, 253, 255, 251, 9, 249, 93, 254, 66, 254, 209, 0, 50, 253, 202, 253, 234, 253, 6, 254, 181, 2, 89, 3, 49, 254, 71, 253, 198, 251, 69, 1, 175, 1, 50, 255, 241, 255, 248, 255, 5, 253, 33, 2, 151, 3, 238, 5, 157, 253, 241, 252, 223, 250, 0, 1, 201, 255, 208, 0, 91, 255, 164, 254, 106, 253, 65, 1, 168, 2, 162, 3, 186, 254, 83, 254, 73, 252, 228, 1, 190, 1, 58, 2, 59, 255, 72, 0, 183, 255, 141, 3, 175, 5, 205, 6, 205, 253, 31, 253, 74, 248, 132, 255, 96, 254, 206, 2, 34, 254, 108, 254, 198, 254, 240, 255, 190, 1, 100, 6, 217, 253, 231, 253, 18, 253, 198, 255, 126, 2, 214, 0, 55, 0, 71, 255, 241, 254, 124, 4, 21, 5, 188, 4, 29, 254, 97, 253, 16, 251, 117, 0, 29, 1, 31, 2, 52, 255, 121, 254, 145, 255, 1, 2, 2, 6, 86, 3, 142, 255, 66, 255, 46, 252, 109, 3, 83, 2, 208, 1, 4, 1, 4, 1, 201, 254, 236, 2, 235, 8, 168, 8, 251, 253, 79, 252, 133, 247, 186, 254, 60, 253, 122, 1, 212, 252, 77, 253, 24, 255, 208, 253, 175, 2, 129, 5, 36, 253, 78, 253, 188, 252, 153, 254, 133, 2, 130, 1, 247, 254, 62, 0, 90, 253, 145, 0, 108, 6, 184, 4, 213, 253, 36, 252, 47, 251, 178, 255, 14, 0, 114, 0, 185, 254, 154, 254, 23, 254, 136, 1, 165, 2, 185, 2, 55, 255, 20, 255, 140, 251, 181, 2, 193, 1, 178, 0, 13, 255, 0, 1, 79, 254, 99, 2, 105, 5, 152, 9, 156, 253, 123, 252, 72, 250, 205, 254, 239, 255, 243, 1, 197, 254, 101, 253, 2, 255, 0, 1, 172, 1, 183, 5, 26, 254, 90, 254, 224, 251, 143, 2, 114, 1, 18, 0, 154, 255, 71, 255, 236, 254, 243, 2, 42, 6, 55, 5, 24, 254, 165, 253, 118, 250, 182, 0, 163, 255, 102, 3, 183, 255, 54, 254, 164, 254, 67, 3, 94, 3, 189, 3, 230, 254, 179, 254, 22, 253, 35, 2, 71, 3, 172, 1, 17, 1, 167, 255, 13, 0, 172, 3, 172, 6, 16, 10, 94, 254, 196, 251, 34, 249, 212, 255, 154, 254, 3, 1, 15, 254, 125, 253, 208, 253, 99, 0, 45, 2, 193, 3, 91, 254, 2, 253, 107, 252, 39, 1, 70, 1, 184, 0, 175, 0, 15, 0, 142, 253, 20, 2, 110, 3, 189, 7, 69, 254, 0, 253, 5, 251, 221, 0, 156, 0, 12, 1, 39, 0, 149, 254, 7, 254, 183, 2, 4, 3, 116, 4, 94, 255, 53, 254, 112, 252, 197, 2, 188, 1, 146, 2, 25, 0, 47, 1, 200, 254, 244, 4, 130, 5, 179, 6, 215, 254, 2, 253, 212, 248, 249, 254, 148, 255, 46, 4, 106, 254, 243, 255, 127, 255, 57, 0, 182, 1, 174, 10, 138, 254, 25, 254, 189, 252, 48, 1, 184, 2, 164, 0, 104, 0, 21, 255, 5, 0, 75, 6, 108, 7, 119, 5, 27, 255, 186, 253, 211, 250, 149, 1, 192, 0, 49, 3, 169, 255, 74, 254, 111, 0, 4, 4, 175, 4, 225, 3, 68, 0, 81, 255, 90, 252, 9, 4, 93, 4, 195, 1, 222, 1, 200, 0, 8, 255, 79, 8, 136, 10, 250, 7, 189, 252, 213, 250, 173, 247, 225, 252, 76, 253, 210, 1, 212, 252, 248, 251, 43, 254, 146, 253, 32, 1, 152, 3, 67, 253, 183, 252, 210, 251, 101, 254, 0, 2, 8, 0, 122, 254, 165, 255, 24, 253, 226, 255, 19, 4, 137, 4, 202, 252, 132, 251, 124, 251, 218, 254, 210, 255, 110, 0, 101, 254, 138, 254, 90, 253, 214, 0, 19, 2, 156, 2, 106, 254, 92, 254, 86, 251, 231, 1, 232, 0, 47, 1, 194, 254, 91, 0, 40, 254, 123, 0, 208, 4, 141, 9, 46, 253, 72, 252, 41, 250, 30, 253, 93, 253, 52, 5, 225, 253, 162, 253, 45, 255, 161, 255, 158, 255, 228, 5, 219, 253, 254, 253, 87, 251, 217, 1, 211, 0, 73, 0, 224, 254, 144, 255, 123, 254, 25, 2, 52, 5, 234, 4, 201, 253, 13, 253, 247, 249, 71, 0, 229, 254, 120, 2, 86, 255, 31, 254, 19, 254, 169, 2, 234, 3, 49, 3, 156, 254, 181, 254, 147, 252, 163, 1, 194, 2, 90, 1, 241, 0, 222, 255, 186, 254, 121, 1, 158, 7, 91, 7, 41, 253, 205, 251, 167, 249, 23, 255, 225, 253, 116, 0, 244, 253, 218, 252, 183, 253, 183, 255, 222, 1, 217, 2, 224, 254, 99, 252, 137, 251, 173, 0, 191, 1, 204, 255, 68, 0, 27, 255, 162, 253, 193, 1, 17, 2, 5, 7, 177, 253, 149, 252, 173, 250, 183, 0, 112, 255, 68, 1, 153, 255, 60, 254, 102, 253, 111, 2, 232, 1, 152, 4, 18, 255, 1, 254, 20, 252, 70, 1, 40, 2, 202, 1, 136, 0, 108, 0, 193, 254, 114, 2, 63, 5, 91, 7, 22, 254, 122, 253, 62, 249, 70, 255, 63, 254, 216, 3, 30, 253, 180, 255, 86, 255, 218, 253, 243, 2, 0, 10, 16, 254, 2, 254, 77, 252, 210, 0, 182, 2, 204, 255, 84, 0, 190, 254, 57, 255, 66, 4, 89, 6, 200, 4, 136, 254, 165, 253, 140, 250, 87, 1, 74, 0, 120, 2, 81, 255, 10, 254, 224, 255, 204, 3, 52, 5, 222, 2, 52, 0, 217, 254, 167, 251, 41, 4, 150, 3, 160, 0, 137, 1, 107, 0, 115, 254, 190, 4, 89, 10, 205, 6, 136, 253, 79, 251, 157, 248, 49, 253, 235, 254, 97, 1, 117, 253, 144, 252, 134, 255, 45, 255, 209, 0, 58, 5, 206, 253, 54, 253, 221, 251, 48, 255, 132, 1, 159, 0, 192, 254, 195, 255, 217, 253, 37, 1, 68, 4, 163, 5, 120, 253, 159, 252, 27, 251, 207, 255, 113, 255, 49, 1, 111, 254, 29, 255, 183, 253, 49, 2, 20, 2, 159, 3, 139, 255, 69, 254, 92, 251, 251, 1, 180, 1, 36, 1, 177, 255, 233, 0, 54, 254, 159, 2, 1, 4, 92, 9, 135, 253, 182, 252, 11, 250, 204, 254, 226, 254, 128, 2, 139, 254, 147, 253, 105, 254, 162, 1, 253, 0, 25, 5, 197, 254, 187, 253, 143, 251, 60, 2, 173, 2, 231, 254, 61, 0, 188, 255, 141, 254, 223, 3, 77, 4, 218, 5, 19, 254, 85, 253, 174, 250, 209, 255, 164, 0, 192, 2, 0, 255, 198, 254, 244, 254, 119, 2, 181, 3, 28, 4, 138, 255, 164, 254, 191, 252, 68, 0, 156, 4, 56, 2, 152, 0, 117, 0, 34, 0, 89, 4, 110, 7, 191, 8, 167, 253, 65, 252, 86, 249, 113, 255, 23, 254, 224, 1, 180, 254, 113, 253, 194, 253, 54, 0, 97, 1, 168, 4, 50, 254, 116, 253, 228, 252, 150, 0, 37, 2, 112, 0, 195, 0, 145, 255, 253, 253, 167, 2, 84, 4, 111, 6, 210, 253, 19, 253, 63, 251, 247, 255, 16, 1, 85, 1, 203, 255, 247, 254, 233, 253, 233, 1, 75, 3, 18, 5, 136, 255, 30, 254, 248, 251, 120, 2, 31, 2, 152, 1, 179, 0, 50, 1, 242, 253, 100, 4, 184, 5, 196, 8, 95, 254, 238, 252, 230, 249, 32, 255, 128, 254, 84, 5, 135, 254, 53, 254, 231, 255, 129, 1, 233, 1, 126, 8, 180, 254, 117, 253, 195, 252, 32, 2, 41, 2, 61, 0, 22, 0, 143, 255, 167, 255, 104, 4, 189, 6, 244, 5, 40, 255, 139, 254, 139, 249, 161, 0, 60, 1, 140, 3, 91, 255, 34, 255, 189, 255, 82, 5, 151, 4, 21, 3, 73, 0, 4, 255, 1, 253, 226, 2, 164, 3, 104, 2, 106, 1, 246, 0, 130, 255, 19, 3, 94, 10, 211, 11, 77, 253, 174, 251, 114, 247, 203, 253, 180, 253, 12, 2, 178, 253, 45, 252, 22, 254, 249, 254, 141, 1, 214, 3, 191, 253, 187, 252, 79, 252, 234, 255, 179, 1, 207, 255, 66, 255, 138, 255, 139, 253, 168, 255, 216, 4, 233, 5, 132, 253, 229, 251, 5, 252, 221, 254, 189, 0, 3, 1, 255, 254, 42, 254, 139, 253, 145, 0, 177, 3, 126, 3, 186, 254, 148, 254, 186, 251, 31, 2, 4, 1, 118, 2, 54, 255, 189, 0, 47, 255, 101, 1, 99, 5, 43, 8, 199, 253, 205, 251, 87, 250, 54, 253, 17, 255, 151, 3, 92, 254, 63, 253, 172, 255, 147, 255, 142, 255, 103, 9, 99, 254, 239, 253, 103, 251, 226, 1, 112, 1, 131, 0, 70, 255, 184, 255, 125, 255, 93, 3, 231, 4, 196, 4, 157, 253, 110, 253, 195, 250, 227, 0, 135, 255, 119, 2, 80, 255, 23, 254, 38, 255, 233, 2, 151, 4, 189, 3, 191, 254, 108, 255, 88, 252, 159, 2, 198, 3, 216, 0, 84, 1, 253, 255, 113, 255, 213, 1, 56, 7, 133, 9, 39, 253, 63, 252, 109, 249, 43, 255, 2, 255, 65, 1, 1, 254, 74, 254, 247, 253, 130, 255, 213, 2, 135, 3, 172, 254, 83, 253, 248, 251, 60, 1, 224, 1, 20, 0, 23, 0, 167, 255, 217, 253, 97, 1, 27, 4, 253, 6, 224, 253, 11, 253, 172, 250, 42, 1, 231, 255, 180, 1, 156, 255, 120, 254, 249, 253, 211, 1, 242, 2, 54, 4, 46, 255, 114, 254, 202, 251, 108, 2, 146, 2, 118, 2], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE + 10240);
  allocate([33, 0, 147, 0, 78, 255, 153, 3, 151, 6, 129, 7, 187, 254, 240, 253, 70, 248, 2, 0, 227, 254, 142, 3, 141, 254, 22, 254, 26, 255, 0, 0, 85, 2, 218, 7, 16, 254, 117, 254, 190, 252, 37, 0, 177, 3, 245, 0, 181, 0, 96, 255, 112, 255, 201, 5, 93, 5, 77, 5, 157, 254, 167, 253, 10, 251, 42, 1, 66, 1, 160, 2, 63, 255, 176, 254, 77, 0, 65, 4, 253, 5, 154, 3, 177, 0, 217, 255, 155, 251, 228, 3, 13, 3, 24, 2, 200, 1, 110, 1, 80, 254, 135, 5, 136, 9, 231, 8, 46, 254, 10, 253, 235, 246, 209, 254, 3, 254, 131, 1, 41, 253, 211, 253, 66, 0, 111, 255, 131, 2, 224, 4, 224, 253, 92, 253, 108, 252, 31, 255, 94, 3, 76, 2, 104, 255, 40, 0, 235, 253, 167, 1, 143, 5, 22, 6, 196, 253, 181, 252, 135, 251, 128, 255, 85, 0, 205, 1, 18, 255, 255, 254, 184, 253, 93, 2, 236, 2, 93, 3, 24, 0, 54, 255, 127, 250, 29, 3, 231, 1, 47, 1, 75, 255, 108, 1, 74, 255, 104, 2, 98, 5, 126, 11, 18, 254, 172, 252, 95, 250, 220, 254, 61, 0, 44, 3, 172, 255, 45, 253, 74, 255, 43, 2, 20, 2, 226, 5, 147, 254, 19, 254, 223, 251, 54, 3, 76, 2, 11, 0, 242, 255, 238, 255, 26, 255, 233, 3, 121, 5, 171, 5, 38, 254, 199, 253, 244, 250, 46, 1, 62, 0, 38, 4, 186, 255, 136, 254, 34, 255, 214, 3, 206, 3, 125, 4, 60, 255, 22, 255, 229, 252, 223, 1, 74, 4, 243, 1, 106, 1, 58, 0, 70, 0, 123, 4, 21, 8, 41, 11, 25, 254, 146, 252, 224, 248, 73, 0, 224, 254, 92, 1, 154, 254, 12, 254, 4, 254, 199, 0, 209, 2, 218, 4, 178, 255, 71, 253, 229, 252, 105, 1, 24, 2, 196, 0, 118, 1, 110, 0, 33, 253, 79, 3, 27, 4, 104, 7, 146, 254, 55, 253, 98, 251, 59, 1, 64, 1, 173, 1, 72, 0, 41, 255, 62, 254, 247, 2, 118, 3, 83, 5, 226, 255, 84, 254, 190, 252, 93, 3, 115, 2, 28, 3, 118, 0, 212, 1, 233, 254, 75, 5, 91, 7, 101, 7, 68, 255, 126, 253, 180, 249, 63, 0, 81, 255, 174, 4, 94, 254, 45, 255, 51, 0, 158, 1, 75, 2, 41, 10, 22, 255, 211, 253, 166, 252, 168, 1, 121, 3, 222, 0, 136, 0, 155, 255, 83, 0, 133, 5, 230, 8, 103, 5, 172, 255, 67, 254, 147, 250, 158, 1, 57, 1, 21, 4, 29, 0, 169, 254, 65, 0, 16, 6, 111, 6, 212, 3, 183, 0, 165, 255, 195, 252, 249, 4, 133, 5, 104, 1, 41, 2, 16, 1, 149, 255, 51, 6, 77, 12, 43, 10, 104, 5, 29, 8, 92, 13, 244, 19, 86, 26, 186, 31, 135, 38, 84, 43, 170, 49, 133, 53, 61, 254, 215, 251, 239, 253, 231, 250, 62, 254, 12, 253, 15, 254, 161, 252, 128, 254, 149, 253, 99, 254, 99, 253, 195, 254, 230, 253, 181, 254, 212, 253, 98, 254, 4, 254, 88, 254, 134, 254, 238, 254, 188, 254, 78, 254, 154, 253, 30, 255, 12, 254, 24, 255, 254, 253, 249, 254, 135, 254, 214, 254, 102, 254, 105, 255, 58, 253, 82, 255, 206, 252, 107, 255, 100, 254, 100, 255, 83, 254, 224, 254, 50, 254, 70, 255, 53, 255, 86, 255, 210, 254, 65, 255, 191, 254, 125, 255, 109, 255, 215, 254, 117, 254, 28, 255, 42, 255, 11, 255, 64, 255, 189, 255, 196, 254, 185, 255, 185, 254, 152, 255, 51, 255, 162, 255, 73, 255, 113, 255, 218, 255, 63, 255, 161, 255, 16, 0, 180, 255, 132, 255, 8, 255, 23, 0, 19, 255, 24, 0, 12, 255, 18, 0, 120, 255, 44, 0, 145, 255, 223, 255, 232, 255, 231, 255, 0, 0, 149, 0, 19, 0, 23, 0, 113, 255, 158, 0, 87, 255, 174, 0, 75, 255, 133, 0, 201, 255, 165, 0, 230, 255, 111, 0, 84, 0, 98, 0, 75, 0, 87, 0, 183, 0, 141, 255, 245, 255, 248, 255, 130, 0, 11, 0, 170, 0, 254, 0, 77, 0, 205, 0, 17, 0, 183, 0, 112, 0, 6, 1, 194, 0, 202, 0, 31, 1, 95, 0, 189, 0, 214, 255, 151, 255, 234, 0, 179, 0, 39, 0, 186, 0, 163, 0, 89, 1, 76, 1, 199, 0, 43, 1, 161, 0, 202, 255, 29, 1, 178, 255, 25, 1, 123, 255, 141, 0, 74, 255, 111, 0, 249, 0, 85, 1, 15, 1, 108, 1, 93, 0, 147, 1, 75, 0, 135, 1, 92, 0, 254, 1, 118, 255, 220, 0, 71, 255, 227, 255, 222, 255, 105, 1, 141, 255, 64, 1, 3, 0, 42, 2, 99, 0, 30, 1, 218, 0, 79, 2, 11, 255, 150, 1, 244, 254, 197, 1, 0, 0, 68, 2, 25, 0, 94, 2, 19, 1, 20, 2, 148, 0, 194, 1, 183, 255, 227, 2, 227, 254, 6, 2, 224, 254, 94, 0, 53, 255, 162, 2, 116, 255, 182, 255, 205, 0, 202, 2, 142, 255, 43, 1, 176, 0, 155, 3, 182, 0, 45, 2, 240, 0, 193, 2, 240, 255, 1, 2, 229, 1, 81, 2, 37, 1, 128, 1, 195, 1, 105, 2, 218, 255, 50, 0, 51, 2, 17, 2, 47, 1, 209, 0, 203, 1, 107, 1, 177, 1, 196, 1, 194, 1, 198, 1, 111, 1, 94, 2, 221, 1, 229, 2, 176, 1, 97, 1, 112, 1, 11, 1, 105, 1, 204, 2, 17, 1, 71, 2, 197, 1, 166, 0, 254, 1, 172, 0, 201, 0, 117, 2, 18, 1, 191, 0, 56, 2, 127, 2, 46, 1, 42, 1, 122, 2, 131, 1, 131, 2, 94, 1, 75, 2, 48, 2, 100, 2, 53, 2, 88, 2, 20, 3, 231, 1, 160, 2, 0, 2, 247, 3, 65, 1, 77, 1, 101, 1, 86, 3, 131, 255, 157, 1, 218, 1, 200, 2, 17, 0, 105, 255, 52, 2, 29, 1, 14, 1, 15, 255, 203, 3, 121, 3, 233, 1, 220, 0, 254, 1, 128, 3, 37, 2, 156, 3, 71, 1, 57, 3, 34, 1, 143, 3, 28, 2, 84, 4, 158, 0, 37, 3, 199, 0, 189, 3, 255, 1, 218, 2, 100, 0, 106, 3, 13, 0, 23, 3, 179, 1, 120, 2, 164, 2, 204, 3, 249, 0, 132, 3, 211, 1, 194, 4, 13, 3, 50, 4, 73, 2, 17, 3, 233, 255, 157, 2, 11, 1, 19, 4, 107, 2, 60, 4, 103, 2, 121, 4, 110, 2, 137, 3, 148, 3, 25, 4, 80, 0, 75, 1, 72, 2, 51, 4, 89, 0, 127, 2, 220, 3, 193, 3, 2, 3, 208, 2, 30, 3, 187, 2, 236, 1, 191, 1, 131, 3, 115, 2, 15, 1, 164, 4, 213, 2, 53, 5, 87, 0, 91, 2, 64, 3, 67, 6, 104, 2, 103, 4, 122, 3, 225, 5, 232, 3, 132, 4, 98, 3, 241, 3, 227, 3, 59, 3, 125, 4, 90, 3, 49, 3, 170, 5, 5, 3, 40, 5, 244, 1, 109, 5, 56, 1, 129, 4, 236, 255, 60, 4, 64, 0, 3, 5, 2, 0, 148, 4, 143, 1, 77, 7, 2, 2, 170, 6, 246, 1, 100, 6, 118, 3, 242, 5, 160, 1, 88, 2, 107, 4, 70, 5, 251, 4, 110, 5, 121, 3, 3, 7, 146, 3, 230, 6, 227, 0, 159, 4, 226, 4, 34, 7, 249, 1, 62, 7, 151, 3, 49, 9, 57, 255, 175, 1, 152, 0, 199, 6, 43, 255, 228, 255, 136, 1, 54, 5, 103, 255, 204, 255, 210, 3, 127, 4, 189, 254, 112, 254, 45, 3, 167, 6, 120, 255, 84, 0, 169, 5, 223, 7, 181, 254, 113, 255, 119, 255, 168, 4, 0, 255, 22, 2, 99, 255, 7, 4, 205, 254, 73, 254, 30, 2, 219, 2, 183, 254, 92, 254, 159, 255, 104, 2, 150, 254, 88, 255, 190, 254, 110, 1, 9, 255, 146, 255, 45, 255, 89, 0, 60, 255, 203, 254, 20, 0, 59, 0, 148, 254, 49, 254, 226, 254, 89, 0, 176, 254, 175, 0, 80, 254, 141, 0, 133, 254, 66, 255, 78, 254, 60, 255, 177, 255, 150, 0, 234, 254, 29, 255, 232, 254, 166, 0, 213, 253, 90, 254, 101, 255, 29, 2, 146, 254, 54, 0, 227, 255, 173, 255, 211, 254, 250, 252, 186, 0, 116, 2, 115, 254, 248, 254, 242, 0, 37, 1, 59, 255, 183, 253, 124, 0, 154, 1, 53, 0, 123, 255, 10, 0, 84, 1, 198, 253, 215, 251, 65, 0, 66, 254, 68, 0, 19, 254, 127, 1, 169, 3, 155, 254, 57, 253, 153, 254, 6, 255, 91, 253, 212, 251, 36, 1, 230, 255, 107, 1, 6, 0, 95, 2, 33, 5, 129, 255, 246, 255, 233, 5, 94, 7, 201, 2, 204, 3, 189, 5, 133, 8, 163, 5, 224, 7, 161, 249, 192, 249, 252, 248, 14, 247, 253, 251, 22, 249, 180, 251, 23, 248, 3, 251, 148, 250, 169, 250, 2, 250, 77, 252, 75, 250, 52, 252, 12, 250, 25, 252, 58, 251, 4, 252, 108, 251, 209, 252, 37, 252, 32, 252, 165, 250, 64, 251, 18, 252, 247, 250, 186, 251, 24, 253, 12, 251, 13, 253, 243, 250, 162, 252, 101, 252, 119, 252, 40, 252, 90, 253, 229, 251, 83, 253, 230, 251, 193, 251, 39, 252, 218, 251, 89, 253, 35, 252, 127, 253, 153, 251, 48, 252, 6, 253, 114, 253, 134, 252, 218, 252, 191, 252, 189, 251, 62, 253, 139, 253, 147, 253, 218, 252, 128, 253, 212, 252, 249, 252, 134, 253, 245, 252, 225, 253, 28, 252, 203, 253, 205, 251, 188, 253, 222, 253, 157, 253, 196, 253, 149, 253, 8, 253, 222, 254, 145, 252, 242, 253, 201, 252, 50, 254, 229, 252, 3, 255, 215, 253, 97, 254, 179, 253, 73, 254, 235, 253, 172, 254, 76, 253, 89, 252, 7, 254, 252, 252, 66, 253, 149, 251, 249, 254, 206, 254, 53, 252, 29, 254, 67, 254, 182, 255, 213, 253, 220, 253, 154, 253, 127, 255, 75, 253, 22, 255, 116, 254, 10, 255, 37, 254, 6, 255, 247, 254, 108, 254, 136, 254, 254, 253, 95, 254, 2, 254, 212, 254, 199, 254, 178, 254, 104, 253, 49, 254, 210, 252, 126, 254, 64, 253, 175, 254, 153, 253, 22, 255, 55, 255, 23, 255, 17, 255, 89, 255, 201, 253, 53, 255, 149, 253, 109, 255, 97, 254, 141, 255, 160, 254, 90, 255, 18, 253, 85, 255, 7, 253, 242, 254, 145, 252, 248, 254, 121, 252, 145, 254, 24, 253, 43, 0, 37, 254, 14, 0, 115, 253, 43, 0, 98, 253, 11, 0, 64, 254, 197, 255, 247, 253, 130, 255, 137, 255, 101, 255, 155, 253, 214, 255, 161, 252, 229, 255, 93, 252, 136, 0, 29, 254, 183, 0, 44, 254, 55, 0, 214, 254, 55, 0, 208, 254, 57, 1, 159, 253, 57, 1, 48, 253, 66, 1, 89, 255, 100, 0, 227, 253, 253, 255, 137, 255, 145, 255, 69, 255, 233, 0, 20, 255, 4, 1, 22, 255, 26, 0, 91, 255, 134, 0, 211, 255, 216, 255, 219, 253, 104, 1, 53, 255, 122, 1, 124, 254, 194, 1, 129, 254, 19, 1, 20, 0, 182, 0, 153, 255, 246, 0, 145, 255, 175, 1, 37, 0, 206, 1, 110, 255, 231, 1, 99, 255, 228, 254, 197, 255, 247, 1, 72, 255, 24, 0, 53, 0, 253, 255, 54, 0, 122, 0, 3, 1, 77, 1, 66, 0, 228, 1, 104, 0, 180, 1, 68, 0, 195, 0, 116, 0, 190, 0, 206, 0, 13, 1, 247, 255, 226, 1, 96, 1, 126, 1, 29, 1, 143, 1, 21, 1, 196, 1, 0, 1, 69, 0, 186, 0, 13, 0, 41, 1, 243, 255, 3, 1, 161, 255, 30, 0, 56, 0, 138, 1, 196, 0, 169, 1, 205, 0, 200, 1, 25, 1, 65, 2, 15, 0, 191, 0, 119, 1, 34, 1, 151, 1, 64, 2, 200, 255, 227, 0, 32, 2, 149, 1, 0, 0, 37, 2, 164, 255, 16, 2, 27, 255, 95, 1, 11, 255, 82, 1, 150, 254, 179, 1, 167, 0, 15, 2, 181, 255, 46, 1, 91, 0, 56, 3, 129, 0, 87, 2, 240, 1, 167, 2, 186, 0, 237, 2, 153, 0, 225, 2, 231, 254, 88, 2, 164, 254, 103, 2, 20, 255, 1, 3, 41, 0, 113, 3, 38, 0, 122, 3, 36, 255, 73, 3, 155, 254, 115, 3, 119, 254, 135, 3, 134, 253, 218, 1, 68, 254, 82, 3, 81, 255, 166, 2, 19, 254, 242, 0, 249, 253, 17, 3, 54, 253, 70, 2, 227, 253, 110, 1, 225, 253, 178, 1, 171, 253, 244, 1, 3, 253, 222, 0, 66, 253, 149, 3, 25, 253, 194, 3, 155, 252, 245, 1, 125, 252, 36, 2, 133, 254, 200, 0, 77, 254, 157, 0, 205, 252, 214, 0, 163, 252, 157, 0, 154, 253, 40, 0, 136, 253, 94, 0, 141, 252, 202, 255, 27, 253, 4, 2, 11, 254, 42, 1, 154, 253, 85, 255, 154, 252, 95, 255, 159, 252, 233, 255, 206, 252, 93, 0, 9, 252, 245, 254, 106, 253, 153, 254, 219, 253, 2, 0, 70, 254, 135, 255, 135, 254, 0, 0, 29, 255, 33, 0, 98, 254, 130, 255, 127, 255, 212, 0, 90, 252, 34, 0, 198, 251, 230, 254, 161, 251, 244, 254, 58, 253, 199, 252, 92, 254, 65, 255, 204, 251, 96, 252, 107, 252, 163, 255, 140, 253, 154, 254, 97, 0, 7, 0, 50, 255, 119, 254, 155, 255, 24, 0, 53, 255, 38, 0, 88, 255, 83, 0, 169, 253, 89, 254, 233, 254, 170, 1, 68, 253, 118, 0, 181, 255, 206, 0, 43, 252, 95, 253, 88, 253, 161, 1, 145, 254, 37, 0, 233, 254, 218, 1, 127, 255, 194, 254, 63, 1, 40, 1, 142, 253, 217, 255, 87, 1, 90, 2, 72, 253, 217, 255, 209, 254, 172, 3, 104, 0, 233, 0, 132, 254, 137, 0, 220, 255, 13, 1, 181, 255, 42, 255, 120, 0, 43, 0, 239, 253, 35, 254, 203, 1, 164, 0, 54, 255, 27, 255, 207, 255, 89, 255, 97, 2, 24, 3, 98, 0, 36, 255, 147, 3, 148, 0, 37, 1, 27, 1, 101, 3, 91, 0, 63, 2, 138, 1, 70, 1, 178, 255, 205, 2, 67, 0, 109, 1, 189, 254, 104, 2, 220, 255, 219, 2, 27, 0, 107, 2, 238, 0, 120, 2, 17, 1, 192, 1, 99, 0, 33, 3, 220, 1, 101, 3, 17, 1, 173, 2, 64, 0, 21, 3, 72, 0, 253, 3, 217, 0, 25, 3, 203, 1, 222, 2, 104, 1, 134, 2, 224, 1, 104, 1, 66, 1, 173, 1, 208, 1, 126, 2, 174, 1, 244, 2, 107, 1, 232, 3, 148, 1, 171, 2, 16, 2, 90, 2, 103, 2, 143, 2, 157, 1, 178, 3, 175, 2, 169, 3, 90, 2, 136, 3, 92, 2, 43, 2, 225, 2, 18, 3, 150, 2, 211, 1, 142, 2, 106, 1, 77, 2, 161, 3, 198, 2, 242, 1, 222, 1, 159, 1, 164, 1, 181, 2, 115, 3, 45, 3, 171, 2, 13, 3, 157, 3, 145, 3, 171, 3, 214, 2, 220, 2, 235, 1, 85, 3, 19, 2, 180, 3, 222, 2, 195, 3, 59, 1, 40, 3, 249, 2, 243, 2, 120, 4, 248, 2, 143, 2, 52, 4, 58, 3, 33, 4, 67, 4, 70, 3, 235, 3, 40, 3, 23, 4, 109, 4, 147, 2, 77, 4, 224, 3, 26, 4, 50, 4, 51, 4, 203, 3, 182, 2, 202, 4, 30, 4, 59, 2, 73, 3, 116, 3, 124, 5, 99, 5, 72, 4, 56, 4, 93, 3, 207, 4, 223, 2, 4, 5, 248, 2, 248, 4, 223, 3, 87, 5, 29, 4, 233, 4, 188, 2, 26, 4, 22, 2, 220, 3, 197, 1, 240, 4, 87, 2, 116, 4, 167, 2, 85, 6, 47, 3, 104, 5, 9, 2, 37, 5, 137, 1, 28, 6, 37, 3, 168, 5, 174, 2, 44, 4, 136, 2, 107, 3, 51, 1, 59, 4, 105, 1, 23, 4, 61, 1, 137, 5, 196, 3, 163, 2, 59, 2, 128, 4, 79, 0, 90, 4, 209, 255, 250, 5, 55, 1, 185, 6, 58, 1, 142, 4, 177, 2, 2, 2, 162, 255, 93, 1, 26, 1, 132, 5, 72, 1, 1, 4, 231, 1, 191, 255, 57, 0, 37, 3, 202, 3, 36, 0, 62, 0, 1, 3, 249, 254, 23, 3, 166, 254, 125, 2, 187, 2, 119, 255, 108, 2, 22, 2, 29, 2, 33, 253, 194, 0, 199, 2, 44, 1, 244, 254, 161, 252, 158, 3, 1, 3, 60, 253, 84, 254, 250, 1, 174, 0, 132, 252, 138, 253, 179, 1, 35, 2, 101, 250, 254, 254, 109, 2, 215, 1, 6, 252, 168, 250, 119, 254, 9, 2, 104, 252, 82, 253, 231, 255, 20, 0, 42, 252, 124, 251, 84, 1, 9, 0, 234, 249, 145, 251, 160, 254, 48, 0, 213, 249, 110, 254, 137, 252, 6, 0, 124, 251, 136, 252, 220, 253, 160, 254, 149, 249, 112, 251, 97, 255, 98, 2, 24, 248, 61, 252, 31, 255, 193, 0, 136, 249, 88, 248, 11, 255, 19, 254, 60, 252, 112, 249, 88, 252, 133, 253, 237, 250, 48, 249, 148, 250, 164, 253, 252, 249, 189, 252, 139, 250, 121, 255, 204, 249, 222, 254, 122, 249, 56, 253, 37, 248, 160, 249, 129, 249, 229, 255, 46, 247, 213, 252, 123, 251, 184, 0, 15, 251, 189, 0, 169, 250, 74, 2, 37, 248, 201, 0, 234, 252, 200, 2, 70, 251, 3, 0, 247, 251, 40, 3, 29, 251, 62, 3, 145, 255, 123, 2, 156, 249, 191, 1, 49, 254, 75, 252, 67, 254, 96, 252, 8, 254, 118, 251, 11, 254, 69, 251, 144, 0, 161, 254, 140, 254, 228, 251, 229, 254, 221, 251, 233, 254, 157, 251, 193, 253, 98, 250, 181, 253, 178, 249, 89, 252, 40, 252, 229, 0, 178, 2, 103, 252, 49, 253, 109, 254, 82, 5, 83, 253, 47, 254, 106, 3, 141, 1, 3, 254, 210, 255, 61, 1, 54, 5, 27, 254, 200, 1, 45, 3, 183, 1, 101, 254, 83, 1, 130, 3, 43, 4, 87, 254, 46, 0, 161, 5, 241, 1, 115, 252, 224, 252, 185, 5, 22, 4, 2, 255, 191, 254, 150, 5, 141, 4, 68, 0, 94, 1, 10, 4, 154, 2, 114, 1, 11, 0, 31, 5, 22, 3, 143, 0, 232, 0, 17, 4, 26, 6, 142, 255, 151, 2, 80, 6, 54, 4, 198, 1, 67, 2, 251, 4, 16, 4, 180, 255, 141, 3, 240, 2, 43, 4, 153, 0, 0, 2, 92, 1, 190, 4, 102, 2, 129, 1, 51, 7, 40, 3, 13, 1, 10, 4, 203, 0, 62, 4, 140, 2, 249, 3, 247, 6, 106, 4, 173, 1, 47, 5, 131, 1, 104, 5, 207, 255, 159, 4, 184, 255, 191, 4, 96, 254, 233, 3, 32, 2, 213, 6, 160, 254, 199, 4, 10, 254, 175, 4, 179, 253, 57, 2, 29, 255, 94, 6, 114, 255, 42, 6, 26, 255, 179, 6, 54, 253, 8, 5, 186, 252, 118, 5, 107, 4, 77, 5, 48, 255, 208, 4, 181, 1, 197, 3, 95, 252, 50, 3, 43, 3, 130, 5, 91, 3, 227, 5, 164, 0, 188, 4, 107, 5, 1, 7, 228, 1, 82, 7, 200, 1, 15, 8, 228, 3, 146, 4, 46, 5, 122, 5, 36, 5, 80, 5, 111, 4, 238, 4, 210, 4, 82, 6, 81, 5, 232, 6, 141, 5, 203, 4, 48, 6, 67, 5, 86, 3, 160, 2, 149, 6, 30, 6, 115, 4, 246, 4, 224, 7, 33, 7, 237, 6, 45, 6, 252, 5, 180, 5, 207, 5, 178, 3, 123, 6, 253, 3, 208, 6, 188, 4, 112, 5, 209, 3, 236, 6, 137, 4, 34, 7, 140, 4, 182, 6, 149, 5, 181, 7, 55, 6, 161, 4, 96, 3, 84, 8, 37, 4, 7, 7, 46, 3, 46, 7, 245, 2, 56, 8, 35, 5, 6, 8, 234, 4, 65, 8, 147, 3, 27, 9, 162, 3, 187, 5, 123, 4, 30, 10, 159, 5, 197, 8, 208, 6, 42, 8, 84, 6, 54, 9, 174, 5, 106, 10, 226, 5, 84, 7, 45, 7, 22, 8, 183, 7, 203, 6, 41, 6, 170, 2, 9, 5, 48, 6, 253, 7, 174, 5, 50, 8, 194, 9, 212, 7, 151, 10, 18, 8, 214, 2, 52, 6, 196, 10, 32, 9, 228, 0, 79, 3, 152, 9, 123, 6, 36, 0, 45, 1, 150, 7, 165, 7, 66, 254, 160, 255, 106, 8, 116, 5, 253, 5, 77, 4, 14, 0, 96, 2, 101, 252, 36, 253, 103, 5, 190, 7, 65, 5, 184, 3, 88, 253, 65, 1, 1, 5, 244, 4, 198, 249, 109, 1, 173, 3, 178, 3, 55, 249, 202, 252, 70, 9, 227, 10, 29, 7, 228, 10, 236, 248, 29, 247, 169, 248, 23, 246, 152, 249, 200, 248, 97, 249, 44, 248, 60, 251, 136, 248, 59, 251, 198, 247, 233, 249, 204, 249, 219, 249, 236, 249, 85, 251, 177, 249, 56, 251, 65, 249, 177, 250, 129, 251, 176, 249, 100, 248, 6, 251, 145, 250, 231, 250, 133, 250, 185, 249, 101, 251, 116, 249, 225, 250, 93, 250, 58, 250, 169, 250, 126, 252, 24, 251, 221, 251, 205, 250, 146, 251, 42, 252, 147, 251, 131, 251, 32, 250, 200, 251, 228, 250, 4, 252, 97, 251, 44, 252, 50, 250, 57, 252, 41, 250, 36, 252, 102, 252, 233, 251, 203, 251, 186, 252, 101, 251, 166, 252, 58, 251, 149, 251, 239, 251, 216, 251, 1, 253, 152, 252, 123, 251, 67, 253, 144, 252, 62, 253, 118, 252, 250, 252, 8, 252, 190, 253, 200, 251, 223, 252, 58, 250, 177, 253, 169, 251, 176, 253, 134, 251, 55, 253, 148, 250, 128, 253, 160, 250, 171, 253, 221, 251, 96, 254, 121, 252, 82, 253, 192, 252, 107, 253, 60, 253, 68, 254, 156, 252, 22, 254, 103, 252, 138, 254, 248, 252, 149, 253, 110, 251, 183, 253, 219, 253, 255, 252, 229, 252, 77, 254, 109, 253, 238, 253, 27, 253, 14, 254, 187, 252, 155, 254, 171, 253, 233, 254, 153, 252, 13, 255, 137, 252, 230, 254, 103, 253, 232, 254, 101, 253, 91, 255, 208, 253, 118, 254, 121, 252, 150, 254, 102, 254, 64, 254, 185, 253, 103, 254, 194, 253, 199, 254, 155, 254, 131, 253, 220, 253, 198, 253, 76, 254, 128, 252, 8, 254, 130, 254, 11, 253, 198, 255, 31, 254, 91, 255, 150, 253, 65, 255, 138, 254, 22, 255, 130, 254, 34, 255, 85, 253, 231, 255, 32, 254, 94, 254, 153, 254, 38, 253, 159, 254, 188, 254, 99, 255, 80, 254, 190, 254, 118, 254, 209, 254, 228, 254, 152, 255, 167, 253, 223, 254, 212, 253, 60, 255, 180, 253, 106, 255, 109, 253, 160, 253, 39, 254, 232, 255, 188, 255, 64, 254, 38, 254, 248, 255, 6, 254, 211, 255, 20, 253, 72, 255, 180, 252, 4, 255, 123, 252, 165, 255, 184, 253, 159, 255, 116, 253, 138, 0, 4, 253, 125, 255, 90, 253, 244, 255, 98, 253, 165, 0, 253, 254, 253, 255, 184, 252, 149, 255, 115, 252, 37, 0, 32, 252, 44, 0, 170, 252, 97, 254, 185, 252, 13, 0, 23, 252, 241, 254, 254, 251, 203, 254, 226, 252, 34, 254, 192, 252, 24, 254, 81, 252, 168, 0, 168, 251, 125, 254, 95, 251, 155, 255, 97, 251, 216, 255, 83, 252, 196, 254, 250, 251, 254, 252, 236, 251, 143, 253, 199, 251, 230, 253, 56, 251, 213, 254, 224, 250, 76, 254, 83, 251, 105, 253, 113, 251, 95, 255, 64, 251, 78, 253, 43, 251, 193, 252, 104, 250, 48, 253, 133, 250, 19, 254, 126, 252, 28, 253, 102, 252, 223, 252, 178, 251, 110, 254, 213, 249, 60, 252, 219, 251, 130, 253, 11, 251, 98, 250, 37, 250, 90, 252, 34, 250, 129, 252, 194, 249, 204, 253, 69, 249, 51, 253, 162, 253, 171, 253, 114, 251, 195, 251, 167, 250, 44, 254, 102, 248, 43, 250, 210, 248, 71, 252, 116, 248, 93, 252, 37, 250, 68, 255, 157, 249, 91, 254, 79, 250, 174, 254, 88, 250, 234, 255, 106, 248, 90, 254, 42, 248, 7, 255, 16, 254, 142, 255, 138, 248, 13, 253, 247, 250, 174, 0, 85, 250, 147, 255, 30, 254, 255, 254, 59, 251, 4, 254, 175, 249, 151, 0, 98, 249, 208, 0, 114, 253, 107, 0, 141, 249, 29, 0, 139, 251, 23, 1, 65, 251, 50, 1, 52, 251, 6, 254, 38, 253, 81, 255, 44, 251, 155, 255, 55, 252, 39, 2, 154, 252, 22, 1, 201, 252, 59, 1, 205, 253, 120, 1, 229, 251, 228, 0, 5, 254, 24, 1, 169, 253, 25, 1, 10, 253, 253, 0, 207, 254, 123, 1, 13, 253, 122, 255, 157, 253, 148, 2, 200, 252, 24, 2, 207, 252, 134, 2, 99, 254, 49, 0, 171, 254, 177, 0, 59, 254, 14, 2, 30, 254, 77, 2, 185, 255, 83, 1, 111, 253, 8, 1, 12, 255, 39, 1, 19, 255, 59, 1, 125, 254, 57, 2, 6, 254, 247, 255, 135, 254, 14, 0, 96, 255, 149, 2, 40, 255, 40, 0, 204, 254, 210, 255, 95, 0, 214, 0, 14, 255, 167, 0, 170, 255, 192, 0, 200, 255, 27, 0, 180, 255, 31, 0, 36, 0, 53, 1, 150, 255, 74, 255, 143, 255, 74, 0, 71, 254, 234, 255, 23, 0, 139, 0, 81, 0, 245, 255, 44, 0, 15, 0, 169, 255, 119, 255, 138, 255, 49, 255, 98, 255, 198, 255, 16, 1, 164, 255, 100, 255, 71, 254, 8, 0, 120, 255, 128, 0, 35, 255, 101, 0, 38, 255, 40, 0, 59, 255, 180, 255, 56, 254, 9, 0, 67, 254, 33, 0, 89, 254, 226, 0, 60, 0, 73, 0, 34, 255, 156, 0, 113, 254, 24, 1, 194, 254, 245, 0, 171, 254, 166, 0, 13, 254, 83, 1, 66, 255, 71, 1, 37, 255, 69, 1, 119, 255, 167, 255, 172, 253, 100, 0, 141, 253, 144, 0, 91, 253, 231, 1, 28, 0, 252, 0, 121, 254, 214, 0, 215, 255, 26, 1, 228, 255, 99, 0, 226, 254, 75, 1, 49, 0, 203, 1, 124, 254, 53, 2, 143, 254, 180, 1, 28, 0, 80, 1, 247, 255, 141, 1, 89, 255, 106, 2, 34, 0, 84, 2, 239, 255, 49, 2, 116, 255, 43, 1, 79, 0, 10, 2, 125, 0, 203, 0, 2, 0, 244, 0, 32, 1, 255, 0, 211, 0, 175, 0, 82, 0, 84, 2, 187, 0, 5, 2, 108, 0, 125, 1, 255, 0, 109, 1, 41, 1, 241, 1, 96, 1, 71, 1, 174, 255, 25, 0, 210, 0, 115, 1, 245, 0, 5, 1, 3, 0, 33, 2, 193, 1, 140, 0, 38, 1, 44, 0, 39, 1, 212, 0, 91, 1, 244, 0, 238, 1, 75, 1, 16, 2, 201, 0, 51, 1, 93, 1, 155, 1, 101, 2, 28, 1, 102, 2, 157, 1, 208, 1, 66, 1, 112, 2, 141, 1, 97, 0, 200, 0, 96, 255, 128, 1, 149, 0, 106, 1, 239, 1, 13, 2, 13, 1, 73, 2, 33, 0, 235, 1, 135, 255, 177, 1, 171, 1, 99, 2, 242, 1, 4, 2, 171, 0, 187, 1, 241, 1, 154, 2, 184, 1, 19, 1, 54, 2, 63, 2, 146, 0, 127, 2, 155, 0, 158, 2, 223, 255, 173, 0, 212, 0, 184, 2, 90, 255, 89, 2, 65, 255, 183, 2, 23, 254, 247, 1, 175, 0, 230, 2, 214, 0, 220, 1, 116, 1, 59, 4, 66, 2, 18, 2, 74, 2, 9, 3, 169, 1, 106, 3, 59, 1, 73, 3, 118, 1, 80, 3, 91, 255, 53, 2, 35, 0, 223, 3, 217, 255, 38, 4, 73, 1, 200, 2, 18, 3, 72, 3, 133, 2, 27, 3, 149, 2, 164, 2, 59, 2, 150, 3, 120, 2, 55, 4, 161, 2, 49, 3, 62, 1, 132, 1, 106, 3, 244, 3, 52, 2, 80, 3, 112, 3, 108, 2, 45, 2, 223, 1, 159, 2, 197, 1, 180, 2, 212, 1, 72, 3, 130, 2, 76, 3, 133, 2, 250, 1, 172, 1, 129, 3, 55, 2, 69, 3, 131, 1, 194, 3, 243, 1, 179, 2, 49, 2, 171, 3, 158, 3, 15, 3, 40, 1, 22, 3, 12, 1, 4, 4, 18, 2, 106, 3, 73, 1, 36, 2, 143, 0, 163, 2, 35, 1, 247, 1, 66, 0, 17, 4, 103, 1, 18, 3, 97, 0, 37, 3, 33, 0, 69, 3, 214, 1, 255, 1, 49, 0, 68, 4, 71, 1, 150, 4, 67, 1, 3, 0, 242, 0, 104, 3, 218, 1, 177, 2, 173, 1, 49, 5, 166, 2, 18, 4, 108, 2, 85, 4, 152, 2, 65, 1, 193, 0, 121, 3, 182, 3, 129, 4, 106, 3, 125, 3, 123, 2, 109, 3, 94, 3, 180, 3, 145, 3, 13, 5, 153, 2, 40, 5, 127, 2, 229, 3, 25, 3, 122, 5, 6, 4, 152, 4, 244, 3, 86, 4, 191, 3, 130, 5, 157, 3, 123, 5, 147, 3, 31, 2, 94, 3, 92, 4, 198, 4, 67, 3, 166, 4, 67, 3, 166, 4, 191, 3, 124, 4, 123, 4, 96, 5, 20, 5, 169, 4, 135, 5, 207, 4, 55, 5, 61, 5, 234, 2, 68, 4, 175, 6, 3, 5, 109, 5, 49, 4, 54, 5, 30, 6, 129, 4, 195, 5, 109, 6, 113, 4, 33, 7, 196, 4, 32, 4, 102, 5, 241, 5, 194, 6, 96, 6, 9, 6, 84, 6, 6, 6, 87, 3, 60, 6, 97, 3, 131, 6, 181, 2, 117, 3, 180, 6, 239, 5, 143, 4, 16, 5, 161, 8, 224, 6, 160, 7, 213, 5, 228, 7, 202, 5, 254, 5, 74, 7, 158, 6, 216, 7, 30, 6, 236, 2, 225, 6, 57, 3, 38, 1, 112, 5, 60, 4, 10, 8, 109, 2, 35, 5, 109, 1, 7, 5, 198, 0, 4, 4, 232, 1, 128, 5, 249, 0, 147, 1, 246, 3, 25, 6, 68, 1, 107, 1, 109, 6, 20, 4, 193, 0, 111, 1, 242, 7, 67, 7, 5, 255, 67, 2, 238, 2, 226, 3, 13, 255, 30, 0, 45, 5, 111, 3, 228, 255, 87, 255, 112, 2, 149, 3, 59, 254, 159, 0, 186, 0, 90, 5, 154, 253, 6, 0, 25, 2, 136, 1, 162, 255, 221, 254, 13, 3, 229, 0, 128, 255, 214, 254, 245, 0, 235, 1, 67, 253, 120, 253, 204, 3, 21, 3, 11, 254, 128, 253, 178, 0, 255, 0, 147, 254, 122, 254, 1, 255, 61, 1, 66, 252, 218, 254, 65, 255, 228, 0, 249, 252, 65, 254, 157, 0, 19, 255, 111, 253, 48, 253, 105, 254, 92, 0, 139, 255, 157, 253, 78, 1, 26, 255, 89, 253, 196, 251, 112, 255, 195, 254, 123, 252, 163, 252, 30, 253, 152, 254, 171, 255, 41, 253, 166, 255, 237, 252, 100, 0, 234, 255, 121, 254, 249, 254, 200, 255, 183, 255, 175, 254, 14, 253, 5, 0, 67, 255, 62, 253, 144, 253, 89, 0, 168, 254, 121, 255, 167, 251, 159, 254, 19, 255, 84, 253, 145, 251, 237, 254, 178, 251, 243, 254, 77, 251, 152, 0, 145, 0, 46, 253, 48, 251, 49, 0, 80, 0, 32, 251, 248, 252, 8, 255, 135, 1, 36, 253, 221, 253, 213, 1, 218, 0, 1, 255, 160, 252, 69, 0, 110, 1, 90, 255, 27, 254, 80, 253, 191, 0, 68, 251, 84, 251, 86, 255, 87, 255, 228, 250, 161, 249, 65, 1, 214, 1, 117, 250, 37, 251, 192, 255, 16, 1, 175, 250, 8, 255, 236, 1, 53, 2, 47, 253, 159, 253, 195, 0, 229, 1, 195, 253, 123, 255, 171, 1, 202, 0, 85, 255, 138, 255, 199, 0, 63, 2, 2, 0, 225, 255, 182, 2, 243, 2, 170, 250, 217, 255, 40, 2, 45, 2, 23, 254, 15, 1, 168, 2, 25, 2, 13, 0, 59, 254, 87, 3, 186, 3, 123, 255, 204, 255, 175, 255, 226, 2, 111, 251, 125, 2, 31, 4, 35, 4, 161, 255, 164, 2, 235, 4, 57, 4, 233, 1, 49, 1, 63, 254, 186, 3, 234, 253, 228, 3, 55, 252, 98, 3, 222, 251, 35, 4, 242, 250, 106, 2, 120, 250, 105, 2, 54, 254, 86, 5, 97, 255, 29, 7, 250, 252, 240, 253, 242, 255, 86, 4, 78, 251, 123, 252, 252, 252, 177, 1, 24, 251, 25, 251, 13, 252, 210, 254, 166, 253, 183, 253, 9, 253, 174, 249, 8, 253, 243, 249, 184, 252, 127, 248, 208, 252, 229, 253, 23, 249, 69, 247, 29, 255, 220, 255, 14, 248, 217, 248, 197, 247, 154, 251, 89, 246, 232, 248, 66, 250, 252, 0, 115, 245, 97, 254, 197, 253, 45, 254, 229, 5, 18, 6, 132, 8, 183, 7, 22, 9, 228, 7, 191, 248, 111, 249, 191, 248, 37, 249, 248, 247, 130, 251, 170, 247, 138, 249, 173, 249, 181, 251, 88, 249, 149, 251, 191, 250, 184, 249, 177, 250, 154, 249, 198, 250, 243, 250, 211, 250, 15, 251, 128, 249, 143, 249, 49, 250, 173, 252, 190, 250, 216, 248, 123, 250, 116, 247, 254, 250, 87, 253, 7, 249, 143, 249, 58, 252, 198, 251, 97, 251, 116, 249, 226, 251, 207, 251, 138, 251, 122, 251, 73, 251, 24, 253, 6, 251, 27, 252, 90, 252, 153, 250, 97, 252, 120, 250, 14, 252, 231, 250, 241, 252, 69, 252, 231, 251, 124, 252, 31, 252, 207, 252, 31, 253, 201, 252, 52, 252, 91, 251, 30, 253, 186, 251, 30, 253, 126, 251, 240, 252, 223, 252, 214, 252, 238, 252, 132, 252, 248, 253, 24, 252, 206, 252, 124, 253, 59, 252, 191, 253, 142, 252, 227, 253, 74, 253, 97, 253, 107, 252, 173, 253, 126, 253, 122, 253, 153, 253, 68, 252, 147, 253, 99, 252, 253, 253, 41, 253, 29, 254, 209, 252, 27, 254, 184, 252, 190, 253, 72, 254, 55, 253, 190, 253, 187, 254, 111, 253, 98, 253, 126, 254, 198, 253, 71, 254, 102, 253, 254, 253, 237, 252, 120, 254, 239, 253, 246, 253, 59, 254, 25, 254, 89, 254, 152, 253, 183, 253, 151, 253, 99, 255, 106, 253, 244, 254, 88, 253, 164, 254, 190, 254, 189, 254, 136, 253, 68, 254, 208, 254, 82, 254, 180, 254, 54, 254, 235, 254, 44, 254, 109, 253, 231, 252, 193, 254, 132, 253, 29, 255, 214, 253, 139, 254, 165, 254, 178, 254, 46, 255, 56, 254, 64, 255, 238, 253, 14, 255, 40, 255, 58, 255, 146, 254, 142, 254, 174, 254, 95, 255, 103, 254, 20, 253, 149, 255, 132, 254, 218, 254, 125, 253, 33, 255, 103, 253, 22, 255, 27, 253, 115, 255, 16, 254, 126, 255, 2, 254, 117, 255, 185, 254, 84, 255, 207, 254, 206, 254, 188, 253, 92, 255, 249, 254, 250, 254, 84, 255, 189, 255, 110, 254, 31, 0, 146, 254, 246, 255, 76, 254, 170, 255, 241, 253, 71, 0, 135, 254, 234, 255, 159, 253, 244, 255, 90, 253, 189, 255, 193, 254, 63, 0, 65, 255, 35, 0, 75, 255, 217, 255, 14, 255, 126, 0, 89, 255, 116, 255, 224, 253, 155, 0, 215, 254, 174, 0, 215, 254, 38, 0, 248, 255, 117, 0, 132, 254, 197, 0, 60, 254, 240, 0, 246, 253, 223, 0, 153, 255, 110, 0, 69, 255, 87, 0, 101, 255, 169, 0, 209, 255, 157, 0, 26, 0, 173, 255, 156, 255, 128, 0, 80, 0, 209, 0, 194, 255, 6, 0, 7, 0, 22, 0, 5, 0, 62, 1, 236, 255, 248, 0, 211, 255, 56, 255, 193, 255, 156, 0, 187, 255, 250, 0, 73, 255, 113, 1, 130, 255, 143, 255, 180, 255, 114, 255, 134, 255, 192, 255, 2, 255, 225, 255, 35, 0, 79, 255, 185, 255, 249, 255, 171, 0, 93, 0, 27, 0, 108, 0, 212, 0, 182, 254, 47, 255, 133, 255, 186, 255, 233, 254, 95, 0, 160, 255, 20, 0, 68, 255, 195, 255, 198, 254, 87, 0, 212, 254, 178, 255, 158, 254, 122, 255, 11, 0, 122, 0, 116, 255, 122, 0, 237, 254, 152, 0, 219, 254, 140, 0, 174, 255, 138, 0, 191, 254, 145, 255, 32, 254, 100, 255, 153, 254, 76, 0, 2, 255, 216, 255, 133, 253, 160, 255, 246, 253, 79, 0, 5, 254, 8, 0, 244, 254, 47, 1, 229, 253, 68, 0, 66, 254, 61, 0, 246, 253, 50, 1, 111, 0, 189, 0, 77, 254, 122, 0, 133, 254, 166, 0, 197, 253, 114, 254, 136, 253, 182, 255, 21, 253, 161, 255, 57, 254, 194, 0, 72, 252, 83, 0, 226, 252, 192, 0, 13, 253, 192, 0, 243, 252, 94, 255, 149, 253, 234, 0, 105, 253, 215, 254, 24, 254, 147, 255, 60, 252, 124, 255, 186, 252, 188, 255, 181, 252, 58, 0, 168, 251, 170, 255, 219, 252, 213, 254, 80, 252, 3, 255, 246, 252, 206, 255, 59, 252, 219, 253, 160, 254, 158, 255, 32, 252, 169, 254, 163, 251, 197, 254, 163, 251, 205, 254, 125, 251, 138, 254, 131, 253, 26, 255, 114, 251, 213, 255, 237, 250, 156, 255, 99, 252, 119, 254, 6, 251, 168, 253, 79, 253, 126, 255, 57, 250, 200, 254, 215, 250, 2, 255, 72, 250, 70, 254, 244, 250, 155, 253, 19, 251, 9, 254, 35, 250, 144, 254, 214, 250, 26, 0, 104, 250, 190, 255, 49, 249, 95, 255, 148, 249, 45, 254, 32, 249, 220, 253, 143, 250, 200, 253, 236, 249, 153, 252, 41, 250, 246, 251, 149, 250, 197, 253, 131, 248, 240, 253, 9, 249, 133, 255, 151, 248, 25, 255, 250, 247, 189, 254, 252, 247, 118, 252, 72, 248, 201, 253, 131, 248, 148, 253, 1, 248, 35, 252, 203, 251, 142, 254, 17, 248, 64, 253, 205, 246, 19, 253, 76, 245, 191, 251, 139, 248, 159, 0, 36, 248, 248, 0, 142, 253, 133, 255, 221, 246, 62, 252, 99, 253, 104, 254, 157, 250, 106, 251, 60, 254, 148, 254, 236, 251, 33, 253, 124, 255, 183, 0, 172, 249, 16, 253, 221, 253, 205, 254, 247, 252, 19, 251, 158, 255, 41, 0, 144, 252, 189, 251, 255, 254, 97, 0, 190, 249, 215, 248, 31, 0, 230, 255, 124, 253, 207, 253, 76, 255, 222, 253, 127, 254, 185, 251, 102, 254, 222, 252, 98, 254, 197, 252, 55, 254, 54, 252, 22, 254, 171, 251, 41, 255, 108, 252, 112, 255, 87, 252, 19, 254, 11, 251, 251, 253, 29, 250, 181, 0, 101, 0, 180, 254, 135, 252, 188, 252, 87, 252, 209, 253, 83, 254, 139, 253, 221, 253, 73, 255, 175, 254, 223, 253, 174, 255, 6, 255, 226, 254, 5, 0, 124, 255, 164, 254, 4, 255, 219, 254, 40, 254, 98, 255, 100, 0, 227, 255, 197, 0, 20, 255, 88, 254, 163, 252, 43, 255, 116, 255, 249, 255, 85, 254, 69, 254, 187, 0, 159, 255, 84, 253, 32, 253, 219, 254, 2, 1, 144, 254, 104, 255, 106, 255, 136, 1, 159, 253, 175, 0, 114, 255, 43, 1, 118, 255, 152, 0, 137, 255, 73, 1, 26, 254, 204, 255, 37, 1, 198, 0, 73, 255, 117, 0, 175, 0, 75, 1, 198, 255, 238, 254, 231, 0, 44, 1, 224, 254, 74, 1, 207, 254, 116, 1, 145, 255, 153, 1, 247, 255, 167, 1, 83, 0, 0, 1, 67, 0, 111, 1, 237, 255, 248, 0, 91, 0, 113, 0, 221, 255, 150, 1, 65, 255, 154, 0, 238, 0, 40, 1, 5, 0, 197, 0, 141, 0, 221, 0, 57, 1, 198, 0, 211, 0, 165, 1, 244, 0, 78, 1, 88, 0, 170, 1, 13, 255, 198, 1, 202, 0, 40, 2, 251, 255, 147, 1, 35, 1, 185, 0, 219, 0, 45, 1, 251, 0, 138, 0, 128, 0, 69, 0, 197, 0, 32, 1, 116, 255, 195, 255, 188, 0, 105, 1, 197, 0, 86, 2, 186, 1, 17, 1, 34, 1, 143, 0, 216, 1, 226, 1, 157, 0, 114, 1, 159, 1, 65, 1, 116, 1, 129, 1, 146, 1, 40, 2, 155, 0, 24, 0, 38, 2, 7, 1, 245, 255, 21, 0, 104, 1, 227, 0, 147, 0, 2, 255, 168, 1, 97, 0, 110, 1, 243, 255, 119, 1, 141, 0, 193, 1, 232, 0, 140, 1, 251, 1, 218, 1, 16, 1, 189, 2, 68, 1, 106, 1, 209, 255, 75, 2, 148, 0, 31, 2, 69, 0, 144, 1, 205, 255, 49, 2, 59, 0, 220, 0, 246, 255, 96, 1, 147, 0, 206, 0, 211, 0, 141, 2, 185, 0, 51, 2, 41, 1, 53, 2, 28, 1, 82, 2, 121, 0, 254, 2, 192, 0, 142, 1, 118, 0, 130, 2, 178, 1, 233, 0, 8, 1, 225, 1, 211, 1, 129, 0, 91, 255, 187, 2, 239, 0, 90, 0, 26, 0, 86, 1, 218, 1, 201, 255, 27, 0, 132, 1, 94, 0, 84, 255, 0, 0, 213, 2, 123, 1, 196, 255, 81, 1, 114, 1, 209, 1, 95, 0, 63, 1, 38, 3, 83, 2, 78, 0, 4, 1, 241, 1, 83, 3, 210, 0, 48, 2, 202, 1, 62, 2, 48, 254, 202, 0, 241, 1, 113, 2, 54, 255, 152, 0, 48, 0, 200, 2, 236, 255, 54, 2, 100, 0, 203, 2, 199, 1, 212, 1, 155, 1, 93, 2, 63, 1, 134, 2, 195, 0, 103, 2, 145, 1, 26, 2, 168, 2, 227, 2, 201, 0, 155, 2, 178, 1, 186, 3, 198, 1, 169, 1, 134, 2, 235, 1, 94, 2, 169, 2, 160, 1, 252, 1, 241, 1, 54, 3, 170, 1, 47, 3, 148, 2, 135, 2, 116, 2, 204, 2, 185, 2, 210, 1, 106, 2, 201, 1, 173, 2, 204, 1, 109, 1, 53, 1, 209, 2, 55, 2, 68, 3, 89, 2, 97, 2, 44, 1, 57, 3, 203, 1, 175, 3, 175, 2, 169, 2, 21, 2, 147, 3, 86, 2, 79, 2, 243, 0, 108, 3, 195, 1, 106, 3, 164, 1, 18, 3, 61, 1, 220, 2, 220, 0, 154, 3, 61, 1, 84, 4, 111, 1, 19, 2, 210, 1, 4, 4, 137, 2, 29, 4, 103, 2, 10, 4, 41, 2, 61, 3, 90, 2, 253, 3, 31, 3, 159, 3, 35, 3, 110, 3, 251, 2, 31, 3, 240, 1, 93, 5, 5, 3, 73, 2, 2, 3, 35, 3, 162, 3, 75, 4, 25, 3, 198, 4, 94, 3, 185, 4, 127, 3, 1, 4, 215, 2, 4, 3, 77, 3, 148, 4, 91, 4, 99, 3, 253, 3, 62, 3, 245, 3, 73, 3, 142, 3, 250, 1, 191, 2, 215, 4, 53, 4, 108, 2, 51, 3, 172, 4, 59, 4, 131, 4, 57, 4, 118, 4, 139, 3, 11, 6, 97, 4, 29, 5, 136, 2, 63, 5, 100, 2, 204, 5, 220, 3, 199, 5, 169, 3, 217, 3, 48, 5, 187, 3, 61, 5, 173, 1, 142, 3, 73, 3, 58, 5, 52, 2, 155, 4, 156, 1, 132, 4, 147, 5, 40, 5, 154, 5, 50, 5, 128, 2, 248, 2, 190, 6, 130, 5, 190, 0, 43, 2, 49, 4, 237, 3, 170, 1, 1, 1, 71, 3, 212, 3, 235, 0, 231, 0, 240, 5, 143, 4, 109, 0, 37, 1, 246, 3, 33, 6, 49, 1, 142, 0, 124, 4, 27, 2, 221, 254, 148, 255, 189, 4, 204, 3, 22, 0, 40, 255, 155, 2, 60, 3, 30, 254, 182, 1, 197, 1, 151, 5, 187, 253, 90, 254, 21, 3, 131, 1, 154, 254, 58, 254, 174, 0, 12, 3, 220, 255, 140, 254, 134, 1, 122, 255, 139, 253, 160, 0, 206, 254, 239, 2, 22, 251, 181, 254, 177, 0, 10, 2, 8, 255, 62, 2, 5, 255, 127, 2, 237, 253, 151, 1, 172, 253, 138, 1, 93, 254, 21, 3, 151, 253, 33, 3, 38, 252, 143, 1, 167, 252, 215, 2, 249, 255, 6, 2, 65, 253, 54, 1, 137, 251, 232, 255, 22, 252, 31, 1, 64, 252, 107, 1, 237, 250, 56, 1, 2, 250, 245, 0, 235, 249, 49, 1, 28, 0, 153, 0, 165, 252, 81, 255, 223, 255, 76, 1, 138, 250, 102, 255, 212, 0, 154, 1, 175, 253, 59, 255, 188, 251, 64, 253, 120, 252, 191, 255, 26, 1, 111, 1, 106, 252, 82, 253, 89, 1, 93, 0, 254, 254, 155, 254, 184, 2, 132, 2, 75, 253, 228, 255, 192, 1, 237, 1, 239, 254, 193, 0, 15, 2, 34, 2, 13, 255, 255, 253, 128, 1, 120, 255, 17, 1, 159, 254, 0, 2, 114, 255, 25, 2, 58, 255, 173, 3, 238, 2, 83, 0, 248, 0, 66, 2, 93, 3, 200, 255, 80, 2, 74, 3, 44, 0, 124, 3, 24, 0, 33, 0, 122, 3, 240, 255, 214, 3, 63, 3, 118, 5, 255, 5, 106, 7, 180, 6, 96, 5, 156, 7, 185, 5, 22, 252, 95, 252, 184, 251, 77, 251, 127, 253, 93, 252, 164, 253, 63, 252, 245, 252, 95, 253, 189, 252, 236, 252, 96, 254, 104, 253, 54, 254, 2, 253, 116, 253, 247, 253, 106, 253, 17, 254, 1, 252, 3, 254, 1, 252, 84, 254, 68, 254, 216, 253, 144, 254, 63, 254, 33, 254, 45, 255, 226, 251, 121, 252, 196, 254, 7, 255, 199, 253, 177, 253, 199, 253, 237, 254, 227, 253, 65, 255, 52, 253, 68, 255, 182, 252, 248, 254, 179, 254, 8, 255, 194, 254, 28, 255, 237, 254, 1, 0, 201, 253, 28, 255, 141, 255, 35, 255, 18, 255, 138, 254, 59, 255, 5, 254, 34, 255, 189, 253, 254, 254, 80, 254, 195, 255, 12, 255, 167, 254, 2, 0, 174, 254, 39, 0, 41, 255, 87, 255, 198, 255, 0, 0, 200, 255, 250, 255, 53, 255, 125, 255, 1, 0, 70, 255, 251, 255, 45, 255, 6, 0, 132, 254, 11, 0, 94, 254, 140, 255, 131, 0, 122, 255, 113, 0, 89, 0, 252, 255, 71, 0, 254, 255, 237, 255, 64, 255, 6, 1, 24, 0, 189, 0, 151, 0, 123, 255, 147, 255, 186, 0, 103, 255, 166, 0, 37, 255, 37, 0, 139, 0, 193, 0, 171, 0, 81, 1, 124, 0, 158, 0, 195, 255, 141, 0, 226, 0, 243, 255, 190, 0, 231, 0, 34, 0, 98, 1, 109, 0, 60, 1, 201, 0, 244, 0, 164, 0, 74, 1, 171, 255, 134, 1, 172, 255, 254, 0, 71, 1, 1, 1, 79, 1, 235, 1, 147, 0, 220, 1, 105, 0, 54, 0, 77, 0, 181, 1, 114, 1, 165, 1, 58, 1, 193, 1, 86, 1, 73, 1, 126, 0, 161, 2, 36, 1, 59, 2, 132, 1, 243, 0, 193, 0, 141, 2, 64, 1, 109, 2, 24, 1, 194, 0, 124, 1, 5, 2, 69, 2, 45, 0, 67, 1, 111, 0, 166, 1, 233, 1, 139, 1, 222, 2, 22, 2, 110, 2, 34, 2, 230, 1, 246, 1, 62, 1, 60, 2, 189, 0, 38, 2, 129, 1, 166, 1, 99, 255, 153, 0, 131, 255, 126, 1, 59, 255, 130, 1, 249, 254, 78, 1, 228, 0, 185, 2, 68, 255, 1, 0, 51, 0, 41, 1, 5, 254, 213, 0, 136, 254, 141, 1, 232, 255, 255, 0, 221, 253, 89, 0, 10, 254, 162, 255, 131, 1, 179, 0, 148, 253, 68, 0, 84, 253, 112, 0, 126, 253, 162, 254, 252, 254, 172, 0, 74, 254, 188, 254, 8, 1, 136, 2, 60, 252, 252, 255, 159, 251, 7, 0, 122, 255, 134, 0, 147, 251, 206, 254, 143, 0, 96, 0, 92, 254, 15, 254, 59, 251, 162, 254, 9, 250, 83, 253, 95, 255, 72, 0, 105, 3, 179, 2, 220, 2, 27, 1, 153, 3, 97, 1, 78, 1, 219, 1, 71, 4, 53, 3, 96, 3, 12, 2, 75, 3, 241, 1, 202, 2, 199, 2, 20, 3, 238, 2, 52, 4, 202, 2, 180, 4, 241, 2, 65, 2, 150, 2, 124, 245, 170, 192, 38, 3, 44, 7, 95, 251, 33, 228, 37, 12, 28, 4, 40, 248, 202, 208, 85, 16, 107, 5, 192, 249, 99, 218, 69, 9, 145, 5, 232, 249, 78, 219, 176, 12, 193, 7, 210, 251, 214, 230, 35, 7, 16, 9, 184, 252, 64, 236, 173, 3, 242, 12, 199, 254, 163, 248, 47, 9, 161, 11, 41, 254, 234, 244, 32, 14, 116, 9, 247, 252, 183, 237, 123, 13, 24, 12, 98, 254, 70, 246, 139, 11, 205, 16, 72, 0, 178, 1, 56, 7, 148, 17, 139, 0, 68, 3, 44, 15, 40, 21, 157, 1, 180, 9, 163, 4, 42, 28, 67, 3, 166, 19, 11, 12, 40, 35, 139, 4, 90, 27, 216, 28, 115, 3, 37, 247, 177, 202, 74, 23, 226, 5, 58, 250, 60, 221, 35, 20, 86, 8, 61, 252, 88, 233, 8, 31, 217, 7, 228, 251, 65, 231, 107, 25, 202, 8, 139, 252, 49, 235, 246, 29, 192, 10, 180, 253, 47, 242, 64, 23, 200, 11, 60, 254, 92, 245, 34, 19, 180, 14, 131, 255, 17, 253, 77, 27, 4, 14, 60, 255, 103, 251, 238, 31, 138, 15, 213, 255, 252, 254, 176, 23, 52, 17, 107, 0, 133, 2, 29, 30, 223, 19, 64, 1, 136, 7, 147, 21, 133, 23, 57, 2, 98, 13, 89, 30, 214, 27, 50, 3, 62, 19, 172, 23, 2, 31, 209, 3, 253, 22, 218, 21, 223, 44, 243, 5, 212, 35, 85, 41, 76, 5, 159, 249, 153, 217, 89, 35, 61, 6, 145, 250, 68, 223, 66, 38, 243, 7, 247, 251, 180, 231, 242, 34, 111, 9, 244, 252, 164, 237, 56, 40, 24, 10, 87, 253, 253, 239, 191, 36, 174, 10, 171, 253, 245, 241, 252, 33, 146, 12, 156, 254, 160, 247, 29, 38, 67, 13, 235, 254, 123, 249, 193, 39, 52, 15, 181, 255, 58, 254, 210, 35, 176, 17, 148, 0, 123, 3, 168, 39, 140, 19, 40, 1, 245, 6, 154, 35, 103, 22, 241, 1, 177, 11, 4, 41, 122, 24, 116, 2, 198, 14, 126, 39, 207, 29, 151, 3, 158, 21, 140, 34, 23, 34, 93, 4, 72, 26, 252, 34, 208, 48, 112, 6, 193, 38, 124, 50, 208, 3, 185, 247, 47, 206, 171, 44, 219, 6, 28, 251, 141, 226, 106, 47, 24, 9, 189, 252, 96, 236, 124, 44, 64, 9, 214, 252, 248, 236, 204, 41, 248, 11, 83, 254, 236, 245, 44, 48, 45, 11, 238, 253, 136, 243, 202, 45, 255, 12, 205, 254, 200, 248, 6, 44, 116, 14, 106, 255, 120, 252, 109, 42, 61, 17, 110, 0, 151, 2, 50, 47, 181, 17, 150, 0, 134, 3, 19, 44, 85, 20, 98, 1, 84, 8, 184, 46, 161, 24, 125, 2, 253, 14, 159, 43, 110, 29, 132, 3, 44, 21, 96, 47, 137, 32, 25, 4, 168, 24, 217, 42, 25, 42, 149, 5, 156, 33, 60, 40, 224, 67, 87, 8, 53, 50, 75, 54, 145, 6, 220, 250, 15, 225, 36, 49, 253, 7, 254, 251, 221, 231, 209, 51, 135, 9, 2, 253, 254, 237, 209, 54, 173, 11, 47, 254, 14, 245, 140, 52, 26, 12, 99, 254, 78, 246, 108, 48, 74, 14, 89, 255, 18, 252, 198, 52, 196, 14, 137, 255, 55, 253, 80, 50, 176, 16, 62, 0, 118, 1, 221, 52, 253, 18, 253, 0, 243, 5, 123, 49, 81, 21, 168, 1, 248, 9, 30, 54, 218, 23, 78, 2, 223, 13, 231, 50, 83, 25, 166, 2, 244, 15, 245, 52, 41, 30, 169, 3, 7, 22, 157, 50, 95, 36, 189, 4, 136, 28, 146, 53, 31, 45, 252, 5, 5, 36, 47, 49, 102, 59, 146, 7, 147, 45, 9, 59, 4, 6, 91, 250, 4, 222, 224, 58, 29, 9, 192, 252, 113, 236, 191, 56, 207, 9, 45, 253, 0, 239, 100, 57, 127, 12, 147, 254, 107, 247, 22, 60, 232, 13, 49, 255, 33, 251, 53, 55, 120, 15, 206, 255, 212, 254, 254, 58, 140, 16, 50, 0, 42, 1, 252, 55, 216, 18, 242, 0, 174, 5, 254, 57, 75, 21, 166, 1, 238, 9, 202, 59, 195, 23, 72, 2, 190, 13, 249, 55, 232, 26, 0, 3, 15, 18, 212, 58, 9, 30, 162, 3, 226, 21, 70, 56, 210, 36, 207, 4, 245, 28, 27, 60, 13, 38, 0, 5, 26, 30, 232, 57, 191, 55, 52, 7, 94, 43, 32, 53, 107, 97, 109, 10, 195, 62, 12, 64, 177, 7, 198, 251, 139, 230, 177, 65, 16, 11, 223, 253, 45, 243, 97, 61, 27, 11, 229, 253, 80, 243, 232, 62, 8, 13, 209, 254, 223, 248, 0, 64, 123, 15, 207, 255, 218, 254, 44, 66, 227, 17, 165, 0, 224, 3, 95, 61, 247, 17, 171, 0, 6, 4, 94, 63, 72, 21, 165, 1, 233, 9, 192, 65, 238, 24, 143, 2, 105, 15, 129, 61, 229, 27, 53, 3, 80, 19, 198, 63, 45, 29, 120, 3, 223, 20, 227, 64, 176, 33, 76, 4, 222, 25, 132, 66, 178, 40, 99, 5, 111, 32, 33, 62, 41, 46, 29, 6, 207, 36, 238, 65, 98, 57, 95, 7, 96, 44, 131, 64, 134, 81, 102, 9, 147, 56, 222, 70, 35, 8, 25, 252, 131, 232, 201, 75, 106, 12, 137, 254, 47, 247, 100, 68, 98, 13, 248, 254, 203, 249, 86, 78, 187, 15, 231, 255, 105, 255, 149, 70, 153, 16, 54, 0, 70, 1, 8, 74, 202, 19, 58, 1, 98, 7, 47, 69, 26, 21, 153, 1, 157, 9, 123, 77, 48, 24, 98, 2, 92, 14, 30, 70, 102, 27, 27, 3, 176, 18, 70, 83, 197, 30, 198, 3, 184, 22, 246, 69, 73, 36, 186, 4, 115, 28, 200, 74, 74, 36, 186, 4, 116, 28, 37, 80, 117, 44, 230, 5, 129, 35, 155, 70, 149, 56, 74, 7, 226, 43, 31, 78, 218, 69, 129, 8, 52, 51, 154, 73, 252, 127, 0, 12, 62, 72, 61, 42, 81, 112, 63, 11, 181, 67, 0, 80, 225, 10, 198, 253, 153, 242, 153, 73, 194, 25, 191, 2, 139, 16, 81, 24, 245, 28, 108, 3, 156, 20, 51, 67, 204, 40, 103, 5, 133, 32, 122, 84, 245, 4, 61, 249, 74, 215, 143, 82, 71, 17, 113, 0, 171, 2, 40, 44, 20, 6, 106, 250, 95, 222, 61, 74, 20, 50, 150, 6, 164, 39, 215, 67, 194, 9, 37, 253, 210, 238, 194, 69, 225, 18, 244, 0, 192, 5, 10, 39, 194, 9, 37, 253, 210, 238, 122, 68, 184, 30, 196, 3, 170, 22, 174, 55, 92, 7, 133, 251, 5, 229, 20, 62, 81, 12, 125, 254, 233, 246, 61, 26, 10, 7, 67, 251, 121, 227, 10, 71, 225, 78, 53, 9, 109, 55, 102, 70, 215, 11, 67, 254, 138, 245, 71, 65, 225, 22, 16, 2, 109, 12, 143, 34, 174, 15, 226, 255, 76, 255, 20, 62, 10, 35, 134, 4, 60, 27, 102, 70, 112, 5, 198, 249, 129, 218, 71, 65, 0, 16, 0, 0, 0, 0, 0, 32, 143, 2, 108, 245, 79, 192, 133, 59, 102, 54, 16, 7, 132, 42, 174, 55, 40, 12, 106, 254, 116, 246, 10, 55, 61, 18, 193, 0, 141, 4, 30, 21, 143, 10, 154, 253, 143, 241, 122, 52, 153, 25, 182, 2, 84, 16, 163, 48, 133, 3, 67, 247, 100, 203, 163, 48, 102, 10, 131, 253, 7, 241, 184, 14, 143, 2, 108, 245, 79, 192, 153, 57, 215, 91, 22, 10, 183, 60, 225, 74, 153, 9, 13, 253, 62, 238, 184, 78, 215, 19, 62, 1, 121, 7, 225, 26, 0, 16, 0, 0, 0, 0, 0, 80, 112, 33, 65, 4, 156, 25, 204, 76, 225, 2, 26, 246, 105, 196, 61, 74, 163, 16, 58, 0, 91, 1, 184, 30, 40, 8, 29, 252, 151, 232, 204, 44, 0, 48, 87, 6, 43, 38, 20, 62, 194, 5, 26, 250, 126, 220, 112, 61, 20, 18, 180, 0, 62, 4, 215, 35, 153, 5, 240, 249, 131, 219, 184, 62, 92, 27, 25, 3, 164, 18, 235, 57, 225, 2, 26, 246, 105, 196, 225, 58, 204, 8, 140, 252, 55, 235, 215, 19, 204, 4, 12, 249, 38, 214, 215, 51, 174, 67, 83, 8, 27, 50, 163, 64, 30, 9, 193, 252, 118, 236, 225, 58, 184, 22, 6, 2, 46, 12, 92, 15, 102, 14, 100, 255, 86, 252, 174, 55, 153, 33, 72, 4, 198, 25, 235, 65, 10, 3, 106, 246, 74, 198, 225, 58, 225, 14, 149, 255, 122, 253, 174, 23, 102, 2, 12, 245, 17, 190, 122, 36, 40, 36, 180, 4, 83, 28, 215, 51, 225, 6, 33, 251, 172, 226, 215, 51, 194, 13, 33, 255, 193, 250, 153, 9, 174, 7, 196, 251, 127, 230, 204, 44, 153, 21, 187, 1, 108, 10, 245, 40, 225, 2, 26, 246, 105, 196, 112, 45, 122, 12, 145, 254, 92, 247, 194, 5, 10, 3, 106, 246, 74, 198, 0, 64, 248, 65, 226, 67, 190, 69, 142, 71, 82, 73, 12, 75, 188, 76, 98, 78, 0, 80, 150, 81, 35, 83, 170, 84, 42, 86, 163, 87, 22, 89, 130, 90, 234, 91, 76, 93, 168, 94, 0, 96, 83, 97, 161, 98, 236, 99, 49, 101, 115, 102, 177, 103, 235, 104, 34, 106, 85, 107, 132, 108, 177, 109, 218, 110, 0, 112, 35, 113, 67, 114, 97, 115, 123, 116, 147, 117, 169, 118, 188, 119, 204, 120, 218, 121, 230, 122, 239, 123, 247, 124, 252, 125, 255, 126, 255, 127, 255, 127, 61, 10, 63, 10, 69, 10, 78, 10, 91, 10, 108, 10, 129, 10, 153, 10, 181, 10, 212, 10, 248, 10, 31, 11, 74, 11, 120, 11, 170, 11, 224, 11, 25, 12, 86, 12, 151, 12, 219, 12, 35, 13, 110, 13, 189, 13, 15, 14, 101, 14, 190, 14, 27, 15, 123, 15, 223, 15, 70, 16, 176, 16, 30, 17, 143, 17, 3, 18, 123, 18, 245, 18, 115, 19, 244, 19, 120, 20, 0, 21, 138, 21, 23, 22, 168, 22, 59, 23, 209, 23, 106, 24, 6, 25, 165, 25, 70, 26, 234, 26, 145, 27, 59, 28, 231, 28, 149, 29, 70, 30, 250, 30, 176, 31, 104, 32, 35, 33, 224, 33, 159, 34, 97, 35, 36, 36, 234, 36, 178, 37, 124, 38, 71, 39, 21, 40, 228, 40, 181, 41, 136, 42, 93, 43, 51, 44, 11, 45, 228, 45, 191, 46, 155, 47, 121, 48, 88, 49, 56, 50, 26, 51, 252, 51, 224, 52, 196, 53, 170, 54, 145, 55, 120, 56, 96, 57, 73, 58, 51, 59, 29, 60, 8, 61, 243, 61, 223, 62, 203, 63, 184, 64, 165, 65, 146, 66, 127, 67, 108, 68, 90, 69, 71, 70, 52, 71, 33, 72, 14, 73, 251, 73, 231, 74, 211, 75, 191, 76, 170, 77, 149, 78, 126, 79, 104, 80, 80, 81, 56, 82, 31, 83, 5, 84, 234, 84, 207, 85, 178, 86, 148, 87, 116, 88, 84, 89, 50, 90, 15, 91, 235, 91, 197, 92, 157, 93, 117, 94, 74, 95, 30, 96, 240, 96, 192, 97, 143, 98, 91, 99, 38, 100, 239, 100, 181, 101, 122, 102, 60, 103, 253, 103, 187, 104, 119, 105, 48, 106, 232, 106, 156, 107, 79, 108, 255, 108, 172, 109, 87, 110, 255, 110, 165, 111, 71, 112, 231, 112, 133, 113, 31, 114, 183, 114, 75, 115, 221, 115, 108, 116, 248, 116, 129, 117, 6, 118, 137, 118, 8, 119, 133, 119, 254, 119, 116, 120, 230, 120, 86, 121, 194, 121, 42, 122, 144, 122, 242, 122, 80, 123, 171, 123, 3, 124, 87, 124, 167, 124, 244, 124, 62, 125, 132, 125, 198, 125, 5, 126, 64, 126, 120, 126, 172, 126, 220, 126, 9, 127, 49, 127, 87, 127, 120, 127, 150, 127, 176, 127, 199, 127, 217, 127, 232, 127, 243, 127, 251, 127, 255, 127, 255, 127, 229, 127, 153, 127, 25, 127, 103, 126, 129, 125], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE + 20480);
  allocate([106, 124, 33, 123, 167, 121, 252, 119, 34, 118, 24, 116, 223, 113, 122, 111, 231, 108, 41, 106, 65, 103, 47, 100, 245, 96, 149, 93, 15, 90, 101, 86, 153, 82, 171, 78, 158, 74, 116, 70, 45, 66, 204, 61, 82, 57, 193, 52, 27, 48, 98, 43, 151, 38, 189, 33, 213, 28, 226, 23, 230, 18, 226, 13, 216, 8, 203, 3, 61, 10, 64, 10, 73, 10, 88, 10, 108, 10, 135, 10, 167, 10, 205, 10, 249, 10, 43, 11, 99, 11, 160, 11, 227, 11, 44, 12, 122, 12, 207, 12, 40, 13, 136, 13, 237, 13, 87, 14, 199, 14, 60, 15, 183, 15, 55, 16, 189, 16, 71, 17, 215, 17, 108, 18, 6, 19, 165, 19, 73, 20, 242, 20, 159, 21, 82, 22, 9, 23, 196, 23, 133, 24, 73, 25, 18, 26, 224, 26, 177, 27, 135, 28, 97, 29, 62, 30, 32, 31, 5, 32, 238, 32, 219, 33, 203, 34, 191, 35, 182, 36, 176, 37, 174, 38, 174, 39, 177, 40, 184, 41, 193, 42, 204, 43, 218, 44, 235, 45, 254, 46, 19, 48, 42, 49, 67, 50, 94, 51, 123, 52, 154, 53, 186, 54, 219, 55, 254, 56, 34, 58, 71, 59, 109, 60, 148, 61, 188, 62, 228, 63, 13, 65, 54, 66, 96, 67, 138, 68, 180, 69, 221, 70, 7, 72, 48, 73, 89, 74, 130, 75, 169, 76, 208, 77, 246, 78, 27, 80, 63, 81, 98, 82, 132, 83, 164, 84, 194, 85, 223, 86, 250, 87, 19, 89, 43, 90, 64, 91, 83, 92, 99, 93, 113, 94, 125, 95, 134, 96, 140, 97, 143, 98, 144, 99, 141, 100, 135, 101, 126, 102, 114, 103, 98, 104, 79, 105, 56, 106, 30, 107, 255, 107, 221, 108, 183, 109, 140, 110, 94, 111, 43, 112, 244, 112, 185, 113, 121, 114, 53, 115, 236, 115, 158, 116, 76, 117, 245, 117, 153, 118, 55, 119, 209, 119, 102, 120, 246, 120, 129, 121, 6, 122, 134, 122, 1, 123, 118, 123, 230, 123, 81, 124, 182, 124, 21, 125, 111, 125, 195, 125, 17, 126, 90, 126, 157, 126, 219, 126, 18, 127, 68, 127, 112, 127, 150, 127, 183, 127, 209, 127, 230, 127, 244, 127, 253, 127, 255, 127, 255, 127, 244, 127, 208, 127, 149, 127, 66, 127, 215, 126, 85, 126, 188, 125, 12, 125, 69, 124, 104, 123, 117, 122, 108, 121, 78, 120, 28, 119, 213, 117, 122, 116, 13, 115, 140, 113, 250, 111, 87, 110, 162, 108, 222, 106, 11, 105, 40, 103, 57, 101, 60, 99, 51, 97, 30, 95, 255, 92, 215, 90, 165, 88, 108, 86, 44, 84, 229, 81, 154, 79, 74, 77, 247, 74, 161, 72, 74, 70, 243, 67, 156, 65, 71, 63, 244, 60, 164, 58, 88, 56, 18, 54, 209, 51, 152, 49, 103, 47, 62, 45, 31, 43, 11, 41, 2, 39, 5, 37, 21, 35, 51, 33, 95, 31, 155, 29, 231, 27, 67, 26, 177, 24, 49, 23, 195, 21, 105, 20, 34, 19, 239, 17, 209, 16, 201, 15, 214, 14, 249, 13, 50, 13, 130, 12, 232, 11, 102, 11, 252, 10, 169, 10, 109, 10, 73, 10, 61, 10, 61, 10, 63, 10, 67, 10, 74, 10, 84, 10, 96, 10, 111, 10, 129, 10, 150, 10, 174, 10, 200, 10, 229, 10, 5, 11, 39, 11, 77, 11, 117, 11, 159, 11, 205, 11, 253, 11, 48, 12, 101, 12, 157, 12, 216, 12, 22, 13, 86, 13, 153, 13, 222, 13, 38, 14, 113, 14, 190, 14, 13, 15, 96, 15, 181, 15, 12, 16, 102, 16, 194, 16, 33, 17, 130, 17, 230, 17, 76, 18, 180, 18, 31, 19, 140, 19, 252, 19, 110, 20, 226, 20, 88, 21, 209, 21, 76, 22, 201, 22, 72, 23, 202, 23, 77, 24, 211, 24, 91, 25, 229, 25, 113, 26, 254, 26, 142, 27, 32, 28, 180, 28, 74, 29, 225, 29, 123, 30, 22, 31, 179, 31, 82, 32, 242, 32, 149, 33, 57, 34, 222, 34, 133, 35, 46, 36, 216, 36, 132, 37, 50, 38, 224, 38, 145, 39, 66, 40, 245, 40, 169, 41, 95, 42, 22, 43, 206, 43, 135, 44, 66, 45, 253, 45, 186, 46, 120, 47, 54, 48, 246, 48, 183, 49, 120, 50, 59, 51, 254, 51, 194, 52, 135, 53, 77, 54, 19, 55, 218, 55, 161, 56, 106, 57, 50, 58, 252, 58, 197, 59, 144, 60, 90, 61, 37, 62, 240, 62, 188, 63, 136, 64, 84, 65, 32, 66, 236, 66, 185, 67, 133, 68, 82, 69, 30, 70, 235, 70, 183, 71, 132, 72, 80, 73, 28, 74, 231, 74, 179, 75, 126, 76, 73, 77, 19, 78, 221, 78, 166, 79, 111, 80, 56, 81, 0, 82, 199, 82, 142, 83, 84, 84, 25, 85, 221, 85, 161, 86, 100, 87, 38, 88, 231, 88, 167, 89, 103, 90, 37, 91, 226, 91, 158, 92, 89, 93, 19, 94, 204, 94, 131, 95, 57, 96, 238, 96, 162, 97, 84, 98, 5, 99, 181, 99, 99, 100, 15, 101, 186, 101, 100, 102, 12, 103, 178, 103, 87, 104, 250, 104, 155, 105, 59, 106, 217, 106, 117, 107, 16, 108, 168, 108, 63, 109, 211, 109, 102, 110, 247, 110, 134, 111, 19, 112, 158, 112, 39, 113, 174, 113, 50, 114, 181, 114, 53, 115, 179, 115, 47, 116, 169, 116, 33, 117, 150, 117, 9, 118, 122, 118, 232, 118, 84, 119, 190, 119, 37, 120, 138, 120, 236, 120, 76, 121, 170, 121, 5, 122, 94, 122, 180, 122, 7, 123, 88, 123, 167, 123, 242, 123, 60, 124, 130, 124, 198, 124, 8, 125, 71, 125, 131, 125, 188, 125, 243, 125, 39, 126, 89, 126, 136, 126, 180, 126, 221, 126, 4, 127, 40, 127, 73, 127, 103, 127, 131, 127, 156, 127, 178, 127, 197, 127, 214, 127, 228, 127, 239, 127, 247, 127, 253, 127, 255, 127, 255, 127, 97, 125, 160, 117, 15, 105, 48, 88, 181, 67, 116, 44, 98, 19, 68, 101, 99, 111, 100, 101, 114, 0, 101, 110, 99, 111, 100, 101, 114, 0], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE + 30720);
  var tempDoublePtr = Runtime.alignMemory(allocate(12, "i8", ALLOC_STATIC), 8);
  assert(tempDoublePtr % 8 == 0);
  function _sbrk(bytes) {
    var self = _sbrk;
    if (!self.called) {
      DYNAMICTOP = alignMemoryPage(DYNAMICTOP);
      self.called = true;
      assert(Runtime.dynamicAlloc);
      self.alloc = Runtime.dynamicAlloc;
      Runtime.dynamicAlloc = function() {
        abort("cannot dynamically allocate, sbrk now has control");
      };
    }
    var ret = DYNAMICTOP;
    if (bytes != 0) {
      var success = self.alloc(bytes);
      if (!success)
        return -1 >>> 0;
    }
    return ret;
  }
  function ___setErrNo(value) {
    if (Module["___errno_location"])
      HEAP32[Module["___errno_location"]() >> 2] = value;
    return value;
  }
  var ERRNO_CODES = { EPERM: 1, ENOENT: 2, ESRCH: 3, EINTR: 4, EIO: 5, ENXIO: 6, E2BIG: 7, ENOEXEC: 8, EBADF: 9, ECHILD: 10, EAGAIN: 11, EWOULDBLOCK: 11, ENOMEM: 12, EACCES: 13, EFAULT: 14, ENOTBLK: 15, EBUSY: 16, EEXIST: 17, EXDEV: 18, ENODEV: 19, ENOTDIR: 20, EISDIR: 21, EINVAL: 22, ENFILE: 23, EMFILE: 24, ENOTTY: 25, ETXTBSY: 26, EFBIG: 27, ENOSPC: 28, ESPIPE: 29, EROFS: 30, EMLINK: 31, EPIPE: 32, EDOM: 33, ERANGE: 34, ENOMSG: 42, EIDRM: 43, ECHRNG: 44, EL2NSYNC: 45, EL3HLT: 46, EL3RST: 47, ELNRNG: 48, EUNATCH: 49, ENOCSI: 50, EL2HLT: 51, EDEADLK: 35, ENOLCK: 37, EBADE: 52, EBADR: 53, EXFULL: 54, ENOANO: 55, EBADRQC: 56, EBADSLT: 57, EDEADLOCK: 35, EBFONT: 59, ENOSTR: 60, ENODATA: 61, ETIME: 62, ENOSR: 63, ENONET: 64, ENOPKG: 65, EREMOTE: 66, ENOLINK: 67, EADV: 68, ESRMNT: 69, ECOMM: 70, EPROTO: 71, EMULTIHOP: 72, EDOTDOT: 73, EBADMSG: 74, ENOTUNIQ: 76, EBADFD: 77, EREMCHG: 78, ELIBACC: 79, ELIBBAD: 80, ELIBSCN: 81, ELIBMAX: 82, ELIBEXEC: 83, ENOSYS: 38, ENOTEMPTY: 39, ENAMETOOLONG: 36, ELOOP: 40, EOPNOTSUPP: 95, EPFNOSUPPORT: 96, ECONNRESET: 104, ENOBUFS: 105, EAFNOSUPPORT: 97, EPROTOTYPE: 91, ENOTSOCK: 88, ENOPROTOOPT: 92, ESHUTDOWN: 108, ECONNREFUSED: 111, EADDRINUSE: 98, ECONNABORTED: 103, ENETUNREACH: 101, ENETDOWN: 100, ETIMEDOUT: 110, EHOSTDOWN: 112, EHOSTUNREACH: 113, EINPROGRESS: 115, EALREADY: 114, EDESTADDRREQ: 89, EMSGSIZE: 90, EPROTONOSUPPORT: 93, ESOCKTNOSUPPORT: 94, EADDRNOTAVAIL: 99, ENETRESET: 102, EISCONN: 106, ENOTCONN: 107, ETOOMANYREFS: 109, EUSERS: 87, EDQUOT: 122, ESTALE: 116, ENOTSUP: 95, ENOMEDIUM: 123, EILSEQ: 84, EOVERFLOW: 75, ECANCELED: 125, ENOTRECOVERABLE: 131, EOWNERDEAD: 130, ESTRPIPE: 86 };
  function _sysconf(name) {
    switch (name) {
      case 30:
        return PAGE_SIZE;
      case 85:
        return totalMemory / PAGE_SIZE;
      case 132:
      case 133:
      case 12:
      case 137:
      case 138:
      case 15:
      case 235:
      case 16:
      case 17:
      case 18:
      case 19:
      case 20:
      case 149:
      case 13:
      case 10:
      case 236:
      case 153:
      case 9:
      case 21:
      case 22:
      case 159:
      case 154:
      case 14:
      case 77:
      case 78:
      case 139:
      case 80:
      case 81:
      case 82:
      case 68:
      case 67:
      case 164:
      case 11:
      case 29:
      case 47:
      case 48:
      case 95:
      case 52:
      case 51:
      case 46:
        return 200809;
      case 79:
        return 0;
      case 27:
      case 246:
      case 127:
      case 128:
      case 23:
      case 24:
      case 160:
      case 161:
      case 181:
      case 182:
      case 242:
      case 183:
      case 184:
      case 243:
      case 244:
      case 245:
      case 165:
      case 178:
      case 179:
      case 49:
      case 50:
      case 168:
      case 169:
      case 175:
      case 170:
      case 171:
      case 172:
      case 97:
      case 76:
      case 32:
      case 173:
      case 35:
        return -1;
      case 176:
      case 177:
      case 7:
      case 155:
      case 8:
      case 157:
      case 125:
      case 126:
      case 92:
      case 93:
      case 129:
      case 130:
      case 131:
      case 94:
      case 91:
        return 1;
      case 74:
      case 60:
      case 69:
      case 70:
      case 4:
        return 1024;
      case 31:
      case 42:
      case 72:
        return 32;
      case 87:
      case 26:
      case 33:
        return 2147483647;
      case 34:
      case 1:
        return 47839;
      case 38:
      case 36:
        return 99;
      case 43:
      case 37:
        return 2048;
      case 0:
        return 2097152;
      case 3:
        return 65536;
      case 28:
        return 32768;
      case 44:
        return 32767;
      case 75:
        return 16384;
      case 39:
        return 1e3;
      case 89:
        return 700;
      case 71:
        return 256;
      case 40:
        return 255;
      case 2:
        return 100;
      case 180:
        return 64;
      case 25:
        return 20;
      case 5:
        return 16;
      case 6:
        return 6;
      case 73:
        return 4;
      case 84: {
        if (typeof navigator === "object")
          return navigator["hardwareConcurrency"] || 1;
        return 1;
      }
    }
    ___setErrNo(ERRNO_CODES.EINVAL);
    return -1;
  }
  function _emscripten_memcpy_big(dest, src, num) {
    HEAPU8.set(HEAPU8.subarray(src, src + num), dest);
    return dest;
  }
  Module["_memcpy"] = _memcpy;
  Module["_memmove"] = _memmove;
  Module["_memset"] = _memset;
  function _abort() {
    Module["abort"]();
  }
  var ERRNO_MESSAGES = { 0: "Success", 1: "Not super-user", 2: "No such file or directory", 3: "No such process", 4: "Interrupted system call", 5: "I/O error", 6: "No such device or address", 7: "Arg list too long", 8: "Exec format error", 9: "Bad file number", 10: "No children", 11: "No more processes", 12: "Not enough core", 13: "Permission denied", 14: "Bad address", 15: "Block device required", 16: "Mount device busy", 17: "File exists", 18: "Cross-device link", 19: "No such device", 20: "Not a directory", 21: "Is a directory", 22: "Invalid argument", 23: "Too many open files in system", 24: "Too many open files", 25: "Not a typewriter", 26: "Text file busy", 27: "File too large", 28: "No space left on device", 29: "Illegal seek", 30: "Read only file system", 31: "Too many links", 32: "Broken pipe", 33: "Math arg out of domain of func", 34: "Math result not representable", 35: "File locking deadlock error", 36: "File or path name too long", 37: "No record locks available", 38: "Function not implemented", 39: "Directory not empty", 40: "Too many symbolic links", 42: "No message of desired type", 43: "Identifier removed", 44: "Channel number out of range", 45: "Level 2 not synchronized", 46: "Level 3 halted", 47: "Level 3 reset", 48: "Link number out of range", 49: "Protocol driver not attached", 50: "No CSI structure available", 51: "Level 2 halted", 52: "Invalid exchange", 53: "Invalid request descriptor", 54: "Exchange full", 55: "No anode", 56: "Invalid request code", 57: "Invalid slot", 59: "Bad font file fmt", 60: "Device not a stream", 61: "No data (for no delay io)", 62: "Timer expired", 63: "Out of streams resources", 64: "Machine is not on the network", 65: "Package not installed", 66: "The object is remote", 67: "The link has been severed", 68: "Advertise error", 69: "Srmount error", 70: "Communication error on send", 71: "Protocol error", 72: "Multihop attempted", 73: "Cross mount point (not really error)", 74: "Trying to read unreadable message", 75: "Value too large for defined data type", 76: "Given log. name not unique", 77: "f.d. invalid for this operation", 78: "Remote address changed", 79: "Can   access a needed shared lib", 80: "Accessing a corrupted shared lib", 81: ".lib section in a.out corrupted", 82: "Attempting to link in too many libs", 83: "Attempting to exec a shared library", 84: "Illegal byte sequence", 86: "Streams pipe error", 87: "Too many users", 88: "Socket operation on non-socket", 89: "Destination address required", 90: "Message too long", 91: "Protocol wrong type for socket", 92: "Protocol not available", 93: "Unknown protocol", 94: "Socket type not supported", 95: "Not supported", 96: "Protocol family not supported", 97: "Address family not supported by protocol family", 98: "Address already in use", 99: "Address not available", 100: "Network interface is not configured", 101: "Network is unreachable", 102: "Connection reset by network", 103: "Connection aborted", 104: "Connection reset by peer", 105: "No buffer space available", 106: "Socket is already connected", 107: "Socket is not connected", 108: "Can't send after socket shutdown", 109: "Too many references", 110: "Connection timed out", 111: "Connection refused", 112: "Host is down", 113: "Host is unreachable", 114: "Socket already connected", 115: "Connection already in progress", 116: "Stale file handle", 122: "Quota exceeded", 123: "No medium (in tape drive)", 125: "Operation canceled", 130: "Previous owner died", 131: "State not recoverable" };
  var TTY = { ttys: [], init: function() {
  }, shutdown: function() {
  }, register: function(dev, ops) {
    TTY.ttys[dev] = { input: [], output: [], ops };
    FS.registerDevice(dev, TTY.stream_ops);
  }, stream_ops: { open: function(stream) {
    var tty = TTY.ttys[stream.node.rdev];
    if (!tty) {
      throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
    }
    stream.tty = tty;
    stream.seekable = false;
  }, close: function(stream) {
    stream.tty.ops.flush(stream.tty);
  }, flush: function(stream) {
    stream.tty.ops.flush(stream.tty);
  }, read: function(stream, buffer2, offset, length, pos) {
    if (!stream.tty || !stream.tty.ops.get_char) {
      throw new FS.ErrnoError(ERRNO_CODES.ENXIO);
    }
    var bytesRead = 0;
    for (var i2 = 0; i2 < length; i2++) {
      var result;
      try {
        result = stream.tty.ops.get_char(stream.tty);
      } catch (e) {
        throw new FS.ErrnoError(ERRNO_CODES.EIO);
      }
      if (result === void 0 && bytesRead === 0) {
        throw new FS.ErrnoError(ERRNO_CODES.EAGAIN);
      }
      if (result === null || result === void 0)
        break;
      bytesRead++;
      buffer2[offset + i2] = result;
    }
    if (bytesRead) {
      stream.node.timestamp = Date.now();
    }
    return bytesRead;
  }, write: function(stream, buffer2, offset, length, pos) {
    if (!stream.tty || !stream.tty.ops.put_char) {
      throw new FS.ErrnoError(ERRNO_CODES.ENXIO);
    }
    for (var i2 = 0; i2 < length; i2++) {
      try {
        stream.tty.ops.put_char(stream.tty, buffer2[offset + i2]);
      } catch (e) {
        throw new FS.ErrnoError(ERRNO_CODES.EIO);
      }
    }
    if (length) {
      stream.node.timestamp = Date.now();
    }
    return i2;
  } }, default_tty_ops: { get_char: function(tty) {
    if (!tty.input.length) {
      var result = null;
      if (ENVIRONMENT_IS_NODE) {
        var BUFSIZE = 256;
        var buf = new Buffer(BUFSIZE);
        var bytesRead = 0;
        var fd = process.stdin.fd;
        var usingDevice = false;
        try {
          fd = fs.openSync("/dev/stdin", "r");
          usingDevice = true;
        } catch (e) {
        }
        bytesRead = fs.readSync(fd, buf, 0, BUFSIZE, null);
        if (usingDevice) {
          fs.closeSync(fd);
        }
        if (bytesRead > 0) {
          result = buf.slice(0, bytesRead).toString("utf-8");
        } else {
          result = null;
        }
      } else if (typeof window != "undefined" && typeof window.prompt == "function") {
        result = window.prompt("Input: ");
        if (result !== null) {
          result += "\n";
        }
      } else if (typeof readline == "function") {
        result = readline();
        if (result !== null) {
          result += "\n";
        }
      }
      if (!result) {
        return null;
      }
      tty.input = intArrayFromString(result, true);
    }
    return tty.input.shift();
  }, put_char: function(tty, val) {
    if (val === null || val === 10) {
      Module["print"](UTF8ArrayToString(tty.output, 0));
      tty.output = [];
    } else {
      if (val != 0)
        tty.output.push(val);
    }
  }, flush: function(tty) {
    if (tty.output && tty.output.length > 0) {
      Module["print"](UTF8ArrayToString(tty.output, 0));
      tty.output = [];
    }
  } }, default_tty1_ops: { put_char: function(tty, val) {
    if (val === null || val === 10) {
      Module["printErr"](UTF8ArrayToString(tty.output, 0));
      tty.output = [];
    } else {
      if (val != 0)
        tty.output.push(val);
    }
  }, flush: function(tty) {
    if (tty.output && tty.output.length > 0) {
      Module["printErr"](UTF8ArrayToString(tty.output, 0));
      tty.output = [];
    }
  } } };
  var MEMFS = { ops_table: null, mount: function(mount) {
    return MEMFS.createNode(null, "/", 16384 | 511, 0);
  }, createNode: function(parent, name, mode, dev) {
    if (FS.isBlkdev(mode) || FS.isFIFO(mode)) {
      throw new FS.ErrnoError(ERRNO_CODES.EPERM);
    }
    if (!MEMFS.ops_table) {
      MEMFS.ops_table = { dir: { node: { getattr: MEMFS.node_ops.getattr, setattr: MEMFS.node_ops.setattr, lookup: MEMFS.node_ops.lookup, mknod: MEMFS.node_ops.mknod, rename: MEMFS.node_ops.rename, unlink: MEMFS.node_ops.unlink, rmdir: MEMFS.node_ops.rmdir, readdir: MEMFS.node_ops.readdir, symlink: MEMFS.node_ops.symlink }, stream: { llseek: MEMFS.stream_ops.llseek } }, file: { node: { getattr: MEMFS.node_ops.getattr, setattr: MEMFS.node_ops.setattr }, stream: { llseek: MEMFS.stream_ops.llseek, read: MEMFS.stream_ops.read, write: MEMFS.stream_ops.write, allocate: MEMFS.stream_ops.allocate, mmap: MEMFS.stream_ops.mmap, msync: MEMFS.stream_ops.msync } }, link: { node: { getattr: MEMFS.node_ops.getattr, setattr: MEMFS.node_ops.setattr, readlink: MEMFS.node_ops.readlink }, stream: {} }, chrdev: { node: { getattr: MEMFS.node_ops.getattr, setattr: MEMFS.node_ops.setattr }, stream: FS.chrdev_stream_ops } };
    }
    var node2 = FS.createNode(parent, name, mode, dev);
    if (FS.isDir(node2.mode)) {
      node2.node_ops = MEMFS.ops_table.dir.node;
      node2.stream_ops = MEMFS.ops_table.dir.stream;
      node2.contents = {};
    } else if (FS.isFile(node2.mode)) {
      node2.node_ops = MEMFS.ops_table.file.node;
      node2.stream_ops = MEMFS.ops_table.file.stream;
      node2.usedBytes = 0;
      node2.contents = null;
    } else if (FS.isLink(node2.mode)) {
      node2.node_ops = MEMFS.ops_table.link.node;
      node2.stream_ops = MEMFS.ops_table.link.stream;
    } else if (FS.isChrdev(node2.mode)) {
      node2.node_ops = MEMFS.ops_table.chrdev.node;
      node2.stream_ops = MEMFS.ops_table.chrdev.stream;
    }
    node2.timestamp = Date.now();
    if (parent) {
      parent.contents[name] = node2;
    }
    return node2;
  }, getFileDataAsRegularArray: function(node2) {
    if (node2.contents && node2.contents.subarray) {
      var arr = [];
      for (var i2 = 0; i2 < node2.usedBytes; ++i2)
        arr.push(node2.contents[i2]);
      return arr;
    }
    return node2.contents;
  }, getFileDataAsTypedArray: function(node2) {
    if (!node2.contents)
      return new Uint8Array();
    if (node2.contents.subarray)
      return node2.contents.subarray(0, node2.usedBytes);
    return new Uint8Array(node2.contents);
  }, expandFileStorage: function(node2, newCapacity) {
    if (node2.contents && node2.contents.subarray && newCapacity > node2.contents.length) {
      node2.contents = MEMFS.getFileDataAsRegularArray(node2);
      node2.usedBytes = node2.contents.length;
    }
    if (!node2.contents || node2.contents.subarray) {
      var prevCapacity = node2.contents ? node2.contents.buffer.byteLength : 0;
      if (prevCapacity >= newCapacity)
        return;
      var CAPACITY_DOUBLING_MAX = 1024 * 1024;
      newCapacity = Math.max(newCapacity, prevCapacity * (prevCapacity < CAPACITY_DOUBLING_MAX ? 2 : 1.125) | 0);
      if (prevCapacity != 0)
        newCapacity = Math.max(newCapacity, 256);
      var oldContents = node2.contents;
      node2.contents = new Uint8Array(newCapacity);
      if (node2.usedBytes > 0)
        node2.contents.set(oldContents.subarray(0, node2.usedBytes), 0);
      return;
    }
    if (!node2.contents && newCapacity > 0)
      node2.contents = [];
    while (node2.contents.length < newCapacity)
      node2.contents.push(0);
  }, resizeFileStorage: function(node2, newSize) {
    if (node2.usedBytes == newSize)
      return;
    if (newSize == 0) {
      node2.contents = null;
      node2.usedBytes = 0;
      return;
    }
    if (!node2.contents || node2.contents.subarray) {
      var oldContents = node2.contents;
      node2.contents = new Uint8Array(new ArrayBuffer(newSize));
      if (oldContents) {
        node2.contents.set(oldContents.subarray(0, Math.min(newSize, node2.usedBytes)));
      }
      node2.usedBytes = newSize;
      return;
    }
    if (!node2.contents)
      node2.contents = [];
    if (node2.contents.length > newSize)
      node2.contents.length = newSize;
    else
      while (node2.contents.length < newSize)
        node2.contents.push(0);
    node2.usedBytes = newSize;
  }, node_ops: { getattr: function(node2) {
    var attr = {};
    attr.dev = FS.isChrdev(node2.mode) ? node2.id : 1;
    attr.ino = node2.id;
    attr.mode = node2.mode;
    attr.nlink = 1;
    attr.uid = 0;
    attr.gid = 0;
    attr.rdev = node2.rdev;
    if (FS.isDir(node2.mode)) {
      attr.size = 4096;
    } else if (FS.isFile(node2.mode)) {
      attr.size = node2.usedBytes;
    } else if (FS.isLink(node2.mode)) {
      attr.size = node2.link.length;
    } else {
      attr.size = 0;
    }
    attr.atime = new Date(node2.timestamp);
    attr.mtime = new Date(node2.timestamp);
    attr.ctime = new Date(node2.timestamp);
    attr.blksize = 4096;
    attr.blocks = Math.ceil(attr.size / attr.blksize);
    return attr;
  }, setattr: function(node2, attr) {
    if (attr.mode !== void 0) {
      node2.mode = attr.mode;
    }
    if (attr.timestamp !== void 0) {
      node2.timestamp = attr.timestamp;
    }
    if (attr.size !== void 0) {
      MEMFS.resizeFileStorage(node2, attr.size);
    }
  }, lookup: function(parent, name) {
    throw FS.genericErrors[ERRNO_CODES.ENOENT];
  }, mknod: function(parent, name, mode, dev) {
    return MEMFS.createNode(parent, name, mode, dev);
  }, rename: function(old_node, new_dir, new_name) {
    if (FS.isDir(old_node.mode)) {
      var new_node;
      try {
        new_node = FS.lookupNode(new_dir, new_name);
      } catch (e) {
      }
      if (new_node) {
        for (var i2 in new_node.contents) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY);
        }
      }
    }
    delete old_node.parent.contents[old_node.name];
    old_node.name = new_name;
    new_dir.contents[new_name] = old_node;
    old_node.parent = new_dir;
  }, unlink: function(parent, name) {
    delete parent.contents[name];
  }, rmdir: function(parent, name) {
    var node2 = FS.lookupNode(parent, name);
    for (var i2 in node2.contents) {
      throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY);
    }
    delete parent.contents[name];
  }, readdir: function(node2) {
    var entries = [".", ".."];
    for (var key2 in node2.contents) {
      if (!node2.contents.hasOwnProperty(key2)) {
        continue;
      }
      entries.push(key2);
    }
    return entries;
  }, symlink: function(parent, newname, oldpath) {
    var node2 = MEMFS.createNode(parent, newname, 511 | 40960, 0);
    node2.link = oldpath;
    return node2;
  }, readlink: function(node2) {
    if (!FS.isLink(node2.mode)) {
      throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
    }
    return node2.link;
  } }, stream_ops: { read: function(stream, buffer2, offset, length, position) {
    var contents = stream.node.contents;
    if (position >= stream.node.usedBytes)
      return 0;
    var size = Math.min(stream.node.usedBytes - position, length);
    assert(size >= 0);
    if (size > 8 && contents.subarray) {
      buffer2.set(contents.subarray(position, position + size), offset);
    } else {
      for (var i2 = 0; i2 < size; i2++)
        buffer2[offset + i2] = contents[position + i2];
    }
    return size;
  }, write: function(stream, buffer2, offset, length, position, canOwn) {
    if (!length)
      return 0;
    var node2 = stream.node;
    node2.timestamp = Date.now();
    if (buffer2.subarray && (!node2.contents || node2.contents.subarray)) {
      if (canOwn) {
        node2.contents = buffer2.subarray(offset, offset + length);
        node2.usedBytes = length;
        return length;
      } else if (node2.usedBytes === 0 && position === 0) {
        node2.contents = new Uint8Array(buffer2.subarray(offset, offset + length));
        node2.usedBytes = length;
        return length;
      } else if (position + length <= node2.usedBytes) {
        node2.contents.set(buffer2.subarray(offset, offset + length), position);
        return length;
      }
    }
    MEMFS.expandFileStorage(node2, position + length);
    if (node2.contents.subarray && buffer2.subarray)
      node2.contents.set(buffer2.subarray(offset, offset + length), position);
    else {
      for (var i2 = 0; i2 < length; i2++) {
        node2.contents[position + i2] = buffer2[offset + i2];
      }
    }
    node2.usedBytes = Math.max(node2.usedBytes, position + length);
    return length;
  }, llseek: function(stream, offset, whence) {
    var position = offset;
    if (whence === 1) {
      position += stream.position;
    } else if (whence === 2) {
      if (FS.isFile(stream.node.mode)) {
        position += stream.node.usedBytes;
      }
    }
    if (position < 0) {
      throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
    }
    return position;
  }, allocate: function(stream, offset, length) {
    MEMFS.expandFileStorage(stream.node, offset + length);
    stream.node.usedBytes = Math.max(stream.node.usedBytes, offset + length);
  }, mmap: function(stream, buffer2, offset, length, position, prot, flags) {
    if (!FS.isFile(stream.node.mode)) {
      throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
    }
    var ptr;
    var allocated;
    var contents = stream.node.contents;
    if (!(flags & 2) && (contents.buffer === buffer2 || contents.buffer === buffer2.buffer)) {
      allocated = false;
      ptr = contents.byteOffset;
    } else {
      if (position > 0 || position + length < stream.node.usedBytes) {
        if (contents.subarray) {
          contents = contents.subarray(position, position + length);
        } else {
          contents = Array.prototype.slice.call(contents, position, position + length);
        }
      }
      allocated = true;
      ptr = _malloc(length);
      if (!ptr) {
        throw new FS.ErrnoError(ERRNO_CODES.ENOMEM);
      }
      buffer2.set(contents, ptr);
    }
    return { ptr, allocated };
  }, msync: function(stream, buffer2, offset, length, mmapFlags) {
    if (!FS.isFile(stream.node.mode)) {
      throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
    }
    if (mmapFlags & 2) {
      return 0;
    }
    MEMFS.stream_ops.write(stream, buffer2, 0, length, offset, false);
    return 0;
  } } };
  var IDBFS = { dbs: {}, indexedDB: function() {
    if (typeof indexedDB !== "undefined")
      return indexedDB;
    var ret = null;
    if (typeof window === "object")
      ret = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
    assert(ret, "IDBFS used, but indexedDB not supported");
    return ret;
  }, DB_VERSION: 21, DB_STORE_NAME: "FILE_DATA", mount: function(mount) {
    return MEMFS.mount.apply(null, arguments);
  }, syncfs: function(mount, populate, callback) {
    IDBFS.getLocalSet(mount, function(err, local) {
      if (err)
        return callback(err);
      IDBFS.getRemoteSet(mount, function(err2, remote) {
        if (err2)
          return callback(err2);
        var src = populate ? remote : local;
        var dst = populate ? local : remote;
        IDBFS.reconcile(src, dst, callback);
      });
    });
  }, getDB: function(name, callback) {
    var db = IDBFS.dbs[name];
    if (db) {
      return callback(null, db);
    }
    var req;
    try {
      req = IDBFS.indexedDB().open(name, IDBFS.DB_VERSION);
    } catch (e) {
      return callback(e);
    }
    req.onupgradeneeded = function(e) {
      var db2 = e.target.result;
      var transaction = e.target.transaction;
      var fileStore;
      if (db2.objectStoreNames.contains(IDBFS.DB_STORE_NAME)) {
        fileStore = transaction.objectStore(IDBFS.DB_STORE_NAME);
      } else {
        fileStore = db2.createObjectStore(IDBFS.DB_STORE_NAME);
      }
      if (!fileStore.indexNames.contains("timestamp")) {
        fileStore.createIndex("timestamp", "timestamp", { unique: false });
      }
    };
    req.onsuccess = function() {
      db = req.result;
      IDBFS.dbs[name] = db;
      callback(null, db);
    };
    req.onerror = function(e) {
      callback(this.error);
      e.preventDefault();
    };
  }, getLocalSet: function(mount, callback) {
    var entries = {};
    function isRealDir(p) {
      return p !== "." && p !== "..";
    }
    function toAbsolute(root) {
      return function(p) {
        return PATH.join2(root, p);
      };
    }
    var check = FS.readdir(mount.mountpoint).filter(isRealDir).map(toAbsolute(mount.mountpoint));
    while (check.length) {
      var path2 = check.pop();
      var stat;
      try {
        stat = FS.stat(path2);
      } catch (e) {
        return callback(e);
      }
      if (FS.isDir(stat.mode)) {
        check.push.apply(check, FS.readdir(path2).filter(isRealDir).map(toAbsolute(path2)));
      }
      entries[path2] = { timestamp: stat.mtime };
    }
    return callback(null, { type: "local", entries });
  }, getRemoteSet: function(mount, callback) {
    var entries = {};
    IDBFS.getDB(mount.mountpoint, function(err, db) {
      if (err)
        return callback(err);
      var transaction = db.transaction([IDBFS.DB_STORE_NAME], "readonly");
      transaction.onerror = function(e) {
        callback(this.error);
        e.preventDefault();
      };
      var store = transaction.objectStore(IDBFS.DB_STORE_NAME);
      var index = store.index("timestamp");
      index.openKeyCursor().onsuccess = function(event) {
        var cursor = event.target.result;
        if (!cursor) {
          return callback(null, { type: "remote", db, entries });
        }
        entries[cursor.primaryKey] = { timestamp: cursor.key };
        cursor.continue();
      };
    });
  }, loadLocalEntry: function(path2, callback) {
    var stat, node2;
    try {
      var lookup = FS.lookupPath(path2);
      node2 = lookup.node;
      stat = FS.stat(path2);
    } catch (e) {
      return callback(e);
    }
    if (FS.isDir(stat.mode)) {
      return callback(null, { timestamp: stat.mtime, mode: stat.mode });
    } else if (FS.isFile(stat.mode)) {
      node2.contents = MEMFS.getFileDataAsTypedArray(node2);
      return callback(null, { timestamp: stat.mtime, mode: stat.mode, contents: node2.contents });
    } else {
      return callback(new Error("node type not supported"));
    }
  }, storeLocalEntry: function(path2, entry, callback) {
    try {
      if (FS.isDir(entry.mode)) {
        FS.mkdir(path2, entry.mode);
      } else if (FS.isFile(entry.mode)) {
        FS.writeFile(path2, entry.contents, { encoding: "binary", canOwn: true });
      } else {
        return callback(new Error("node type not supported"));
      }
      FS.chmod(path2, entry.mode);
      FS.utime(path2, entry.timestamp, entry.timestamp);
    } catch (e) {
      return callback(e);
    }
    callback(null);
  }, removeLocalEntry: function(path2, callback) {
    try {
      var lookup = FS.lookupPath(path2);
      var stat = FS.stat(path2);
      if (FS.isDir(stat.mode)) {
        FS.rmdir(path2);
      } else if (FS.isFile(stat.mode)) {
        FS.unlink(path2);
      }
    } catch (e) {
      return callback(e);
    }
    callback(null);
  }, loadRemoteEntry: function(store, path2, callback) {
    var req = store.get(path2);
    req.onsuccess = function(event) {
      callback(null, event.target.result);
    };
    req.onerror = function(e) {
      callback(this.error);
      e.preventDefault();
    };
  }, storeRemoteEntry: function(store, path2, entry, callback) {
    var req = store.put(entry, path2);
    req.onsuccess = function() {
      callback(null);
    };
    req.onerror = function(e) {
      callback(this.error);
      e.preventDefault();
    };
  }, removeRemoteEntry: function(store, path2, callback) {
    var req = store.delete(path2);
    req.onsuccess = function() {
      callback(null);
    };
    req.onerror = function(e) {
      callback(this.error);
      e.preventDefault();
    };
  }, reconcile: function(src, dst, callback) {
    var total = 0;
    var create = [];
    Object.keys(src.entries).forEach(function(key2) {
      var e = src.entries[key2];
      var e2 = dst.entries[key2];
      if (!e2 || e.timestamp > e2.timestamp) {
        create.push(key2);
        total++;
      }
    });
    var remove = [];
    Object.keys(dst.entries).forEach(function(key2) {
      dst.entries[key2];
      var e2 = src.entries[key2];
      if (!e2) {
        remove.push(key2);
        total++;
      }
    });
    if (!total) {
      return callback(null);
    }
    var completed = 0;
    var db = src.type === "remote" ? src.db : dst.db;
    var transaction = db.transaction([IDBFS.DB_STORE_NAME], "readwrite");
    var store = transaction.objectStore(IDBFS.DB_STORE_NAME);
    function done(err) {
      if (err) {
        if (!done.errored) {
          done.errored = true;
          return callback(err);
        }
        return;
      }
      if (++completed >= total) {
        return callback(null);
      }
    }
    transaction.onerror = function(e) {
      done(this.error);
      e.preventDefault();
    };
    create.sort().forEach(function(path2) {
      if (dst.type === "local") {
        IDBFS.loadRemoteEntry(store, path2, function(err, entry) {
          if (err)
            return done(err);
          IDBFS.storeLocalEntry(path2, entry, done);
        });
      } else {
        IDBFS.loadLocalEntry(path2, function(err, entry) {
          if (err)
            return done(err);
          IDBFS.storeRemoteEntry(store, path2, entry, done);
        });
      }
    });
    remove.sort().reverse().forEach(function(path2) {
      if (dst.type === "local") {
        IDBFS.removeLocalEntry(path2, done);
      } else {
        IDBFS.removeRemoteEntry(store, path2, done);
      }
    });
  } };
  var NODEFS = { isWindows: false, staticInit: function() {
    NODEFS.isWindows = !!process.platform.match(/^win/);
  }, mount: function(mount) {
    assert(ENVIRONMENT_IS_NODE);
    return NODEFS.createNode(null, "/", NODEFS.getMode(mount.opts.root), 0);
  }, createNode: function(parent, name, mode, dev) {
    if (!FS.isDir(mode) && !FS.isFile(mode) && !FS.isLink(mode)) {
      throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
    }
    var node2 = FS.createNode(parent, name, mode);
    node2.node_ops = NODEFS.node_ops;
    node2.stream_ops = NODEFS.stream_ops;
    return node2;
  }, getMode: function(path2) {
    var stat;
    try {
      stat = fs.lstatSync(path2);
      if (NODEFS.isWindows) {
        stat.mode = stat.mode | (stat.mode & 146) >> 1;
      }
    } catch (e) {
      if (!e.code)
        throw e;
      throw new FS.ErrnoError(ERRNO_CODES[e.code]);
    }
    return stat.mode;
  }, realPath: function(node2) {
    var parts = [];
    while (node2.parent !== node2) {
      parts.push(node2.name);
      node2 = node2.parent;
    }
    parts.push(node2.mount.opts.root);
    parts.reverse();
    return PATH.join.apply(null, parts);
  }, flagsToPermissionStringMap: { 0: "r", 1: "r+", 2: "r+", 64: "r", 65: "r+", 66: "r+", 129: "rx+", 193: "rx+", 514: "w+", 577: "w", 578: "w+", 705: "wx", 706: "wx+", 1024: "a", 1025: "a", 1026: "a+", 1089: "a", 1090: "a+", 1153: "ax", 1154: "ax+", 1217: "ax", 1218: "ax+", 4096: "rs", 4098: "rs+" }, flagsToPermissionString: function(flags) {
    flags &= ~32768;
    if (flags in NODEFS.flagsToPermissionStringMap) {
      return NODEFS.flagsToPermissionStringMap[flags];
    } else {
      throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
    }
  }, node_ops: { getattr: function(node2) {
    var path2 = NODEFS.realPath(node2);
    var stat;
    try {
      stat = fs.lstatSync(path2);
    } catch (e) {
      if (!e.code)
        throw e;
      throw new FS.ErrnoError(ERRNO_CODES[e.code]);
    }
    if (NODEFS.isWindows && !stat.blksize) {
      stat.blksize = 4096;
    }
    if (NODEFS.isWindows && !stat.blocks) {
      stat.blocks = (stat.size + stat.blksize - 1) / stat.blksize | 0;
    }
    return { dev: stat.dev, ino: stat.ino, mode: stat.mode, nlink: stat.nlink, uid: stat.uid, gid: stat.gid, rdev: stat.rdev, size: stat.size, atime: stat.atime, mtime: stat.mtime, ctime: stat.ctime, blksize: stat.blksize, blocks: stat.blocks };
  }, setattr: function(node2, attr) {
    var path2 = NODEFS.realPath(node2);
    try {
      if (attr.mode !== void 0) {
        fs.chmodSync(path2, attr.mode);
        node2.mode = attr.mode;
      }
      if (attr.timestamp !== void 0) {
        var date = new Date(attr.timestamp);
        fs.utimesSync(path2, date, date);
      }
      if (attr.size !== void 0) {
        fs.truncateSync(path2, attr.size);
      }
    } catch (e) {
      if (!e.code)
        throw e;
      throw new FS.ErrnoError(ERRNO_CODES[e.code]);
    }
  }, lookup: function(parent, name) {
    var path2 = PATH.join2(NODEFS.realPath(parent), name);
    var mode = NODEFS.getMode(path2);
    return NODEFS.createNode(parent, name, mode);
  }, mknod: function(parent, name, mode, dev) {
    var node2 = NODEFS.createNode(parent, name, mode, dev);
    var path2 = NODEFS.realPath(node2);
    try {
      if (FS.isDir(node2.mode)) {
        fs.mkdirSync(path2, node2.mode);
      } else {
        fs.writeFileSync(path2, "", { mode: node2.mode });
      }
    } catch (e) {
      if (!e.code)
        throw e;
      throw new FS.ErrnoError(ERRNO_CODES[e.code]);
    }
    return node2;
  }, rename: function(oldNode, newDir, newName) {
    var oldPath = NODEFS.realPath(oldNode);
    var newPath = PATH.join2(NODEFS.realPath(newDir), newName);
    try {
      fs.renameSync(oldPath, newPath);
    } catch (e) {
      if (!e.code)
        throw e;
      throw new FS.ErrnoError(ERRNO_CODES[e.code]);
    }
  }, unlink: function(parent, name) {
    var path2 = PATH.join2(NODEFS.realPath(parent), name);
    try {
      fs.unlinkSync(path2);
    } catch (e) {
      if (!e.code)
        throw e;
      throw new FS.ErrnoError(ERRNO_CODES[e.code]);
    }
  }, rmdir: function(parent, name) {
    var path2 = PATH.join2(NODEFS.realPath(parent), name);
    try {
      fs.rmdirSync(path2);
    } catch (e) {
      if (!e.code)
        throw e;
      throw new FS.ErrnoError(ERRNO_CODES[e.code]);
    }
  }, readdir: function(node2) {
    var path2 = NODEFS.realPath(node2);
    try {
      return fs.readdirSync(path2);
    } catch (e) {
      if (!e.code)
        throw e;
      throw new FS.ErrnoError(ERRNO_CODES[e.code]);
    }
  }, symlink: function(parent, newName, oldPath) {
    var newPath = PATH.join2(NODEFS.realPath(parent), newName);
    try {
      fs.symlinkSync(oldPath, newPath);
    } catch (e) {
      if (!e.code)
        throw e;
      throw new FS.ErrnoError(ERRNO_CODES[e.code]);
    }
  }, readlink: function(node2) {
    var path2 = NODEFS.realPath(node2);
    try {
      path2 = fs.readlinkSync(path2);
      path2 = NODEJS_PATH.relative(NODEJS_PATH.resolve(node2.mount.opts.root), path2);
      return path2;
    } catch (e) {
      if (!e.code)
        throw e;
      throw new FS.ErrnoError(ERRNO_CODES[e.code]);
    }
  } }, stream_ops: { open: function(stream) {
    var path2 = NODEFS.realPath(stream.node);
    try {
      if (FS.isFile(stream.node.mode)) {
        stream.nfd = fs.openSync(path2, NODEFS.flagsToPermissionString(stream.flags));
      }
    } catch (e) {
      if (!e.code)
        throw e;
      throw new FS.ErrnoError(ERRNO_CODES[e.code]);
    }
  }, close: function(stream) {
    try {
      if (FS.isFile(stream.node.mode) && stream.nfd) {
        fs.closeSync(stream.nfd);
      }
    } catch (e) {
      if (!e.code)
        throw e;
      throw new FS.ErrnoError(ERRNO_CODES[e.code]);
    }
  }, read: function(stream, buffer2, offset, length, position) {
    if (length === 0)
      return 0;
    var nbuffer = new Buffer(length);
    var res;
    try {
      res = fs.readSync(stream.nfd, nbuffer, 0, length, position);
    } catch (e) {
      throw new FS.ErrnoError(ERRNO_CODES[e.code]);
    }
    if (res > 0) {
      for (var i2 = 0; i2 < res; i2++) {
        buffer2[offset + i2] = nbuffer[i2];
      }
    }
    return res;
  }, write: function(stream, buffer2, offset, length, position) {
    var nbuffer = new Buffer(buffer2.subarray(offset, offset + length));
    var res;
    try {
      res = fs.writeSync(stream.nfd, nbuffer, 0, length, position);
    } catch (e) {
      throw new FS.ErrnoError(ERRNO_CODES[e.code]);
    }
    return res;
  }, llseek: function(stream, offset, whence) {
    var position = offset;
    if (whence === 1) {
      position += stream.position;
    } else if (whence === 2) {
      if (FS.isFile(stream.node.mode)) {
        try {
          var stat = fs.fstatSync(stream.nfd);
          position += stat.size;
        } catch (e) {
          throw new FS.ErrnoError(ERRNO_CODES[e.code]);
        }
      }
    }
    if (position < 0) {
      throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
    }
    return position;
  } } };
  var WORKERFS = { DIR_MODE: 16895, FILE_MODE: 33279, reader: null, mount: function(mount) {
    assert(ENVIRONMENT_IS_WORKER);
    if (!WORKERFS.reader)
      WORKERFS.reader = new FileReaderSync();
    var root = WORKERFS.createNode(null, "/", WORKERFS.DIR_MODE, 0);
    var createdParents = {};
    function ensureParent(path2) {
      var parts = path2.split("/");
      var parent = root;
      for (var i2 = 0; i2 < parts.length - 1; i2++) {
        var curr = parts.slice(0, i2 + 1).join("/");
        if (!createdParents[curr]) {
          createdParents[curr] = WORKERFS.createNode(parent, curr, WORKERFS.DIR_MODE, 0);
        }
        parent = createdParents[curr];
      }
      return parent;
    }
    function base(path2) {
      var parts = path2.split("/");
      return parts[parts.length - 1];
    }
    Array.prototype.forEach.call(mount.opts["files"] || [], function(file) {
      WORKERFS.createNode(ensureParent(file.name), base(file.name), WORKERFS.FILE_MODE, 0, file, file.lastModifiedDate);
    });
    (mount.opts["blobs"] || []).forEach(function(obj) {
      WORKERFS.createNode(ensureParent(obj["name"]), base(obj["name"]), WORKERFS.FILE_MODE, 0, obj["data"]);
    });
    (mount.opts["packages"] || []).forEach(function(pack) {
      pack["metadata"].files.forEach(function(file) {
        var name = file.filename.substr(1);
        WORKERFS.createNode(ensureParent(name), base(name), WORKERFS.FILE_MODE, 0, pack["blob"].slice(file.start, file.end));
      });
    });
    return root;
  }, createNode: function(parent, name, mode, dev, contents, mtime) {
    var node2 = FS.createNode(parent, name, mode);
    node2.mode = mode;
    node2.node_ops = WORKERFS.node_ops;
    node2.stream_ops = WORKERFS.stream_ops;
    node2.timestamp = (mtime || new Date()).getTime();
    assert(WORKERFS.FILE_MODE !== WORKERFS.DIR_MODE);
    if (mode === WORKERFS.FILE_MODE) {
      node2.size = contents.size;
      node2.contents = contents;
    } else {
      node2.size = 4096;
      node2.contents = {};
    }
    if (parent) {
      parent.contents[name] = node2;
    }
    return node2;
  }, node_ops: { getattr: function(node2) {
    return { dev: 1, ino: void 0, mode: node2.mode, nlink: 1, uid: 0, gid: 0, rdev: void 0, size: node2.size, atime: new Date(node2.timestamp), mtime: new Date(node2.timestamp), ctime: new Date(node2.timestamp), blksize: 4096, blocks: Math.ceil(node2.size / 4096) };
  }, setattr: function(node2, attr) {
    if (attr.mode !== void 0) {
      node2.mode = attr.mode;
    }
    if (attr.timestamp !== void 0) {
      node2.timestamp = attr.timestamp;
    }
  }, lookup: function(parent, name) {
    throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
  }, mknod: function(parent, name, mode, dev) {
    throw new FS.ErrnoError(ERRNO_CODES.EPERM);
  }, rename: function(oldNode, newDir, newName) {
    throw new FS.ErrnoError(ERRNO_CODES.EPERM);
  }, unlink: function(parent, name) {
    throw new FS.ErrnoError(ERRNO_CODES.EPERM);
  }, rmdir: function(parent, name) {
    throw new FS.ErrnoError(ERRNO_CODES.EPERM);
  }, readdir: function(node2) {
    throw new FS.ErrnoError(ERRNO_CODES.EPERM);
  }, symlink: function(parent, newName, oldPath) {
    throw new FS.ErrnoError(ERRNO_CODES.EPERM);
  }, readlink: function(node2) {
    throw new FS.ErrnoError(ERRNO_CODES.EPERM);
  } }, stream_ops: { read: function(stream, buffer2, offset, length, position) {
    if (position >= stream.node.size)
      return 0;
    var chunk = stream.node.contents.slice(position, position + length);
    var ab = WORKERFS.reader.readAsArrayBuffer(chunk);
    buffer2.set(new Uint8Array(ab), offset);
    return chunk.size;
  }, write: function(stream, buffer2, offset, length, position) {
    throw new FS.ErrnoError(ERRNO_CODES.EIO);
  }, llseek: function(stream, offset, whence) {
    var position = offset;
    if (whence === 1) {
      position += stream.position;
    } else if (whence === 2) {
      if (FS.isFile(stream.node.mode)) {
        position += stream.node.size;
      }
    }
    if (position < 0) {
      throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
    }
    return position;
  } } };
  allocate(1, "i32*", ALLOC_STATIC);
  allocate(1, "i32*", ALLOC_STATIC);
  allocate(1, "i32*", ALLOC_STATIC);
  var FS = { root: null, mounts: [], devices: [null], streams: [], nextInode: 1, nameTable: null, currentPath: "/", initialized: false, ignorePermissions: true, trackingDelegate: {}, tracking: { openFlags: { READ: 1, WRITE: 2 } }, ErrnoError: null, genericErrors: {}, filesystems: null, handleFSError: function(e) {
    if (!(e instanceof FS.ErrnoError))
      throw e + " : " + stackTrace();
    return ___setErrNo(e.errno);
  }, lookupPath: function(path2, opts) {
    path2 = PATH.resolve(FS.cwd(), path2);
    opts = opts || {};
    if (!path2)
      return { path: "", node: null };
    var defaults = { follow_mount: true, recurse_count: 0 };
    for (var key2 in defaults) {
      if (opts[key2] === void 0) {
        opts[key2] = defaults[key2];
      }
    }
    if (opts.recurse_count > 8) {
      throw new FS.ErrnoError(ERRNO_CODES.ELOOP);
    }
    var parts = PATH.normalizeArray(path2.split("/").filter(function(p) {
      return !!p;
    }), false);
    var current = FS.root;
    var current_path = "/";
    for (var i2 = 0; i2 < parts.length; i2++) {
      var islast = i2 === parts.length - 1;
      if (islast && opts.parent) {
        break;
      }
      current = FS.lookupNode(current, parts[i2]);
      current_path = PATH.join2(current_path, parts[i2]);
      if (FS.isMountpoint(current)) {
        if (!islast || islast && opts.follow_mount) {
          current = current.mounted.root;
        }
      }
      if (!islast || opts.follow) {
        var count = 0;
        while (FS.isLink(current.mode)) {
          var link = FS.readlink(current_path);
          current_path = PATH.resolve(PATH.dirname(current_path), link);
          var lookup = FS.lookupPath(current_path, { recurse_count: opts.recurse_count });
          current = lookup.node;
          if (count++ > 40) {
            throw new FS.ErrnoError(ERRNO_CODES.ELOOP);
          }
        }
      }
    }
    return { path: current_path, node: current };
  }, getPath: function(node2) {
    var path2;
    while (true) {
      if (FS.isRoot(node2)) {
        var mount = node2.mount.mountpoint;
        if (!path2)
          return mount;
        return mount[mount.length - 1] !== "/" ? mount + "/" + path2 : mount + path2;
      }
      path2 = path2 ? node2.name + "/" + path2 : node2.name;
      node2 = node2.parent;
    }
  }, hashName: function(parentid, name) {
    var hash = 0;
    for (var i2 = 0; i2 < name.length; i2++) {
      hash = (hash << 5) - hash + name.charCodeAt(i2) | 0;
    }
    return (parentid + hash >>> 0) % FS.nameTable.length;
  }, hashAddNode: function(node2) {
    var hash = FS.hashName(node2.parent.id, node2.name);
    node2.name_next = FS.nameTable[hash];
    FS.nameTable[hash] = node2;
  }, hashRemoveNode: function(node2) {
    var hash = FS.hashName(node2.parent.id, node2.name);
    if (FS.nameTable[hash] === node2) {
      FS.nameTable[hash] = node2.name_next;
    } else {
      var current = FS.nameTable[hash];
      while (current) {
        if (current.name_next === node2) {
          current.name_next = node2.name_next;
          break;
        }
        current = current.name_next;
      }
    }
  }, lookupNode: function(parent, name) {
    var err = FS.mayLookup(parent);
    if (err) {
      throw new FS.ErrnoError(err, parent);
    }
    var hash = FS.hashName(parent.id, name);
    for (var node2 = FS.nameTable[hash]; node2; node2 = node2.name_next) {
      var nodeName = node2.name;
      if (node2.parent.id === parent.id && nodeName === name) {
        return node2;
      }
    }
    return FS.lookup(parent, name);
  }, createNode: function(parent, name, mode, rdev) {
    if (!FS.FSNode) {
      FS.FSNode = function(parent2, name2, mode2, rdev2) {
        if (!parent2) {
          parent2 = this;
        }
        this.parent = parent2;
        this.mount = parent2.mount;
        this.mounted = null;
        this.id = FS.nextInode++;
        this.name = name2;
        this.mode = mode2;
        this.node_ops = {};
        this.stream_ops = {};
        this.rdev = rdev2;
      };
      FS.FSNode.prototype = {};
      var readMode = 292 | 73;
      var writeMode = 146;
      Object.defineProperties(FS.FSNode.prototype, { read: { get: function() {
        return (this.mode & readMode) === readMode;
      }, set: function(val) {
        val ? this.mode |= readMode : this.mode &= ~readMode;
      } }, write: { get: function() {
        return (this.mode & writeMode) === writeMode;
      }, set: function(val) {
        val ? this.mode |= writeMode : this.mode &= ~writeMode;
      } }, isFolder: { get: function() {
        return FS.isDir(this.mode);
      } }, isDevice: { get: function() {
        return FS.isChrdev(this.mode);
      } } });
    }
    var node2 = new FS.FSNode(parent, name, mode, rdev);
    FS.hashAddNode(node2);
    return node2;
  }, destroyNode: function(node2) {
    FS.hashRemoveNode(node2);
  }, isRoot: function(node2) {
    return node2 === node2.parent;
  }, isMountpoint: function(node2) {
    return !!node2.mounted;
  }, isFile: function(mode) {
    return (mode & 61440) === 32768;
  }, isDir: function(mode) {
    return (mode & 61440) === 16384;
  }, isLink: function(mode) {
    return (mode & 61440) === 40960;
  }, isChrdev: function(mode) {
    return (mode & 61440) === 8192;
  }, isBlkdev: function(mode) {
    return (mode & 61440) === 24576;
  }, isFIFO: function(mode) {
    return (mode & 61440) === 4096;
  }, isSocket: function(mode) {
    return (mode & 49152) === 49152;
  }, flagModes: { "r": 0, "rs": 1052672, "r+": 2, "w": 577, "wx": 705, "xw": 705, "w+": 578, "wx+": 706, "xw+": 706, "a": 1089, "ax": 1217, "xa": 1217, "a+": 1090, "ax+": 1218, "xa+": 1218 }, modeStringToFlags: function(str) {
    var flags = FS.flagModes[str];
    if (typeof flags === "undefined") {
      throw new Error("Unknown file open mode: " + str);
    }
    return flags;
  }, flagsToPermissionString: function(flag) {
    var perms = ["r", "w", "rw"][flag & 3];
    if (flag & 512) {
      perms += "w";
    }
    return perms;
  }, nodePermissions: function(node2, perms) {
    if (FS.ignorePermissions) {
      return 0;
    }
    if (perms.indexOf("r") !== -1 && !(node2.mode & 292)) {
      return ERRNO_CODES.EACCES;
    } else if (perms.indexOf("w") !== -1 && !(node2.mode & 146)) {
      return ERRNO_CODES.EACCES;
    } else if (perms.indexOf("x") !== -1 && !(node2.mode & 73)) {
      return ERRNO_CODES.EACCES;
    }
    return 0;
  }, mayLookup: function(dir) {
    var err = FS.nodePermissions(dir, "x");
    if (err)
      return err;
    if (!dir.node_ops.lookup)
      return ERRNO_CODES.EACCES;
    return 0;
  }, mayCreate: function(dir, name) {
    try {
      var node2 = FS.lookupNode(dir, name);
      return ERRNO_CODES.EEXIST;
    } catch (e) {
    }
    return FS.nodePermissions(dir, "wx");
  }, mayDelete: function(dir, name, isdir) {
    var node2;
    try {
      node2 = FS.lookupNode(dir, name);
    } catch (e) {
      return e.errno;
    }
    var err = FS.nodePermissions(dir, "wx");
    if (err) {
      return err;
    }
    if (isdir) {
      if (!FS.isDir(node2.mode)) {
        return ERRNO_CODES.ENOTDIR;
      }
      if (FS.isRoot(node2) || FS.getPath(node2) === FS.cwd()) {
        return ERRNO_CODES.EBUSY;
      }
    } else {
      if (FS.isDir(node2.mode)) {
        return ERRNO_CODES.EISDIR;
      }
    }
    return 0;
  }, mayOpen: function(node2, flags) {
    if (!node2) {
      return ERRNO_CODES.ENOENT;
    }
    if (FS.isLink(node2.mode)) {
      return ERRNO_CODES.ELOOP;
    } else if (FS.isDir(node2.mode)) {
      if ((flags & 2097155) !== 0 || flags & 512) {
        return ERRNO_CODES.EISDIR;
      }
    }
    return FS.nodePermissions(node2, FS.flagsToPermissionString(flags));
  }, MAX_OPEN_FDS: 4096, nextfd: function(fd_start, fd_end) {
    fd_start = fd_start || 0;
    fd_end = fd_end || FS.MAX_OPEN_FDS;
    for (var fd = fd_start; fd <= fd_end; fd++) {
      if (!FS.streams[fd]) {
        return fd;
      }
    }
    throw new FS.ErrnoError(ERRNO_CODES.EMFILE);
  }, getStream: function(fd) {
    return FS.streams[fd];
  }, createStream: function(stream, fd_start, fd_end) {
    if (!FS.FSStream) {
      FS.FSStream = function() {
      };
      FS.FSStream.prototype = {};
      Object.defineProperties(FS.FSStream.prototype, { object: { get: function() {
        return this.node;
      }, set: function(val) {
        this.node = val;
      } }, isRead: { get: function() {
        return (this.flags & 2097155) !== 1;
      } }, isWrite: { get: function() {
        return (this.flags & 2097155) !== 0;
      } }, isAppend: { get: function() {
        return this.flags & 1024;
      } } });
    }
    var newStream = new FS.FSStream();
    for (var p in stream) {
      newStream[p] = stream[p];
    }
    stream = newStream;
    var fd = FS.nextfd(fd_start, fd_end);
    stream.fd = fd;
    FS.streams[fd] = stream;
    return stream;
  }, closeStream: function(fd) {
    FS.streams[fd] = null;
  }, chrdev_stream_ops: { open: function(stream) {
    var device = FS.getDevice(stream.node.rdev);
    stream.stream_ops = device.stream_ops;
    if (stream.stream_ops.open) {
      stream.stream_ops.open(stream);
    }
  }, llseek: function() {
    throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);
  } }, major: function(dev) {
    return dev >> 8;
  }, minor: function(dev) {
    return dev & 255;
  }, makedev: function(ma, mi) {
    return ma << 8 | mi;
  }, registerDevice: function(dev, ops) {
    FS.devices[dev] = { stream_ops: ops };
  }, getDevice: function(dev) {
    return FS.devices[dev];
  }, getMounts: function(mount) {
    var mounts = [];
    var check = [mount];
    while (check.length) {
      var m = check.pop();
      mounts.push(m);
      check.push.apply(check, m.mounts);
    }
    return mounts;
  }, syncfs: function(populate, callback) {
    if (typeof populate === "function") {
      callback = populate;
      populate = false;
    }
    var mounts = FS.getMounts(FS.root.mount);
    var completed = 0;
    function done(err) {
      if (err) {
        if (!done.errored) {
          done.errored = true;
          return callback(err);
        }
        return;
      }
      if (++completed >= mounts.length) {
        callback(null);
      }
    }
    mounts.forEach(function(mount) {
      if (!mount.type.syncfs) {
        return done(null);
      }
      mount.type.syncfs(mount, populate, done);
    });
  }, mount: function(type2, opts, mountpoint) {
    var root = mountpoint === "/";
    var pseudo = !mountpoint;
    var node2;
    if (root && FS.root) {
      throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
    } else if (!root && !pseudo) {
      var lookup = FS.lookupPath(mountpoint, { follow_mount: false });
      mountpoint = lookup.path;
      node2 = lookup.node;
      if (FS.isMountpoint(node2)) {
        throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
      }
      if (!FS.isDir(node2.mode)) {
        throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR);
      }
    }
    var mount = { type: type2, opts, mountpoint, mounts: [] };
    var mountRoot = type2.mount(mount);
    mountRoot.mount = mount;
    mount.root = mountRoot;
    if (root) {
      FS.root = mountRoot;
    } else if (node2) {
      node2.mounted = mount;
      if (node2.mount) {
        node2.mount.mounts.push(mount);
      }
    }
    return mountRoot;
  }, unmount: function(mountpoint) {
    var lookup = FS.lookupPath(mountpoint, { follow_mount: false });
    if (!FS.isMountpoint(lookup.node)) {
      throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
    }
    var node2 = lookup.node;
    var mount = node2.mounted;
    var mounts = FS.getMounts(mount);
    Object.keys(FS.nameTable).forEach(function(hash) {
      var current = FS.nameTable[hash];
      while (current) {
        var next = current.name_next;
        if (mounts.indexOf(current.mount) !== -1) {
          FS.destroyNode(current);
        }
        current = next;
      }
    });
    node2.mounted = null;
    var idx = node2.mount.mounts.indexOf(mount);
    assert(idx !== -1);
    node2.mount.mounts.splice(idx, 1);
  }, lookup: function(parent, name) {
    return parent.node_ops.lookup(parent, name);
  }, mknod: function(path2, mode, dev) {
    var lookup = FS.lookupPath(path2, { parent: true });
    var parent = lookup.node;
    var name = PATH.basename(path2);
    if (!name || name === "." || name === "..") {
      throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
    }
    var err = FS.mayCreate(parent, name);
    if (err) {
      throw new FS.ErrnoError(err);
    }
    if (!parent.node_ops.mknod) {
      throw new FS.ErrnoError(ERRNO_CODES.EPERM);
    }
    return parent.node_ops.mknod(parent, name, mode, dev);
  }, create: function(path2, mode) {
    mode = mode !== void 0 ? mode : 438;
    mode &= 4095;
    mode |= 32768;
    return FS.mknod(path2, mode, 0);
  }, mkdir: function(path2, mode) {
    mode = mode !== void 0 ? mode : 511;
    mode &= 511 | 512;
    mode |= 16384;
    return FS.mknod(path2, mode, 0);
  }, mkdev: function(path2, mode, dev) {
    if (typeof dev === "undefined") {
      dev = mode;
      mode = 438;
    }
    mode |= 8192;
    return FS.mknod(path2, mode, dev);
  }, symlink: function(oldpath, newpath) {
    if (!PATH.resolve(oldpath)) {
      throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
    }
    var lookup = FS.lookupPath(newpath, { parent: true });
    var parent = lookup.node;
    if (!parent) {
      throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
    }
    var newname = PATH.basename(newpath);
    var err = FS.mayCreate(parent, newname);
    if (err) {
      throw new FS.ErrnoError(err);
    }
    if (!parent.node_ops.symlink) {
      throw new FS.ErrnoError(ERRNO_CODES.EPERM);
    }
    return parent.node_ops.symlink(parent, newname, oldpath);
  }, rename: function(old_path, new_path) {
    var old_dirname = PATH.dirname(old_path);
    var new_dirname = PATH.dirname(new_path);
    var old_name = PATH.basename(old_path);
    var new_name = PATH.basename(new_path);
    var lookup, old_dir, new_dir;
    try {
      lookup = FS.lookupPath(old_path, { parent: true });
      old_dir = lookup.node;
      lookup = FS.lookupPath(new_path, { parent: true });
      new_dir = lookup.node;
    } catch (e) {
      throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
    }
    if (!old_dir || !new_dir)
      throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
    if (old_dir.mount !== new_dir.mount) {
      throw new FS.ErrnoError(ERRNO_CODES.EXDEV);
    }
    var old_node = FS.lookupNode(old_dir, old_name);
    var relative = PATH.relative(old_path, new_dirname);
    if (relative.charAt(0) !== ".") {
      throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
    }
    relative = PATH.relative(new_path, old_dirname);
    if (relative.charAt(0) !== ".") {
      throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY);
    }
    var new_node;
    try {
      new_node = FS.lookupNode(new_dir, new_name);
    } catch (e) {
    }
    if (old_node === new_node) {
      return;
    }
    var isdir = FS.isDir(old_node.mode);
    var err = FS.mayDelete(old_dir, old_name, isdir);
    if (err) {
      throw new FS.ErrnoError(err);
    }
    err = new_node ? FS.mayDelete(new_dir, new_name, isdir) : FS.mayCreate(new_dir, new_name);
    if (err) {
      throw new FS.ErrnoError(err);
    }
    if (!old_dir.node_ops.rename) {
      throw new FS.ErrnoError(ERRNO_CODES.EPERM);
    }
    if (FS.isMountpoint(old_node) || new_node && FS.isMountpoint(new_node)) {
      throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
    }
    if (new_dir !== old_dir) {
      err = FS.nodePermissions(old_dir, "w");
      if (err) {
        throw new FS.ErrnoError(err);
      }
    }
    try {
      if (FS.trackingDelegate["willMovePath"]) {
        FS.trackingDelegate["willMovePath"](old_path, new_path);
      }
    } catch (e) {
      console.log("FS.trackingDelegate['willMovePath']('" + old_path + "', '" + new_path + "') threw an exception: " + e.message);
    }
    FS.hashRemoveNode(old_node);
    try {
      old_dir.node_ops.rename(old_node, new_dir, new_name);
    } catch (e) {
      throw e;
    } finally {
      FS.hashAddNode(old_node);
    }
    try {
      if (FS.trackingDelegate["onMovePath"])
        FS.trackingDelegate["onMovePath"](old_path, new_path);
    } catch (e) {
      console.log("FS.trackingDelegate['onMovePath']('" + old_path + "', '" + new_path + "') threw an exception: " + e.message);
    }
  }, rmdir: function(path2) {
    var lookup = FS.lookupPath(path2, { parent: true });
    var parent = lookup.node;
    var name = PATH.basename(path2);
    var node2 = FS.lookupNode(parent, name);
    var err = FS.mayDelete(parent, name, true);
    if (err) {
      throw new FS.ErrnoError(err);
    }
    if (!parent.node_ops.rmdir) {
      throw new FS.ErrnoError(ERRNO_CODES.EPERM);
    }
    if (FS.isMountpoint(node2)) {
      throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
    }
    try {
      if (FS.trackingDelegate["willDeletePath"]) {
        FS.trackingDelegate["willDeletePath"](path2);
      }
    } catch (e) {
      console.log("FS.trackingDelegate['willDeletePath']('" + path2 + "') threw an exception: " + e.message);
    }
    parent.node_ops.rmdir(parent, name);
    FS.destroyNode(node2);
    try {
      if (FS.trackingDelegate["onDeletePath"])
        FS.trackingDelegate["onDeletePath"](path2);
    } catch (e) {
      console.log("FS.trackingDelegate['onDeletePath']('" + path2 + "') threw an exception: " + e.message);
    }
  }, readdir: function(path2) {
    var lookup = FS.lookupPath(path2, { follow: true });
    var node2 = lookup.node;
    if (!node2.node_ops.readdir) {
      throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR);
    }
    return node2.node_ops.readdir(node2);
  }, unlink: function(path2) {
    var lookup = FS.lookupPath(path2, { parent: true });
    var parent = lookup.node;
    var name = PATH.basename(path2);
    var node2 = FS.lookupNode(parent, name);
    var err = FS.mayDelete(parent, name, false);
    if (err) {
      if (err === ERRNO_CODES.EISDIR)
        err = ERRNO_CODES.EPERM;
      throw new FS.ErrnoError(err);
    }
    if (!parent.node_ops.unlink) {
      throw new FS.ErrnoError(ERRNO_CODES.EPERM);
    }
    if (FS.isMountpoint(node2)) {
      throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
    }
    try {
      if (FS.trackingDelegate["willDeletePath"]) {
        FS.trackingDelegate["willDeletePath"](path2);
      }
    } catch (e) {
      console.log("FS.trackingDelegate['willDeletePath']('" + path2 + "') threw an exception: " + e.message);
    }
    parent.node_ops.unlink(parent, name);
    FS.destroyNode(node2);
    try {
      if (FS.trackingDelegate["onDeletePath"])
        FS.trackingDelegate["onDeletePath"](path2);
    } catch (e) {
      console.log("FS.trackingDelegate['onDeletePath']('" + path2 + "') threw an exception: " + e.message);
    }
  }, readlink: function(path2) {
    var lookup = FS.lookupPath(path2);
    var link = lookup.node;
    if (!link) {
      throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
    }
    if (!link.node_ops.readlink) {
      throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
    }
    return PATH.resolve(FS.getPath(link.parent), link.node_ops.readlink(link));
  }, stat: function(path2, dontFollow) {
    var lookup = FS.lookupPath(path2, { follow: !dontFollow });
    var node2 = lookup.node;
    if (!node2) {
      throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
    }
    if (!node2.node_ops.getattr) {
      throw new FS.ErrnoError(ERRNO_CODES.EPERM);
    }
    return node2.node_ops.getattr(node2);
  }, lstat: function(path2) {
    return FS.stat(path2, true);
  }, chmod: function(path2, mode, dontFollow) {
    var node2;
    if (typeof path2 === "string") {
      var lookup = FS.lookupPath(path2, { follow: !dontFollow });
      node2 = lookup.node;
    } else {
      node2 = path2;
    }
    if (!node2.node_ops.setattr) {
      throw new FS.ErrnoError(ERRNO_CODES.EPERM);
    }
    node2.node_ops.setattr(node2, { mode: mode & 4095 | node2.mode & ~4095, timestamp: Date.now() });
  }, lchmod: function(path2, mode) {
    FS.chmod(path2, mode, true);
  }, fchmod: function(fd, mode) {
    var stream = FS.getStream(fd);
    if (!stream) {
      throw new FS.ErrnoError(ERRNO_CODES.EBADF);
    }
    FS.chmod(stream.node, mode);
  }, chown: function(path2, uid, gid, dontFollow) {
    var node2;
    if (typeof path2 === "string") {
      var lookup = FS.lookupPath(path2, { follow: !dontFollow });
      node2 = lookup.node;
    } else {
      node2 = path2;
    }
    if (!node2.node_ops.setattr) {
      throw new FS.ErrnoError(ERRNO_CODES.EPERM);
    }
    node2.node_ops.setattr(node2, { timestamp: Date.now() });
  }, lchown: function(path2, uid, gid) {
    FS.chown(path2, uid, gid, true);
  }, fchown: function(fd, uid, gid) {
    var stream = FS.getStream(fd);
    if (!stream) {
      throw new FS.ErrnoError(ERRNO_CODES.EBADF);
    }
    FS.chown(stream.node, uid, gid);
  }, truncate: function(path2, len) {
    if (len < 0) {
      throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
    }
    var node2;
    if (typeof path2 === "string") {
      var lookup = FS.lookupPath(path2, { follow: true });
      node2 = lookup.node;
    } else {
      node2 = path2;
    }
    if (!node2.node_ops.setattr) {
      throw new FS.ErrnoError(ERRNO_CODES.EPERM);
    }
    if (FS.isDir(node2.mode)) {
      throw new FS.ErrnoError(ERRNO_CODES.EISDIR);
    }
    if (!FS.isFile(node2.mode)) {
      throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
    }
    var err = FS.nodePermissions(node2, "w");
    if (err) {
      throw new FS.ErrnoError(err);
    }
    node2.node_ops.setattr(node2, { size: len, timestamp: Date.now() });
  }, ftruncate: function(fd, len) {
    var stream = FS.getStream(fd);
    if (!stream) {
      throw new FS.ErrnoError(ERRNO_CODES.EBADF);
    }
    if ((stream.flags & 2097155) === 0) {
      throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
    }
    FS.truncate(stream.node, len);
  }, utime: function(path2, atime, mtime) {
    var lookup = FS.lookupPath(path2, { follow: true });
    var node2 = lookup.node;
    node2.node_ops.setattr(node2, { timestamp: Math.max(atime, mtime) });
  }, open: function(path2, flags, mode, fd_start, fd_end) {
    if (path2 === "") {
      throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
    }
    flags = typeof flags === "string" ? FS.modeStringToFlags(flags) : flags;
    mode = typeof mode === "undefined" ? 438 : mode;
    if (flags & 64) {
      mode = mode & 4095 | 32768;
    } else {
      mode = 0;
    }
    var node2;
    if (typeof path2 === "object") {
      node2 = path2;
    } else {
      path2 = PATH.normalize(path2);
      try {
        var lookup = FS.lookupPath(path2, { follow: !(flags & 131072) });
        node2 = lookup.node;
      } catch (e) {
      }
    }
    var created = false;
    if (flags & 64) {
      if (node2) {
        if (flags & 128) {
          throw new FS.ErrnoError(ERRNO_CODES.EEXIST);
        }
      } else {
        node2 = FS.mknod(path2, mode, 0);
        created = true;
      }
    }
    if (!node2) {
      throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
    }
    if (FS.isChrdev(node2.mode)) {
      flags &= ~512;
    }
    if (flags & 65536 && !FS.isDir(node2.mode)) {
      throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR);
    }
    if (!created) {
      var err = FS.mayOpen(node2, flags);
      if (err) {
        throw new FS.ErrnoError(err);
      }
    }
    if (flags & 512) {
      FS.truncate(node2, 0);
    }
    flags &= ~(128 | 512);
    var stream = FS.createStream({ node: node2, path: FS.getPath(node2), flags, seekable: true, position: 0, stream_ops: node2.stream_ops, ungotten: [], error: false }, fd_start, fd_end);
    if (stream.stream_ops.open) {
      stream.stream_ops.open(stream);
    }
    if (Module["logReadFiles"] && !(flags & 1)) {
      if (!FS.readFiles)
        FS.readFiles = {};
      if (!(path2 in FS.readFiles)) {
        FS.readFiles[path2] = 1;
        Module["printErr"]("read file: " + path2);
      }
    }
    try {
      if (FS.trackingDelegate["onOpenFile"]) {
        var trackingFlags = 0;
        if ((flags & 2097155) !== 1) {
          trackingFlags |= FS.tracking.openFlags.READ;
        }
        if ((flags & 2097155) !== 0) {
          trackingFlags |= FS.tracking.openFlags.WRITE;
        }
        FS.trackingDelegate["onOpenFile"](path2, trackingFlags);
      }
    } catch (e) {
      console.log("FS.trackingDelegate['onOpenFile']('" + path2 + "', flags) threw an exception: " + e.message);
    }
    return stream;
  }, close: function(stream) {
    if (stream.getdents)
      stream.getdents = null;
    try {
      if (stream.stream_ops.close) {
        stream.stream_ops.close(stream);
      }
    } catch (e) {
      throw e;
    } finally {
      FS.closeStream(stream.fd);
    }
  }, llseek: function(stream, offset, whence) {
    if (!stream.seekable || !stream.stream_ops.llseek) {
      throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);
    }
    stream.position = stream.stream_ops.llseek(stream, offset, whence);
    stream.ungotten = [];
    return stream.position;
  }, read: function(stream, buffer2, offset, length, position) {
    if (length < 0 || position < 0) {
      throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
    }
    if ((stream.flags & 2097155) === 1) {
      throw new FS.ErrnoError(ERRNO_CODES.EBADF);
    }
    if (FS.isDir(stream.node.mode)) {
      throw new FS.ErrnoError(ERRNO_CODES.EISDIR);
    }
    if (!stream.stream_ops.read) {
      throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
    }
    var seeking = true;
    if (typeof position === "undefined") {
      position = stream.position;
      seeking = false;
    } else if (!stream.seekable) {
      throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);
    }
    var bytesRead = stream.stream_ops.read(stream, buffer2, offset, length, position);
    if (!seeking)
      stream.position += bytesRead;
    return bytesRead;
  }, write: function(stream, buffer2, offset, length, position, canOwn) {
    if (length < 0 || position < 0) {
      throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
    }
    if ((stream.flags & 2097155) === 0) {
      throw new FS.ErrnoError(ERRNO_CODES.EBADF);
    }
    if (FS.isDir(stream.node.mode)) {
      throw new FS.ErrnoError(ERRNO_CODES.EISDIR);
    }
    if (!stream.stream_ops.write) {
      throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
    }
    if (stream.flags & 1024) {
      FS.llseek(stream, 0, 2);
    }
    var seeking = true;
    if (typeof position === "undefined") {
      position = stream.position;
      seeking = false;
    } else if (!stream.seekable) {
      throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);
    }
    var bytesWritten = stream.stream_ops.write(stream, buffer2, offset, length, position, canOwn);
    if (!seeking)
      stream.position += bytesWritten;
    try {
      if (stream.path && FS.trackingDelegate["onWriteToFile"])
        FS.trackingDelegate["onWriteToFile"](stream.path);
    } catch (e) {
      console.log("FS.trackingDelegate['onWriteToFile']('" + path + "') threw an exception: " + e.message);
    }
    return bytesWritten;
  }, allocate: function(stream, offset, length) {
    if (offset < 0 || length <= 0) {
      throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
    }
    if ((stream.flags & 2097155) === 0) {
      throw new FS.ErrnoError(ERRNO_CODES.EBADF);
    }
    if (!FS.isFile(stream.node.mode) && !FS.isDir(node.mode)) {
      throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
    }
    if (!stream.stream_ops.allocate) {
      throw new FS.ErrnoError(ERRNO_CODES.EOPNOTSUPP);
    }
    stream.stream_ops.allocate(stream, offset, length);
  }, mmap: function(stream, buffer2, offset, length, position, prot, flags) {
    if ((stream.flags & 2097155) === 1) {
      throw new FS.ErrnoError(ERRNO_CODES.EACCES);
    }
    if (!stream.stream_ops.mmap) {
      throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
    }
    return stream.stream_ops.mmap(stream, buffer2, offset, length, position, prot, flags);
  }, msync: function(stream, buffer2, offset, length, mmapFlags) {
    if (!stream || !stream.stream_ops.msync) {
      return 0;
    }
    return stream.stream_ops.msync(stream, buffer2, offset, length, mmapFlags);
  }, munmap: function(stream) {
    return 0;
  }, ioctl: function(stream, cmd, arg2) {
    if (!stream.stream_ops.ioctl) {
      throw new FS.ErrnoError(ERRNO_CODES.ENOTTY);
    }
    return stream.stream_ops.ioctl(stream, cmd, arg2);
  }, readFile: function(path2, opts) {
    opts = opts || {};
    opts.flags = opts.flags || "r";
    opts.encoding = opts.encoding || "binary";
    if (opts.encoding !== "utf8" && opts.encoding !== "binary") {
      throw new Error('Invalid encoding type "' + opts.encoding + '"');
    }
    var ret;
    var stream = FS.open(path2, opts.flags);
    var stat = FS.stat(path2);
    var length = stat.size;
    var buf = new Uint8Array(length);
    FS.read(stream, buf, 0, length, 0);
    if (opts.encoding === "utf8") {
      ret = UTF8ArrayToString(buf, 0);
    } else if (opts.encoding === "binary") {
      ret = buf;
    }
    FS.close(stream);
    return ret;
  }, writeFile: function(path2, data, opts) {
    opts = opts || {};
    opts.flags = opts.flags || "w";
    opts.encoding = opts.encoding || "utf8";
    if (opts.encoding !== "utf8" && opts.encoding !== "binary") {
      throw new Error('Invalid encoding type "' + opts.encoding + '"');
    }
    var stream = FS.open(path2, opts.flags, opts.mode);
    if (opts.encoding === "utf8") {
      var buf = new Uint8Array(lengthBytesUTF8(data) + 1);
      var actualNumBytes = stringToUTF8Array(data, buf, 0, buf.length);
      FS.write(stream, buf, 0, actualNumBytes, 0, opts.canOwn);
    } else if (opts.encoding === "binary") {
      FS.write(stream, data, 0, data.length, 0, opts.canOwn);
    }
    FS.close(stream);
  }, cwd: function() {
    return FS.currentPath;
  }, chdir: function(path2) {
    var lookup = FS.lookupPath(path2, { follow: true });
    if (!FS.isDir(lookup.node.mode)) {
      throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR);
    }
    var err = FS.nodePermissions(lookup.node, "x");
    if (err) {
      throw new FS.ErrnoError(err);
    }
    FS.currentPath = lookup.path;
  }, createDefaultDirectories: function() {
    FS.mkdir("/tmp");
    FS.mkdir("/home");
    FS.mkdir("/home/web_user");
  }, createDefaultDevices: function() {
    FS.mkdir("/dev");
    FS.registerDevice(FS.makedev(1, 3), { read: function() {
      return 0;
    }, write: function(stream, buffer2, offset, length, pos) {
      return length;
    } });
    FS.mkdev("/dev/null", FS.makedev(1, 3));
    TTY.register(FS.makedev(5, 0), TTY.default_tty_ops);
    TTY.register(FS.makedev(6, 0), TTY.default_tty1_ops);
    FS.mkdev("/dev/tty", FS.makedev(5, 0));
    FS.mkdev("/dev/tty1", FS.makedev(6, 0));
    var random_device;
    if (typeof crypto !== "undefined") {
      var randomBuffer = new Uint8Array(1);
      random_device = function() {
        crypto.getRandomValues(randomBuffer);
        return randomBuffer[0];
      };
    } else if (ENVIRONMENT_IS_NODE) {
      random_device = function() {
        return require("crypto").randomBytes(1)[0];
      };
    } else {
      random_device = function() {
        return Math.random() * 256 | 0;
      };
    }
    FS.createDevice("/dev", "random", random_device);
    FS.createDevice("/dev", "urandom", random_device);
    FS.mkdir("/dev/shm");
    FS.mkdir("/dev/shm/tmp");
  }, createSpecialDirectories: function() {
    FS.mkdir("/proc");
    FS.mkdir("/proc/self");
    FS.mkdir("/proc/self/fd");
    FS.mount({ mount: function() {
      var node2 = FS.createNode("/proc/self", "fd", 16384 | 511, 73);
      node2.node_ops = { lookup: function(parent, name) {
        var fd = +name;
        var stream = FS.getStream(fd);
        if (!stream)
          throw new FS.ErrnoError(ERRNO_CODES.EBADF);
        var ret = { parent: null, mount: { mountpoint: "fake" }, node_ops: { readlink: function() {
          return stream.path;
        } } };
        ret.parent = ret;
        return ret;
      } };
      return node2;
    } }, {}, "/proc/self/fd");
  }, createStandardStreams: function() {
    if (Module["stdin"]) {
      FS.createDevice("/dev", "stdin", Module["stdin"]);
    } else {
      FS.symlink("/dev/tty", "/dev/stdin");
    }
    if (Module["stdout"]) {
      FS.createDevice("/dev", "stdout", null, Module["stdout"]);
    } else {
      FS.symlink("/dev/tty", "/dev/stdout");
    }
    if (Module["stderr"]) {
      FS.createDevice("/dev", "stderr", null, Module["stderr"]);
    } else {
      FS.symlink("/dev/tty1", "/dev/stderr");
    }
    var stdin = FS.open("/dev/stdin", "r");
    assert(stdin.fd === 0, "invalid handle for stdin (" + stdin.fd + ")");
    var stdout = FS.open("/dev/stdout", "w");
    assert(stdout.fd === 1, "invalid handle for stdout (" + stdout.fd + ")");
    var stderr = FS.open("/dev/stderr", "w");
    assert(stderr.fd === 2, "invalid handle for stderr (" + stderr.fd + ")");
  }, ensureErrnoError: function() {
    if (FS.ErrnoError)
      return;
    FS.ErrnoError = function ErrnoError(errno, node2) {
      this.node = node2;
      this.setErrno = function(errno2) {
        this.errno = errno2;
        for (var key2 in ERRNO_CODES) {
          if (ERRNO_CODES[key2] === errno2) {
            this.code = key2;
            break;
          }
        }
      };
      this.setErrno(errno);
      this.message = ERRNO_MESSAGES[errno];
    };
    FS.ErrnoError.prototype = new Error();
    FS.ErrnoError.prototype.constructor = FS.ErrnoError;
    [ERRNO_CODES.ENOENT].forEach(function(code) {
      FS.genericErrors[code] = new FS.ErrnoError(code);
      FS.genericErrors[code].stack = "<generic error, no stack>";
    });
  }, staticInit: function() {
    FS.ensureErrnoError();
    FS.nameTable = new Array(4096);
    FS.mount(MEMFS, {}, "/");
    FS.createDefaultDirectories();
    FS.createDefaultDevices();
    FS.createSpecialDirectories();
    FS.filesystems = { "MEMFS": MEMFS, "IDBFS": IDBFS, "NODEFS": NODEFS, "WORKERFS": WORKERFS };
  }, init: function(input, output, error) {
    assert(!FS.init.initialized, "FS.init was previously called. If you want to initialize later with custom parameters, remove any earlier calls (note that one is automatically added to the generated code)");
    FS.init.initialized = true;
    FS.ensureErrnoError();
    Module["stdin"] = input || Module["stdin"];
    Module["stdout"] = output || Module["stdout"];
    Module["stderr"] = error || Module["stderr"];
    FS.createStandardStreams();
  }, quit: function() {
    FS.init.initialized = false;
    var fflush = Module["_fflush"];
    if (fflush)
      fflush(0);
    for (var i2 = 0; i2 < FS.streams.length; i2++) {
      var stream = FS.streams[i2];
      if (!stream) {
        continue;
      }
      FS.close(stream);
    }
  }, getMode: function(canRead, canWrite) {
    var mode = 0;
    if (canRead)
      mode |= 292 | 73;
    if (canWrite)
      mode |= 146;
    return mode;
  }, joinPath: function(parts, forceRelative) {
    var path2 = PATH.join.apply(null, parts);
    if (forceRelative && path2[0] == "/")
      path2 = path2.substr(1);
    return path2;
  }, absolutePath: function(relative, base) {
    return PATH.resolve(base, relative);
  }, standardizePath: function(path2) {
    return PATH.normalize(path2);
  }, findObject: function(path2, dontResolveLastLink) {
    var ret = FS.analyzePath(path2, dontResolveLastLink);
    if (ret.exists) {
      return ret.object;
    } else {
      ___setErrNo(ret.error);
      return null;
    }
  }, analyzePath: function(path2, dontResolveLastLink) {
    try {
      var lookup = FS.lookupPath(path2, { follow: !dontResolveLastLink });
      path2 = lookup.path;
    } catch (e) {
    }
    var ret = { isRoot: false, exists: false, error: 0, name: null, path: null, object: null, parentExists: false, parentPath: null, parentObject: null };
    try {
      var lookup = FS.lookupPath(path2, { parent: true });
      ret.parentExists = true;
      ret.parentPath = lookup.path;
      ret.parentObject = lookup.node;
      ret.name = PATH.basename(path2);
      lookup = FS.lookupPath(path2, { follow: !dontResolveLastLink });
      ret.exists = true;
      ret.path = lookup.path;
      ret.object = lookup.node;
      ret.name = lookup.node.name;
      ret.isRoot = lookup.path === "/";
    } catch (e) {
      ret.error = e.errno;
    }
    return ret;
  }, createFolder: function(parent, name, canRead, canWrite) {
    var path2 = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
    var mode = FS.getMode(canRead, canWrite);
    return FS.mkdir(path2, mode);
  }, createPath: function(parent, path2, canRead, canWrite) {
    parent = typeof parent === "string" ? parent : FS.getPath(parent);
    var parts = path2.split("/").reverse();
    while (parts.length) {
      var part = parts.pop();
      if (!part)
        continue;
      var current = PATH.join2(parent, part);
      try {
        FS.mkdir(current);
      } catch (e) {
      }
      parent = current;
    }
    return current;
  }, createFile: function(parent, name, properties, canRead, canWrite) {
    var path2 = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
    var mode = FS.getMode(canRead, canWrite);
    return FS.create(path2, mode);
  }, createDataFile: function(parent, name, data, canRead, canWrite, canOwn) {
    var path2 = name ? PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name) : parent;
    var mode = FS.getMode(canRead, canWrite);
    var node2 = FS.create(path2, mode);
    if (data) {
      if (typeof data === "string") {
        var arr = new Array(data.length);
        for (var i2 = 0, len = data.length; i2 < len; ++i2)
          arr[i2] = data.charCodeAt(i2);
        data = arr;
      }
      FS.chmod(node2, mode | 146);
      var stream = FS.open(node2, "w");
      FS.write(stream, data, 0, data.length, 0, canOwn);
      FS.close(stream);
      FS.chmod(node2, mode);
    }
    return node2;
  }, createDevice: function(parent, name, input, output) {
    var path2 = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
    var mode = FS.getMode(!!input, !!output);
    if (!FS.createDevice.major)
      FS.createDevice.major = 64;
    var dev = FS.makedev(FS.createDevice.major++, 0);
    FS.registerDevice(dev, { open: function(stream) {
      stream.seekable = false;
    }, close: function(stream) {
      if (output && output.buffer && output.buffer.length) {
        output(10);
      }
    }, read: function(stream, buffer2, offset, length, pos) {
      var bytesRead = 0;
      for (var i2 = 0; i2 < length; i2++) {
        var result;
        try {
          result = input();
        } catch (e) {
          throw new FS.ErrnoError(ERRNO_CODES.EIO);
        }
        if (result === void 0 && bytesRead === 0) {
          throw new FS.ErrnoError(ERRNO_CODES.EAGAIN);
        }
        if (result === null || result === void 0)
          break;
        bytesRead++;
        buffer2[offset + i2] = result;
      }
      if (bytesRead) {
        stream.node.timestamp = Date.now();
      }
      return bytesRead;
    }, write: function(stream, buffer2, offset, length, pos) {
      for (var i2 = 0; i2 < length; i2++) {
        try {
          output(buffer2[offset + i2]);
        } catch (e) {
          throw new FS.ErrnoError(ERRNO_CODES.EIO);
        }
      }
      if (length) {
        stream.node.timestamp = Date.now();
      }
      return i2;
    } });
    return FS.mkdev(path2, mode, dev);
  }, createLink: function(parent, name, target, canRead, canWrite) {
    var path2 = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
    return FS.symlink(target, path2);
  }, forceLoadFile: function(obj) {
    if (obj.isDevice || obj.isFolder || obj.link || obj.contents)
      return true;
    var success = true;
    if (typeof XMLHttpRequest !== "undefined") {
      throw new Error("Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.");
    } else if (Module["read"]) {
      try {
        obj.contents = intArrayFromString(Module["read"](obj.url), true);
        obj.usedBytes = obj.contents.length;
      } catch (e) {
        success = false;
      }
    } else {
      throw new Error("Cannot load without read() or XMLHttpRequest.");
    }
    if (!success)
      ___setErrNo(ERRNO_CODES.EIO);
    return success;
  }, createLazyFile: function(parent, name, url, canRead, canWrite) {
    function LazyUint8Array() {
      this.lengthKnown = false;
      this.chunks = [];
    }
    LazyUint8Array.prototype.get = function LazyUint8Array_get(idx) {
      if (idx > this.length - 1 || idx < 0) {
        return void 0;
      }
      var chunkOffset = idx % this.chunkSize;
      var chunkNum = idx / this.chunkSize | 0;
      return this.getter(chunkNum)[chunkOffset];
    };
    LazyUint8Array.prototype.setDataGetter = function LazyUint8Array_setDataGetter(getter) {
      this.getter = getter;
    };
    LazyUint8Array.prototype.cacheLength = function LazyUint8Array_cacheLength() {
      var xhr = new XMLHttpRequest();
      xhr.open("HEAD", url, false);
      xhr.send(null);
      if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304))
        throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
      var datalength = Number(xhr.getResponseHeader("Content-length"));
      var header;
      var hasByteServing = (header = xhr.getResponseHeader("Accept-Ranges")) && header === "bytes";
      var chunkSize = 1024 * 1024;
      if (!hasByteServing)
        chunkSize = datalength;
      var doXHR = function(from, to) {
        if (from > to)
          throw new Error("invalid range (" + from + ", " + to + ") or no bytes requested!");
        if (to > datalength - 1)
          throw new Error("only " + datalength + " bytes available! programmer error!");
        var xhr2 = new XMLHttpRequest();
        xhr2.open("GET", url, false);
        if (datalength !== chunkSize)
          xhr2.setRequestHeader("Range", "bytes=" + from + "-" + to);
        if (typeof Uint8Array != "undefined")
          xhr2.responseType = "arraybuffer";
        if (xhr2.overrideMimeType) {
          xhr2.overrideMimeType("text/plain; charset=x-user-defined");
        }
        xhr2.send(null);
        if (!(xhr2.status >= 200 && xhr2.status < 300 || xhr2.status === 304))
          throw new Error("Couldn't load " + url + ". Status: " + xhr2.status);
        if (xhr2.response !== void 0) {
          return new Uint8Array(xhr2.response || []);
        } else {
          return intArrayFromString(xhr2.responseText || "", true);
        }
      };
      var lazyArray2 = this;
      lazyArray2.setDataGetter(function(chunkNum) {
        var start = chunkNum * chunkSize;
        var end = (chunkNum + 1) * chunkSize - 1;
        end = Math.min(end, datalength - 1);
        if (typeof lazyArray2.chunks[chunkNum] === "undefined") {
          lazyArray2.chunks[chunkNum] = doXHR(start, end);
        }
        if (typeof lazyArray2.chunks[chunkNum] === "undefined")
          throw new Error("doXHR failed!");
        return lazyArray2.chunks[chunkNum];
      });
      this._length = datalength;
      this._chunkSize = chunkSize;
      this.lengthKnown = true;
    };
    if (typeof XMLHttpRequest !== "undefined") {
      if (!ENVIRONMENT_IS_WORKER)
        throw "Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc";
      var lazyArray = new LazyUint8Array();
      Object.defineProperty(lazyArray, "length", { get: function() {
        if (!this.lengthKnown) {
          this.cacheLength();
        }
        return this._length;
      } });
      Object.defineProperty(lazyArray, "chunkSize", { get: function() {
        if (!this.lengthKnown) {
          this.cacheLength();
        }
        return this._chunkSize;
      } });
      var properties = { isDevice: false, contents: lazyArray };
    } else {
      var properties = { isDevice: false, url };
    }
    var node2 = FS.createFile(parent, name, properties, canRead, canWrite);
    if (properties.contents) {
      node2.contents = properties.contents;
    } else if (properties.url) {
      node2.contents = null;
      node2.url = properties.url;
    }
    Object.defineProperty(node2, "usedBytes", { get: function() {
      return this.contents.length;
    } });
    var stream_ops = {};
    var keys = Object.keys(node2.stream_ops);
    keys.forEach(function(key2) {
      var fn = node2.stream_ops[key2];
      stream_ops[key2] = function forceLoadLazyFile() {
        if (!FS.forceLoadFile(node2)) {
          throw new FS.ErrnoError(ERRNO_CODES.EIO);
        }
        return fn.apply(null, arguments);
      };
    });
    stream_ops.read = function stream_ops_read(stream, buffer2, offset, length, position) {
      if (!FS.forceLoadFile(node2)) {
        throw new FS.ErrnoError(ERRNO_CODES.EIO);
      }
      var contents = stream.node.contents;
      if (position >= contents.length)
        return 0;
      var size = Math.min(contents.length - position, length);
      assert(size >= 0);
      if (contents.slice) {
        for (var i2 = 0; i2 < size; i2++) {
          buffer2[offset + i2] = contents[position + i2];
        }
      } else {
        for (var i2 = 0; i2 < size; i2++) {
          buffer2[offset + i2] = contents.get(position + i2);
        }
      }
      return size;
    };
    node2.stream_ops = stream_ops;
    return node2;
  }, createPreloadedFile: function(parent, name, url, canRead, canWrite, onload, onerror, dontCreateFile, canOwn, preFinish) {
    Browser.init();
    var fullname = name ? PATH.resolve(PATH.join2(parent, name)) : parent;
    function processData(byteArray) {
      function finish(byteArray2) {
        if (preFinish)
          preFinish();
        if (!dontCreateFile) {
          FS.createDataFile(parent, name, byteArray2, canRead, canWrite, canOwn);
        }
        if (onload)
          onload();
        removeRunDependency();
      }
      var handled = false;
      Module["preloadPlugins"].forEach(function(plugin) {
        if (handled)
          return;
        if (plugin["canHandle"](fullname)) {
          plugin["handle"](byteArray, fullname, finish, function() {
            if (onerror)
              onerror();
            removeRunDependency();
          });
          handled = true;
        }
      });
      if (!handled)
        finish(byteArray);
    }
    addRunDependency();
    if (typeof url == "string") {
      Browser.asyncLoad(url, function(byteArray) {
        processData(byteArray);
      }, onerror);
    } else {
      processData(url);
    }
  }, indexedDB: function() {
    return window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
  }, DB_NAME: function() {
    return "EM_FS_" + window.location.pathname;
  }, DB_VERSION: 20, DB_STORE_NAME: "FILE_DATA", saveFilesToDB: function(paths, onload, onerror) {
    onload = onload || function() {
    };
    onerror = onerror || function() {
    };
    var indexedDB2 = FS.indexedDB();
    try {
      var openRequest = indexedDB2.open(FS.DB_NAME(), FS.DB_VERSION);
    } catch (e) {
      return onerror(e);
    }
    openRequest.onupgradeneeded = function openRequest_onupgradeneeded() {
      console.log("creating db");
      var db = openRequest.result;
      db.createObjectStore(FS.DB_STORE_NAME);
    };
    openRequest.onsuccess = function openRequest_onsuccess() {
      var db = openRequest.result;
      var transaction = db.transaction([FS.DB_STORE_NAME], "readwrite");
      var files = transaction.objectStore(FS.DB_STORE_NAME);
      var ok = 0, fail = 0, total = paths.length;
      function finish() {
        if (fail == 0)
          onload();
        else
          onerror();
      }
      paths.forEach(function(path2) {
        var putRequest = files.put(FS.analyzePath(path2).object.contents, path2);
        putRequest.onsuccess = function putRequest_onsuccess() {
          ok++;
          if (ok + fail == total)
            finish();
        };
        putRequest.onerror = function putRequest_onerror() {
          fail++;
          if (ok + fail == total)
            finish();
        };
      });
      transaction.onerror = onerror;
    };
    openRequest.onerror = onerror;
  }, loadFilesFromDB: function(paths, onload, onerror) {
    onload = onload || function() {
    };
    onerror = onerror || function() {
    };
    var indexedDB2 = FS.indexedDB();
    try {
      var openRequest = indexedDB2.open(FS.DB_NAME(), FS.DB_VERSION);
    } catch (e) {
      return onerror(e);
    }
    openRequest.onupgradeneeded = onerror;
    openRequest.onsuccess = function openRequest_onsuccess() {
      var db = openRequest.result;
      try {
        var transaction = db.transaction([FS.DB_STORE_NAME], "readonly");
      } catch (e) {
        onerror(e);
        return;
      }
      var files = transaction.objectStore(FS.DB_STORE_NAME);
      var ok = 0, fail = 0, total = paths.length;
      function finish() {
        if (fail == 0)
          onload();
        else
          onerror();
      }
      paths.forEach(function(path2) {
        var getRequest = files.get(path2);
        getRequest.onsuccess = function getRequest_onsuccess() {
          if (FS.analyzePath(path2).exists) {
            FS.unlink(path2);
          }
          FS.createDataFile(PATH.dirname(path2), PATH.basename(path2), getRequest.result, true, true, true);
          ok++;
          if (ok + fail == total)
            finish();
        };
        getRequest.onerror = function getRequest_onerror() {
          fail++;
          if (ok + fail == total)
            finish();
        };
      });
      transaction.onerror = onerror;
    };
    openRequest.onerror = onerror;
  } };
  var PATH = { splitPath: function(filename) {
    var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
    return splitPathRe.exec(filename).slice(1);
  }, normalizeArray: function(parts, allowAboveRoot) {
    var up = 0;
    for (var i2 = parts.length - 1; i2 >= 0; i2--) {
      var last = parts[i2];
      if (last === ".") {
        parts.splice(i2, 1);
      } else if (last === "..") {
        parts.splice(i2, 1);
        up++;
      } else if (up) {
        parts.splice(i2, 1);
        up--;
      }
    }
    if (allowAboveRoot) {
      for (; up--; up) {
        parts.unshift("..");
      }
    }
    return parts;
  }, normalize: function(path2) {
    var isAbsolute = path2.charAt(0) === "/", trailingSlash = path2.substr(-1) === "/";
    path2 = PATH.normalizeArray(path2.split("/").filter(function(p) {
      return !!p;
    }), !isAbsolute).join("/");
    if (!path2 && !isAbsolute) {
      path2 = ".";
    }
    if (path2 && trailingSlash) {
      path2 += "/";
    }
    return (isAbsolute ? "/" : "") + path2;
  }, dirname: function(path2) {
    var result = PATH.splitPath(path2), root = result[0], dir = result[1];
    if (!root && !dir) {
      return ".";
    }
    if (dir) {
      dir = dir.substr(0, dir.length - 1);
    }
    return root + dir;
  }, basename: function(path2) {
    if (path2 === "/")
      return "/";
    var lastSlash = path2.lastIndexOf("/");
    if (lastSlash === -1)
      return path2;
    return path2.substr(lastSlash + 1);
  }, extname: function(path2) {
    return PATH.splitPath(path2)[3];
  }, join: function() {
    var paths = Array.prototype.slice.call(arguments, 0);
    return PATH.normalize(paths.join("/"));
  }, join2: function(l, r) {
    return PATH.normalize(l + "/" + r);
  }, resolve: function() {
    var resolvedPath = "", resolvedAbsolute = false;
    for (var i2 = arguments.length - 1; i2 >= -1 && !resolvedAbsolute; i2--) {
      var path2 = i2 >= 0 ? arguments[i2] : FS.cwd();
      if (typeof path2 !== "string") {
        throw new TypeError("Arguments to path.resolve must be strings");
      } else if (!path2) {
        return "";
      }
      resolvedPath = path2 + "/" + resolvedPath;
      resolvedAbsolute = path2.charAt(0) === "/";
    }
    resolvedPath = PATH.normalizeArray(resolvedPath.split("/").filter(function(p) {
      return !!p;
    }), !resolvedAbsolute).join("/");
    return (resolvedAbsolute ? "/" : "") + resolvedPath || ".";
  }, relative: function(from, to) {
    from = PATH.resolve(from).substr(1);
    to = PATH.resolve(to).substr(1);
    function trim(arr) {
      var start = 0;
      for (; start < arr.length; start++) {
        if (arr[start] !== "")
          break;
      }
      var end = arr.length - 1;
      for (; end >= 0; end--) {
        if (arr[end] !== "")
          break;
      }
      if (start > end)
        return [];
      return arr.slice(start, end - start + 1);
    }
    var fromParts = trim(from.split("/"));
    var toParts = trim(to.split("/"));
    var length = Math.min(fromParts.length, toParts.length);
    var samePartsLength = length;
    for (var i2 = 0; i2 < length; i2++) {
      if (fromParts[i2] !== toParts[i2]) {
        samePartsLength = i2;
        break;
      }
    }
    var outputParts = [];
    for (var i2 = samePartsLength; i2 < fromParts.length; i2++) {
      outputParts.push("..");
    }
    outputParts = outputParts.concat(toParts.slice(samePartsLength));
    return outputParts.join("/");
  } };
  function _emscripten_set_main_loop_timing(mode, value) {
    Browser.mainLoop.timingMode = mode;
    Browser.mainLoop.timingValue = value;
    if (!Browser.mainLoop.func) {
      return 1;
    }
    if (mode == 0) {
      Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_setTimeout() {
        setTimeout(Browser.mainLoop.runner, value);
      };
      Browser.mainLoop.method = "timeout";
    } else if (mode == 1) {
      Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_rAF() {
        Browser.requestAnimationFrame(Browser.mainLoop.runner);
      };
      Browser.mainLoop.method = "rAF";
    } else if (mode == 2) {
      if (!window["setImmediate"]) {
        let Browser_setImmediate_messageHandler = function(event) {
          if (event.source === window && event.data === emscriptenMainLoopMessageId) {
            event.stopPropagation();
            setImmediates.shift()();
          }
        };
        var setImmediates = [];
        var emscriptenMainLoopMessageId = "__emcc";
        window.addEventListener("message", Browser_setImmediate_messageHandler, true);
        window["setImmediate"] = function Browser_emulated_setImmediate(func2) {
          setImmediates.push(func2);
          window.postMessage(emscriptenMainLoopMessageId, "*");
        };
      }
      Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_setImmediate() {
        window["setImmediate"](Browser.mainLoop.runner);
      };
      Browser.mainLoop.method = "immediate";
    }
    return 0;
  }
  function _emscripten_set_main_loop(func2, fps, simulateInfiniteLoop, arg2, noSetTiming) {
    Module["noExitRuntime"] = true;
    assert(!Browser.mainLoop.func, "emscripten_set_main_loop: there can only be one main loop function at once: call emscripten_cancel_main_loop to cancel the previous one before setting a new one with different parameters.");
    Browser.mainLoop.func = func2;
    Browser.mainLoop.arg = arg2;
    var thisMainLoopId = Browser.mainLoop.currentlyRunningMainloop;
    Browser.mainLoop.runner = function Browser_mainLoop_runner() {
      if (ABORT)
        return;
      if (Browser.mainLoop.queue.length > 0) {
        var start = Date.now();
        var blocker = Browser.mainLoop.queue.shift();
        blocker.func(blocker.arg);
        if (Browser.mainLoop.remainingBlockers) {
          var remaining = Browser.mainLoop.remainingBlockers;
          var next = remaining % 1 == 0 ? remaining - 1 : Math.floor(remaining);
          if (blocker.counted) {
            Browser.mainLoop.remainingBlockers = next;
          } else {
            next = next + 0.5;
            Browser.mainLoop.remainingBlockers = (8 * remaining + next) / 9;
          }
        }
        console.log('main loop blocker "' + blocker.name + '" took ' + (Date.now() - start) + " ms");
        Browser.mainLoop.updateStatus();
        setTimeout(Browser.mainLoop.runner, 0);
        return;
      }
      if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop)
        return;
      Browser.mainLoop.currentFrameNumber = Browser.mainLoop.currentFrameNumber + 1 | 0;
      if (Browser.mainLoop.timingMode == 1 && Browser.mainLoop.timingValue > 1 && Browser.mainLoop.currentFrameNumber % Browser.mainLoop.timingValue != 0) {
        Browser.mainLoop.scheduler();
        return;
      }
      if (Browser.mainLoop.method === "timeout" && Module.ctx) {
        Module.printErr("Looks like you are rendering without using requestAnimationFrame for the main loop. You should use 0 for the frame rate in emscripten_set_main_loop in order to use requestAnimationFrame, as that can greatly improve your frame rates!");
        Browser.mainLoop.method = "";
      }
      Browser.mainLoop.runIter(function() {
        if (typeof arg2 !== "undefined") {
          Runtime.dynCall("vi", func2, [arg2]);
        } else {
          Runtime.dynCall("v", func2);
        }
      });
      if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop)
        return;
      if (typeof SDL === "object" && SDL.audio && SDL.audio.queueNewAudioData)
        SDL.audio.queueNewAudioData();
      Browser.mainLoop.scheduler();
    };
    if (!noSetTiming) {
      if (fps && fps > 0)
        _emscripten_set_main_loop_timing(0, 1e3 / fps);
      else
        _emscripten_set_main_loop_timing(1, 1);
      Browser.mainLoop.scheduler();
    }
    if (simulateInfiniteLoop) {
      throw "SimulateInfiniteLoop";
    }
  }
  var Browser = { mainLoop: { scheduler: null, method: "", currentlyRunningMainloop: 0, func: null, arg: 0, timingMode: 0, timingValue: 0, currentFrameNumber: 0, queue: [], pause: function() {
    Browser.mainLoop.scheduler = null;
    Browser.mainLoop.currentlyRunningMainloop++;
  }, resume: function() {
    Browser.mainLoop.currentlyRunningMainloop++;
    var timingMode = Browser.mainLoop.timingMode;
    var timingValue = Browser.mainLoop.timingValue;
    var func2 = Browser.mainLoop.func;
    Browser.mainLoop.func = null;
    _emscripten_set_main_loop(func2, 0, false, Browser.mainLoop.arg, true);
    _emscripten_set_main_loop_timing(timingMode, timingValue);
    Browser.mainLoop.scheduler();
  }, updateStatus: function() {
    if (Module["setStatus"]) {
      var message = Module["statusMessage"] || "Please wait...";
      var remaining = Browser.mainLoop.remainingBlockers;
      var expected = Browser.mainLoop.expectedBlockers;
      if (remaining) {
        if (remaining < expected) {
          Module["setStatus"](message + " (" + (expected - remaining) + "/" + expected + ")");
        } else {
          Module["setStatus"](message);
        }
      } else {
        Module["setStatus"]("");
      }
    }
  }, runIter: function(func2) {
    if (ABORT)
      return;
    if (Module["preMainLoop"]) {
      var preRet = Module["preMainLoop"]();
      if (preRet === false) {
        return;
      }
    }
    try {
      func2();
    } catch (e) {
      if (e instanceof ExitStatus) {
        return;
      } else {
        if (e && typeof e === "object" && e.stack)
          Module.printErr("exception thrown: " + [e, e.stack]);
        throw e;
      }
    }
    if (Module["postMainLoop"])
      Module["postMainLoop"]();
  } }, isFullScreen: false, pointerLock: false, moduleContextCreatedCallbacks: [], workers: [], init: function() {
    if (!Module["preloadPlugins"])
      Module["preloadPlugins"] = [];
    if (Browser.initted)
      return;
    Browser.initted = true;
    try {
      new Blob();
      Browser.hasBlobConstructor = true;
    } catch (e) {
      Browser.hasBlobConstructor = false;
      console.log("warning: no blob constructor, cannot create blobs with mimetypes");
    }
    Browser.BlobBuilder = typeof MozBlobBuilder != "undefined" ? MozBlobBuilder : typeof WebKitBlobBuilder != "undefined" ? WebKitBlobBuilder : !Browser.hasBlobConstructor ? console.log("warning: no BlobBuilder") : null;
    Browser.URLObject = typeof window != "undefined" ? window.URL ? window.URL : window.webkitURL : void 0;
    if (!Module.noImageDecoding && typeof Browser.URLObject === "undefined") {
      console.log("warning: Browser does not support creating object URLs. Built-in browser image decoding will not be available.");
      Module.noImageDecoding = true;
    }
    var imagePlugin = {};
    imagePlugin["canHandle"] = function imagePlugin_canHandle(name) {
      return !Module.noImageDecoding && /\.(jpg|jpeg|png|bmp)$/i.test(name);
    };
    imagePlugin["handle"] = function imagePlugin_handle(byteArray, name, onload, onerror) {
      var b = null;
      if (Browser.hasBlobConstructor) {
        try {
          b = new Blob([byteArray], { type: Browser.getMimetype(name) });
          if (b.size !== byteArray.length) {
            b = new Blob([new Uint8Array(byteArray).buffer], { type: Browser.getMimetype(name) });
          }
        } catch (e) {
          Runtime.warnOnce("Blob constructor present but fails: " + e + "; falling back to blob builder");
        }
      }
      if (!b) {
        var bb = new Browser.BlobBuilder();
        bb.append(new Uint8Array(byteArray).buffer);
        b = bb.getBlob();
      }
      var url = Browser.URLObject.createObjectURL(b);
      var img = new Image();
      img.onload = function img_onload() {
        assert(img.complete, "Image " + name + " could not be decoded");
        var canvas2 = document.createElement("canvas");
        canvas2.width = img.width;
        canvas2.height = img.height;
        var ctx = canvas2.getContext("2d");
        ctx.drawImage(img, 0, 0);
        Module["preloadedImages"][name] = canvas2;
        Browser.URLObject.revokeObjectURL(url);
        if (onload)
          onload(byteArray);
      };
      img.onerror = function img_onerror(event) {
        console.log("Image " + url + " could not be decoded");
        if (onerror)
          onerror();
      };
      img.src = url;
    };
    Module["preloadPlugins"].push(imagePlugin);
    var audioPlugin = {};
    audioPlugin["canHandle"] = function audioPlugin_canHandle(name) {
      return !Module.noAudioDecoding && name.substr(-4) in { ".ogg": 1, ".wav": 1, ".mp3": 1 };
    };
    audioPlugin["handle"] = function audioPlugin_handle(byteArray, name, onload, onerror) {
      var done = false;
      function finish(audio2) {
        if (done)
          return;
        done = true;
        Module["preloadedAudios"][name] = audio2;
        if (onload)
          onload(byteArray);
      }
      function fail() {
        if (done)
          return;
        done = true;
        Module["preloadedAudios"][name] = new Audio();
        if (onerror)
          onerror();
      }
      if (Browser.hasBlobConstructor) {
        try {
          var b = new Blob([byteArray], { type: Browser.getMimetype(name) });
        } catch (e) {
          return fail();
        }
        var url = Browser.URLObject.createObjectURL(b);
        var audio = new Audio();
        audio.addEventListener("canplaythrough", function() {
          finish(audio);
        }, false);
        audio.onerror = function audio_onerror(event) {
          if (done)
            return;
          console.log("warning: browser could not fully decode audio " + name + ", trying slower base64 approach");
          function encode64(data) {
            var BASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
            var PAD = "=";
            var ret = "";
            var leftchar = 0;
            var leftbits = 0;
            for (var i2 = 0; i2 < data.length; i2++) {
              leftchar = leftchar << 8 | data[i2];
              leftbits += 8;
              while (leftbits >= 6) {
                var curr = leftchar >> leftbits - 6 & 63;
                leftbits -= 6;
                ret += BASE[curr];
              }
            }
            if (leftbits == 2) {
              ret += BASE[(leftchar & 3) << 4];
              ret += PAD + PAD;
            } else if (leftbits == 4) {
              ret += BASE[(leftchar & 15) << 2];
              ret += PAD;
            }
            return ret;
          }
          audio.src = "data:audio/x-" + name.substr(-3) + ";base64," + encode64(byteArray);
          finish(audio);
        };
        audio.src = url;
        Browser.safeSetTimeout(function() {
          finish(audio);
        }, 1e4);
      } else {
        return fail();
      }
    };
    Module["preloadPlugins"].push(audioPlugin);
    var canvas = Module["canvas"];
    function pointerLockChange() {
      Browser.pointerLock = document["pointerLockElement"] === canvas || document["mozPointerLockElement"] === canvas || document["webkitPointerLockElement"] === canvas || document["msPointerLockElement"] === canvas;
    }
    if (canvas) {
      canvas.requestPointerLock = canvas["requestPointerLock"] || canvas["mozRequestPointerLock"] || canvas["webkitRequestPointerLock"] || canvas["msRequestPointerLock"] || function() {
      };
      canvas.exitPointerLock = document["exitPointerLock"] || document["mozExitPointerLock"] || document["webkitExitPointerLock"] || document["msExitPointerLock"] || function() {
      };
      canvas.exitPointerLock = canvas.exitPointerLock.bind(document);
      document.addEventListener("pointerlockchange", pointerLockChange, false);
      document.addEventListener("mozpointerlockchange", pointerLockChange, false);
      document.addEventListener("webkitpointerlockchange", pointerLockChange, false);
      document.addEventListener("mspointerlockchange", pointerLockChange, false);
      if (Module["elementPointerLock"]) {
        canvas.addEventListener("click", function(ev) {
          if (!Browser.pointerLock && canvas.requestPointerLock) {
            canvas.requestPointerLock();
            ev.preventDefault();
          }
        }, false);
      }
    }
  }, createContext: function(canvas, useWebGL, setInModule, webGLContextAttributes) {
    if (useWebGL && Module.ctx && canvas == Module.canvas)
      return Module.ctx;
    var ctx;
    var contextHandle;
    if (useWebGL) {
      var contextAttributes = { antialias: false, alpha: false };
      if (webGLContextAttributes) {
        for (var attribute in webGLContextAttributes) {
          contextAttributes[attribute] = webGLContextAttributes[attribute];
        }
      }
      contextHandle = GL.createContext(canvas, contextAttributes);
      if (contextHandle) {
        ctx = GL.getContext(contextHandle).GLctx;
      }
      canvas.style.backgroundColor = "black";
    } else {
      ctx = canvas.getContext("2d");
    }
    if (!ctx)
      return null;
    if (setInModule) {
      if (!useWebGL)
        assert(typeof GLctx === "undefined", "cannot set in module if GLctx is used, but we are a non-GL context that would replace it");
      Module.ctx = ctx;
      if (useWebGL)
        GL.makeContextCurrent(contextHandle);
      Module.useWebGL = useWebGL;
      Browser.moduleContextCreatedCallbacks.forEach(function(callback) {
        callback();
      });
      Browser.init();
    }
    return ctx;
  }, destroyContext: function(canvas, useWebGL, setInModule) {
  }, fullScreenHandlersInstalled: false, lockPointer: void 0, resizeCanvas: void 0, requestFullScreen: function(lockPointer, resizeCanvas, vrDevice) {
    Browser.lockPointer = lockPointer;
    Browser.resizeCanvas = resizeCanvas;
    Browser.vrDevice = vrDevice;
    if (typeof Browser.lockPointer === "undefined")
      Browser.lockPointer = true;
    if (typeof Browser.resizeCanvas === "undefined")
      Browser.resizeCanvas = false;
    if (typeof Browser.vrDevice === "undefined")
      Browser.vrDevice = null;
    var canvas = Module["canvas"];
    function fullScreenChange() {
      Browser.isFullScreen = false;
      var canvasContainer2 = canvas.parentNode;
      if ((document["webkitFullScreenElement"] || document["webkitFullscreenElement"] || document["mozFullScreenElement"] || document["mozFullscreenElement"] || document["fullScreenElement"] || document["fullscreenElement"] || document["msFullScreenElement"] || document["msFullscreenElement"] || document["webkitCurrentFullScreenElement"]) === canvasContainer2) {
        canvas.cancelFullScreen = document["cancelFullScreen"] || document["mozCancelFullScreen"] || document["webkitCancelFullScreen"] || document["msExitFullscreen"] || document["exitFullscreen"] || function() {
        };
        canvas.cancelFullScreen = canvas.cancelFullScreen.bind(document);
        if (Browser.lockPointer)
          canvas.requestPointerLock();
        Browser.isFullScreen = true;
        if (Browser.resizeCanvas)
          Browser.setFullScreenCanvasSize();
      } else {
        canvasContainer2.parentNode.insertBefore(canvas, canvasContainer2);
        canvasContainer2.parentNode.removeChild(canvasContainer2);
        if (Browser.resizeCanvas)
          Browser.setWindowedCanvasSize();
      }
      if (Module["onFullScreen"])
        Module["onFullScreen"](Browser.isFullScreen);
      Browser.updateCanvasDimensions(canvas);
    }
    if (!Browser.fullScreenHandlersInstalled) {
      Browser.fullScreenHandlersInstalled = true;
      document.addEventListener("fullscreenchange", fullScreenChange, false);
      document.addEventListener("mozfullscreenchange", fullScreenChange, false);
      document.addEventListener("webkitfullscreenchange", fullScreenChange, false);
      document.addEventListener("MSFullscreenChange", fullScreenChange, false);
    }
    var canvasContainer = document.createElement("div");
    canvas.parentNode.insertBefore(canvasContainer, canvas);
    canvasContainer.appendChild(canvas);
    canvasContainer.requestFullScreen = canvasContainer["requestFullScreen"] || canvasContainer["mozRequestFullScreen"] || canvasContainer["msRequestFullscreen"] || (canvasContainer["webkitRequestFullScreen"] ? function() {
      canvasContainer["webkitRequestFullScreen"](Element["ALLOW_KEYBOARD_INPUT"]);
    } : null);
    if (vrDevice) {
      canvasContainer.requestFullScreen({ vrDisplay: vrDevice });
    } else {
      canvasContainer.requestFullScreen();
    }
  }, nextRAF: 0, fakeRequestAnimationFrame: function(func2) {
    var now = Date.now();
    if (Browser.nextRAF === 0) {
      Browser.nextRAF = now + 1e3 / 60;
    } else {
      while (now + 2 >= Browser.nextRAF) {
        Browser.nextRAF += 1e3 / 60;
      }
    }
    var delay = Math.max(Browser.nextRAF - now, 0);
    setTimeout(func2, delay);
  }, requestAnimationFrame: function requestAnimationFrame(func2) {
    if (typeof window === "undefined") {
      Browser.fakeRequestAnimationFrame(func2);
    } else {
      if (!window.requestAnimationFrame) {
        window.requestAnimationFrame = window["requestAnimationFrame"] || window["mozRequestAnimationFrame"] || window["webkitRequestAnimationFrame"] || window["msRequestAnimationFrame"] || window["oRequestAnimationFrame"] || Browser.fakeRequestAnimationFrame;
      }
      window.requestAnimationFrame(func2);
    }
  }, safeCallback: function(func2) {
    return function() {
      if (!ABORT)
        return func2.apply(null, arguments);
    };
  }, allowAsyncCallbacks: true, queuedAsyncCallbacks: [], pauseAsyncCallbacks: function() {
    Browser.allowAsyncCallbacks = false;
  }, resumeAsyncCallbacks: function() {
    Browser.allowAsyncCallbacks = true;
    if (Browser.queuedAsyncCallbacks.length > 0) {
      var callbacks = Browser.queuedAsyncCallbacks;
      Browser.queuedAsyncCallbacks = [];
      callbacks.forEach(function(func2) {
        func2();
      });
    }
  }, safeRequestAnimationFrame: function(func2) {
    return Browser.requestAnimationFrame(function() {
      if (ABORT)
        return;
      if (Browser.allowAsyncCallbacks) {
        func2();
      } else {
        Browser.queuedAsyncCallbacks.push(func2);
      }
    });
  }, safeSetTimeout: function(func2, timeout) {
    Module["noExitRuntime"] = true;
    return setTimeout(function() {
      if (ABORT)
        return;
      if (Browser.allowAsyncCallbacks) {
        func2();
      } else {
        Browser.queuedAsyncCallbacks.push(func2);
      }
    }, timeout);
  }, safeSetInterval: function(func2, timeout) {
    Module["noExitRuntime"] = true;
    return setInterval(function() {
      if (ABORT)
        return;
      if (Browser.allowAsyncCallbacks) {
        func2();
      }
    }, timeout);
  }, getMimetype: function(name) {
    return { "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "bmp": "image/bmp", "ogg": "audio/ogg", "wav": "audio/wav", "mp3": "audio/mpeg" }[name.substr(name.lastIndexOf(".") + 1)];
  }, getUserMedia: function(func2) {
    if (!window.getUserMedia) {
      window.getUserMedia = navigator["getUserMedia"] || navigator["mozGetUserMedia"];
    }
    window.getUserMedia(func2);
  }, getMovementX: function(event) {
    return event["movementX"] || event["mozMovementX"] || event["webkitMovementX"] || 0;
  }, getMovementY: function(event) {
    return event["movementY"] || event["mozMovementY"] || event["webkitMovementY"] || 0;
  }, getMouseWheelDelta: function(event) {
    var delta = 0;
    switch (event.type) {
      case "DOMMouseScroll":
        delta = event.detail;
        break;
      case "mousewheel":
        delta = event.wheelDelta;
        break;
      case "wheel":
        delta = event["deltaY"];
        break;
      default:
        throw "unrecognized mouse wheel event: " + event.type;
    }
    return delta;
  }, mouseX: 0, mouseY: 0, mouseMovementX: 0, mouseMovementY: 0, touches: {}, lastTouches: {}, calculateMouseEvent: function(event) {
    if (Browser.pointerLock) {
      if (event.type != "mousemove" && "mozMovementX" in event) {
        Browser.mouseMovementX = Browser.mouseMovementY = 0;
      } else {
        Browser.mouseMovementX = Browser.getMovementX(event);
        Browser.mouseMovementY = Browser.getMovementY(event);
      }
      if (typeof SDL != "undefined") {
        Browser.mouseX = SDL.mouseX + Browser.mouseMovementX;
        Browser.mouseY = SDL.mouseY + Browser.mouseMovementY;
      } else {
        Browser.mouseX += Browser.mouseMovementX;
        Browser.mouseY += Browser.mouseMovementY;
      }
    } else {
      var rect = Module["canvas"].getBoundingClientRect();
      var cw = Module["canvas"].width;
      var ch = Module["canvas"].height;
      var scrollX = typeof window.scrollX !== "undefined" ? window.scrollX : window.pageXOffset;
      var scrollY = typeof window.scrollY !== "undefined" ? window.scrollY : window.pageYOffset;
      if (event.type === "touchstart" || event.type === "touchend" || event.type === "touchmove") {
        var touch = event.touch;
        if (touch === void 0) {
          return;
        }
        var adjustedX = touch.pageX - (scrollX + rect.left);
        var adjustedY = touch.pageY - (scrollY + rect.top);
        adjustedX = adjustedX * (cw / rect.width);
        adjustedY = adjustedY * (ch / rect.height);
        var coords = { x: adjustedX, y: adjustedY };
        if (event.type === "touchstart") {
          Browser.lastTouches[touch.identifier] = coords;
          Browser.touches[touch.identifier] = coords;
        } else if (event.type === "touchend" || event.type === "touchmove") {
          var last = Browser.touches[touch.identifier];
          if (!last)
            last = coords;
          Browser.lastTouches[touch.identifier] = last;
          Browser.touches[touch.identifier] = coords;
        }
        return;
      }
      var x = event.pageX - (scrollX + rect.left);
      var y = event.pageY - (scrollY + rect.top);
      x = x * (cw / rect.width);
      y = y * (ch / rect.height);
      Browser.mouseMovementX = x - Browser.mouseX;
      Browser.mouseMovementY = y - Browser.mouseY;
      Browser.mouseX = x;
      Browser.mouseY = y;
    }
  }, xhrLoad: function(url, onload, onerror) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.responseType = "arraybuffer";
    xhr.onload = function xhr_onload() {
      if (xhr.status == 200 || xhr.status == 0 && xhr.response) {
        onload(xhr.response);
      } else {
        onerror();
      }
    };
    xhr.onerror = onerror;
    xhr.send(null);
  }, asyncLoad: function(url, onload, onerror, noRunDep) {
    Browser.xhrLoad(url, function(arrayBuffer) {
      assert(arrayBuffer, 'Loading data file "' + url + '" failed (no arrayBuffer).');
      onload(new Uint8Array(arrayBuffer));
      if (!noRunDep)
        removeRunDependency();
    }, function(event) {
      if (onerror) {
        onerror();
      } else {
        throw 'Loading data file "' + url + '" failed.';
      }
    });
    if (!noRunDep)
      addRunDependency();
  }, resizeListeners: [], updateResizeListeners: function() {
    var canvas = Module["canvas"];
    Browser.resizeListeners.forEach(function(listener) {
      listener(canvas.width, canvas.height);
    });
  }, setCanvasSize: function(width, height, noUpdates) {
    var canvas = Module["canvas"];
    Browser.updateCanvasDimensions(canvas, width, height);
    if (!noUpdates)
      Browser.updateResizeListeners();
  }, windowedWidth: 0, windowedHeight: 0, setFullScreenCanvasSize: function() {
    if (typeof SDL != "undefined") {
      var flags = HEAPU32[SDL.screen + Runtime.QUANTUM_SIZE * 0 >> 2];
      flags = flags | 8388608;
      HEAP32[SDL.screen + Runtime.QUANTUM_SIZE * 0 >> 2] = flags;
    }
    Browser.updateResizeListeners();
  }, setWindowedCanvasSize: function() {
    if (typeof SDL != "undefined") {
      var flags = HEAPU32[SDL.screen + Runtime.QUANTUM_SIZE * 0 >> 2];
      flags = flags & ~8388608;
      HEAP32[SDL.screen + Runtime.QUANTUM_SIZE * 0 >> 2] = flags;
    }
    Browser.updateResizeListeners();
  }, updateCanvasDimensions: function(canvas, wNative, hNative) {
    if (wNative && hNative) {
      canvas.widthNative = wNative;
      canvas.heightNative = hNative;
    } else {
      wNative = canvas.widthNative;
      hNative = canvas.heightNative;
    }
    var w = wNative;
    var h = hNative;
    if (Module["forcedAspectRatio"] && Module["forcedAspectRatio"] > 0) {
      if (w / h < Module["forcedAspectRatio"]) {
        w = Math.round(h * Module["forcedAspectRatio"]);
      } else {
        h = Math.round(w / Module["forcedAspectRatio"]);
      }
    }
    if ((document["webkitFullScreenElement"] || document["webkitFullscreenElement"] || document["mozFullScreenElement"] || document["mozFullscreenElement"] || document["fullScreenElement"] || document["fullscreenElement"] || document["msFullScreenElement"] || document["msFullscreenElement"] || document["webkitCurrentFullScreenElement"]) === canvas.parentNode && typeof screen != "undefined") {
      var factor = Math.min(screen.width / w, screen.height / h);
      w = Math.round(w * factor);
      h = Math.round(h * factor);
    }
    if (Browser.resizeCanvas) {
      if (canvas.width != w)
        canvas.width = w;
      if (canvas.height != h)
        canvas.height = h;
      if (typeof canvas.style != "undefined") {
        canvas.style.removeProperty("width");
        canvas.style.removeProperty("height");
      }
    } else {
      if (canvas.width != wNative)
        canvas.width = wNative;
      if (canvas.height != hNative)
        canvas.height = hNative;
      if (typeof canvas.style != "undefined") {
        if (w != wNative || h != hNative) {
          canvas.style.setProperty("width", w + "px", "important");
          canvas.style.setProperty("height", h + "px", "important");
        } else {
          canvas.style.removeProperty("width");
          canvas.style.removeProperty("height");
        }
      }
    }
  }, wgetRequests: {}, nextWgetRequestHandle: 0, getNextWgetRequestHandle: function() {
    var handle = Browser.nextWgetRequestHandle;
    Browser.nextWgetRequestHandle++;
    return handle;
  } };
  function _time(ptr) {
    var ret = Date.now() / 1e3 | 0;
    if (ptr) {
      HEAP32[ptr >> 2] = ret;
    }
    return ret;
  }
  function _pthread_self() {
    return 0;
  }
  Module["requestFullScreen"] = function Module_requestFullScreen(lockPointer, resizeCanvas, vrDevice) {
    Browser.requestFullScreen(lockPointer, resizeCanvas, vrDevice);
  };
  Module["requestAnimationFrame"] = function Module_requestAnimationFrame(func2) {
    Browser.requestAnimationFrame(func2);
  };
  Module["setCanvasSize"] = function Module_setCanvasSize(width, height, noUpdates) {
    Browser.setCanvasSize(width, height, noUpdates);
  };
  Module["pauseMainLoop"] = function Module_pauseMainLoop() {
    Browser.mainLoop.pause();
  };
  Module["resumeMainLoop"] = function Module_resumeMainLoop() {
    Browser.mainLoop.resume();
  };
  Module["getUserMedia"] = function Module_getUserMedia() {
    Browser.getUserMedia();
  };
  Module["createContext"] = function Module_createContext(canvas, useWebGL, setInModule, webGLContextAttributes) {
    return Browser.createContext(canvas, useWebGL, setInModule, webGLContextAttributes);
  };
  FS.staticInit();
  __ATINIT__.unshift(function() {
    if (!Module["noFSInit"] && !FS.init.initialized)
      FS.init();
  });
  __ATMAIN__.push(function() {
    FS.ignorePermissions = false;
  });
  __ATEXIT__.push(function() {
    FS.quit();
  });
  Module["FS_createFolder"] = FS.createFolder;
  Module["FS_createPath"] = FS.createPath;
  Module["FS_createDataFile"] = FS.createDataFile;
  Module["FS_createPreloadedFile"] = FS.createPreloadedFile;
  Module["FS_createLazyFile"] = FS.createLazyFile;
  Module["FS_createLink"] = FS.createLink;
  Module["FS_createDevice"] = FS.createDevice;
  Module["FS_unlink"] = FS.unlink;
  __ATINIT__.unshift(function() {
  });
  __ATEXIT__.push(function() {
  });
  if (ENVIRONMENT_IS_NODE) {
    var fs = require("fs");
    var NODEJS_PATH = require("path");
    NODEFS.staticInit();
  }
  STACK_BASE = STACKTOP = Runtime.alignMemory(STATICTOP);
  staticSealed = true;
  STACK_MAX = STACK_BASE + TOTAL_STACK;
  DYNAMIC_BASE = DYNAMICTOP = Runtime.alignMemory(STACK_MAX);
  assert(DYNAMIC_BASE < TOTAL_MEMORY, "TOTAL_MEMORY not big enough for stack");
  Module.asmGlobalArg = { "Math": Math, "Int8Array": Int8Array, "Int16Array": Int16Array, "Int32Array": Int32Array, "Uint8Array": Uint8Array, "Uint16Array": Uint16Array, "Uint32Array": Uint32Array, "Float32Array": Float32Array, "Float64Array": Float64Array, "NaN": NaN, "Infinity": Infinity };
  Module.asmLibraryArg = { "abort": abort, "assert": assert, "_sysconf": _sysconf, "_pthread_self": _pthread_self, "_abort": _abort, "___setErrNo": ___setErrNo, "_sbrk": _sbrk, "_time": _time, "_emscripten_set_main_loop_timing": _emscripten_set_main_loop_timing, "_emscripten_memcpy_big": _emscripten_memcpy_big, "_emscripten_set_main_loop": _emscripten_set_main_loop, "STACKTOP": STACKTOP, "STACK_MAX": STACK_MAX, "tempDoublePtr": tempDoublePtr, "ABORT": ABORT };
  var asm = function(global, env, buffer2) {
    var a = new global.Int8Array(buffer2);
    var b = new global.Int16Array(buffer2);
    var c = new global.Int32Array(buffer2);
    var d = new global.Uint8Array(buffer2);
    var e = new global.Uint16Array(buffer2);
    new global.Uint32Array(buffer2);
    new global.Float32Array(buffer2);
    new global.Float64Array(buffer2);
    var i2 = env.STACKTOP | 0;
    env.STACK_MAX | 0;
    env.tempDoublePtr | 0;
    env.ABORT | 0;
    global.NaN; global.Infinity;
    var B = 0;
    global.Math.floor;
    global.Math.abs;
    global.Math.sqrt;
    global.Math.pow;
    global.Math.cos;
    global.Math.sin;
    global.Math.tan;
    global.Math.acos;
    global.Math.asin;
    global.Math.atan;
    global.Math.atan2;
    global.Math.exp;
    global.Math.log;
    global.Math.ceil;
    var Z = global.Math.imul;
    global.Math.min;
    global.Math.clz32;
    env.abort;
    env.assert;
    var ca = env._sysconf;
    env._pthread_self;
    var ea = env._abort;
    env.___setErrNo;
    var ga = env._sbrk;
    var ha = env._time;
    env._emscripten_set_main_loop_timing;
    var ja = env._emscripten_memcpy_big;
    env._emscripten_set_main_loop;
    function ma(a2) {
      a2 = a2 | 0;
      var b2 = 0;
      b2 = i2;
      i2 = i2 + a2 | 0;
      i2 = i2 + 15 & -16;
      return b2 | 0;
    }
    function na() {
      return i2 | 0;
    }
    function oa(a2) {
      a2 = a2 | 0;
      i2 = a2;
    }
    function pa(a2, b2) {
      a2 = a2 | 0;
      i2 = a2;
    }
    function qa(a2, b2) {
    }
    function ta(a2) {
      a2 = a2 | 0;
      B = a2;
    }
    function ua() {
      return B | 0;
    }
    function va() {
      var a2 = 0, b2 = 0;
      b2 = i2;
      i2 = i2 + 16 | 0;
      a2 = b2;
      c[a2 >> 2] = 0;
      Db(a2, 31756) | 0;
      i2 = b2;
      return c[a2 >> 2] | 0;
    }
    function wa(a2) {
      a2 = a2 | 0;
      var b2 = 0, d2 = 0;
      b2 = i2;
      i2 = i2 + 16 | 0;
      d2 = b2;
      c[d2 >> 2] = a2;
      Eb(d2);
      i2 = b2;
      return;
    }
    function xa(a2, b2, c2, e2) {
      a2 = a2 | 0;
      b2 = b2 | 0;
      c2 = c2 | 0;
      e2 = e2 | 0;
      Ea(a2, (e2 | 0) == 0 ? (d[b2 >> 0] | 0) >>> 3 & 15 : 15, b2 + 1 | 0, c2, 2) | 0;
      return;
    }
    function ya(a2) {
      a2 = a2 | 0;
      var b2 = 0;
      b2 = Je(8) | 0;
      Hb(b2, b2 + 4 | 0, a2) | 0;
      return b2 | 0;
    }
    function za(a2) {
      a2 = a2 | 0;
      Ib(a2, a2 + 4 | 0);
      Ke(a2);
      return;
    }
    function Aa(b2, e2, f2, g2, h2) {
      b2 = b2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      var j2 = 0;
      h2 = i2;
      i2 = i2 + 16 | 0;
      j2 = h2;
      c[j2 >> 2] = e2;
      f2 = (Jb(c[b2 >> 2] | 0, c[b2 + 4 >> 2] | 0, e2, f2, g2, j2, 3) | 0) << 16 >> 16;
      a[g2 >> 0] = d[g2 >> 0] | 0 | 4;
      i2 = h2;
      return f2 | 0;
    }
    function Ba(a2) {
      a2 = a2 | 0;
      if (!a2)
        a2 = -1;
      else {
        b[a2 >> 1] = 4096;
        a2 = 0;
      }
      return a2 | 0;
    }
    function Ca(a2, d2, e2, f2, g2, h2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      var i3 = 0, j2 = 0, k2 = 0, l2 = 0, m2 = 0, n2 = 0, o2 = 0, p2 = 0, q2 = 0;
      m2 = c[h2 >> 2] | 0;
      q2 = g2 << 16 >> 16 > 0;
      if (q2) {
        i3 = 0;
        j2 = 0;
        do {
          l2 = b[e2 + (i3 << 1) >> 1] | 0;
          l2 = Z(l2, l2) | 0;
          if ((l2 | 0) != 1073741824) {
            k2 = (l2 << 1) + j2 | 0;
            if ((l2 ^ j2 | 0) > 0 & (k2 ^ j2 | 0) < 0) {
              c[h2 >> 2] = 1;
              j2 = (j2 >>> 31) + 2147483647 | 0;
            } else
              j2 = k2;
          } else {
            c[h2 >> 2] = 1;
            j2 = 2147483647;
          }
          i3 = i3 + 1 | 0;
        } while ((i3 & 65535) << 16 >> 16 != g2 << 16 >> 16);
        if ((j2 | 0) == 2147483647) {
          c[h2 >> 2] = m2;
          l2 = 0;
          k2 = 0;
          do {
            j2 = b[e2 + (l2 << 1) >> 1] >> 2;
            j2 = Z(j2, j2) | 0;
            if ((j2 | 0) != 1073741824) {
              i3 = (j2 << 1) + k2 | 0;
              if ((j2 ^ k2 | 0) > 0 & (i3 ^ k2 | 0) < 0) {
                c[h2 >> 2] = 1;
                k2 = (k2 >>> 31) + 2147483647 | 0;
              } else
                k2 = i3;
            } else {
              c[h2 >> 2] = 1;
              k2 = 2147483647;
            }
            l2 = l2 + 1 | 0;
          } while ((l2 & 65535) << 16 >> 16 != g2 << 16 >> 16);
        } else
          p2 = 8;
      } else {
        j2 = 0;
        p2 = 8;
      }
      if ((p2 | 0) == 8)
        k2 = j2 >> 4;
      if (!k2) {
        b[a2 >> 1] = 0;
        return;
      }
      o2 = ((pe(k2) | 0) & 65535) + 65535 | 0;
      j2 = o2 << 16 >> 16;
      if ((o2 & 65535) << 16 >> 16 > 0) {
        i3 = k2 << j2;
        if ((i3 >> j2 | 0) == (k2 | 0))
          k2 = i3;
        else
          k2 = k2 >> 31 ^ 2147483647;
      } else {
        j2 = 0 - j2 << 16;
        if ((j2 | 0) < 2031616)
          k2 = k2 >> (j2 >> 16);
        else
          k2 = 0;
      }
      n2 = Ce(k2, h2) | 0;
      i3 = c[h2 >> 2] | 0;
      if (q2) {
        j2 = 0;
        k2 = 0;
        do {
          m2 = b[d2 + (j2 << 1) >> 1] | 0;
          m2 = Z(m2, m2) | 0;
          if ((m2 | 0) != 1073741824) {
            l2 = (m2 << 1) + k2 | 0;
            if ((m2 ^ k2 | 0) > 0 & (l2 ^ k2 | 0) < 0) {
              c[h2 >> 2] = 1;
              k2 = (k2 >>> 31) + 2147483647 | 0;
            } else
              k2 = l2;
          } else {
            c[h2 >> 2] = 1;
            k2 = 2147483647;
          }
          j2 = j2 + 1 | 0;
        } while ((j2 & 65535) << 16 >> 16 != g2 << 16 >> 16);
        if ((k2 | 0) == 2147483647) {
          c[h2 >> 2] = i3;
          m2 = 0;
          k2 = 0;
          do {
            l2 = b[d2 + (m2 << 1) >> 1] >> 2;
            l2 = Z(l2, l2) | 0;
            if ((l2 | 0) != 1073741824) {
              j2 = (l2 << 1) + k2 | 0;
              if ((l2 ^ k2 | 0) > 0 & (j2 ^ k2 | 0) < 0) {
                c[h2 >> 2] = 1;
                k2 = (k2 >>> 31) + 2147483647 | 0;
              } else
                k2 = j2;
            } else {
              c[h2 >> 2] = 1;
              k2 = 2147483647;
            }
            m2 = m2 + 1 | 0;
          } while ((m2 & 65535) << 16 >> 16 != g2 << 16 >> 16);
        } else
          p2 = 29;
      } else {
        k2 = 0;
        p2 = 29;
      }
      if ((p2 | 0) == 29)
        k2 = k2 >> 4;
      if (!k2)
        l2 = 0;
      else {
        j2 = (pe(k2) | 0) << 16 >> 16;
        i3 = o2 - j2 | 0;
        l2 = i3 & 65535;
        k2 = (Td(n2, Ce(k2 << j2, h2) | 0) | 0) << 16 >> 16;
        j2 = k2 << 7;
        i3 = i3 << 16 >> 16;
        if (l2 << 16 >> 16 > 0)
          i3 = l2 << 16 >> 16 < 31 ? j2 >> i3 : 0;
        else {
          p2 = 0 - i3 << 16 >> 16;
          i3 = j2 << p2;
          i3 = (i3 >> p2 | 0) == (j2 | 0) ? i3 : k2 >> 24 ^ 2147483647;
        }
        l2 = (Z(((ce(i3, h2) | 0) << 9) + 32768 >> 16, 32767 - (f2 & 65535) << 16 >> 16) | 0) >>> 15 << 16 >> 16;
      }
      i3 = b[a2 >> 1] | 0;
      if (q2) {
        k2 = f2 << 16 >> 16;
        j2 = 0;
        while (1) {
          f2 = ((Z(i3 << 16 >> 16, k2) | 0) >>> 15 & 65535) + l2 | 0;
          i3 = f2 & 65535;
          b[e2 >> 1] = (Z(b[e2 >> 1] | 0, f2 << 16 >> 16) | 0) >>> 12;
          j2 = j2 + 1 << 16 >> 16;
          if (j2 << 16 >> 16 >= g2 << 16 >> 16)
            break;
          else
            e2 = e2 + 2 | 0;
        }
      }
      b[a2 >> 1] = i3;
      return;
    }
    function Da(a2, d2, e2, f2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      var g2 = 0, h2 = 0, i3 = 0, j2 = 0, k2 = 0, l2 = 0, m2 = 0, n2 = 0, o2 = 0;
      i3 = c[f2 >> 2] | 0;
      g2 = e2 << 16 >> 16 > 0;
      if (g2) {
        j2 = 0;
        h2 = 0;
        do {
          l2 = b[d2 + (j2 << 1) >> 1] | 0;
          l2 = Z(l2, l2) | 0;
          if ((l2 | 0) != 1073741824) {
            k2 = (l2 << 1) + h2 | 0;
            if ((l2 ^ h2 | 0) > 0 & (k2 ^ h2 | 0) < 0) {
              c[f2 >> 2] = 1;
              h2 = (h2 >>> 31) + 2147483647 | 0;
            } else
              h2 = k2;
          } else {
            c[f2 >> 2] = 1;
            h2 = 2147483647;
          }
          j2 = j2 + 1 | 0;
        } while ((j2 & 65535) << 16 >> 16 != e2 << 16 >> 16);
        if ((h2 | 0) == 2147483647) {
          c[f2 >> 2] = i3;
          l2 = 0;
          i3 = 0;
          do {
            k2 = b[d2 + (l2 << 1) >> 1] >> 2;
            k2 = Z(k2, k2) | 0;
            if ((k2 | 0) != 1073741824) {
              j2 = (k2 << 1) + i3 | 0;
              if ((k2 ^ i3 | 0) > 0 & (j2 ^ i3 | 0) < 0) {
                c[f2 >> 2] = 1;
                i3 = (i3 >>> 31) + 2147483647 | 0;
              } else
                i3 = j2;
            } else {
              c[f2 >> 2] = 1;
              i3 = 2147483647;
            }
            l2 = l2 + 1 | 0;
          } while ((l2 & 65535) << 16 >> 16 != e2 << 16 >> 16);
        } else
          o2 = 8;
      } else {
        h2 = 0;
        o2 = 8;
      }
      if ((o2 | 0) == 8)
        i3 = h2 >> 4;
      if (!i3)
        return;
      n2 = ((pe(i3) | 0) & 65535) + 65535 | 0;
      k2 = n2 << 16 >> 16;
      if ((n2 & 65535) << 16 >> 16 > 0) {
        j2 = i3 << k2;
        if ((j2 >> k2 | 0) == (i3 | 0))
          i3 = j2;
        else
          i3 = i3 >> 31 ^ 2147483647;
      } else {
        k2 = 0 - k2 << 16;
        if ((k2 | 0) < 2031616)
          i3 = i3 >> (k2 >> 16);
        else
          i3 = 0;
      }
      m2 = Ce(i3, f2) | 0;
      i3 = c[f2 >> 2] | 0;
      if (g2) {
        j2 = 0;
        h2 = 0;
        do {
          l2 = b[a2 + (j2 << 1) >> 1] | 0;
          l2 = Z(l2, l2) | 0;
          if ((l2 | 0) != 1073741824) {
            k2 = (l2 << 1) + h2 | 0;
            if ((l2 ^ h2 | 0) > 0 & (k2 ^ h2 | 0) < 0) {
              c[f2 >> 2] = 1;
              h2 = (h2 >>> 31) + 2147483647 | 0;
            } else
              h2 = k2;
          } else {
            c[f2 >> 2] = 1;
            h2 = 2147483647;
          }
          j2 = j2 + 1 | 0;
        } while ((j2 & 65535) << 16 >> 16 != e2 << 16 >> 16);
        if ((h2 | 0) == 2147483647) {
          c[f2 >> 2] = i3;
          i3 = 0;
          j2 = 0;
          do {
            l2 = b[a2 + (i3 << 1) >> 1] >> 2;
            l2 = Z(l2, l2) | 0;
            if ((l2 | 0) != 1073741824) {
              k2 = (l2 << 1) + j2 | 0;
              if ((l2 ^ j2 | 0) > 0 & (k2 ^ j2 | 0) < 0) {
                c[f2 >> 2] = 1;
                j2 = (j2 >>> 31) + 2147483647 | 0;
              } else
                j2 = k2;
            } else {
              c[f2 >> 2] = 1;
              j2 = 2147483647;
            }
            i3 = i3 + 1 | 0;
          } while ((i3 & 65535) << 16 >> 16 != e2 << 16 >> 16);
        } else
          o2 = 28;
      } else {
        h2 = 0;
        o2 = 28;
      }
      if ((o2 | 0) == 28)
        j2 = h2 >> 4;
      if (!j2)
        g2 = 0;
      else {
        l2 = pe(j2) | 0;
        k2 = l2 << 16 >> 16;
        if (l2 << 16 >> 16 > 0) {
          i3 = j2 << k2;
          if ((i3 >> k2 | 0) == (j2 | 0))
            j2 = i3;
          else
            j2 = j2 >> 31 ^ 2147483647;
        } else {
          k2 = 0 - k2 << 16;
          if ((k2 | 0) < 2031616)
            j2 = j2 >> (k2 >> 16);
          else
            j2 = 0;
        }
        i3 = n2 - (l2 & 65535) | 0;
        k2 = i3 & 65535;
        h2 = (Td(m2, Ce(j2, f2) | 0) | 0) << 16 >> 16;
        g2 = h2 << 7;
        i3 = i3 << 16 >> 16;
        if (k2 << 16 >> 16 > 0)
          g2 = k2 << 16 >> 16 < 31 ? g2 >> i3 : 0;
        else {
          n2 = 0 - i3 << 16 >> 16;
          a2 = g2 << n2;
          g2 = (a2 >> n2 | 0) == (g2 | 0) ? a2 : h2 >> 24 ^ 2147483647;
        }
        g2 = ce(g2, f2) | 0;
        if ((g2 | 0) > 4194303)
          g2 = 2147483647;
        else
          g2 = (g2 | 0) < -4194304 ? -2147483648 : g2 << 9;
        g2 = Ce(g2, f2) | 0;
      }
      h2 = (e2 & 65535) + 65535 & 65535;
      if (h2 << 16 >> 16 <= -1)
        return;
      l2 = g2 << 16 >> 16;
      k2 = e2 + -1 << 16 >> 16 << 16 >> 16;
      while (1) {
        i3 = d2 + (k2 << 1) | 0;
        g2 = Z(b[i3 >> 1] | 0, l2) | 0;
        do
          if ((g2 | 0) != 1073741824) {
            j2 = g2 << 1;
            if ((j2 | 0) <= 268435455)
              if ((j2 | 0) < -268435456) {
                b[i3 >> 1] = -32768;
                break;
              } else {
                b[i3 >> 1] = g2 >>> 12;
                break;
              }
            else
              o2 = 52;
          } else {
            c[f2 >> 2] = 1;
            o2 = 52;
          }
        while (0);
        if ((o2 | 0) == 52) {
          o2 = 0;
          b[i3 >> 1] = 32767;
        }
        h2 = h2 + -1 << 16 >> 16;
        if (h2 << 16 >> 16 <= -1)
          break;
        else
          k2 = k2 + -1 | 0;
      }
      return;
    }
    function Ea(a2, d2, e2, f2, g2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      var h2 = 0, j2 = 0, k2 = 0, l2 = 0;
      l2 = i2;
      i2 = i2 + 496 | 0;
      k2 = l2;
      j2 = (g2 | 0) == 2;
      do
        if (!(j2 & 1 | (g2 | 0) == 4)) {
          if (g2) {
            a2 = -1;
            i2 = l2;
            return a2 | 0;
          }
          j2 = b[e2 >> 1] | 0;
          d2 = e2 + 490 | 0;
          g2 = e2 + 2 | 0;
          h2 = 0;
          while (1) {
            b[k2 + (h2 << 1) >> 1] = b[g2 >> 1] | 0;
            h2 = h2 + 1 | 0;
            if ((h2 | 0) == 244)
              break;
            else
              g2 = g2 + 2 | 0;
          }
          h2 = j2 << 16 >> 16;
          if (j2 << 16 >> 16 == 7) {
            g2 = 492;
            d2 = c[a2 + 1760 >> 2] | 0;
            break;
          } else {
            g2 = 492;
            d2 = b[d2 >> 1] | 0;
            break;
          }
        } else {
          h2 = a2 + 1168 | 0;
          if (j2) {
            Gb(d2, e2, k2, h2);
            h2 = 604;
          } else {
            pb(d2, e2, k2, h2);
            h2 = 3436;
          }
          g2 = b[h2 + (d2 << 1) >> 1] | 0;
          do
            if (d2 >>> 0 >= 8) {
              if ((d2 | 0) == 8) {
                d2 = b[k2 + 76 >> 1] << 2 | (b[k2 + 74 >> 1] << 1 | b[k2 + 72 >> 1]);
                h2 = (b[k2 + 70 >> 1] | 0) == 0 ? 4 : 5;
                break;
              }
              if (d2 >>> 0 < 15) {
                a2 = -1;
                i2 = l2;
                return a2 | 0;
              } else {
                d2 = c[a2 + 1760 >> 2] | 0;
                h2 = 7;
                break;
              }
            } else
              h2 = 0;
          while (0);
          if (g2 << 16 >> 16 == -1) {
            a2 = -1;
            i2 = l2;
            return a2 | 0;
          }
        }
      while (0);
      Fb(a2, d2, k2, h2, f2);
      c[a2 + 1760 >> 2] = d2;
      a2 = g2;
      i2 = l2;
      return a2 | 0;
    }
    function Fa(a2, d2, f2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      f2 = f2 | 0;
      var g2 = 0, h2 = 0, j2 = 0, k2 = 0, l2 = 0, m2 = 0, n2 = 0, o2 = 0, p2 = 0, q2 = 0, r2 = 0, s2 = 0, t2 = 0;
      t2 = i2;
      i2 = i2 + 48 | 0;
      r2 = t2 + 20 | 0;
      s2 = t2;
      h2 = r2;
      g2 = h2 + 20 | 0;
      do {
        b[h2 >> 1] = b[a2 >> 1] | 0;
        h2 = h2 + 2 | 0;
        a2 = a2 + 2 | 0;
      } while ((h2 | 0) < (g2 | 0));
      a2 = b[r2 + 18 >> 1] | 0;
      q2 = (a2 & 65535) - ((a2 & 65535) >>> 15 & 65535) | 0;
      a:
        do
          if (((q2 << 16 >> 31 ^ q2) & 65535) << 16 >> 16 <= 4095) {
            g2 = 9;
            q2 = 9;
            while (1) {
              a2 = a2 << 16 >> 16;
              a2 = (a2 << 19 >> 19 | 0) == (a2 | 0) ? a2 << 3 : a2 >>> 15 ^ 32767;
              p2 = d2 + (g2 << 1) | 0;
              b[p2 >> 1] = a2;
              a2 = a2 << 16 >> 16;
              a2 = Z(a2, a2) | 0;
              if ((a2 | 0) == 1073741824) {
                c[f2 >> 2] = 1;
                h2 = 2147483647;
              } else
                h2 = a2 << 1;
              a2 = 2147483647 - h2 | 0;
              if ((a2 & h2 | 0) < 0) {
                c[f2 >> 2] = 1;
                a2 = 2147483647;
              }
              n2 = pe(a2) | 0;
              o2 = 15 - (n2 & 65535) & 65535;
              j2 = n2 << 16 >> 16;
              if (n2 << 16 >> 16 > 0) {
                h2 = a2 << j2;
                if ((h2 >> j2 | 0) != (a2 | 0))
                  h2 = a2 >> 31 ^ 2147483647;
              } else {
                h2 = 0 - j2 << 16;
                if ((h2 | 0) < 2031616)
                  h2 = a2 >> (h2 >> 16);
                else
                  h2 = 0;
              }
              h2 = Td(16384, Ce(h2, f2) | 0) | 0;
              do
                if (q2 << 16 >> 16 > 0) {
                  n2 = g2 + -1 | 0;
                  k2 = h2 << 16 >> 16;
                  l2 = q2 << 16 >> 16;
                  m2 = 0;
                  while (1) {
                    g2 = e[r2 + (m2 << 1) >> 1] | 0;
                    a2 = g2 << 16;
                    j2 = Z(b[r2 + (n2 - m2 << 1) >> 1] | 0, b[p2 >> 1] | 0) | 0;
                    if ((j2 | 0) == 1073741824) {
                      c[f2 >> 2] = 1;
                      h2 = 2147483647;
                    } else
                      h2 = j2 << 1;
                    j2 = a2 - h2 | 0;
                    if (((j2 ^ a2) & (h2 ^ a2) | 0) < 0) {
                      c[f2 >> 2] = 1;
                      j2 = (g2 >>> 15) + 2147483647 | 0;
                    }
                    j2 = Z((Ce(j2, f2) | 0) << 16 >> 16, k2) | 0;
                    if ((j2 | 0) == 1073741824) {
                      c[f2 >> 2] = 1;
                      j2 = 2147483647;
                    } else
                      j2 = j2 << 1;
                    j2 = ge(j2, o2, f2) | 0;
                    h2 = j2 - (j2 >>> 31) | 0;
                    if ((h2 >> 31 ^ h2 | 0) > 32767) {
                      j2 = 24;
                      break;
                    }
                    b[s2 + (m2 << 1) >> 1] = j2;
                    m2 = m2 + 1 | 0;
                    if ((l2 | 0) <= (m2 | 0)) {
                      j2 = 26;
                      break;
                    }
                  }
                  if ((j2 | 0) == 24) {
                    j2 = 0;
                    h2 = d2;
                    g2 = h2 + 20 | 0;
                    do {
                      b[h2 >> 1] = 0;
                      h2 = h2 + 2 | 0;
                    } while ((h2 | 0) < (g2 | 0));
                    a2 = 10;
                  } else if ((j2 | 0) == 26) {
                    j2 = 0;
                    if (q2 << 16 >> 16 > 0)
                      a2 = q2;
                    else {
                      j2 = 28;
                      break;
                    }
                  }
                  h2 = a2 + -1 << 16 >> 16;
                  Oe(r2 | 0, s2 | 0, ((h2 & 65535) << 1) + 2 | 0) | 0;
                  g2 = h2 << 16 >> 16;
                } else
                  j2 = 28;
              while (0);
              if ((j2 | 0) == 28) {
                a2 = q2 + -1 << 16 >> 16;
                if (a2 << 16 >> 16 > -1) {
                  g2 = a2 << 16 >> 16;
                  h2 = 32767;
                } else
                  break;
              }
              a2 = b[r2 + (g2 << 1) >> 1] | 0;
              q2 = (a2 & 65535) - ((a2 & 65535) >>> 15 & 65535) | 0;
              if (((q2 << 16 >> 31 ^ q2) & 65535) << 16 >> 16 > 4095)
                break a;
              else
                q2 = h2;
            }
            i2 = t2;
            return;
          }
        while (0);
      h2 = d2;
      g2 = h2 + 20 | 0;
      do {
        b[h2 >> 1] = 0;
        h2 = h2 + 2 | 0;
      } while ((h2 | 0) < (g2 | 0));
      i2 = t2;
      return;
    }
    function Ga(a2, b2) {
      a2 = a2 | 0;
      b2 = b2 | 0;
      var d2 = 0, e2 = 0, f2 = 0, g2 = 0, h2 = 0;
      if (b2 << 16 >> 16 <= 0) {
        a2 = 0;
        return a2 | 0;
      }
      e2 = c[a2 >> 2] | 0;
      f2 = 0;
      d2 = 0;
      do {
        h2 = e2 & 1;
        d2 = h2 | d2 << 1 & 131070;
        g2 = e2 >> 1;
        e2 = (h2 | 0) == (e2 >>> 28 & 1 | 0) ? g2 : g2 | 1073741824;
        f2 = f2 + 1 << 16 >> 16;
      } while (f2 << 16 >> 16 < b2 << 16 >> 16);
      c[a2 >> 2] = e2;
      h2 = d2 & 65535;
      return h2 | 0;
    }
    function Ha(a2, d2, e2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      var f2 = 0, g2 = 0, h2 = 0, i3 = 0, j2 = 0, k2 = 0;
      g2 = d2;
      f2 = g2 + 80 | 0;
      do {
        b[g2 >> 1] = 0;
        g2 = g2 + 2 | 0;
      } while ((g2 | 0) < (f2 | 0));
      f2 = 0;
      g2 = c[a2 >> 2] | 0;
      do {
        k2 = g2 & 1;
        j2 = g2 >> 1;
        j2 = (k2 | 0) == (g2 >>> 28 & 1 | 0) ? j2 : j2 | 1073741824;
        h2 = j2 & 1;
        i3 = j2 >> 1;
        c[a2 >> 2] = (h2 | 0) == (j2 >>> 28 & 1 | 0) ? i3 : i3 | 1073741824;
        h2 = Rd((Z(k2 << 1 | h2, 1310720) | 0) >>> 17 & 65535, f2, e2) | 0;
        k2 = c[a2 >> 2] | 0;
        i3 = k2 & 1;
        j2 = k2 >> 1;
        g2 = (i3 | 0) == (k2 >>> 28 & 1 | 0) ? j2 : j2 | 1073741824;
        c[a2 >> 2] = g2;
        b[d2 + (h2 << 16 >> 16 << 1) >> 1] = ((i3 & 65535) << 13 & 65535) + -4096 << 16 >> 16;
        f2 = f2 + 1 << 16 >> 16;
      } while (f2 << 16 >> 16 < 10);
      return;
    }
    function Ia(a2, d2, f2, g2, h2, i3) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      i3 = i3 | 0;
      var j2 = 0, k2 = 0;
      j2 = b[a2 >> 1] | 0;
      if ((j2 * 31821 | 0) == 1073741824) {
        c[i3 >> 2] = 1;
        k2 = 1073741823;
      } else
        k2 = j2 * 63642 >> 1;
      j2 = k2 + 13849 | 0;
      if ((k2 | 0) > -1 & (j2 ^ k2 | 0) < 0) {
        c[i3 >> 2] = 1;
        j2 = (k2 >>> 31) + 2147483647 | 0;
      }
      b[a2 >> 1] = j2;
      if (d2 << 16 >> 16 <= 0)
        return;
      k2 = 0;
      j2 = h2 + ((j2 & 127) << 1) | 0;
      while (1) {
        b[g2 + (k2 << 1) >> 1] = (-65536 << b[f2 + (k2 << 1) >> 1] >>> 16 ^ 65535) & e[j2 >> 1];
        k2 = k2 + 1 | 0;
        if ((k2 & 65535) << 16 >> 16 == d2 << 16 >> 16)
          break;
        else
          j2 = j2 + 2 | 0;
      }
      return;
    }
    function Ja(a2) {
      a2 = a2 | 0;
      var c2 = 0;
      if (!a2) {
        c2 = -1;
        return c2 | 0;
      }
      c2 = a2 + 122 | 0;
      do {
        b[a2 >> 1] = 0;
        a2 = a2 + 2 | 0;
      } while ((a2 | 0) < (c2 | 0));
      c2 = 0;
      return c2 | 0;
    }
    function Ka(a2, d2, f2, g2, h2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      var i3 = 0, j2 = 0, k2 = 0, l2 = 0, m2 = 0, n2 = 0, o2 = 0;
      k2 = 159;
      j2 = 0;
      while (1) {
        m2 = b[f2 + (k2 << 1) >> 1] | 0;
        m2 = Z(m2, m2) | 0;
        m2 = (m2 | 0) == 1073741824 ? 2147483647 : m2 << 1;
        i3 = m2 + j2 | 0;
        if ((m2 ^ j2 | 0) > -1 & (i3 ^ j2 | 0) < 0) {
          c[h2 >> 2] = 1;
          j2 = (j2 >>> 31) + 2147483647 | 0;
        } else
          j2 = i3;
        if ((k2 | 0) > 0)
          k2 = k2 + -1 | 0;
        else {
          k2 = j2;
          break;
        }
      }
      h2 = k2 >>> 14 & 65535;
      j2 = 32767;
      i3 = 59;
      while (1) {
        m2 = b[a2 + (i3 << 1) >> 1] | 0;
        j2 = m2 << 16 >> 16 < j2 << 16 >> 16 ? m2 : j2;
        if ((i3 | 0) > 0)
          i3 = i3 + -1 | 0;
        else
          break;
      }
      m2 = (k2 | 0) > 536870911 ? 32767 : h2;
      h2 = j2 << 16 >> 16;
      i3 = h2 << 20 >> 16;
      k2 = j2 << 16 >> 16 > 0 ? 32767 : -32768;
      f2 = 55;
      j2 = b[a2 >> 1] | 0;
      while (1) {
        l2 = b[a2 + (f2 << 1) >> 1] | 0;
        j2 = j2 << 16 >> 16 < l2 << 16 >> 16 ? l2 : j2;
        if ((f2 | 0) > 1)
          f2 = f2 + -1 | 0;
        else
          break;
      }
      f2 = b[a2 + 80 >> 1] | 0;
      l2 = b[a2 + 82 >> 1] | 0;
      f2 = f2 << 16 >> 16 < l2 << 16 >> 16 ? l2 : f2;
      l2 = b[a2 + 84 >> 1] | 0;
      f2 = f2 << 16 >> 16 < l2 << 16 >> 16 ? l2 : f2;
      l2 = b[a2 + 86 >> 1] | 0;
      f2 = f2 << 16 >> 16 < l2 << 16 >> 16 ? l2 : f2;
      l2 = b[a2 + 88 >> 1] | 0;
      f2 = f2 << 16 >> 16 < l2 << 16 >> 16 ? l2 : f2;
      l2 = b[a2 + 90 >> 1] | 0;
      f2 = f2 << 16 >> 16 < l2 << 16 >> 16 ? l2 : f2;
      l2 = b[a2 + 92 >> 1] | 0;
      f2 = f2 << 16 >> 16 < l2 << 16 >> 16 ? l2 : f2;
      l2 = b[a2 + 94 >> 1] | 0;
      f2 = f2 << 16 >> 16 < l2 << 16 >> 16 ? l2 : f2;
      l2 = b[a2 + 96 >> 1] | 0;
      f2 = f2 << 16 >> 16 < l2 << 16 >> 16 ? l2 : f2;
      l2 = b[a2 + 98 >> 1] | 0;
      f2 = f2 << 16 >> 16 < l2 << 16 >> 16 ? l2 : f2;
      l2 = b[a2 + 100 >> 1] | 0;
      f2 = f2 << 16 >> 16 < l2 << 16 >> 16 ? l2 : f2;
      l2 = b[a2 + 102 >> 1] | 0;
      f2 = f2 << 16 >> 16 < l2 << 16 >> 16 ? l2 : f2;
      l2 = b[a2 + 104 >> 1] | 0;
      f2 = f2 << 16 >> 16 < l2 << 16 >> 16 ? l2 : f2;
      l2 = b[a2 + 106 >> 1] | 0;
      f2 = f2 << 16 >> 16 < l2 << 16 >> 16 ? l2 : f2;
      l2 = b[a2 + 108 >> 1] | 0;
      f2 = f2 << 16 >> 16 < l2 << 16 >> 16 ? l2 : f2;
      l2 = b[a2 + 110 >> 1] | 0;
      f2 = f2 << 16 >> 16 < l2 << 16 >> 16 ? l2 : f2;
      l2 = b[a2 + 112 >> 1] | 0;
      f2 = f2 << 16 >> 16 < l2 << 16 >> 16 ? l2 : f2;
      l2 = b[a2 + 114 >> 1] | 0;
      f2 = f2 << 16 >> 16 < l2 << 16 >> 16 ? l2 : f2;
      l2 = b[a2 + 116 >> 1] | 0;
      f2 = f2 << 16 >> 16 < l2 << 16 >> 16 ? l2 : f2;
      l2 = a2 + 118 | 0;
      o2 = b[l2 >> 1] | 0;
      do
        if ((m2 + -21 & 65535) < 17557 & j2 << 16 >> 16 > 20 ? (m2 << 16 >> 16 | 0) < (((h2 << 4 | 0) == (i3 | 0) ? i3 : k2) | 0) ? 1 : (f2 << 16 >> 16 < o2 << 16 >> 16 ? o2 : f2) << 16 >> 16 < 1953 : 0) {
          j2 = a2 + 120 | 0;
          i3 = b[j2 >> 1] | 0;
          if (i3 << 16 >> 16 > 29) {
            b[j2 >> 1] = 30;
            f2 = j2;
            k2 = 1;
            break;
          } else {
            k2 = (i3 & 65535) + 1 & 65535;
            b[j2 >> 1] = k2;
            f2 = j2;
            k2 = k2 << 16 >> 16 > 1 & 1;
            break;
          }
        } else
          n2 = 14;
      while (0);
      if ((n2 | 0) == 14) {
        f2 = a2 + 120 | 0;
        b[f2 >> 1] = 0;
        k2 = 0;
      }
      j2 = 0;
      do {
        o2 = j2;
        j2 = j2 + 1 | 0;
        b[a2 + (o2 << 1) >> 1] = b[a2 + (j2 << 1) >> 1] | 0;
      } while ((j2 | 0) != 59);
      b[l2 >> 1] = m2;
      j2 = b[f2 >> 1] | 0;
      j2 = j2 << 16 >> 16 > 15 ? 16383 : j2 << 16 >> 16 > 8 ? 15565 : 13926;
      i3 = Zd(d2 + 8 | 0, 5) | 0;
      if ((b[f2 >> 1] | 0) > 20) {
        if (((Zd(d2, 9) | 0) << 16 >> 16 | 0) > (j2 | 0))
          n2 = 20;
      } else if ((i3 << 16 >> 16 | 0) > (j2 | 0))
        n2 = 20;
      if ((n2 | 0) == 20) {
        b[g2 >> 1] = 0;
        return k2 | 0;
      }
      i3 = (e[g2 >> 1] | 0) + 1 & 65535;
      if (i3 << 16 >> 16 > 10) {
        b[g2 >> 1] = 10;
        return k2 | 0;
      } else {
        b[g2 >> 1] = i3;
        return k2 | 0;
      }
    }
    function La(a2) {
      a2 = a2 | 0;
      var c2 = 0;
      if (!a2) {
        c2 = -1;
        return c2 | 0;
      }
      c2 = a2 + 18 | 0;
      do {
        b[a2 >> 1] = 0;
        a2 = a2 + 2 | 0;
      } while ((a2 | 0) < (c2 | 0));
      c2 = 0;
      return c2 | 0;
    }
    function Ma(a2, d2, f2, g2, h2, i3, j2, k2, l2, m2, n2, o2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      i3 = i3 | 0;
      j2 = j2 | 0;
      k2 = k2 | 0;
      l2 = l2 | 0;
      m2 = m2 | 0;
      n2 = n2 | 0;
      o2 = o2 | 0;
      var p2 = 0, q2 = 0, r2 = 0, s2 = 0, t2 = 0, u2 = 0, v2 = 0, w2 = 0, x2 = 0, y2 = 0, z2 = 0, A2 = 0, B2 = 0, C2 = 0, D2 = 0;
      y2 = a2 + 2 | 0;
      b[a2 >> 1] = b[y2 >> 1] | 0;
      z2 = a2 + 4 | 0;
      b[y2 >> 1] = b[z2 >> 1] | 0;
      A2 = a2 + 6 | 0;
      b[z2 >> 1] = b[A2 >> 1] | 0;
      B2 = a2 + 8 | 0;
      b[A2 >> 1] = b[B2 >> 1] | 0;
      C2 = a2 + 10 | 0;
      b[B2 >> 1] = b[C2 >> 1] | 0;
      D2 = a2 + 12 | 0;
      b[C2 >> 1] = b[D2 >> 1] | 0;
      b[D2 >> 1] = f2;
      t2 = 0;
      x2 = 0;
      do {
        p2 = h2 + (x2 << 1) | 0;
        r2 = Ge(b[p2 >> 1] | 0, b[g2 + (x2 << 1) >> 1] | 0, o2) | 0;
        r2 = (r2 & 65535) - ((r2 & 65535) >>> 15 & 65535) | 0;
        r2 = r2 << 16 >> 31 ^ r2;
        w2 = ((qe(r2 & 65535) | 0) & 65535) + 65535 | 0;
        q2 = w2 << 16 >> 16;
        if ((w2 & 65535) << 16 >> 16 < 0) {
          s2 = 0 - q2 << 16;
          if ((s2 | 0) < 983040)
            u2 = r2 << 16 >> 16 >> (s2 >> 16) & 65535;
          else
            u2 = 0;
        } else {
          s2 = r2 << 16 >> 16;
          r2 = s2 << q2;
          if ((r2 << 16 >> 16 >> q2 | 0) == (s2 | 0))
            u2 = r2 & 65535;
          else
            u2 = (s2 >>> 15 ^ 32767) & 65535;
        }
        v2 = qe(b[p2 >> 1] | 0) | 0;
        r2 = b[p2 >> 1] | 0;
        q2 = v2 << 16 >> 16;
        if (v2 << 16 >> 16 < 0) {
          s2 = 0 - q2 << 16;
          if ((s2 | 0) < 983040)
            s2 = r2 << 16 >> 16 >> (s2 >> 16) & 65535;
          else
            s2 = 0;
        } else {
          s2 = r2 << 16 >> 16;
          r2 = s2 << q2;
          if ((r2 << 16 >> 16 >> q2 | 0) == (s2 | 0))
            s2 = r2 & 65535;
          else
            s2 = (s2 >>> 15 ^ 32767) & 65535;
        }
        q2 = Td(u2, s2) | 0;
        s2 = (w2 & 65535) + 2 - (v2 & 65535) | 0;
        r2 = s2 & 65535;
        do
          if (s2 & 32768) {
            if (r2 << 16 >> 16 != -32768) {
              w2 = 0 - s2 | 0;
              s2 = w2 << 16 >> 16;
              if ((w2 & 65535) << 16 >> 16 < 0) {
                s2 = 0 - s2 << 16;
                if ((s2 | 0) >= 983040) {
                  s2 = 0;
                  break;
                }
                s2 = q2 << 16 >> 16 >> (s2 >> 16) & 65535;
                break;
              }
            } else
              s2 = 32767;
            r2 = q2 << 16 >> 16;
            q2 = r2 << s2;
            if ((q2 << 16 >> 16 >> s2 | 0) == (r2 | 0))
              s2 = q2 & 65535;
            else
              s2 = (r2 >>> 15 ^ 32767) & 65535;
          } else
            s2 = De(q2, r2, o2) | 0;
        while (0);
        t2 = Rd(t2, s2, o2) | 0;
        x2 = x2 + 1 | 0;
      } while ((x2 | 0) != 10);
      s2 = t2 & 65535;
      r2 = t2 << 16 >> 16 > 5325;
      t2 = a2 + 14 | 0;
      if (r2) {
        h2 = (e[t2 >> 1] | 0) + 1 & 65535;
        b[t2 >> 1] = h2;
        if (h2 << 16 >> 16 > 10)
          b[a2 + 16 >> 1] = 0;
      } else
        b[t2 >> 1] = 0;
      switch (d2 | 0) {
        case 0:
        case 1:
        case 2:
        case 3:
        case 6:
          break;
        default: {
          D2 = a2 + 16 | 0;
          o2 = f2;
          f2 = b[D2 >> 1] | 0;
          f2 = f2 & 65535;
          f2 = f2 + 1 | 0;
          f2 = f2 & 65535;
          b[D2 >> 1] = f2;
          return o2 | 0;
        }
      }
      u2 = (j2 | i3) << 16 >> 16 == 0;
      v2 = m2 << 16 >> 16 == 0;
      w2 = d2 >>> 0 < 3;
      t2 = s2 + (w2 & ((v2 | (u2 & (k2 << 16 >> 16 == 0 | l2 << 16 >> 16 == 0) | n2 << 16 >> 16 < 2)) ^ 1) ? 61030 : 62259) & 65535;
      t2 = t2 << 16 >> 16 > 0 ? t2 : 0;
      if (t2 << 16 >> 16 <= 2048) {
        t2 = t2 << 16 >> 16;
        if ((t2 << 18 >> 18 | 0) == (t2 | 0))
          l2 = t2 << 2;
        else
          l2 = t2 >>> 15 ^ 32767;
      } else
        l2 = 8192;
      k2 = a2 + 16 | 0;
      n2 = r2 | (b[k2 >> 1] | 0) < 40;
      t2 = b[z2 >> 1] | 0;
      if ((t2 * 6554 | 0) == 1073741824) {
        c[o2 >> 2] = 1;
        r2 = 2147483647;
      } else
        r2 = t2 * 13108 | 0;
      t2 = b[A2 >> 1] | 0;
      s2 = t2 * 6554 | 0;
      if ((s2 | 0) != 1073741824) {
        t2 = (t2 * 13108 | 0) + r2 | 0;
        if ((s2 ^ r2 | 0) > 0 & (t2 ^ r2 | 0) < 0) {
          c[o2 >> 2] = 1;
          t2 = (r2 >>> 31) + 2147483647 | 0;
        }
      } else {
        c[o2 >> 2] = 1;
        t2 = 2147483647;
      }
      s2 = b[B2 >> 1] | 0;
      r2 = s2 * 6554 | 0;
      if ((r2 | 0) != 1073741824) {
        s2 = (s2 * 13108 | 0) + t2 | 0;
        if ((r2 ^ t2 | 0) > 0 & (s2 ^ t2 | 0) < 0) {
          c[o2 >> 2] = 1;
          s2 = (t2 >>> 31) + 2147483647 | 0;
        }
      } else {
        c[o2 >> 2] = 1;
        s2 = 2147483647;
      }
      t2 = b[C2 >> 1] | 0;
      r2 = t2 * 6554 | 0;
      if ((r2 | 0) != 1073741824) {
        t2 = (t2 * 13108 | 0) + s2 | 0;
        if ((r2 ^ s2 | 0) > 0 & (t2 ^ s2 | 0) < 0) {
          c[o2 >> 2] = 1;
          r2 = (s2 >>> 31) + 2147483647 | 0;
        } else
          r2 = t2;
      } else {
        c[o2 >> 2] = 1;
        r2 = 2147483647;
      }
      t2 = b[D2 >> 1] | 0;
      s2 = t2 * 6554 | 0;
      if ((s2 | 0) != 1073741824) {
        t2 = (t2 * 13108 | 0) + r2 | 0;
        if ((s2 ^ r2 | 0) > 0 & (t2 ^ r2 | 0) < 0) {
          c[o2 >> 2] = 1;
          t2 = (r2 >>> 31) + 2147483647 | 0;
        }
      } else {
        c[o2 >> 2] = 1;
        t2 = 2147483647;
      }
      r2 = Ce(t2, o2) | 0;
      if (w2 & ((u2 | v2) ^ 1)) {
        t2 = b[a2 >> 1] | 0;
        if ((t2 * 4681 | 0) == 1073741824) {
          c[o2 >> 2] = 1;
          r2 = 2147483647;
        } else
          r2 = t2 * 9362 | 0;
        t2 = b[y2 >> 1] | 0;
        s2 = t2 * 4681 | 0;
        if ((s2 | 0) != 1073741824) {
          t2 = (t2 * 9362 | 0) + r2 | 0;
          if ((s2 ^ r2 | 0) > 0 & (t2 ^ r2 | 0) < 0) {
            c[o2 >> 2] = 1;
            r2 = (r2 >>> 31) + 2147483647 | 0;
          } else
            r2 = t2;
        } else {
          c[o2 >> 2] = 1;
          r2 = 2147483647;
        }
        t2 = b[z2 >> 1] | 0;
        s2 = t2 * 4681 | 0;
        if ((s2 | 0) != 1073741824) {
          t2 = (t2 * 9362 | 0) + r2 | 0;
          if ((s2 ^ r2 | 0) > 0 & (t2 ^ r2 | 0) < 0) {
            c[o2 >> 2] = 1;
            r2 = (r2 >>> 31) + 2147483647 | 0;
          } else
            r2 = t2;
        } else {
          c[o2 >> 2] = 1;
          r2 = 2147483647;
        }
        t2 = b[A2 >> 1] | 0;
        s2 = t2 * 4681 | 0;
        if ((s2 | 0) != 1073741824) {
          t2 = (t2 * 9362 | 0) + r2 | 0;
          if ((s2 ^ r2 | 0) > 0 & (t2 ^ r2 | 0) < 0) {
            c[o2 >> 2] = 1;
            t2 = (r2 >>> 31) + 2147483647 | 0;
          }
        } else {
          c[o2 >> 2] = 1;
          t2 = 2147483647;
        }
        s2 = b[B2 >> 1] | 0;
        r2 = s2 * 4681 | 0;
        if ((r2 | 0) != 1073741824) {
          s2 = (s2 * 9362 | 0) + t2 | 0;
          if ((r2 ^ t2 | 0) > 0 & (s2 ^ t2 | 0) < 0) {
            c[o2 >> 2] = 1;
            t2 = (t2 >>> 31) + 2147483647 | 0;
          } else
            t2 = s2;
        } else {
          c[o2 >> 2] = 1;
          t2 = 2147483647;
        }
        s2 = b[C2 >> 1] | 0;
        r2 = s2 * 4681 | 0;
        if ((r2 | 0) != 1073741824) {
          s2 = (s2 * 9362 | 0) + t2 | 0;
          if ((r2 ^ t2 | 0) > 0 & (s2 ^ t2 | 0) < 0) {
            c[o2 >> 2] = 1;
            s2 = (t2 >>> 31) + 2147483647 | 0;
          }
        } else {
          c[o2 >> 2] = 1;
          s2 = 2147483647;
        }
        r2 = b[D2 >> 1] | 0;
        p2 = r2 * 4681 | 0;
        if ((p2 | 0) != 1073741824) {
          q2 = (r2 * 9362 | 0) + s2 | 0;
          if ((p2 ^ s2 | 0) > 0 & (q2 ^ s2 | 0) < 0) {
            c[o2 >> 2] = 1;
            q2 = (s2 >>> 31) + 2147483647 | 0;
          }
        } else {
          c[o2 >> 2] = 1;
          q2 = 2147483647;
        }
        r2 = Ce(q2, o2) | 0;
      }
      t2 = n2 ? 8192 : l2 << 16 >> 16;
      p2 = Z(t2, f2 << 16 >> 16) | 0;
      if ((p2 | 0) == 1073741824) {
        c[o2 >> 2] = 1;
        s2 = 2147483647;
      } else
        s2 = p2 << 1;
      r2 = r2 << 16 >> 16;
      q2 = r2 << 13;
      if ((q2 | 0) != 1073741824) {
        p2 = s2 + (r2 << 14) | 0;
        if ((s2 ^ q2 | 0) > 0 & (p2 ^ s2 | 0) < 0) {
          c[o2 >> 2] = 1;
          s2 = (s2 >>> 31) + 2147483647 | 0;
        } else
          s2 = p2;
      } else {
        c[o2 >> 2] = 1;
        s2 = 2147483647;
      }
      p2 = Z(r2, t2) | 0;
      if ((p2 | 0) == 1073741824) {
        c[o2 >> 2] = 1;
        q2 = 2147483647;
      } else
        q2 = p2 << 1;
      p2 = s2 - q2 | 0;
      if (((p2 ^ s2) & (q2 ^ s2) | 0) < 0) {
        c[o2 >> 2] = 1;
        p2 = (s2 >>> 31) + 2147483647 | 0;
      }
      D2 = p2 << 2;
      f2 = k2;
      o2 = Ce((D2 >> 2 | 0) == (p2 | 0) ? D2 : p2 >> 31 ^ 2147483647, o2) | 0;
      D2 = b[f2 >> 1] | 0;
      D2 = D2 & 65535;
      D2 = D2 + 1 | 0;
      D2 = D2 & 65535;
      b[f2 >> 1] = D2;
      return o2 | 0;
    }
    function Na(a2, c2, d2) {
      a2 = a2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      var f2 = 0, g2 = 0, h2 = 0, i3 = 0;
      f2 = c2;
      g2 = f2 + 80 | 0;
      do {
        b[f2 >> 1] = 0;
        f2 = f2 + 2 | 0;
      } while ((f2 | 0) < (g2 | 0));
      f2 = 0;
      do {
        i3 = b[a2 + (f2 << 1) >> 1] | 0;
        g2 = ((i3 & 8) << 10 & 65535 ^ 8192) + -4096 << 16 >> 16;
        h2 = f2 << 16;
        i3 = ((b[d2 + ((i3 & 7) << 1) >> 1] | 0) * 327680 | 0) + h2 >> 16;
        b[c2 + (i3 << 1) >> 1] = g2;
        h2 = ((b[d2 + ((e[a2 + (f2 + 5 << 1) >> 1] & 7) << 1) >> 1] | 0) * 327680 | 0) + h2 >> 16;
        if ((h2 | 0) < (i3 | 0))
          g2 = 0 - (g2 & 65535) & 65535;
        i3 = c2 + (h2 << 1) | 0;
        b[i3 >> 1] = (e[i3 >> 1] | 0) + (g2 & 65535);
        f2 = f2 + 1 | 0;
      } while ((f2 | 0) != 5);
      return;
    }
    function Oa(a2, c2, d2) {
      a2 = a2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      var e2 = 0, f2 = 0, g2 = 0;
      f2 = c2 << 16 >> 16;
      e2 = (f2 << 1 & 2 | 1) + ((f2 >>> 1 & 7) * 5 | 0) | 0;
      c2 = f2 >>> 4 & 3;
      c2 = ((f2 >>> 6 & 7) * 5 | 0) + ((c2 | 0) == 3 ? 4 : c2) | 0;
      f2 = d2;
      g2 = f2 + 80 | 0;
      do {
        b[f2 >> 1] = 0;
        f2 = f2 + 2 | 0;
      } while ((f2 | 0) < (g2 | 0));
      a2 = a2 << 16 >> 16;
      b[d2 + (e2 << 1) >> 1] = (0 - (a2 & 1) & 16383) + 57344;
      b[d2 + (c2 << 1) >> 1] = (0 - (a2 >>> 1 & 1) & 16383) + 57344;
      return;
    }
    function Pa(a2, c2, d2, f2, g2, h2) {
      a2 = a2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      var i3 = 0, j2 = 0;
      h2 = d2 << 16 >> 16;
      j2 = h2 >>> 3;
      a2 = a2 << 16 >> 16;
      a2 = ((a2 << 17 >> 17 | 0) == (a2 | 0) ? a2 << 1 : a2 >>> 15 ^ 32767) + (j2 & 8) << 16;
      j2 = (e[f2 + (a2 + 65536 >> 16 << 1) >> 1] | 0) + ((j2 & 7) * 5 | 0) | 0;
      d2 = c2 << 16 >> 16;
      i3 = (0 - (d2 & 1) & 16383) + 57344 & 65535;
      a2 = g2 + ((e[f2 + (a2 >> 16 << 1) >> 1] | 0) + ((h2 & 7) * 5 | 0) << 16 >> 16 << 1) | 0;
      c2 = g2;
      h2 = c2 + 80 | 0;
      do {
        b[c2 >> 1] = 0;
        c2 = c2 + 2 | 0;
      } while ((c2 | 0) < (h2 | 0));
      b[a2 >> 1] = i3;
      b[g2 + (j2 << 16 >> 16 << 1) >> 1] = (0 - (d2 >>> 1 & 1) & 16383) + 57344;
      return;
    }
    function Qa(a2, c2, d2) {
      a2 = a2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      var e2 = 0, f2 = 0, g2 = 0, h2 = 0;
      c2 = c2 << 16 >> 16;
      e2 = (c2 & 7) * 5 | 0;
      f2 = (c2 >>> 2 & 2 | 1) + ((c2 >>> 4 & 7) * 5 | 0) | 0;
      c2 = (c2 >>> 6 & 2) + 2 + ((c2 >>> 8 & 7) * 5 | 0) | 0;
      g2 = d2;
      h2 = g2 + 80 | 0;
      do {
        b[g2 >> 1] = 0;
        g2 = g2 + 2 | 0;
      } while ((g2 | 0) < (h2 | 0));
      a2 = a2 << 16 >> 16;
      b[d2 + (e2 << 1) >> 1] = (0 - (a2 & 1) & 16383) + 57344;
      b[d2 + (f2 << 1) >> 1] = (0 - (a2 >>> 1 & 1) & 16383) + 57344;
      b[d2 + (c2 << 1) >> 1] = (0 - (a2 >>> 2 & 1) & 16383) + 57344;
      return;
    }
    function Ra(a2, c2, d2, e2) {
      a2 = a2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      var f2 = 0, g2 = 0, h2 = 0, i3 = 0;
      c2 = c2 << 16 >> 16;
      h2 = b[d2 + ((c2 & 7) << 1) >> 1] | 0;
      i3 = b[d2 + ((c2 >>> 3 & 7) << 1) >> 1] | 0;
      g2 = b[d2 + ((c2 >>> 6 & 7) << 1) >> 1] | 0;
      d2 = (c2 >>> 9 & 1) + 3 + ((b[d2 + ((c2 >>> 10 & 7) << 1) >> 1] | 0) * 5 | 0) | 0;
      c2 = e2;
      f2 = c2 + 80 | 0;
      do {
        b[c2 >> 1] = 0;
        c2 = c2 + 2 | 0;
      } while ((c2 | 0) < (f2 | 0));
      a2 = a2 << 16 >> 16;
      b[e2 + (h2 * 327680 >> 16 << 1) >> 1] = (0 - (a2 & 1) & 16383) + 57344;
      b[e2 + ((i3 * 327680 | 0) + 65536 >> 16 << 1) >> 1] = (0 - (a2 >>> 1 & 1) & 16383) + 57344;
      b[e2 + ((g2 * 327680 | 0) + 131072 >> 16 << 1) >> 1] = (0 - (a2 >>> 2 & 1) & 16383) + 57344;
      b[e2 + (d2 << 16 >> 16 << 1) >> 1] = (0 - (a2 >>> 3 & 1) & 16383) + 57344;
      return;
    }
    function Sa(a2, d2, f2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      f2 = f2 | 0;
      var g2 = 0, h2 = 0, j2 = 0, k2 = 0, l2 = 0, m2 = 0, n2 = 0, o2 = 0, p2 = 0, q2 = 0;
      q2 = i2;
      i2 = i2 + 32 | 0;
      p2 = q2 + 16 | 0;
      o2 = q2;
      j2 = d2;
      h2 = j2 + 80 | 0;
      do {
        b[j2 >> 1] = 0;
        j2 = j2 + 2 | 0;
      } while ((j2 | 0) < (h2 | 0));
      h2 = b[a2 >> 1] | 0;
      b[p2 >> 1] = h2;
      b[p2 + 2 >> 1] = b[a2 + 2 >> 1] | 0;
      b[p2 + 4 >> 1] = b[a2 + 4 >> 1] | 0;
      b[p2 + 6 >> 1] = b[a2 + 6 >> 1] | 0;
      m2 = b[a2 + 8 >> 1] | 0;
      Ta(m2 >>> 3 & 65535, m2 & 7, 0, 4, 1, o2, f2);
      m2 = b[a2 + 10 >> 1] | 0;
      Ta(m2 >>> 3 & 65535, m2 & 7, 2, 6, 5, o2, f2);
      m2 = b[a2 + 12 >> 1] | 0;
      g2 = m2 >> 2;
      do
        if ((g2 * 25 | 0) != 1073741824) {
          j2 = (Z(g2, 1638400) | 0) + 786432 >> 21;
          g2 = j2 * 6554 >> 15;
          if ((g2 | 0) > 32767) {
            c[f2 >> 2] = 1;
            k2 = 1;
            l2 = 1;
            a2 = 163835;
            n2 = 6;
            break;
          }
          a2 = (g2 << 16 >> 16) * 5 | 0;
          k2 = g2 & 1;
          if ((a2 | 0) == 1073741824) {
            c[f2 >> 2] = 1;
            l2 = 0;
            a2 = 65535;
          } else {
            l2 = 0;
            n2 = 6;
          }
        } else {
          c[f2 >> 2] = 1;
          k2 = 0;
          g2 = 0;
          l2 = 0;
          j2 = 0;
          a2 = 0;
          n2 = 6;
        }
      while (0);
      if ((n2 | 0) == 6)
        a2 = a2 & 65535;
      n2 = j2 - a2 | 0;
      k2 = k2 << 16 >> 16 == 0 ? n2 : 4 - n2 | 0;
      n2 = k2 << 16 >> 16;
      b[o2 + 6 >> 1] = Rd(((k2 << 17 >> 17 | 0) == (n2 | 0) ? k2 << 1 : n2 >>> 15 ^ 32767) & 65535, m2 & 1, f2) | 0;
      if (l2) {
        c[f2 >> 2] = 1;
        g2 = 32767;
      }
      n2 = g2 << 16 >> 16;
      b[o2 + 14 >> 1] = ((g2 << 17 >> 17 | 0) == (n2 | 0) ? g2 << 1 : n2 >>> 15 ^ 32767) + (m2 >>> 1 & 1);
      g2 = 0;
      while (1) {
        h2 = h2 << 16 >> 16 == 0 ? 8191 : -8191;
        n2 = (b[o2 + (g2 << 1) >> 1] << 2) + g2 << 16;
        j2 = n2 >> 16;
        if ((n2 | 0) < 2621440)
          b[d2 + (j2 << 1) >> 1] = h2;
        k2 = (b[o2 + (g2 + 4 << 1) >> 1] << 2) + g2 << 16;
        a2 = k2 >> 16;
        if ((a2 | 0) < (j2 | 0))
          h2 = 0 - (h2 & 65535) & 65535;
        if ((k2 | 0) < 2621440) {
          n2 = d2 + (a2 << 1) | 0;
          b[n2 >> 1] = (e[n2 >> 1] | 0) + (h2 & 65535);
        }
        g2 = g2 + 1 | 0;
        if ((g2 | 0) == 4)
          break;
        h2 = b[p2 + (g2 << 1) >> 1] | 0;
      }
      i2 = q2;
      return;
    }
    function Ta(a2, d2, e2, f2, g2, h2, i3) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      i3 = i3 | 0;
      var j2 = 0, k2 = 0, l2 = 0, m2 = 0, n2 = 0, o2 = 0, p2 = 0;
      k2 = a2 << 16 >> 16 > 124 ? 124 : a2;
      a2 = (k2 << 16 >> 16) * 1311 >> 15;
      p2 = (a2 | 0) > 32767;
      if (!p2) {
        j2 = a2 << 16 >> 16;
        if ((j2 * 25 | 0) == 1073741824) {
          c[i3 >> 2] = 1;
          j2 = 1073741823;
        } else
          o2 = 4;
      } else {
        c[i3 >> 2] = 1;
        j2 = 32767;
        o2 = 4;
      }
      if ((o2 | 0) == 4)
        j2 = (j2 * 50 | 0) >>> 1;
      m2 = (k2 & 65535) - j2 | 0;
      j2 = (m2 << 16 >> 16) * 6554 >> 15;
      n2 = (j2 | 0) > 32767;
      if (!n2) {
        k2 = j2 << 16 >> 16;
        if ((k2 * 5 | 0) == 1073741824) {
          c[i3 >> 2] = 1;
          l2 = 1073741823;
        } else
          o2 = 9;
      } else {
        c[i3 >> 2] = 1;
        k2 = 32767;
        o2 = 9;
      }
      if ((o2 | 0) == 9)
        l2 = (k2 * 10 | 0) >>> 1;
      m2 = m2 - l2 | 0;
      o2 = m2 << 16 >> 16;
      k2 = d2 << 16 >> 16;
      l2 = k2 >> 2;
      k2 = k2 - (l2 << 2) | 0;
      b[h2 + (e2 << 16 >> 16 << 1) >> 1] = ((m2 << 17 >> 17 | 0) == (o2 | 0) ? m2 << 1 : o2 >>> 15 ^ 32767) + (k2 & 1);
      if (n2) {
        c[i3 >> 2] = 1;
        j2 = 32767;
      }
      e2 = j2 << 16 >> 16;
      b[h2 + (f2 << 16 >> 16 << 1) >> 1] = ((j2 << 17 >> 17 | 0) == (e2 | 0) ? j2 << 1 : e2 >>> 15 ^ 32767) + (k2 << 16 >> 17);
      if (p2) {
        c[i3 >> 2] = 1;
        a2 = 32767;
      }
      f2 = a2 << 16 >> 16;
      b[h2 + (g2 << 16 >> 16 << 1) >> 1] = Rd(l2 & 65535, ((a2 << 17 >> 17 | 0) == (f2 | 0) ? a2 << 1 : f2 >>> 15 ^ 32767) & 65535, i3) | 0;
      return;
    }
    function Ua(a2) {
      a2 = a2 | 0;
      var d2 = 0, e2 = 0, f2 = 0, g2 = 0;
      if (!a2) {
        g2 = -1;
        return g2 | 0;
      }
      Yd(a2 + 1168 | 0);
      b[a2 + 460 >> 1] = 40;
      c[a2 + 1164 >> 2] = 0;
      d2 = a2 + 646 | 0;
      e2 = a2 + 1216 | 0;
      f2 = a2 + 462 | 0;
      g2 = f2 + 22 | 0;
      do {
        b[f2 >> 1] = 0;
        f2 = f2 + 2 | 0;
      } while ((f2 | 0) < (g2 | 0));
      db(d2, c[e2 >> 2] | 0) | 0;
      mb(a2 + 686 | 0) | 0;
      ib(a2 + 700 | 0) | 0;
      La(a2 + 608 | 0) | 0;
      rb(a2 + 626 | 0, c[e2 >> 2] | 0) | 0;
      Ja(a2 + 484 | 0) | 0;
      tb(a2 + 730 | 0) | 0;
      eb(a2 + 748 | 0) | 0;
      Ud(a2 + 714 | 0) | 0;
      Va(a2, 0) | 0;
      g2 = 0;
      return g2 | 0;
    }
    function Va(a2, d2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      var e2 = 0, f2 = 0;
      if (!a2) {
        a2 = -1;
        return a2 | 0;
      }
      c[a2 + 388 >> 2] = a2 + 308;
      Qe(a2 | 0, 0, 308) | 0;
      d2 = (d2 | 0) != 8;
      if (d2) {
        e2 = a2 + 412 | 0;
        f2 = e2 + 20 | 0;
        do {
          b[e2 >> 1] = 0;
          e2 = e2 + 2 | 0;
        } while ((e2 | 0) < (f2 | 0));
        b[a2 + 392 >> 1] = 3e4;
        b[a2 + 394 >> 1] = 26e3;
        b[a2 + 396 >> 1] = 21e3;
        b[a2 + 398 >> 1] = 15e3;
        b[a2 + 400 >> 1] = 8e3;
        b[a2 + 402 >> 1] = 0;
        b[a2 + 404 >> 1] = -8e3;
        b[a2 + 406 >> 1] = -15e3;
        b[a2 + 408 >> 1] = -21e3;
        b[a2 + 410 >> 1] = -26e3;
      }
      b[a2 + 432 >> 1] = 0;
      b[a2 + 434 >> 1] = 40;
      c[a2 + 1164 >> 2] = 0;
      b[a2 + 436 >> 1] = 0;
      b[a2 + 438 >> 1] = 0;
      b[a2 + 440 >> 1] = 0;
      b[a2 + 460 >> 1] = 40;
      b[a2 + 462 >> 1] = 0;
      b[a2 + 464 >> 1] = 0;
      if (d2) {
        e2 = a2 + 442 | 0;
        f2 = e2 + 18 | 0;
        do {
          b[e2 >> 1] = 0;
          e2 = e2 + 2 | 0;
        } while ((e2 | 0) < (f2 | 0));
        e2 = a2 + 466 | 0;
        f2 = e2 + 18 | 0;
        do {
          b[e2 >> 1] = 0;
          e2 = e2 + 2 | 0;
        } while ((e2 | 0) < (f2 | 0));
        La(a2 + 608 | 0) | 0;
        f2 = a2 + 1216 | 0;
        rb(a2 + 626 | 0, c[f2 >> 2] | 0) | 0;
        db(a2 + 646 | 0, c[f2 >> 2] | 0) | 0;
        mb(a2 + 686 | 0) | 0;
        ib(a2 + 700 | 0) | 0;
        Ud(a2 + 714 | 0) | 0;
      } else {
        e2 = a2 + 466 | 0;
        f2 = e2 + 18 | 0;
        do {
          b[e2 >> 1] = 0;
          e2 = e2 + 2 | 0;
        } while ((e2 | 0) < (f2 | 0));
        La(a2 + 608 | 0) | 0;
        db(a2 + 646 | 0, c[a2 + 1216 >> 2] | 0) | 0;
        mb(a2 + 686 | 0) | 0;
        ib(a2 + 700 | 0) | 0;
      }
      Ja(a2 + 484 | 0) | 0;
      b[a2 + 606 >> 1] = 21845;
      tb(a2 + 730 | 0) | 0;
      if (!d2) {
        a2 = 0;
        return a2 | 0;
      }
      eb(a2 + 748 | 0) | 0;
      a2 = 0;
      return a2 | 0;
    }
    function Wa(d2, f2, g2, h2, j2, k2) {
      d2 = d2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      j2 = j2 | 0;
      k2 = k2 | 0;
      var l2 = 0, m2 = 0, n2 = 0, o2 = 0, p2 = 0, q2 = 0, r2 = 0, s2 = 0, t2 = 0, u2 = 0, v2 = 0, w2 = 0, x2 = 0, y2 = 0, z2 = 0, A2 = 0, B2 = 0, C2 = 0, D2 = 0, E2 = 0, F2 = 0, G2 = 0, H2 = 0, I2 = 0, J2 = 0, K2 = 0, L2 = 0, M2 = 0, N2 = 0, O2 = 0, P2 = 0, Q2 = 0, R2 = 0, S2 = 0, T2 = 0, U2 = 0, V2 = 0, W2 = 0, X2 = 0, Y2 = 0, _2 = 0, $2 = 0, aa2 = 0, ba2 = 0, ca2 = 0, da2 = 0, ea2 = 0, fa2 = 0, ga2 = 0, ha2 = 0, ia2 = 0, ja2 = 0, ka2 = 0, la2 = 0, ma2 = 0, na2 = 0, oa2 = 0, pa2 = 0, qa2 = 0, ra2 = 0, sa2 = 0, ta2 = 0, ua2 = 0, va2 = 0, wa2 = 0, xa2 = 0, ya2 = 0, za2 = 0, Aa2 = 0, Ba2 = 0, Ca2 = 0, Ea2 = 0, Fa2 = 0, Ga2 = 0, Ha2 = 0, Ja2 = 0, La2 = 0, Ta2 = 0, Ua2 = 0, Wa2 = 0, bb2 = 0, db2 = 0, eb2 = 0, ib2 = 0, mb2 = 0, pb2 = 0, rb2 = 0, tb2 = 0, xb2 = 0, yb2 = 0, zb2 = 0, Ab2 = 0, Bb2 = 0;
      Bb2 = i2;
      i2 = i2 + 336 | 0;
      r2 = Bb2 + 236 | 0;
      q2 = Bb2 + 216 | 0;
      zb2 = Bb2 + 112 | 0;
      yb2 = Bb2 + 12 | 0;
      mb2 = Bb2 + 256 | 0;
      rb2 = Bb2 + 136 | 0;
      pb2 = Bb2 + 32 | 0;
      eb2 = Bb2 + 8 | 0;
      ib2 = Bb2 + 6 | 0;
      xb2 = Bb2 + 4 | 0;
      tb2 = Bb2 + 2 | 0;
      Ab2 = Bb2;
      Ta2 = d2 + 1164 | 0;
      Ua2 = d2 + 748 | 0;
      Wa2 = hb(Ua2, h2, Ta2) | 0;
      if (Wa2) {
        Va(d2, 8) | 0;
        fb(Ua2, d2 + 412 | 0, d2 + 646 | 0, d2 + 714 | 0, d2 + 608 | 0, Wa2, f2, g2, d2 + 1168 | 0, j2, k2, Ta2);
        Ab2 = d2 + 666 | 0;
        me(Ab2, d2 + 392 | 0, 10, Ta2);
        sb(d2 + 626 | 0, Ab2, Ta2);
        Ab2 = d2 + 1156 | 0;
        c[Ab2 >> 2] = Wa2;
        i2 = Bb2;
        return;
      }
      switch (h2 | 0) {
        case 1: {
          l2 = 1;
          x2 = 6;
          break;
        }
        case 2:
        case 7: {
          Ia(d2 + 606 | 0, b[(c[d2 + 1256 >> 2] | 0) + (f2 << 1) >> 1] | 0, c[(c[d2 + 1260 >> 2] | 0) + (f2 << 2) >> 2] | 0, g2, c[d2 + 1276 >> 2] | 0, Ta2);
          x2 = 9;
          break;
        }
        case 3: {
          x2 = 9;
          break;
        }
        default: {
          l2 = 0;
          x2 = 6;
        }
      }
      do
        if ((x2 | 0) == 6) {
          h2 = d2 + 440 | 0;
          if ((b[h2 >> 1] | 0) == 6) {
            b[h2 >> 1] = 5;
            Ja2 = 0;
            La2 = 0;
            break;
          } else {
            b[h2 >> 1] = 0;
            Ja2 = 0;
            La2 = 0;
            break;
          }
        } else if ((x2 | 0) == 9) {
          h2 = d2 + 440 | 0;
          Ja2 = (e[h2 >> 1] | 0) + 1 & 65535;
          b[h2 >> 1] = Ja2 << 16 >> 16 > 6 ? 6 : Ja2;
          Ja2 = 1;
          La2 = 1;
          l2 = 0;
        }
      while (0);
      Ea2 = d2 + 1156 | 0;
      switch (c[Ea2 >> 2] | 0) {
        case 1: {
          b[h2 >> 1] = 5;
          b[d2 + 436 >> 1] = 0;
          break;
        }
        case 2: {
          b[h2 >> 1] = 5;
          b[d2 + 436 >> 1] = 1;
          break;
        }
      }
      n2 = d2 + 646 | 0;
      Fa2 = d2 + 666 | 0;
      m2 = zb2;
      o2 = Fa2;
      p2 = m2 + 20 | 0;
      do {
        a[m2 >> 0] = a[o2 >> 0] | 0;
        m2 = m2 + 1 | 0;
        o2 = o2 + 1 | 0;
      } while ((m2 | 0) < (p2 | 0));
      Ga2 = (f2 | 0) != 7;
      Ha2 = d2 + 1168 | 0;
      if (Ga2) {
        ab(n2, f2, La2, g2, Ha2, r2, Ta2);
        m2 = d2 + 392 | 0;
        ae(m2, r2, k2, Ta2);
        g2 = g2 + 6 | 0;
      } else {
        cb(n2, La2, g2, Ha2, q2, r2, Ta2);
        m2 = d2 + 392 | 0;
        _d(m2, q2, r2, k2, Ta2);
        g2 = g2 + 10 | 0;
      }
      o2 = r2;
      p2 = m2 + 20 | 0;
      do {
        b[m2 >> 1] = b[o2 >> 1] | 0;
        m2 = m2 + 2 | 0;
        o2 = o2 + 2 | 0;
      } while ((m2 | 0) < (p2 | 0));
      Ca2 = f2 >>> 0 > 1;
      B2 = f2 >>> 0 < 4 & 1;
      Ba2 = (f2 | 0) == 5;
      Aa2 = Ba2 ? 10 : 5;
      Ba2 = Ba2 ? 19 : 9;
      E2 = d2 + 434 | 0;
      F2 = 143 - Ba2 & 65535;
      G2 = d2 + 460 | 0;
      H2 = d2 + 462 | 0;
      I2 = d2 + 464 | 0;
      C2 = f2 >>> 0 > 2;
      J2 = d2 + 388 | 0;
      K2 = (f2 | 0) == 0;
      L2 = f2 >>> 0 < 2;
      M2 = d2 + 1244 | 0;
      N2 = d2 + 432 | 0;
      O2 = f2 >>> 0 < 6;
      P2 = d2 + 1168 | 0;
      Q2 = (f2 | 0) == 6;
      R2 = La2 << 16 >> 16 == 0;
      S2 = d2 + 714 | 0;
      T2 = d2 + 686 | 0;
      U2 = d2 + 436 | 0;
      V2 = d2 + 700 | 0;
      W2 = (f2 | 0) == 7;
      X2 = d2 + 482 | 0;
      Y2 = f2 >>> 0 < 3;
      _2 = d2 + 608 | 0;
      $2 = d2 + 626 | 0;
      aa2 = d2 + 438 | 0;
      ba2 = f2 >>> 0 < 7;
      ca2 = d2 + 730 | 0;
      D2 = Ja2 ^ 1;
      da2 = l2 << 16 >> 16 != 0;
      za2 = da2 ? La2 ^ 1 : 0;
      ea2 = d2 + 442 | 0;
      fa2 = d2 + 458 | 0;
      ga2 = d2 + 412 | 0;
      ha2 = d2 + 80 | 0;
      ia2 = d2 + 1236 | 0;
      ja2 = d2 + 1240 | 0;
      ka2 = d2 + 468 | 0;
      la2 = d2 + 466 | 0;
      ma2 = d2 + 470 | 0;
      na2 = d2 + 472 | 0;
      oa2 = d2 + 474 | 0;
      pa2 = d2 + 476 | 0;
      qa2 = d2 + 478 | 0;
      ra2 = d2 + 480 | 0;
      sa2 = d2 + 444 | 0;
      ta2 = d2 + 446 | 0;
      ua2 = d2 + 448 | 0;
      va2 = d2 + 450 | 0;
      wa2 = d2 + 452 | 0;
      xa2 = d2 + 454 | 0;
      ya2 = d2 + 456 | 0;
      y2 = 0;
      z2 = 0;
      s2 = 0;
      t2 = 0;
      A2 = -1;
      while (1) {
        A2 = (A2 << 16 >> 16) + 1 | 0;
        p2 = A2 & 65535;
        z2 = 1 - (z2 << 16 >> 16) | 0;
        v2 = z2 & 65535;
        q2 = Ca2 & s2 << 16 >> 16 == 80 ? 0 : s2;
        u2 = g2 + 2 | 0;
        r2 = b[g2 >> 1] | 0;
        a:
          do
            if (Ga2) {
              w2 = b[E2 >> 1] | 0;
              m2 = (w2 & 65535) - Aa2 & 65535;
              m2 = m2 << 16 >> 16 < 20 ? 20 : m2;
              o2 = (m2 & 65535) + Ba2 & 65535;
              n2 = o2 << 16 >> 16 > 143;
              Ya(r2, n2 ? F2 : m2, n2 ? 143 : o2, q2, w2, eb2, ib2, B2, Ta2);
              q2 = b[eb2 >> 1] | 0;
              b[G2 >> 1] = q2;
              if (Ja2) {
                r2 = b[E2 >> 1] | 0;
                if (r2 << 16 >> 16 < 143) {
                  r2 = (r2 & 65535) + 1 & 65535;
                  b[E2 >> 1] = r2;
                }
                b[eb2 >> 1] = r2;
                b[ib2 >> 1] = 0;
                if ((b[H2 >> 1] | 0) != 0 ? !(C2 | (b[I2 >> 1] | 0) < 5) : 0) {
                  b[eb2 >> 1] = q2;
                  r2 = q2;
                  q2 = 0;
                } else
                  q2 = 0;
              } else {
                r2 = q2;
                q2 = b[ib2 >> 1] | 0;
              }
              se(c[J2 >> 2] | 0, r2, q2, 40, 1, Ta2);
              if (L2) {
                q2 = g2 + 6 | 0;
                Pa(p2, b[g2 + 4 >> 1] | 0, b[u2 >> 1] | 0, c[M2 >> 2] | 0, mb2, Ta2);
                g2 = b[N2 >> 1] | 0;
                w2 = g2 << 16 >> 16;
                r2 = w2 << 1;
                if ((r2 | 0) == (w2 << 17 >> 16 | 0)) {
                  o2 = K2;
                  break;
                }
                o2 = K2;
                r2 = g2 << 16 >> 16 > 0 ? 32767 : -32768;
                break;
              }
              switch (f2 | 0) {
                case 2: {
                  q2 = g2 + 6 | 0;
                  Oa(b[g2 + 4 >> 1] | 0, b[u2 >> 1] | 0, mb2);
                  g2 = b[N2 >> 1] | 0;
                  w2 = g2 << 16 >> 16;
                  r2 = w2 << 1;
                  if ((r2 | 0) == (w2 << 17 >> 16 | 0)) {
                    o2 = K2;
                    break a;
                  }
                  o2 = K2;
                  r2 = g2 << 16 >> 16 > 0 ? 32767 : -32768;
                  break a;
                }
                case 3: {
                  q2 = g2 + 6 | 0;
                  Qa(b[g2 + 4 >> 1] | 0, b[u2 >> 1] | 0, mb2);
                  g2 = b[N2 >> 1] | 0;
                  w2 = g2 << 16 >> 16;
                  r2 = w2 << 1;
                  if ((r2 | 0) == (w2 << 17 >> 16 | 0)) {
                    o2 = K2;
                    break a;
                  }
                  o2 = K2;
                  r2 = g2 << 16 >> 16 > 0 ? 32767 : -32768;
                  break a;
                }
                default: {
                  if (O2) {
                    q2 = g2 + 6 | 0;
                    Ra(b[g2 + 4 >> 1] | 0, b[u2 >> 1] | 0, c[P2 >> 2] | 0, mb2);
                    g2 = b[N2 >> 1] | 0;
                    w2 = g2 << 16 >> 16;
                    r2 = w2 << 1;
                    if ((r2 | 0) == (w2 << 17 >> 16 | 0)) {
                      o2 = K2;
                      break a;
                    }
                    o2 = K2;
                    r2 = g2 << 16 >> 16 > 0 ? 32767 : -32768;
                    break a;
                  }
                  if (!Q2) {
                    o2 = K2;
                    x2 = 44;
                    break a;
                  }
                  Sa(u2, mb2, Ta2);
                  r2 = g2 + 16 | 0;
                  g2 = b[N2 >> 1] | 0;
                  w2 = g2 << 16 >> 16;
                  p2 = w2 << 1;
                  if ((p2 | 0) == (w2 << 17 >> 16 | 0)) {
                    q2 = r2;
                    o2 = K2;
                    r2 = p2;
                    break a;
                  }
                  q2 = r2;
                  o2 = K2;
                  r2 = g2 << 16 >> 16 > 0 ? 32767 : -32768;
                  break a;
                }
              }
            } else {
              Za(r2, 18, 143, q2, eb2, ib2, Ta2);
              if (R2 ? q2 << 16 >> 16 == 0 | r2 << 16 >> 16 < 61 : 0) {
                r2 = b[eb2 >> 1] | 0;
                q2 = b[ib2 >> 1] | 0;
              } else {
                b[G2 >> 1] = b[eb2 >> 1] | 0;
                r2 = b[E2 >> 1] | 0;
                b[eb2 >> 1] = r2;
                b[ib2 >> 1] = 0;
                q2 = 0;
              }
              se(c[J2 >> 2] | 0, r2, q2, 40, 0, Ta2);
              o2 = 0;
              x2 = 44;
            }
          while (0);
        if ((x2 | 0) == 44) {
          x2 = 0;
          if (Ja2)
            lb(T2, b[h2 >> 1] | 0, xb2, Ta2);
          else
            b[xb2 >> 1] = $a(f2, b[u2 >> 1] | 0, c[ja2 >> 2] | 0) | 0;
          nb(T2, La2, b[U2 >> 1] | 0, xb2, Ta2);
          Na(g2 + 4 | 0, mb2, c[P2 >> 2] | 0);
          r2 = g2 + 24 | 0;
          g2 = b[xb2 >> 1] | 0;
          w2 = g2 << 16 >> 16;
          p2 = w2 << 1;
          if ((p2 | 0) == (w2 << 17 >> 16 | 0)) {
            q2 = r2;
            r2 = p2;
          } else {
            q2 = r2;
            r2 = g2 << 16 >> 16 > 0 ? 32767 : -32768;
          }
        }
        g2 = b[eb2 >> 1] | 0;
        b:
          do
            if (g2 << 16 >> 16 < 40) {
              m2 = r2 << 16 >> 16;
              n2 = g2;
              r2 = g2 << 16 >> 16;
              while (1) {
                p2 = mb2 + (r2 << 1) | 0;
                g2 = (Z(b[mb2 + (r2 - (n2 << 16 >> 16) << 1) >> 1] | 0, m2) | 0) >> 15;
                if ((g2 | 0) > 32767) {
                  c[Ta2 >> 2] = 1;
                  g2 = 32767;
                }
                w2 = g2 & 65535;
                b[Ab2 >> 1] = w2;
                b[p2 >> 1] = Rd(b[p2 >> 1] | 0, w2, Ta2) | 0;
                r2 = r2 + 1 | 0;
                if ((r2 & 65535) << 16 >> 16 == 40)
                  break b;
                n2 = b[eb2 >> 1] | 0;
              }
            }
          while (0);
        c:
          do
            if (o2) {
              o2 = (z2 & 65535 | 0) == 0;
              if (o2) {
                g2 = q2;
                p2 = t2;
              } else {
                g2 = q2 + 2 | 0;
                p2 = b[q2 >> 1] | 0;
              }
              if (R2)
                Xa(S2, f2, p2, mb2, v2, xb2, tb2, Ha2, Ta2);
              else {
                lb(T2, b[h2 >> 1] | 0, xb2, Ta2);
                jb(V2, S2, b[h2 >> 1] | 0, tb2, Ta2);
              }
              nb(T2, La2, b[U2 >> 1] | 0, xb2, Ta2);
              kb(V2, La2, b[U2 >> 1] | 0, tb2, Ta2);
              q2 = b[xb2 >> 1] | 0;
              r2 = q2 << 16 >> 16 > 13017 ? 13017 : q2;
              if (o2)
                x2 = 80;
              else
                w2 = p2;
            } else {
              g2 = q2 + 2 | 0;
              r2 = b[q2 >> 1] | 0;
              switch (f2 | 0) {
                case 1:
                case 2:
                case 3:
                case 4:
                case 6: {
                  if (R2)
                    Xa(S2, f2, r2, mb2, v2, xb2, tb2, Ha2, Ta2);
                  else {
                    lb(T2, b[h2 >> 1] | 0, xb2, Ta2);
                    jb(V2, S2, b[h2 >> 1] | 0, tb2, Ta2);
                  }
                  nb(T2, La2, b[U2 >> 1] | 0, xb2, Ta2);
                  kb(V2, La2, b[U2 >> 1] | 0, tb2, Ta2);
                  q2 = b[xb2 >> 1] | 0;
                  r2 = q2 << 16 >> 16 > 13017 ? 13017 : q2;
                  if (!Q2) {
                    p2 = t2;
                    x2 = 80;
                    break c;
                  }
                  if ((b[E2 >> 1] | 0) <= 45) {
                    p2 = t2;
                    x2 = 80;
                    break c;
                  }
                  p2 = t2;
                  r2 = r2 << 16 >> 16 >>> 2 & 65535;
                  x2 = 80;
                  break c;
                }
                case 5: {
                  if (Ja2)
                    lb(T2, b[h2 >> 1] | 0, xb2, Ta2);
                  else
                    b[xb2 >> 1] = $a(5, r2, c[ja2 >> 2] | 0) | 0;
                  nb(T2, La2, b[U2 >> 1] | 0, xb2, Ta2);
                  if (R2)
                    _a(S2, 5, b[g2 >> 1] | 0, mb2, c[ia2 >> 2] | 0, tb2, Ta2);
                  else
                    jb(V2, S2, b[h2 >> 1] | 0, tb2, Ta2);
                  kb(V2, La2, b[U2 >> 1] | 0, tb2, Ta2);
                  r2 = b[xb2 >> 1] | 0;
                  g2 = q2 + 4 | 0;
                  q2 = r2;
                  p2 = t2;
                  r2 = r2 << 16 >> 16 > 13017 ? 13017 : r2;
                  x2 = 80;
                  break c;
                }
                default: {
                  if (R2)
                    _a(S2, f2, r2, mb2, c[ia2 >> 2] | 0, tb2, Ta2);
                  else
                    jb(V2, S2, b[h2 >> 1] | 0, tb2, Ta2);
                  kb(V2, La2, b[U2 >> 1] | 0, tb2, Ta2);
                  r2 = b[xb2 >> 1] | 0;
                  q2 = r2;
                  p2 = t2;
                  x2 = 80;
                  break c;
                }
              }
            }
          while (0);
        if ((x2 | 0) == 80) {
          x2 = 0;
          b[N2 >> 1] = q2 << 16 >> 16 > 13017 ? 13017 : q2;
          w2 = p2;
        }
        r2 = r2 << 16 >> 16;
        r2 = (r2 << 17 >> 17 | 0) == (r2 | 0) ? r2 << 1 : r2 >>> 15 ^ 32767;
        v2 = (r2 & 65535) << 16 >> 16 > 16384;
        d:
          do
            if (v2) {
              u2 = r2 << 16 >> 16;
              if (W2)
                q2 = 0;
              else {
                q2 = 0;
                while (1) {
                  r2 = (Z(b[(c[J2 >> 2] | 0) + (q2 << 1) >> 1] | 0, u2) | 0) >> 15;
                  if ((r2 | 0) > 32767) {
                    c[Ta2 >> 2] = 1;
                    r2 = 32767;
                  }
                  b[Ab2 >> 1] = r2;
                  r2 = Z(b[xb2 >> 1] | 0, r2 << 16 >> 16) | 0;
                  if ((r2 | 0) == 1073741824) {
                    c[Ta2 >> 2] = 1;
                    r2 = 2147483647;
                  } else
                    r2 = r2 << 1;
                  b[rb2 + (q2 << 1) >> 1] = Ce(r2, Ta2) | 0;
                  q2 = q2 + 1 | 0;
                  if ((q2 | 0) == 40)
                    break d;
                }
              }
              do {
                r2 = (Z(b[(c[J2 >> 2] | 0) + (q2 << 1) >> 1] | 0, u2) | 0) >> 15;
                if ((r2 | 0) > 32767) {
                  c[Ta2 >> 2] = 1;
                  r2 = 32767;
                }
                b[Ab2 >> 1] = r2;
                r2 = Z(b[xb2 >> 1] | 0, r2 << 16 >> 16) | 0;
                if ((r2 | 0) != 1073741824) {
                  r2 = r2 << 1;
                  if ((r2 | 0) < 0)
                    r2 = ~((r2 ^ -2) >> 1);
                  else
                    x2 = 88;
                } else {
                  c[Ta2 >> 2] = 1;
                  r2 = 2147483647;
                  x2 = 88;
                }
                if ((x2 | 0) == 88) {
                  x2 = 0;
                  r2 = r2 >> 1;
                }
                b[rb2 + (q2 << 1) >> 1] = Ce(r2, Ta2) | 0;
                q2 = q2 + 1 | 0;
              } while ((q2 | 0) != 40);
            }
          while (0);
        if (R2) {
          b[la2 >> 1] = b[ka2 >> 1] | 0;
          b[ka2 >> 1] = b[ma2 >> 1] | 0;
          b[ma2 >> 1] = b[na2 >> 1] | 0;
          b[na2 >> 1] = b[oa2 >> 1] | 0;
          b[oa2 >> 1] = b[pa2 >> 1] | 0;
          b[pa2 >> 1] = b[qa2 >> 1] | 0;
          b[qa2 >> 1] = b[ra2 >> 1] | 0;
          b[ra2 >> 1] = b[X2 >> 1] | 0;
          b[X2 >> 1] = b[xb2 >> 1] | 0;
        }
        if ((Ja2 | (b[U2 >> 1] | 0) != 0 ? Y2 & (b[H2 >> 1] | 0) != 0 : 0) ? (bb2 = b[xb2 >> 1] | 0, bb2 << 16 >> 16 > 12288) : 0) {
          x2 = (((bb2 << 16 >> 16) + 118784 | 0) >>> 1) + 12288 & 65535;
          b[xb2 >> 1] = x2 << 16 >> 16 > 14745 ? 14745 : x2;
        }
        qb(zb2, Fa2, s2, yb2, Ta2);
        r2 = Ma(_2, f2, b[tb2 >> 1] | 0, yb2, $2, La2, b[U2 >> 1] | 0, l2, b[aa2 >> 1] | 0, b[H2 >> 1] | 0, b[I2 >> 1] | 0, Ta2) | 0;
        switch (f2 | 0) {
          case 0:
          case 1:
          case 2:
          case 3:
          case 6: {
            p2 = b[xb2 >> 1] | 0;
            u2 = 1;
            break;
          }
          default: {
            r2 = b[tb2 >> 1] | 0;
            p2 = b[xb2 >> 1] | 0;
            if (ba2)
              u2 = 1;
            else {
              q2 = p2 << 16 >> 16;
              if (p2 << 16 >> 16 < 0)
                q2 = ~((q2 ^ -2) >> 1);
              else
                q2 = q2 >>> 1;
              p2 = q2 & 65535;
              u2 = 2;
            }
          }
        }
        m2 = p2 << 16 >> 16;
        s2 = u2 & 65535;
        q2 = c[J2 >> 2] | 0;
        t2 = 0;
        do {
          q2 = q2 + (t2 << 1) | 0;
          b[pb2 + (t2 << 1) >> 1] = b[q2 >> 1] | 0;
          q2 = Z(b[q2 >> 1] | 0, m2) | 0;
          if ((q2 | 0) == 1073741824) {
            c[Ta2 >> 2] = 1;
            n2 = 2147483647;
          } else
            n2 = q2 << 1;
          o2 = Z(b[tb2 >> 1] | 0, b[mb2 + (t2 << 1) >> 1] | 0) | 0;
          if ((o2 | 0) != 1073741824) {
            q2 = (o2 << 1) + n2 | 0;
            if ((o2 ^ n2 | 0) > 0 & (q2 ^ n2 | 0) < 0) {
              c[Ta2 >> 2] = 1;
              q2 = (n2 >>> 31) + 2147483647 | 0;
            }
          } else {
            c[Ta2 >> 2] = 1;
            q2 = 2147483647;
          }
          x2 = q2 << s2;
          x2 = Ce((x2 >> s2 | 0) == (q2 | 0) ? x2 : q2 >> 31 ^ 2147483647, Ta2) | 0;
          q2 = c[J2 >> 2] | 0;
          b[q2 + (t2 << 1) >> 1] = x2;
          t2 = t2 + 1 | 0;
        } while ((t2 | 0) != 40);
        vb(ca2);
        if ((Y2 ? (b[I2 >> 1] | 0) > 3 : 0) ? !((b[H2 >> 1] | 0) == 0 | D2) : 0)
          ub(ca2);
        wb(ca2, f2, pb2, r2, b[xb2 >> 1] | 0, mb2, p2, u2, Ha2, Ta2);
        r2 = 0;
        o2 = 0;
        do {
          q2 = b[pb2 + (o2 << 1) >> 1] | 0;
          q2 = Z(q2, q2) | 0;
          if ((q2 | 0) != 1073741824) {
            p2 = (q2 << 1) + r2 | 0;
            if ((q2 ^ r2 | 0) > 0 & (p2 ^ r2 | 0) < 0) {
              c[Ta2 >> 2] = 1;
              r2 = (r2 >>> 31) + 2147483647 | 0;
            } else
              r2 = p2;
          } else {
            c[Ta2 >> 2] = 1;
            r2 = 2147483647;
          }
          o2 = o2 + 1 | 0;
        } while ((o2 | 0) != 40);
        if ((r2 | 0) < 0)
          r2 = ~((r2 ^ -2) >> 1);
        else
          r2 = r2 >> 1;
        r2 = Fe(r2, Ab2, Ta2) | 0;
        p2 = ((b[Ab2 >> 1] | 0) >>> 1) + 15 | 0;
        q2 = p2 & 65535;
        p2 = p2 << 16 >> 16;
        if (q2 << 16 >> 16 > 0)
          if (q2 << 16 >> 16 < 31) {
            r2 = r2 >> p2;
            x2 = 135;
          } else {
            r2 = 0;
            x2 = 137;
          }
        else {
          u2 = 0 - p2 << 16 >> 16;
          x2 = r2 << u2;
          r2 = (x2 >> u2 | 0) == (r2 | 0) ? x2 : r2 >> 31 ^ 2147483647;
          x2 = 135;
        }
        if ((x2 | 0) == 135) {
          x2 = 0;
          if ((r2 | 0) < 0)
            r2 = ~((r2 ^ -4) >> 2);
          else
            x2 = 137;
        }
        if ((x2 | 0) == 137) {
          x2 = 0;
          r2 = r2 >>> 2;
        }
        r2 = r2 & 65535;
        do
          if (Y2 ? (db2 = b[I2 >> 1] | 0, db2 << 16 >> 16 > 5) : 0)
            if (b[H2 >> 1] | 0)
              if ((b[h2 >> 1] | 0) < 4) {
                if (da2) {
                  if (!(Ja2 | (b[aa2 >> 1] | 0) != 0))
                    x2 = 145;
                } else if (!Ja2)
                  x2 = 145;
                if ((x2 | 0) == 145 ? ((b[U2 >> 1] | 0) == 0) : 0) {
                  x2 = 147;
                  break;
                }
                ob(pb2, r2, ea2, db2, b[U2 >> 1] | 0, za2, Ta2) | 0;
                x2 = 147;
              } else
                x2 = 147;
            else
              x2 = 151;
          else
            x2 = 147;
        while (0);
        do
          if ((x2 | 0) == 147) {
            x2 = 0;
            if (b[H2 >> 1] | 0) {
              if (!Ja2 ? (b[U2 >> 1] | 0) == 0 : 0) {
                x2 = 151;
                break;
              }
              if ((b[h2 >> 1] | 0) >= 4)
                x2 = 151;
            } else
              x2 = 151;
          }
        while (0);
        if ((x2 | 0) == 151) {
          x2 = 0;
          b[ea2 >> 1] = b[sa2 >> 1] | 0;
          b[sa2 >> 1] = b[ta2 >> 1] | 0;
          b[ta2 >> 1] = b[ua2 >> 1] | 0;
          b[ua2 >> 1] = b[va2 >> 1] | 0;
          b[va2 >> 1] = b[wa2 >> 1] | 0;
          b[wa2 >> 1] = b[xa2 >> 1] | 0;
          b[xa2 >> 1] = b[ya2 >> 1] | 0;
          b[ya2 >> 1] = b[fa2 >> 1] | 0;
          b[fa2 >> 1] = r2;
        }
        if (v2) {
          r2 = 0;
          do {
            v2 = rb2 + (r2 << 1) | 0;
            b[v2 >> 1] = Rd(b[v2 >> 1] | 0, b[pb2 + (r2 << 1) >> 1] | 0, Ta2) | 0;
            r2 = r2 + 1 | 0;
          } while ((r2 | 0) != 40);
          Da(pb2, rb2, 40, Ta2);
          c[Ta2 >> 2] = 0;
          He(k2, rb2, j2 + (y2 << 1) | 0, 40, ga2, 0);
        } else {
          c[Ta2 >> 2] = 0;
          He(k2, pb2, j2 + (y2 << 1) | 0, 40, ga2, 0);
        }
        if (!(c[Ta2 >> 2] | 0))
          Pe(ga2 | 0, j2 + (y2 + 30 << 1) | 0, 20) | 0;
        else {
          p2 = 193;
          while (1) {
            q2 = d2 + (p2 << 1) | 0;
            v2 = b[q2 >> 1] | 0;
            r2 = v2 << 16 >> 16;
            if (v2 << 16 >> 16 < 0)
              r2 = ~((r2 ^ -4) >> 2);
            else
              r2 = r2 >>> 2;
            b[q2 >> 1] = r2;
            if ((p2 | 0) > 0)
              p2 = p2 + -1 | 0;
            else {
              p2 = 39;
              break;
            }
          }
          while (1) {
            q2 = pb2 + (p2 << 1) | 0;
            v2 = b[q2 >> 1] | 0;
            r2 = v2 << 16 >> 16;
            if (v2 << 16 >> 16 < 0)
              r2 = ~((r2 ^ -4) >> 2);
            else
              r2 = r2 >>> 2;
            b[q2 >> 1] = r2;
            if ((p2 | 0) > 0)
              p2 = p2 + -1 | 0;
            else
              break;
          }
          He(k2, pb2, j2 + (y2 << 1) | 0, 40, ga2, 1);
        }
        Pe(d2 | 0, ha2 | 0, 308) | 0;
        b[E2 >> 1] = b[eb2 >> 1] | 0;
        r2 = y2 + 40 | 0;
        s2 = r2 & 65535;
        if (s2 << 16 >> 16 >= 160)
          break;
        else {
          y2 = r2 << 16 >> 16;
          k2 = k2 + 22 | 0;
          t2 = w2;
        }
      }
      b[H2 >> 1] = Ka(d2 + 484 | 0, d2 + 466 | 0, j2, I2, Ta2) | 0;
      gb(Ua2, Fa2, j2, Ta2);
      b[U2 >> 1] = La2;
      b[aa2 >> 1] = l2;
      sb(d2 + 626 | 0, Fa2, Ta2);
      Ab2 = Ea2;
      c[Ab2 >> 2] = Wa2;
      i2 = Bb2;
      return;
    }
    function Xa(a2, d2, f2, g2, h2, j2, k2, l2, m2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      j2 = j2 | 0;
      k2 = k2 | 0;
      l2 = l2 | 0;
      m2 = m2 | 0;
      var n2 = 0, o2 = 0, p2 = 0, q2 = 0, r2 = 0;
      r2 = i2;
      i2 = i2 + 16 | 0;
      p2 = r2 + 2 | 0;
      q2 = r2;
      f2 = f2 << 16 >> 16;
      f2 = (f2 << 18 >> 18 | 0) == (f2 | 0) ? f2 << 2 : f2 >>> 15 ^ 32767;
      switch (d2 | 0) {
        case 3:
        case 4:
        case 6: {
          o2 = f2 << 16 >> 16;
          f2 = c[l2 + 84 >> 2] | 0;
          b[j2 >> 1] = b[f2 + (o2 << 1) >> 1] | 0;
          l2 = b[f2 + (o2 + 1 << 1) >> 1] | 0;
          n2 = b[f2 + (o2 + 3 << 1) >> 1] | 0;
          j2 = b[f2 + (o2 + 2 << 1) >> 1] | 0;
          break;
        }
        case 0: {
          l2 = (f2 & 65535) + (h2 << 16 >> 16 << 1 ^ 2) | 0;
          l2 = (l2 & 65535) << 16 >> 16 > 1022 ? 1022 : l2 << 16 >> 16;
          b[j2 >> 1] = b[782 + (l2 << 1) >> 1] | 0;
          j2 = b[782 + (l2 + 1 << 1) >> 1] | 0;
          de(j2 << 16 >> 16, q2, p2, m2);
          b[q2 >> 1] = (e[q2 >> 1] | 0) + 65524;
          l2 = Ee(b[p2 >> 1] | 0, 5, m2) | 0;
          o2 = b[q2 >> 1] | 0;
          o2 = Rd(l2, ((o2 << 26 >> 26 | 0) == (o2 | 0) ? o2 << 10 : o2 >>> 15 ^ 32767) & 65535, m2) | 0;
          l2 = b[p2 >> 1] | 0;
          f2 = b[q2 >> 1] | 0;
          if ((f2 * 24660 | 0) == 1073741824) {
            c[m2 >> 2] = 1;
            h2 = 2147483647;
          } else
            h2 = f2 * 49320 | 0;
          n2 = (l2 << 16 >> 16) * 24660 >> 15;
          f2 = h2 + (n2 << 1) | 0;
          if ((h2 ^ n2 | 0) > 0 & (f2 ^ h2 | 0) < 0) {
            c[m2 >> 2] = 1;
            f2 = (h2 >>> 31) + 2147483647 | 0;
          }
          n2 = f2 << 13;
          l2 = j2;
          n2 = Ce((n2 >> 13 | 0) == (f2 | 0) ? n2 : f2 >> 31 ^ 2147483647, m2) | 0;
          j2 = o2;
          break;
        }
        default: {
          o2 = f2 << 16 >> 16;
          f2 = c[l2 + 80 >> 2] | 0;
          b[j2 >> 1] = b[f2 + (o2 << 1) >> 1] | 0;
          l2 = b[f2 + (o2 + 1 << 1) >> 1] | 0;
          n2 = b[f2 + (o2 + 3 << 1) >> 1] | 0;
          j2 = b[f2 + (o2 + 2 << 1) >> 1] | 0;
        }
      }
      Vd(a2, d2, g2, q2, p2, 0, 0, m2);
      h2 = Z((re(14, b[p2 >> 1] | 0, m2) | 0) << 16 >> 16, l2 << 16 >> 16) | 0;
      if ((h2 | 0) == 1073741824) {
        c[m2 >> 2] = 1;
        f2 = 2147483647;
      } else
        f2 = h2 << 1;
      l2 = 10 - (e[q2 >> 1] | 0) | 0;
      h2 = l2 & 65535;
      l2 = l2 << 16 >> 16;
      if (h2 << 16 >> 16 > 0) {
        q2 = h2 << 16 >> 16 < 31 ? f2 >> l2 : 0;
        q2 = q2 >>> 16;
        q2 = q2 & 65535;
        b[k2 >> 1] = q2;
        Wd(a2, j2, n2);
        i2 = r2;
        return;
      } else {
        m2 = 0 - l2 << 16 >> 16;
        q2 = f2 << m2;
        q2 = (q2 >> m2 | 0) == (f2 | 0) ? q2 : f2 >> 31 ^ 2147483647;
        q2 = q2 >>> 16;
        q2 = q2 & 65535;
        b[k2 >> 1] = q2;
        Wd(a2, j2, n2);
        i2 = r2;
        return;
      }
    }
    function Ya(a2, d2, e2, f2, g2, h2, i3, j2, k2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      i3 = i3 | 0;
      j2 = j2 | 0;
      k2 = k2 | 0;
      if (!(f2 << 16 >> 16)) {
        j2 = a2 << 16 >> 16;
        if (a2 << 16 >> 16 >= 197) {
          b[h2 >> 1] = j2 + 65424;
          b[i3 >> 1] = 0;
          return;
        }
        g2 = ((j2 << 16) + 131072 >> 16) * 10923 >> 15;
        if ((g2 | 0) > 32767) {
          c[k2 >> 2] = 1;
          g2 = 32767;
        }
        a2 = (g2 & 65535) + 19 | 0;
        b[h2 >> 1] = a2;
        b[i3 >> 1] = j2 + 58 - ((a2 * 196608 | 0) >>> 16);
        return;
      }
      if (!(j2 << 16 >> 16)) {
        k2 = a2 << 16 >> 16 << 16;
        a2 = ((k2 + 131072 >> 16) * 21846 | 0) + -65536 >> 16;
        b[h2 >> 1] = a2 + (d2 & 65535);
        b[i3 >> 1] = ((k2 + -131072 | 0) >>> 16) - ((a2 * 196608 | 0) >>> 16);
        return;
      }
      if ((Ge(g2, d2, k2) | 0) << 16 >> 16 > 5)
        g2 = (d2 & 65535) + 5 & 65535;
      j2 = e2 << 16 >> 16;
      j2 = (j2 - (g2 & 65535) & 65535) << 16 >> 16 > 4 ? j2 + 65532 & 65535 : g2;
      g2 = a2 << 16 >> 16;
      if (a2 << 16 >> 16 < 4) {
        b[h2 >> 1] = ((((j2 & 65535) << 16) + -327680 | 0) >>> 16) + g2;
        b[i3 >> 1] = 0;
        return;
      }
      g2 = g2 << 16;
      if (a2 << 16 >> 16 < 12) {
        k2 = (((g2 + -327680 >> 16) * 10923 | 0) >>> 15 << 16) + -65536 | 0;
        a2 = k2 >> 16;
        b[h2 >> 1] = (j2 & 65535) + a2;
        b[i3 >> 1] = ((g2 + -589824 | 0) >>> 16) - (k2 >>> 15) - a2;
        return;
      } else {
        b[h2 >> 1] = ((g2 + -786432 + ((j2 & 65535) << 16) | 0) >>> 16) + 1;
        b[i3 >> 1] = 0;
        return;
      }
    }
    function Za(a2, c2, d2, f2, g2, h2, i3) {
      a2 = a2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      i3 = i3 | 0;
      if (f2 << 16 >> 16) {
        i3 = (e[g2 >> 1] | 0) + 65531 | 0;
        i3 = (i3 << 16 >> 16 | 0) < (c2 << 16 >> 16 | 0) ? c2 : i3 & 65535;
        d2 = d2 << 16 >> 16;
        c2 = a2 << 16 >> 16 << 16;
        a2 = ((c2 + 327680 >> 16) * 10924 | 0) + -65536 >> 16;
        b[g2 >> 1] = (((((i3 & 65535) << 16) + 589824 >> 16 | 0) > (d2 | 0) ? d2 + 65527 & 65535 : i3) & 65535) + a2;
        b[h2 >> 1] = ((c2 + -196608 | 0) >>> 16) - ((a2 * 393216 | 0) >>> 16);
        return;
      }
      f2 = a2 << 16 >> 16;
      if (a2 << 16 >> 16 < 463) {
        a2 = ((((f2 << 16) + 327680 >> 16) * 10924 | 0) >>> 16) + 17 | 0;
        b[g2 >> 1] = a2;
        b[h2 >> 1] = f2 + 105 - ((a2 * 393216 | 0) >>> 16);
        return;
      } else {
        b[g2 >> 1] = f2 + 65168;
        b[h2 >> 1] = 0;
        return;
      }
    }
    function _a(a2, d2, e2, f2, g2, h2, j2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      j2 = j2 | 0;
      var k2 = 0, l2 = 0, m2 = 0, n2 = 0;
      n2 = i2;
      i2 = i2 + 16 | 0;
      l2 = n2 + 6 | 0;
      k2 = n2 + 4 | 0;
      Vd(a2, d2, f2, l2, k2, n2 + 2 | 0, n2, j2);
      m2 = (e2 & 31) * 3 | 0;
      f2 = g2 + (m2 << 1) | 0;
      if (!((Ge(d2 & 65535, 7, j2) | 0) << 16 >> 16)) {
        l2 = re(b[l2 >> 1] | 0, b[k2 >> 1] | 0, j2) | 0;
        k2 = l2 << 16 >> 16;
        k2 = (Z(((l2 << 20 >> 20 | 0) == (k2 | 0) ? l2 << 4 : k2 >>> 15 ^ 32767) << 16 >> 16, b[f2 >> 1] | 0) | 0) >> 15;
        if ((k2 | 0) > 32767) {
          c[j2 >> 2] = 1;
          k2 = 32767;
        }
        f2 = k2 << 16;
        e2 = f2 >> 16;
        if ((k2 << 17 >> 17 | 0) == (e2 | 0))
          k2 = f2 >> 15;
        else
          k2 = e2 >>> 15 ^ 32767;
      } else {
        e2 = re(14, b[k2 >> 1] | 0, j2) | 0;
        e2 = Z(e2 << 16 >> 16, b[f2 >> 1] | 0) | 0;
        if ((e2 | 0) == 1073741824) {
          c[j2 >> 2] = 1;
          f2 = 2147483647;
        } else
          f2 = e2 << 1;
        e2 = Ge(9, b[l2 >> 1] | 0, j2) | 0;
        k2 = e2 << 16 >> 16;
        if (e2 << 16 >> 16 > 0)
          k2 = e2 << 16 >> 16 < 31 ? f2 >> k2 : 0;
        else {
          j2 = 0 - k2 << 16 >> 16;
          k2 = f2 << j2;
          k2 = (k2 >> j2 | 0) == (f2 | 0) ? k2 : f2 >> 31 ^ 2147483647;
        }
        k2 = k2 >>> 16;
      }
      b[h2 >> 1] = k2;
      Wd(a2, b[g2 + (m2 + 1 << 1) >> 1] | 0, b[g2 + (m2 + 2 << 1) >> 1] | 0);
      i2 = n2;
      return;
    }
    function $a(a2, c2, d2) {
      a2 = a2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      c2 = b[d2 + (c2 << 16 >> 16 << 1) >> 1] | 0;
      if ((a2 | 0) != 7) {
        a2 = c2;
        return a2 | 0;
      }
      a2 = c2 & 65532;
      return a2 | 0;
    }
    function ab(d2, e2, f2, g2, h2, j2, k2) {
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      j2 = j2 | 0;
      k2 = k2 | 0;
      var l2 = 0, m2 = 0, n2 = 0, o2 = 0, p2 = 0, q2 = 0, r2 = 0, s2 = 0, t2 = 0, u2 = 0, v2 = 0;
      v2 = i2;
      i2 = i2 + 48 | 0;
      r2 = v2 + 20 | 0;
      u2 = v2;
      t2 = c[h2 + 44 >> 2] | 0;
      s2 = c[h2 + 64 >> 2] | 0;
      l2 = c[h2 + 4 >> 2] | 0;
      q2 = c[h2 + 12 >> 2] | 0;
      n2 = c[h2 + 20 >> 2] | 0;
      m2 = c[h2 + 56 >> 2] | 0;
      if (!(f2 << 16 >> 16)) {
        o2 = e2 >>> 0 < 2;
        if (o2) {
          f2 = 765;
          p2 = 508;
          n2 = c[h2 + 52 >> 2] | 0;
        } else {
          h2 = (e2 | 0) == 5;
          f2 = h2 ? 1533 : 765;
          p2 = 2044;
          l2 = h2 ? m2 : l2;
        }
        m2 = b[g2 >> 1] | 0;
        f2 = ((m2 * 196608 >> 16 | 0) > (f2 & 65535 | 0) ? f2 : m2 * 3 & 65535) << 16 >> 16;
        m2 = b[l2 + (f2 << 1) >> 1] | 0;
        b[r2 >> 1] = m2;
        b[r2 + 2 >> 1] = b[l2 + (f2 + 1 << 1) >> 1] | 0;
        b[r2 + 4 >> 1] = b[l2 + (f2 + 2 << 1) >> 1] | 0;
        f2 = b[g2 + 2 >> 1] | 0;
        if (o2)
          f2 = f2 << 16 >> 16 << 1 & 65535;
        o2 = (f2 << 16 >> 16) * 196608 | 0;
        o2 = (o2 | 0) > 100466688 ? 1533 : o2 >> 16;
        b[r2 + 6 >> 1] = b[q2 + (o2 << 1) >> 1] | 0;
        b[r2 + 8 >> 1] = b[q2 + (o2 + 1 << 1) >> 1] | 0;
        b[r2 + 10 >> 1] = b[q2 + (o2 + 2 << 1) >> 1] | 0;
        g2 = b[g2 + 4 >> 1] | 0;
        g2 = ((g2 << 18 >> 16 | 0) > (p2 & 65535 | 0) ? p2 : g2 << 2 & 65535) << 16 >> 16;
        b[r2 + 12 >> 1] = b[n2 + (g2 << 1) >> 1] | 0;
        b[r2 + 14 >> 1] = b[n2 + ((g2 | 1) << 1) >> 1] | 0;
        b[r2 + 16 >> 1] = b[n2 + ((g2 | 2) << 1) >> 1] | 0;
        b[r2 + 18 >> 1] = b[n2 + ((g2 | 3) << 1) >> 1] | 0;
        if ((e2 | 0) == 8) {
          f2 = 0;
          while (1) {
            s2 = d2 + (f2 << 1) | 0;
            b[u2 + (f2 << 1) >> 1] = Rd(m2, Rd(b[t2 + (f2 << 1) >> 1] | 0, b[s2 >> 1] | 0, k2) | 0, k2) | 0;
            b[s2 >> 1] = m2;
            f2 = f2 + 1 | 0;
            if ((f2 | 0) == 10)
              break;
            m2 = b[r2 + (f2 << 1) >> 1] | 0;
          }
          Ae(u2, 205, 10, k2);
          l2 = d2 + 20 | 0;
          m2 = u2;
          f2 = l2 + 20 | 0;
          do {
            a[l2 >> 0] = a[m2 >> 0] | 0;
            l2 = l2 + 1 | 0;
            m2 = m2 + 1 | 0;
          } while ((l2 | 0) < (f2 | 0));
          me(u2, j2, 10, k2);
          i2 = v2;
          return;
        } else
          l2 = 0;
        do {
          m2 = d2 + (l2 << 1) | 0;
          f2 = (Z(b[s2 + (l2 << 1) >> 1] | 0, b[m2 >> 1] | 0) | 0) >> 15;
          if ((f2 | 0) > 32767) {
            c[k2 >> 2] = 1;
            f2 = 32767;
          }
          g2 = Rd(b[t2 + (l2 << 1) >> 1] | 0, f2 & 65535, k2) | 0;
          e2 = b[r2 + (l2 << 1) >> 1] | 0;
          b[u2 + (l2 << 1) >> 1] = Rd(e2, g2, k2) | 0;
          b[m2 >> 1] = e2;
          l2 = l2 + 1 | 0;
        } while ((l2 | 0) != 10);
        Ae(u2, 205, 10, k2);
        l2 = d2 + 20 | 0;
        m2 = u2;
        f2 = l2 + 20 | 0;
        do {
          a[l2 >> 0] = a[m2 >> 0] | 0;
          l2 = l2 + 1 | 0;
          m2 = m2 + 1 | 0;
        } while ((l2 | 0) < (f2 | 0));
        me(u2, j2, 10, k2);
        i2 = v2;
        return;
      } else {
        l2 = 0;
        do {
          f2 = (b[d2 + 20 + (l2 << 1) >> 1] | 0) * 29491 >> 15;
          if ((f2 | 0) > 32767) {
            c[k2 >> 2] = 1;
            f2 = 32767;
          }
          m2 = (b[t2 + (l2 << 1) >> 1] | 0) * 3277 >> 15;
          if ((m2 | 0) > 32767) {
            c[k2 >> 2] = 1;
            m2 = 32767;
          }
          b[u2 + (l2 << 1) >> 1] = Rd(m2 & 65535, f2 & 65535, k2) | 0;
          l2 = l2 + 1 | 0;
        } while ((l2 | 0) != 10);
        if ((e2 | 0) == 8) {
          l2 = 0;
          do {
            s2 = d2 + (l2 << 1) | 0;
            r2 = Rd(b[t2 + (l2 << 1) >> 1] | 0, b[s2 >> 1] | 0, k2) | 0;
            b[s2 >> 1] = Ge(b[u2 + (l2 << 1) >> 1] | 0, r2, k2) | 0;
            l2 = l2 + 1 | 0;
          } while ((l2 | 0) != 10);
          Ae(u2, 205, 10, k2);
          l2 = d2 + 20 | 0;
          m2 = u2;
          f2 = l2 + 20 | 0;
          do {
            a[l2 >> 0] = a[m2 >> 0] | 0;
            l2 = l2 + 1 | 0;
            m2 = m2 + 1 | 0;
          } while ((l2 | 0) < (f2 | 0));
          me(u2, j2, 10, k2);
          i2 = v2;
          return;
        } else
          l2 = 0;
        do {
          m2 = d2 + (l2 << 1) | 0;
          f2 = (Z(b[s2 + (l2 << 1) >> 1] | 0, b[m2 >> 1] | 0) | 0) >> 15;
          if ((f2 | 0) > 32767) {
            c[k2 >> 2] = 1;
            f2 = 32767;
          }
          r2 = Rd(b[t2 + (l2 << 1) >> 1] | 0, f2 & 65535, k2) | 0;
          b[m2 >> 1] = Ge(b[u2 + (l2 << 1) >> 1] | 0, r2, k2) | 0;
          l2 = l2 + 1 | 0;
        } while ((l2 | 0) != 10);
        Ae(u2, 205, 10, k2);
        l2 = d2 + 20 | 0;
        m2 = u2;
        f2 = l2 + 20 | 0;
        do {
          a[l2 >> 0] = a[m2 >> 0] | 0;
          l2 = l2 + 1 | 0;
          m2 = m2 + 1 | 0;
        } while ((l2 | 0) < (f2 | 0));
        me(u2, j2, 10, k2);
        i2 = v2;
        return;
      }
    }
    function bb(a2, b2, c2) {
      a2 = a2 | 0;
      b2 = b2 | 0;
      c2 = c2 | 0;
      Pe(a2 | 0, c2 + ((b2 << 16 >> 16) * 10 << 1) | 0, 20) | 0;
      return;
    }
    function cb(d2, e2, f2, g2, h2, j2, k2) {
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      j2 = j2 | 0;
      k2 = k2 | 0;
      var l2 = 0, m2 = 0, n2 = 0, o2 = 0, p2 = 0, q2 = 0, r2 = 0, s2 = 0, t2 = 0, u2 = 0, v2 = 0;
      v2 = i2;
      i2 = i2 + 80 | 0;
      q2 = v2 + 60 | 0;
      r2 = v2 + 40 | 0;
      t2 = v2 + 20 | 0;
      u2 = v2;
      s2 = c[g2 + 48 >> 2] | 0;
      n2 = c[g2 + 24 >> 2] | 0;
      o2 = c[g2 + 28 >> 2] | 0;
      p2 = c[g2 + 32 >> 2] | 0;
      if (e2 << 16 >> 16) {
        l2 = 0;
        do {
          q2 = s2 + (l2 << 1) | 0;
          f2 = Rd(((b[q2 >> 1] | 0) * 1639 | 0) >>> 15 & 65535, ((b[d2 + 20 + (l2 << 1) >> 1] | 0) * 31128 | 0) >>> 15 & 65535, k2) | 0;
          b[t2 + (l2 << 1) >> 1] = f2;
          b[u2 + (l2 << 1) >> 1] = f2;
          r2 = d2 + (l2 << 1) | 0;
          b[r2 >> 1] = Ge(f2, Rd(b[q2 >> 1] | 0, ((b[r2 >> 1] | 0) * 21299 | 0) >>> 15 & 65535, k2) | 0, k2) | 0;
          l2 = l2 + 1 | 0;
        } while ((l2 | 0) != 10);
        Ae(t2, 205, 10, k2);
        Ae(u2, 205, 10, k2);
        l2 = d2 + 20 | 0;
        g2 = u2;
        e2 = l2 + 20 | 0;
        do {
          a[l2 >> 0] = a[g2 >> 0] | 0;
          l2 = l2 + 1 | 0;
          g2 = g2 + 1 | 0;
        } while ((l2 | 0) < (e2 | 0));
        me(t2, h2, 10, k2);
        me(u2, j2, 10, k2);
        i2 = v2;
        return;
      }
      e2 = c[g2 + 16 >> 2] | 0;
      g2 = c[g2 + 8 >> 2] | 0;
      m2 = b[f2 >> 1] | 0;
      m2 = ((m2 << 18 >> 18 | 0) == (m2 | 0) ? m2 << 2 : m2 >>> 15 ^ 32767) << 16 >> 16;
      b[q2 >> 1] = b[g2 + (m2 << 1) >> 1] | 0;
      b[q2 + 2 >> 1] = b[g2 + (m2 + 1 << 1) >> 1] | 0;
      b[r2 >> 1] = b[g2 + (m2 + 2 << 1) >> 1] | 0;
      b[r2 + 2 >> 1] = b[g2 + (m2 + 3 << 1) >> 1] | 0;
      m2 = b[f2 + 2 >> 1] | 0;
      m2 = ((m2 << 18 >> 18 | 0) == (m2 | 0) ? m2 << 2 : m2 >>> 15 ^ 32767) << 16 >> 16;
      b[q2 + 4 >> 1] = b[e2 + (m2 << 1) >> 1] | 0;
      b[q2 + 6 >> 1] = b[e2 + (m2 + 1 << 1) >> 1] | 0;
      b[r2 + 4 >> 1] = b[e2 + (m2 + 2 << 1) >> 1] | 0;
      b[r2 + 6 >> 1] = b[e2 + (m2 + 3 << 1) >> 1] | 0;
      m2 = b[f2 + 4 >> 1] | 0;
      g2 = m2 << 16 >> 16;
      if (m2 << 16 >> 16 < 0)
        e2 = ~((g2 ^ -2) >> 1);
      else
        e2 = g2 >>> 1;
      m2 = e2 << 16 >> 16;
      m2 = ((e2 << 18 >> 18 | 0) == (m2 | 0) ? e2 << 2 : m2 >>> 15 ^ 32767) << 16 >> 16;
      l2 = n2 + (m2 + 1 << 1) | 0;
      e2 = b[n2 + (m2 << 1) >> 1] | 0;
      if (!(g2 & 1)) {
        b[q2 + 8 >> 1] = e2;
        b[q2 + 10 >> 1] = b[l2 >> 1] | 0;
        b[r2 + 8 >> 1] = b[n2 + (m2 + 2 << 1) >> 1] | 0;
        b[r2 + 10 >> 1] = b[n2 + (m2 + 3 << 1) >> 1] | 0;
      } else {
        if (e2 << 16 >> 16 == -32768)
          e2 = 32767;
        else
          e2 = 0 - (e2 & 65535) & 65535;
        b[q2 + 8 >> 1] = e2;
        e2 = b[l2 >> 1] | 0;
        if (e2 << 16 >> 16 == -32768)
          e2 = 32767;
        else
          e2 = 0 - (e2 & 65535) & 65535;
        b[q2 + 10 >> 1] = e2;
        e2 = b[n2 + (m2 + 2 << 1) >> 1] | 0;
        if (e2 << 16 >> 16 == -32768)
          e2 = 32767;
        else
          e2 = 0 - (e2 & 65535) & 65535;
        b[r2 + 8 >> 1] = e2;
        e2 = b[n2 + (m2 + 3 << 1) >> 1] | 0;
        if (e2 << 16 >> 16 == -32768)
          e2 = 32767;
        else
          e2 = 0 - (e2 & 65535) & 65535;
        b[r2 + 10 >> 1] = e2;
      }
      l2 = b[f2 + 6 >> 1] | 0;
      l2 = ((l2 << 18 >> 18 | 0) == (l2 | 0) ? l2 << 2 : l2 >>> 15 ^ 32767) << 16 >> 16;
      b[q2 + 12 >> 1] = b[o2 + (l2 << 1) >> 1] | 0;
      b[q2 + 14 >> 1] = b[o2 + (l2 + 1 << 1) >> 1] | 0;
      b[r2 + 12 >> 1] = b[o2 + (l2 + 2 << 1) >> 1] | 0;
      b[r2 + 14 >> 1] = b[o2 + (l2 + 3 << 1) >> 1] | 0;
      l2 = b[f2 + 8 >> 1] | 0;
      l2 = ((l2 << 18 >> 18 | 0) == (l2 | 0) ? l2 << 2 : l2 >>> 15 ^ 32767) << 16 >> 16;
      b[q2 + 16 >> 1] = b[p2 + (l2 << 1) >> 1] | 0;
      b[q2 + 18 >> 1] = b[p2 + (l2 + 1 << 1) >> 1] | 0;
      b[r2 + 16 >> 1] = b[p2 + (l2 + 2 << 1) >> 1] | 0;
      b[r2 + 18 >> 1] = b[p2 + (l2 + 3 << 1) >> 1] | 0;
      l2 = 0;
      do {
        g2 = d2 + (l2 << 1) | 0;
        e2 = (b[g2 >> 1] | 0) * 21299 >> 15;
        if ((e2 | 0) > 32767) {
          c[k2 >> 2] = 1;
          e2 = 32767;
        }
        p2 = Rd(b[s2 + (l2 << 1) >> 1] | 0, e2 & 65535, k2) | 0;
        b[t2 + (l2 << 1) >> 1] = Rd(b[q2 + (l2 << 1) >> 1] | 0, p2, k2) | 0;
        f2 = b[r2 + (l2 << 1) >> 1] | 0;
        b[u2 + (l2 << 1) >> 1] = Rd(f2, p2, k2) | 0;
        b[g2 >> 1] = f2;
        l2 = l2 + 1 | 0;
      } while ((l2 | 0) != 10);
      Ae(t2, 205, 10, k2);
      Ae(u2, 205, 10, k2);
      l2 = d2 + 20 | 0;
      g2 = u2;
      e2 = l2 + 20 | 0;
      do {
        a[l2 >> 0] = a[g2 >> 0] | 0;
        l2 = l2 + 1 | 0;
        g2 = g2 + 1 | 0;
      } while ((l2 | 0) < (e2 | 0));
      me(t2, h2, 10, k2);
      me(u2, j2, 10, k2);
      i2 = v2;
      return;
    }
    function db(a2, c2) {
      a2 = a2 | 0;
      c2 = c2 | 0;
      var d2 = 0, e2 = 0;
      if (!a2) {
        e2 = -1;
        return e2 | 0;
      }
      d2 = a2;
      e2 = d2 + 20 | 0;
      do {
        b[d2 >> 1] = 0;
        d2 = d2 + 2 | 0;
      } while ((d2 | 0) < (e2 | 0));
      Pe(a2 + 20 | 0, c2 | 0, 20) | 0;
      e2 = 0;
      return e2 | 0;
    }
    function eb(d2) {
      d2 = d2 | 0;
      var e2 = 0, f2 = 0, g2 = 0, h2 = 0, i3 = 0;
      if (!d2) {
        i3 = -1;
        return i3 | 0;
      }
      b[d2 >> 1] = 0;
      b[d2 + 2 >> 1] = 8192;
      e2 = d2 + 4 | 0;
      b[e2 >> 1] = 3500;
      b[d2 + 6 >> 1] = 3500;
      c[d2 + 8 >> 2] = 1887529304;
      b[d2 + 12 >> 1] = 3e4;
      b[d2 + 14 >> 1] = 26e3;
      b[d2 + 16 >> 1] = 21e3;
      b[d2 + 18 >> 1] = 15e3;
      b[d2 + 20 >> 1] = 8e3;
      b[d2 + 22 >> 1] = 0;
      b[d2 + 24 >> 1] = -8e3;
      b[d2 + 26 >> 1] = -15e3;
      b[d2 + 28 >> 1] = -21e3;
      b[d2 + 30 >> 1] = -26e3;
      b[d2 + 32 >> 1] = 3e4;
      b[d2 + 34 >> 1] = 26e3;
      b[d2 + 36 >> 1] = 21e3;
      b[d2 + 38 >> 1] = 15e3;
      b[d2 + 40 >> 1] = 8e3;
      b[d2 + 42 >> 1] = 0;
      b[d2 + 44 >> 1] = -8e3;
      b[d2 + 46 >> 1] = -15e3;
      b[d2 + 48 >> 1] = -21e3;
      b[d2 + 50 >> 1] = -26e3;
      b[d2 + 212 >> 1] = 0;
      b[d2 + 374 >> 1] = 0;
      b[d2 + 392 >> 1] = 0;
      f2 = d2 + 52 | 0;
      b[f2 >> 1] = 1384;
      b[d2 + 54 >> 1] = 2077;
      b[d2 + 56 >> 1] = 3420;
      b[d2 + 58 >> 1] = 5108;
      b[d2 + 60 >> 1] = 6742;
      b[d2 + 62 >> 1] = 8122;
      b[d2 + 64 >> 1] = 9863;
      b[d2 + 66 >> 1] = 11092;
      b[d2 + 68 >> 1] = 12714;
      b[d2 + 70 >> 1] = 13701;
      g2 = d2 + 72 | 0;
      h2 = f2;
      i3 = g2 + 20 | 0;
      do {
        a[g2 >> 0] = a[h2 >> 0] | 0;
        g2 = g2 + 1 | 0;
        h2 = h2 + 1 | 0;
      } while ((g2 | 0) < (i3 | 0));
      g2 = d2 + 92 | 0;
      h2 = f2;
      i3 = g2 + 20 | 0;
      do {
        a[g2 >> 0] = a[h2 >> 0] | 0;
        g2 = g2 + 1 | 0;
        h2 = h2 + 1 | 0;
      } while ((g2 | 0) < (i3 | 0));
      g2 = d2 + 112 | 0;
      h2 = f2;
      i3 = g2 + 20 | 0;
      do {
        a[g2 >> 0] = a[h2 >> 0] | 0;
        g2 = g2 + 1 | 0;
        h2 = h2 + 1 | 0;
      } while ((g2 | 0) < (i3 | 0));
      g2 = d2 + 132 | 0;
      h2 = f2;
      i3 = g2 + 20 | 0;
      do {
        a[g2 >> 0] = a[h2 >> 0] | 0;
        g2 = g2 + 1 | 0;
        h2 = h2 + 1 | 0;
      } while ((g2 | 0) < (i3 | 0));
      g2 = d2 + 152 | 0;
      h2 = f2;
      i3 = g2 + 20 | 0;
      do {
        a[g2 >> 0] = a[h2 >> 0] | 0;
        g2 = g2 + 1 | 0;
        h2 = h2 + 1 | 0;
      } while ((g2 | 0) < (i3 | 0));
      g2 = d2 + 172 | 0;
      h2 = f2;
      i3 = g2 + 20 | 0;
      do {
        a[g2 >> 0] = a[h2 >> 0] | 0;
        g2 = g2 + 1 | 0;
        h2 = h2 + 1 | 0;
      } while ((g2 | 0) < (i3 | 0));
      g2 = d2 + 192 | 0;
      h2 = f2;
      i3 = g2 + 20 | 0;
      do {
        a[g2 >> 0] = a[h2 >> 0] | 0;
        g2 = g2 + 1 | 0;
        h2 = h2 + 1 | 0;
      } while ((g2 | 0) < (i3 | 0));
      Qe(d2 + 214 | 0, 0, 160) | 0;
      b[d2 + 376 >> 1] = 3500;
      b[d2 + 378 >> 1] = 3500;
      i3 = b[e2 >> 1] | 0;
      b[d2 + 380 >> 1] = i3;
      b[d2 + 382 >> 1] = i3;
      b[d2 + 384 >> 1] = i3;
      b[d2 + 386 >> 1] = i3;
      b[d2 + 388 >> 1] = i3;
      b[d2 + 390 >> 1] = i3;
      b[d2 + 394 >> 1] = 0;
      b[d2 + 396 >> 1] = 7;
      b[d2 + 398 >> 1] = 32767;
      b[d2 + 400 >> 1] = 0;
      b[d2 + 402 >> 1] = 0;
      b[d2 + 404 >> 1] = 0;
      c[d2 + 408 >> 2] = 1;
      b[d2 + 412 >> 1] = 0;
      i3 = 0;
      return i3 | 0;
    }
    function fb(d2, f2, g2, h2, j2, k2, l2, m2, n2, o2, p2, q2) {
      d2 = d2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      j2 = j2 | 0;
      k2 = k2 | 0;
      l2 = l2 | 0;
      m2 = m2 | 0;
      n2 = n2 | 0;
      o2 = o2 | 0;
      p2 = p2 | 0;
      q2 = q2 | 0;
      var r2 = 0, s2 = 0, t2 = 0, u2 = 0, v2 = 0, w2 = 0, x2 = 0, y2 = 0, z2 = 0, A2 = 0, B2 = 0, C2 = 0, D2 = 0, E2 = 0, F2 = 0, G2 = 0, H2 = 0, I2 = 0, J2 = 0, K2 = 0, L2 = 0, M2 = 0, N2 = 0, O2 = 0, P2 = 0, Q2 = 0, R2 = 0, S2 = 0, T2 = 0, U2 = 0, V2 = 0, W2 = 0, X2 = 0, Y2 = 0, _2 = 0;
      _2 = i2;
      i2 = i2 + 304 | 0;
      Q2 = _2 + 192 | 0;
      N2 = _2 + 168 | 0;
      S2 = _2 + 148 | 0;
      W2 = _2 + 216 | 0;
      T2 = _2 + 146 | 0;
      U2 = _2 + 144 | 0;
      O2 = _2 + 124 | 0;
      P2 = _2 + 104 | 0;
      R2 = _2 + 84 | 0;
      V2 = _2 + 60 | 0;
      L2 = _2 + 40 | 0;
      K2 = _2;
      Y2 = d2 + 404 | 0;
      X2 = d2 + 400 | 0;
      if ((b[Y2 >> 1] | 0) != 0 ? (b[X2 >> 1] | 0) != 0 : 0) {
        J2 = d2 + 394 | 0;
        b[J2 >> 1] = b[636 + (l2 << 1) >> 1] | 0;
        z2 = b[d2 + 212 >> 1] | 0;
        y2 = z2 + 10 | 0;
        Pe(d2 + 52 + (((y2 & 65535 | 0) == 80 ? 0 : y2 << 16 >> 16) << 1) | 0, d2 + 52 + (z2 << 1) | 0, 20) | 0;
        z2 = b[d2 + 392 >> 1] | 0;
        y2 = z2 + 1 | 0;
        b[d2 + 376 + (((y2 & 65535 | 0) == 8 ? 0 : y2 << 16 >> 16) << 1) >> 1] = b[d2 + 376 + (z2 << 1) >> 1] | 0;
        y2 = d2 + 4 | 0;
        b[y2 >> 1] = 0;
        z2 = K2 + 36 | 0;
        A2 = K2 + 32 | 0;
        B2 = K2 + 28 | 0;
        C2 = K2 + 24 | 0;
        D2 = K2 + 20 | 0;
        E2 = K2 + 16 | 0;
        F2 = K2 + 12 | 0;
        G2 = K2 + 8 | 0;
        H2 = K2 + 4 | 0;
        I2 = d2 + 52 | 0;
        t2 = K2;
        M2 = t2 + 40 | 0;
        do {
          c[t2 >> 2] = 0;
          t2 = t2 + 4 | 0;
        } while ((t2 | 0) < (M2 | 0));
        s2 = 0;
        r2 = 7;
        while (1) {
          M2 = b[d2 + 376 + (r2 << 1) >> 1] | 0;
          x2 = M2 << 16 >> 16;
          if (M2 << 16 >> 16 < 0)
            x2 = ~((x2 ^ -8) >> 3);
          else
            x2 = x2 >>> 3;
          s2 = Rd(s2, x2 & 65535, q2) | 0;
          b[y2 >> 1] = s2;
          v2 = r2 * 10 | 0;
          t2 = 9;
          while (1) {
            u2 = K2 + (t2 << 2) | 0;
            w2 = c[u2 >> 2] | 0;
            M2 = b[d2 + 52 + (t2 + v2 << 1) >> 1] | 0;
            x2 = M2 + w2 | 0;
            if ((M2 ^ w2 | 0) > -1 & (x2 ^ w2 | 0) < 0) {
              c[q2 >> 2] = 1;
              x2 = (w2 >>> 31) + 2147483647 | 0;
            }
            c[u2 >> 2] = x2;
            if ((t2 | 0) > 0)
              t2 = t2 + -1 | 0;
            else
              break;
          }
          if ((r2 | 0) <= 0)
            break;
          else
            r2 = r2 + -1 | 0;
        }
        b[L2 + 18 >> 1] = (c[z2 >> 2] | 0) >>> 3;
        b[L2 + 16 >> 1] = (c[A2 >> 2] | 0) >>> 3;
        b[L2 + 14 >> 1] = (c[B2 >> 2] | 0) >>> 3;
        b[L2 + 12 >> 1] = (c[C2 >> 2] | 0) >>> 3;
        b[L2 + 10 >> 1] = (c[D2 >> 2] | 0) >>> 3;
        b[L2 + 8 >> 1] = (c[E2 >> 2] | 0) >>> 3;
        b[L2 + 6 >> 1] = (c[F2 >> 2] | 0) >>> 3;
        b[L2 + 4 >> 1] = (c[G2 >> 2] | 0) >>> 3;
        b[L2 + 2 >> 1] = (c[H2 >> 2] | 0) >>> 3;
        b[L2 >> 1] = (c[K2 >> 2] | 0) >>> 3;
        me(L2, d2 + 12 | 0, 10, q2);
        b[y2 >> 1] = Ge(b[y2 >> 1] | 0, b[J2 >> 1] | 0, q2) | 0;
        Oe(d2 + 214 | 0, I2 | 0, 160) | 0;
        L2 = 9;
        while (1) {
          M2 = b[d2 + 214 + (L2 + 70 << 1) >> 1] | 0;
          u2 = M2 << 16 >> 16;
          K2 = b[d2 + 214 + (L2 + 60 << 1) >> 1] | 0;
          t2 = (K2 << 16 >> 16) + u2 | 0;
          if ((K2 ^ M2) << 16 >> 16 > -1 & (t2 ^ u2 | 0) < 0) {
            c[q2 >> 2] = 1;
            t2 = (u2 >>> 31) + 2147483647 | 0;
          }
          M2 = b[d2 + 214 + (L2 + 50 << 1) >> 1] | 0;
          u2 = M2 + t2 | 0;
          if ((M2 ^ t2 | 0) > -1 & (u2 ^ t2 | 0) < 0) {
            c[q2 >> 2] = 1;
            u2 = (t2 >>> 31) + 2147483647 | 0;
          }
          M2 = b[d2 + 214 + (L2 + 40 << 1) >> 1] | 0;
          t2 = M2 + u2 | 0;
          if ((M2 ^ u2 | 0) > -1 & (t2 ^ u2 | 0) < 0) {
            c[q2 >> 2] = 1;
            t2 = (u2 >>> 31) + 2147483647 | 0;
          }
          M2 = b[d2 + 214 + (L2 + 30 << 1) >> 1] | 0;
          u2 = M2 + t2 | 0;
          if ((M2 ^ t2 | 0) > -1 & (u2 ^ t2 | 0) < 0) {
            c[q2 >> 2] = 1;
            u2 = (t2 >>> 31) + 2147483647 | 0;
          }
          M2 = b[d2 + 214 + (L2 + 20 << 1) >> 1] | 0;
          t2 = M2 + u2 | 0;
          if ((M2 ^ u2 | 0) > -1 & (t2 ^ u2 | 0) < 0) {
            c[q2 >> 2] = 1;
            t2 = (u2 >>> 31) + 2147483647 | 0;
          }
          M2 = b[d2 + 214 + (L2 + 10 << 1) >> 1] | 0;
          u2 = M2 + t2 | 0;
          if ((M2 ^ t2 | 0) > -1 & (u2 ^ t2 | 0) < 0) {
            c[q2 >> 2] = 1;
            t2 = (t2 >>> 31) + 2147483647 | 0;
          } else
            t2 = u2;
          M2 = b[d2 + 214 + (L2 << 1) >> 1] | 0;
          u2 = M2 + t2 | 0;
          if ((M2 ^ t2 | 0) > -1 & (u2 ^ t2 | 0) < 0) {
            c[q2 >> 2] = 1;
            u2 = (t2 >>> 31) + 2147483647 | 0;
          }
          if ((u2 | 0) < 0)
            u2 = ~((u2 ^ -8) >> 3);
          else
            u2 = u2 >>> 3;
          x2 = u2 & 65535;
          v2 = b[654 + (L2 << 1) >> 1] | 0;
          w2 = 7;
          while (1) {
            r2 = d2 + 214 + ((w2 * 10 | 0) + L2 << 1) | 0;
            u2 = Ge(b[r2 >> 1] | 0, x2, q2) | 0;
            b[r2 >> 1] = u2;
            u2 = (Z(v2, u2 << 16 >> 16) | 0) >> 15;
            if ((u2 | 0) > 32767) {
              c[q2 >> 2] = 1;
              u2 = 32767;
            }
            b[r2 >> 1] = u2;
            s2 = (u2 & 65535) - (u2 >>> 15 & 1) | 0;
            s2 = s2 << 16 >> 31 ^ s2;
            t2 = s2 & 65535;
            if (t2 << 16 >> 16 > 655)
              t2 = (((s2 << 16 >> 16) + 261489 | 0) >>> 2) + 655 & 65535;
            t2 = t2 << 16 >> 16 > 1310 ? 1310 : t2;
            if (!(u2 & 32768))
              u2 = t2;
            else
              u2 = 0 - (t2 & 65535) & 65535;
            b[r2 >> 1] = u2;
            if ((w2 | 0) > 0)
              w2 = w2 + -1 | 0;
            else
              break;
          }
          if ((L2 | 0) > 0)
            L2 = L2 + -1 | 0;
          else
            break;
        }
      }
      if (b[X2 >> 1] | 0) {
        x2 = d2 + 32 | 0;
        w2 = d2 + 12 | 0;
        t2 = x2;
        v2 = w2;
        M2 = t2 + 20 | 0;
        do {
          a[t2 >> 0] = a[v2 >> 0] | 0;
          t2 = t2 + 1 | 0;
          v2 = v2 + 1 | 0;
        } while ((t2 | 0) < (M2 | 0));
        v2 = d2 + 4 | 0;
        s2 = b[v2 >> 1] | 0;
        r2 = d2 + 6 | 0;
        b[r2 >> 1] = s2;
        do
          if (b[d2 + 402 >> 1] | 0) {
            t2 = b[d2 >> 1] | 0;
            b[d2 >> 1] = 0;
            t2 = t2 << 16 >> 16 < 32 ? t2 : 32;
            M2 = t2 << 16 >> 16;
            u2 = M2 << 10;
            if ((u2 | 0) != (M2 << 26 >> 16 | 0)) {
              c[q2 >> 2] = 1;
              u2 = t2 << 16 >> 16 > 0 ? 32767 : -32768;
            }
            if (t2 << 16 >> 16 > 1)
              u2 = Td(1024, u2 & 65535) | 0;
            else
              u2 = 16384;
            b[d2 + 2 >> 1] = u2;
            bb(g2, b[m2 >> 1] | 0, c[n2 + 60 >> 2] | 0);
            ab(g2, 8, 0, m2 + 2 | 0, n2, w2, q2);
            t2 = g2;
            M2 = t2 + 20 | 0;
            do {
              a[t2 >> 0] = 0;
              t2 = t2 + 1 | 0;
            } while ((t2 | 0) < (M2 | 0));
            s2 = b[m2 + 8 >> 1] | 0;
            s2 = s2 << 16 >> 16 == 0 ? -32768 : ((s2 + 64 & 65535) > 127 ? s2 << 16 >> 16 > 0 ? 32767 : 32768 : s2 << 16 >> 16 << 9) + 60416 & 65535;
            b[v2 >> 1] = s2;
            if ((b[d2 + 412 >> 1] | 0) != 0 ? (c[d2 + 408 >> 2] | 0) != 0 : 0)
              break;
            t2 = x2;
            v2 = w2;
            M2 = t2 + 20 | 0;
            do {
              a[t2 >> 0] = a[v2 >> 0] | 0;
              t2 = t2 + 1 | 0;
              v2 = v2 + 1 | 0;
            } while ((t2 | 0) < (M2 | 0));
            b[r2 >> 1] = s2;
          }
        while (0);
        t2 = s2 << 16 >> 16;
        if (s2 << 16 >> 16 < 0)
          t2 = ~((t2 ^ -2) >> 1);
        else
          t2 = t2 >>> 1;
        t2 = t2 + 56536 | 0;
        u2 = t2 << 16;
        if ((u2 | 0) > 0)
          t2 = 0;
        else
          t2 = (u2 | 0) < -946077696 ? -14436 : t2 & 65535;
        b[h2 >> 1] = t2;
        b[h2 + 2 >> 1] = t2;
        b[h2 + 4 >> 1] = t2;
        b[h2 + 6 >> 1] = t2;
        m2 = ((t2 << 16 >> 16) * 5443 | 0) >>> 15 & 65535;
        b[h2 + 8 >> 1] = m2;
        b[h2 + 10 >> 1] = m2;
        b[h2 + 12 >> 1] = m2;
        b[h2 + 14 >> 1] = m2;
      }
      t2 = ((b[636 + (l2 << 1) >> 1] | 0) * 104864 | 0) >>> 15 << 16;
      if ((t2 | 0) < 0)
        t2 = ~((t2 >> 16 ^ -32) >> 5);
      else
        t2 = t2 >> 21;
      l2 = d2 + 394 | 0;
      b[l2 >> 1] = Rd(((b[l2 >> 1] | 0) * 29491 | 0) >>> 15 & 65535, t2 & 65535, q2) | 0;
      h2 = (e[d2 >> 1] << 16) + 65536 | 0;
      t2 = h2 >> 16;
      n2 = d2 + 2 | 0;
      t2 = (Z(((h2 << 10 >> 26 | 0) == (t2 | 0) ? h2 >>> 6 : t2 >>> 15 ^ 32767) << 16 >> 16, b[n2 >> 1] | 0) | 0) >> 15;
      if ((t2 | 0) > 32767) {
        c[q2 >> 2] = 1;
        t2 = 32767;
      }
      s2 = t2 & 65535;
      if (s2 << 16 >> 16 <= 1024)
        if (s2 << 16 >> 16 < -2048)
          w2 = -32768;
        else
          w2 = t2 << 4 & 65535;
      else
        w2 = 16384;
      m2 = d2 + 4 | 0;
      x2 = w2 << 16 >> 16;
      u2 = Z(b[m2 >> 1] | 0, x2) | 0;
      if ((u2 | 0) == 1073741824) {
        c[q2 >> 2] = 1;
        L2 = 2147483647;
      } else
        L2 = u2 << 1;
      u2 = (Z(b[d2 + 30 >> 1] | 0, x2) | 0) >> 15;
      if ((u2 | 0) > 32767) {
        c[q2 >> 2] = 1;
        u2 = 32767;
      }
      y2 = u2 & 65535;
      b[Q2 + 18 >> 1] = y2;
      u2 = (Z(b[d2 + 28 >> 1] | 0, x2) | 0) >> 15;
      if ((u2 | 0) > 32767) {
        c[q2 >> 2] = 1;
        u2 = 32767;
      }
      b[Q2 + 16 >> 1] = u2;
      u2 = (Z(b[d2 + 26 >> 1] | 0, x2) | 0) >> 15;
      if ((u2 | 0) > 32767) {
        c[q2 >> 2] = 1;
        u2 = 32767;
      }
      b[Q2 + 14 >> 1] = u2;
      u2 = (Z(b[d2 + 24 >> 1] | 0, x2) | 0) >> 15;
      if ((u2 | 0) > 32767) {
        c[q2 >> 2] = 1;
        u2 = 32767;
      }
      b[Q2 + 12 >> 1] = u2;
      u2 = (Z(b[d2 + 22 >> 1] | 0, x2) | 0) >> 15;
      if ((u2 | 0) > 32767) {
        c[q2 >> 2] = 1;
        u2 = 32767;
      }
      b[Q2 + 10 >> 1] = u2;
      u2 = (Z(b[d2 + 20 >> 1] | 0, x2) | 0) >> 15;
      if ((u2 | 0) > 32767) {
        c[q2 >> 2] = 1;
        u2 = 32767;
      }
      b[Q2 + 8 >> 1] = u2;
      u2 = (Z(b[d2 + 18 >> 1] | 0, x2) | 0) >> 15;
      if ((u2 | 0) > 32767) {
        c[q2 >> 2] = 1;
        u2 = 32767;
      }
      b[Q2 + 6 >> 1] = u2;
      u2 = (Z(b[d2 + 16 >> 1] | 0, x2) | 0) >> 15;
      if ((u2 | 0) > 32767) {
        c[q2 >> 2] = 1;
        u2 = 32767;
      }
      b[Q2 + 4 >> 1] = u2;
      u2 = (Z(b[d2 + 14 >> 1] | 0, x2) | 0) >> 15;
      if ((u2 | 0) > 32767) {
        c[q2 >> 2] = 1;
        u2 = 32767;
      }
      b[Q2 + 2 >> 1] = u2;
      u2 = (Z(b[d2 + 12 >> 1] | 0, x2) | 0) >> 15;
      if ((u2 | 0) > 32767) {
        c[q2 >> 2] = 1;
        u2 = 32767;
      }
      b[Q2 >> 1] = u2;
      h2 = d2 + 6 | 0;
      x2 = 16384 - (w2 & 65535) << 16 >> 16;
      u2 = Z(b[h2 >> 1] | 0, x2) | 0;
      if ((u2 | 0) != 1073741824) {
        t2 = (u2 << 1) + L2 | 0;
        if ((u2 ^ L2 | 0) > 0 & (t2 ^ L2 | 0) < 0) {
          c[q2 >> 2] = 1;
          K2 = (L2 >>> 31) + 2147483647 | 0;
        } else
          K2 = t2;
      } else {
        c[q2 >> 2] = 1;
        K2 = 2147483647;
      }
      t2 = y2;
      v2 = 9;
      while (1) {
        s2 = Q2 + (v2 << 1) | 0;
        u2 = (Z(b[d2 + 32 + (v2 << 1) >> 1] | 0, x2) | 0) >> 15;
        if ((u2 | 0) > 32767) {
          c[q2 >> 2] = 1;
          u2 = 32767;
        }
        t2 = Rd(t2, u2 & 65535, q2) | 0;
        b[s2 >> 1] = t2;
        M2 = t2 << 16 >> 16;
        u2 = M2 << 1;
        if ((u2 | 0) != (M2 << 17 >> 16 | 0)) {
          c[q2 >> 2] = 1;
          u2 = t2 << 16 >> 16 > 0 ? 32767 : -32768;
        }
        b[s2 >> 1] = u2;
        u2 = v2 + -1 | 0;
        if ((v2 | 0) <= 0)
          break;
        t2 = b[Q2 + (u2 << 1) >> 1] | 0;
        v2 = u2;
      }
      L2 = d2 + 374 | 0;
      u2 = ((e[L2 >> 1] << 16) + -161021952 >> 16) * 9830 >> 15;
      if ((u2 | 0) > 32767) {
        c[q2 >> 2] = 1;
        u2 = 32767;
      }
      u2 = 4096 - (u2 & 65535) | 0;
      t2 = u2 << 16;
      if ((t2 | 0) > 268369920)
        x2 = 32767;
      else
        x2 = (t2 | 0) < 0 ? 0 : u2 << 19 >> 16;
      J2 = d2 + 8 | 0;
      u2 = Ga(J2, 3) | 0;
      ne(Q2, O2, 10, q2);
      t2 = P2;
      v2 = O2;
      M2 = t2 + 20 | 0;
      do {
        b[t2 >> 1] = b[v2 >> 1] | 0;
        t2 = t2 + 2 | 0;
        v2 = v2 + 2 | 0;
      } while ((t2 | 0) < (M2 | 0));
      t2 = (u2 << 16 >> 16) * 10 | 0;
      v2 = 9;
      while (1) {
        s2 = P2 + (v2 << 1) | 0;
        r2 = b[s2 >> 1] | 0;
        u2 = (Z(b[d2 + 214 + (v2 + t2 << 1) >> 1] | 0, x2) | 0) >> 15;
        if ((u2 | 0) > 32767) {
          c[q2 >> 2] = 1;
          u2 = 32767;
        }
        b[s2 >> 1] = Rd(r2, u2 & 65535, q2) | 0;
        if ((v2 | 0) > 0)
          v2 = v2 + -1 | 0;
        else
          break;
      }
      Ae(O2, 205, 10, q2);
      Ae(P2, 205, 10, q2);
      t2 = g2 + 20 | 0;
      v2 = O2;
      M2 = t2 + 20 | 0;
      do {
        a[t2 >> 0] = a[v2 >> 0] | 0;
        t2 = t2 + 1 | 0;
        v2 = v2 + 1 | 0;
      } while ((t2 | 0) < (M2 | 0));
      me(O2, Q2, 10, q2);
      me(P2, R2, 10, q2);
      he(Q2, N2, q2);
      he(R2, V2, q2);
      t2 = p2;
      v2 = N2;
      M2 = t2 + 22 | 0;
      do {
        a[t2 >> 0] = a[v2 >> 0] | 0;
        t2 = t2 + 1 | 0;
        v2 = v2 + 1 | 0;
      } while ((t2 | 0) < (M2 | 0));
      t2 = p2 + 22 | 0;
      v2 = N2;
      M2 = t2 + 22 | 0;
      do {
        a[t2 >> 0] = a[v2 >> 0] | 0;
        t2 = t2 + 1 | 0;
        v2 = v2 + 1 | 0;
      } while ((t2 | 0) < (M2 | 0));
      t2 = p2 + 44 | 0;
      v2 = N2;
      M2 = t2 + 22 | 0;
      do {
        a[t2 >> 0] = a[v2 >> 0] | 0;
        t2 = t2 + 1 | 0;
        v2 = v2 + 1 | 0;
      } while ((t2 | 0) < (M2 | 0));
      t2 = p2 + 66 | 0;
      v2 = N2;
      M2 = t2 + 22 | 0;
      do {
        a[t2 >> 0] = a[v2 >> 0] | 0;
        t2 = t2 + 1 | 0;
        v2 = v2 + 1 | 0;
      } while ((t2 | 0) < (M2 | 0));
      Fa(N2 + 2 | 0, S2, q2);
      u2 = 0;
      t2 = 32767;
      do {
        s2 = b[S2 + (u2 << 1) >> 1] | 0;
        s2 = Z(s2, s2) | 0;
        if (s2 >>> 0 < 1073741824)
          s2 = 32767 - (s2 >>> 15) | 0;
        else {
          c[q2 >> 2] = 1;
          s2 = 0;
        }
        t2 = (Z(s2 << 16 >> 16, t2 << 16 >> 16) | 0) >> 15;
        if ((t2 | 0) > 32767) {
          c[q2 >> 2] = 1;
          t2 = 32767;
        }
        u2 = u2 + 1 | 0;
      } while ((u2 | 0) != 10);
      de(t2 << 16 >> 16, T2, U2, q2);
      t2 = (e[T2 >> 1] << 16) + -983040 | 0;
      s2 = t2 >> 16;
      s2 = De(Ge(0, Rd(((t2 << 12 >> 28 | 0) == (s2 | 0) ? t2 >>> 4 : s2 >>> 15 ^ 32767) & 65535, De(b[U2 >> 1] | 0, 3, q2) | 0, q2) | 0, q2) | 0, 1, q2) | 0;
      t2 = (b[L2 >> 1] | 0) * 29491 >> 15;
      if ((t2 | 0) > 32767) {
        c[q2 >> 2] = 1;
        t2 = 32767;
      }
      u2 = s2 << 16 >> 16;
      s2 = u2 * 3277 >> 15;
      if ((s2 | 0) > 32767) {
        c[q2 >> 2] = 1;
        s2 = 32767;
      }
      b[L2 >> 1] = Rd(t2 & 65535, s2 & 65535, q2) | 0;
      s2 = K2 >> 10;
      r2 = s2 + 262144 | 0;
      if ((s2 | 0) > -1 & (r2 ^ s2 | 0) < 0) {
        c[q2 >> 2] = 1;
        r2 = (s2 >>> 31) + 2147483647 | 0;
      }
      U2 = u2 << 4;
      s2 = r2 - U2 | 0;
      if (((s2 ^ r2) & (r2 ^ U2) | 0) < 0) {
        c[q2 >> 2] = 1;
        r2 = (r2 >>> 31) + 2147483647 | 0;
      } else
        r2 = s2;
      U2 = b[l2 >> 1] << 5;
      s2 = U2 + r2 | 0;
      if ((U2 ^ r2 | 0) > -1 & (s2 ^ r2 | 0) < 0) {
        c[q2 >> 2] = 1;
        s2 = (r2 >>> 31) + 2147483647 | 0;
      }
      u2 = (re(s2 >>> 16 & 65535, s2 >>> 1 & 32767, q2) | 0) << 16 >> 16;
      Ha(J2, W2, q2);
      r2 = 39;
      while (1) {
        t2 = W2 + (r2 << 1) | 0;
        s2 = (Z(b[t2 >> 1] | 0, u2) | 0) >> 15;
        if ((s2 | 0) > 32767) {
          c[q2 >> 2] = 1;
          s2 = 32767;
        }
        b[t2 >> 1] = s2;
        if ((r2 | 0) > 0)
          r2 = r2 + -1 | 0;
        else
          break;
      }
      He(V2, W2, o2, 40, f2, 1);
      Ha(J2, W2, q2);
      r2 = 39;
      while (1) {
        t2 = W2 + (r2 << 1) | 0;
        s2 = (Z(b[t2 >> 1] | 0, u2) | 0) >> 15;
        if ((s2 | 0) > 32767) {
          c[q2 >> 2] = 1;
          s2 = 32767;
        }
        b[t2 >> 1] = s2;
        if ((r2 | 0) > 0)
          r2 = r2 + -1 | 0;
        else
          break;
      }
      He(V2, W2, o2 + 80 | 0, 40, f2, 1);
      Ha(J2, W2, q2);
      r2 = 39;
      while (1) {
        t2 = W2 + (r2 << 1) | 0;
        s2 = (Z(b[t2 >> 1] | 0, u2) | 0) >> 15;
        if ((s2 | 0) > 32767) {
          c[q2 >> 2] = 1;
          s2 = 32767;
        }
        b[t2 >> 1] = s2;
        if ((r2 | 0) > 0)
          r2 = r2 + -1 | 0;
        else
          break;
      }
      He(V2, W2, o2 + 160 | 0, 40, f2, 1);
      Ha(J2, W2, q2);
      t2 = 39;
      while (1) {
        r2 = W2 + (t2 << 1) | 0;
        s2 = (Z(b[r2 >> 1] | 0, u2) | 0) >> 15;
        if ((s2 | 0) > 32767) {
          c[q2 >> 2] = 1;
          s2 = 32767;
        }
        b[r2 >> 1] = s2;
        if ((t2 | 0) > 0)
          t2 = t2 + -1 | 0;
        else
          break;
      }
      He(V2, W2, o2 + 240 | 0, 40, f2, 1);
      b[j2 + 14 >> 1] = 20;
      b[j2 + 16 >> 1] = 0;
      if ((k2 | 0) == 2) {
        s2 = b[d2 >> 1] | 0;
        s2 = s2 << 16 >> 16 > 32 ? 32 : s2 << 16 >> 16 < 1 ? 8 : s2;
        o2 = s2 << 16 >> 16;
        r2 = o2 << 10;
        if ((r2 | 0) != (o2 << 26 >> 16 | 0)) {
          c[q2 >> 2] = 1;
          r2 = s2 << 16 >> 16 > 0 ? 32767 : -32768;
        }
        b[n2 >> 1] = Td(1024, r2 & 65535) | 0;
        b[d2 >> 1] = 0;
        t2 = d2 + 32 | 0;
        v2 = d2 + 12 | 0;
        M2 = t2 + 20 | 0;
        do {
          a[t2 >> 0] = a[v2 >> 0] | 0;
          t2 = t2 + 1 | 0;
          v2 = v2 + 1 | 0;
        } while ((t2 | 0) < (M2 | 0));
        q2 = b[m2 >> 1] | 0;
        b[h2 >> 1] = q2;
        b[m2 >> 1] = (q2 & 65535) + 65280;
      }
      if (!(b[X2 >> 1] | 0)) {
        i2 = _2;
        return;
      }
      do
        if (!(b[d2 + 402 >> 1] | 0)) {
          if (b[Y2 >> 1] | 0)
            break;
          i2 = _2;
          return;
        }
      while (0);
      b[d2 >> 1] = 0;
      b[d2 + 412 >> 1] = 1;
      i2 = _2;
      return;
    }
    function gb(a2, d2, f2, g2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      var h2 = 0, j2 = 0, k2 = 0, l2 = 0, m2 = 0, n2 = 0;
      m2 = i2;
      i2 = i2 + 16 | 0;
      k2 = m2 + 2 | 0;
      l2 = m2;
      b[l2 >> 1] = 0;
      j2 = a2 + 212 | 0;
      h2 = (e[j2 >> 1] | 0) + 10 | 0;
      h2 = (h2 & 65535 | 0) == 80 ? 0 : h2 & 65535;
      b[j2 >> 1] = h2;
      Pe(a2 + 52 + (h2 << 16 >> 16 << 1) | 0, d2 | 0, 20) | 0;
      h2 = 0;
      j2 = 159;
      while (1) {
        n2 = b[f2 + (j2 << 1) >> 1] | 0;
        n2 = Z(n2, n2) | 0;
        n2 = (n2 | 0) == 1073741824 ? 2147483647 : n2 << 1;
        d2 = n2 + h2 | 0;
        if ((n2 ^ h2 | 0) > -1 & (d2 ^ h2 | 0) < 0) {
          c[g2 >> 2] = 1;
          h2 = (h2 >>> 31) + 2147483647 | 0;
        } else
          h2 = d2;
        if ((j2 | 0) > 0)
          j2 = j2 + -1 | 0;
        else
          break;
      }
      de(h2, k2, l2, g2);
      h2 = b[k2 >> 1] | 0;
      n2 = h2 << 16 >> 16;
      d2 = n2 << 10;
      if ((d2 | 0) != (n2 << 26 >> 16 | 0)) {
        c[g2 >> 2] = 1;
        d2 = h2 << 16 >> 16 > 0 ? 32767 : -32768;
      }
      b[k2 >> 1] = d2;
      n2 = b[l2 >> 1] | 0;
      h2 = n2 << 16 >> 16;
      if (n2 << 16 >> 16 < 0)
        h2 = ~((h2 ^ -32) >> 5);
      else
        h2 = h2 >>> 5;
      l2 = a2 + 392 | 0;
      n2 = (e[l2 >> 1] | 0) + 1 | 0;
      n2 = (n2 & 65535 | 0) == 8 ? 0 : n2 & 65535;
      b[l2 >> 1] = n2;
      b[a2 + 376 + (n2 << 16 >> 16 << 1) >> 1] = h2 + 57015 + d2;
      i2 = m2;
      return;
    }
    function hb(a2, d2, f2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      f2 = f2 | 0;
      var g2 = 0, h2 = 0, i3 = 0, j2 = 0, k2 = 0, l2 = 0, m2 = 0, n2 = 0;
      l2 = (d2 | 0) == 4;
      m2 = (d2 | 0) == 5;
      n2 = (d2 | 0) == 6;
      g2 = c[a2 + 408 >> 2] | 0;
      a:
        do
          if ((d2 + -4 | 0) >>> 0 < 3)
            k2 = 4;
          else {
            if ((g2 + -1 | 0) >>> 0 < 2)
              switch (d2 | 0) {
                case 2:
                case 3:
                case 7: {
                  k2 = 4;
                  break a;
                }
              }
            b[a2 >> 1] = 0;
            j2 = 0;
          }
        while (0);
      if ((k2 | 0) == 4) {
        b:
          do
            if ((g2 | 0) == 2) {
              switch (d2 | 0) {
                case 2:
                case 4:
                case 6:
                case 7:
                  break;
                default: {
                  h2 = 1;
                  break b;
                }
              }
              h2 = 2;
            } else
              h2 = 1;
          while (0);
        j2 = (e[a2 >> 1] | 0) + 1 & 65535;
        b[a2 >> 1] = j2;
        j2 = (d2 | 0) != 5 & j2 << 16 >> 16 > 50 ? 2 : h2;
      }
      i3 = a2 + 398 | 0;
      if (m2 & (b[a2 + 412 >> 1] | 0) == 0) {
        b[i3 >> 1] = 0;
        h2 = 0;
      } else
        h2 = b[i3 >> 1] | 0;
      h2 = Rd(h2, 1, f2) | 0;
      b[i3 >> 1] = h2;
      f2 = a2 + 404 | 0;
      b[f2 >> 1] = 0;
      c:
        do
          switch (d2 | 0) {
            case 2:
            case 4:
            case 5:
            case 6:
            case 7: {
              if (!((d2 | 0) == 7 & (j2 | 0) == 0)) {
                if (h2 << 16 >> 16 > 30) {
                  b[f2 >> 1] = 1;
                  b[i3 >> 1] = 0;
                  b[a2 + 396 >> 1] = 0;
                  break c;
                }
                h2 = a2 + 396 | 0;
                g2 = b[h2 >> 1] | 0;
                if (!(g2 << 16 >> 16)) {
                  b[i3 >> 1] = 0;
                  break c;
                } else {
                  b[h2 >> 1] = (g2 & 65535) + 65535;
                  break c;
                }
              } else
                k2 = 14;
              break;
            }
            default:
              k2 = 14;
          }
        while (0);
      if ((k2 | 0) == 14)
        b[a2 + 396 >> 1] = 7;
      if (!j2)
        return j2 | 0;
      h2 = a2 + 400 | 0;
      b[h2 >> 1] = 0;
      g2 = a2 + 402 | 0;
      b[g2 >> 1] = 0;
      if (l2) {
        b[h2 >> 1] = 1;
        return j2 | 0;
      }
      if (m2) {
        b[h2 >> 1] = 1;
        b[g2 >> 1] = 1;
        return j2 | 0;
      }
      if (!n2)
        return j2 | 0;
      b[h2 >> 1] = 1;
      b[f2 >> 1] = 0;
      return j2 | 0;
    }
    function ib(a2) {
      a2 = a2 | 0;
      if (!a2) {
        a2 = -1;
        return a2 | 0;
      }
      b[a2 >> 1] = 1;
      b[a2 + 2 >> 1] = 1;
      b[a2 + 4 >> 1] = 1;
      b[a2 + 6 >> 1] = 1;
      b[a2 + 8 >> 1] = 1;
      b[a2 + 10 >> 1] = 0;
      b[a2 + 12 >> 1] = 1;
      a2 = 0;
      return a2 | 0;
    }
    function jb(a2, d2, e2, f2, g2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      var h2 = 0, j2 = 0, k2 = 0, l2 = 0;
      l2 = i2;
      i2 = i2 + 16 | 0;
      k2 = l2 + 2 | 0;
      j2 = l2;
      h2 = Zd(a2, 5) | 0;
      a2 = a2 + 10 | 0;
      if ((Ge(h2, b[a2 >> 1] | 0, g2) | 0) << 16 >> 16 > 0)
        h2 = b[a2 >> 1] | 0;
      h2 = (Z(b[674 + (e2 << 16 >> 16 << 1) >> 1] | 0, h2 << 16 >> 16) | 0) >> 15;
      if ((h2 | 0) > 32767) {
        c[g2 >> 2] = 1;
        h2 = 32767;
      }
      b[f2 >> 1] = h2;
      Xd(d2, k2, j2, g2);
      Wd(d2, b[k2 >> 1] | 0, b[j2 >> 1] | 0);
      i2 = l2;
      return;
    }
    function kb(a2, c2, d2, e2, f2) {
      a2 = a2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      if (!(c2 << 16 >> 16)) {
        if (d2 << 16 >> 16) {
          c2 = a2 + 12 | 0;
          if ((Ge(b[e2 >> 1] | 0, b[c2 >> 1] | 0, f2) | 0) << 16 >> 16 > 0)
            b[e2 >> 1] = b[c2 >> 1] | 0;
        } else
          c2 = a2 + 12 | 0;
        b[c2 >> 1] = b[e2 >> 1] | 0;
      }
      b[a2 + 10 >> 1] = b[e2 >> 1] | 0;
      f2 = a2 + 2 | 0;
      b[a2 >> 1] = b[f2 >> 1] | 0;
      d2 = a2 + 4 | 0;
      b[f2 >> 1] = b[d2 >> 1] | 0;
      f2 = a2 + 6 | 0;
      b[d2 >> 1] = b[f2 >> 1] | 0;
      a2 = a2 + 8 | 0;
      b[f2 >> 1] = b[a2 >> 1] | 0;
      b[a2 >> 1] = b[e2 >> 1] | 0;
      return;
    }
    function lb(a2, d2, e2, f2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      var g2 = 0;
      g2 = Zd(a2, 5) | 0;
      a2 = a2 + 10 | 0;
      if ((Ge(g2, b[a2 >> 1] | 0, f2) | 0) << 16 >> 16 > 0)
        g2 = b[a2 >> 1] | 0;
      g2 = (Z(b[688 + (d2 << 16 >> 16 << 1) >> 1] | 0, g2 << 16 >> 16) | 0) >> 15;
      if ((g2 | 0) <= 32767) {
        f2 = g2;
        f2 = f2 & 65535;
        b[e2 >> 1] = f2;
        return;
      }
      c[f2 >> 2] = 1;
      f2 = 32767;
      f2 = f2 & 65535;
      b[e2 >> 1] = f2;
      return;
    }
    function mb(a2) {
      a2 = a2 | 0;
      if (!a2) {
        a2 = -1;
        return a2 | 0;
      }
      b[a2 >> 1] = 1640;
      b[a2 + 2 >> 1] = 1640;
      b[a2 + 4 >> 1] = 1640;
      b[a2 + 6 >> 1] = 1640;
      b[a2 + 8 >> 1] = 1640;
      b[a2 + 10 >> 1] = 0;
      b[a2 + 12 >> 1] = 16384;
      a2 = 0;
      return a2 | 0;
    }
    function nb(a2, c2, d2, e2, f2) {
      a2 = a2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      if (!(c2 << 16 >> 16)) {
        if (d2 << 16 >> 16) {
          c2 = a2 + 12 | 0;
          if ((Ge(b[e2 >> 1] | 0, b[c2 >> 1] | 0, f2) | 0) << 16 >> 16 > 0)
            b[e2 >> 1] = b[c2 >> 1] | 0;
        } else
          c2 = a2 + 12 | 0;
        b[c2 >> 1] = b[e2 >> 1] | 0;
      }
      e2 = b[e2 >> 1] | 0;
      c2 = a2 + 10 | 0;
      b[c2 >> 1] = e2;
      if ((Ge(e2, 16384, f2) | 0) << 16 >> 16 > 0) {
        b[c2 >> 1] = 16384;
        c2 = 16384;
      } else
        c2 = b[c2 >> 1] | 0;
      f2 = a2 + 2 | 0;
      b[a2 >> 1] = b[f2 >> 1] | 0;
      e2 = a2 + 4 | 0;
      b[f2 >> 1] = b[e2 >> 1] | 0;
      f2 = a2 + 6 | 0;
      b[e2 >> 1] = b[f2 >> 1] | 0;
      a2 = a2 + 8 | 0;
      b[f2 >> 1] = b[a2 >> 1] | 0;
      b[a2 >> 1] = c2;
      return;
    }
    function ob(a2, d2, e2, f2, g2, h2, i3) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      i3 = i3 | 0;
      var j2 = 0, k2 = 0, l2 = 0;
      k2 = Zd(e2, 9) | 0;
      l2 = b[e2 + 16 >> 1] | 0;
      j2 = l2 << 16 >> 16;
      e2 = (j2 + (b[e2 + 14 >> 1] | 0) | 0) >>> 1;
      e2 = (j2 | 0) < (e2 << 16 >> 16 | 0) ? l2 : e2 & 65535;
      if (!(d2 << 16 >> 16 > 5 ? k2 << 16 >> 16 > d2 << 16 >> 16 : 0))
        return 0;
      j2 = e2 << 16 >> 16;
      j2 = ((j2 << 18 >> 18 | 0) == (j2 | 0) ? j2 << 2 : j2 >>> 15 ^ 32767) & 65535;
      if (!(f2 << 16 >> 16 > 6 & g2 << 16 >> 16 == 0))
        j2 = Ge(j2, e2, i3) | 0;
      k2 = k2 << 16 >> 16 > j2 << 16 >> 16 ? j2 : k2;
      l2 = qe(d2) | 0;
      j2 = l2 << 16 >> 16;
      if (l2 << 16 >> 16 < 0) {
        e2 = 0 - j2 << 16;
        if ((e2 | 0) < 983040)
          j2 = d2 << 16 >> 16 >> (e2 >> 16) & 65535;
        else
          j2 = 0;
      } else {
        e2 = d2 << 16 >> 16;
        g2 = e2 << j2;
        if ((g2 << 16 >> 16 >> j2 | 0) == (e2 | 0))
          j2 = g2 & 65535;
        else
          j2 = (e2 >>> 15 ^ 32767) & 65535;
      }
      f2 = Z((Td(16383, j2) | 0) << 16 >> 16, k2 << 16 >> 16) | 0;
      if ((f2 | 0) == 1073741824) {
        c[i3 >> 2] = 1;
        g2 = 2147483647;
      } else
        g2 = f2 << 1;
      f2 = Ge(20, l2, i3) | 0;
      j2 = f2 << 16 >> 16;
      if (f2 << 16 >> 16 > 0)
        f2 = f2 << 16 >> 16 < 31 ? g2 >> j2 : 0;
      else {
        d2 = 0 - j2 << 16 >> 16;
        f2 = g2 << d2;
        f2 = (f2 >> d2 | 0) == (g2 | 0) ? f2 : g2 >> 31 ^ 2147483647;
      }
      f2 = (f2 | 0) > 32767 ? 32767 : f2 & 65535;
      f2 = h2 << 16 >> 16 != 0 & f2 << 16 >> 16 > 3072 ? 3072 : f2 << 16 >> 16;
      e2 = 0;
      do {
        g2 = a2 + (e2 << 1) | 0;
        j2 = Z(b[g2 >> 1] | 0, f2) | 0;
        if ((j2 | 0) == 1073741824) {
          c[i3 >> 2] = 1;
          j2 = 2147483647;
        } else
          j2 = j2 << 1;
        b[g2 >> 1] = j2 >>> 11;
        e2 = e2 + 1 | 0;
      } while ((e2 | 0) != 40);
      return 0;
    }
    function pb(a2, e2, f2, g2) {
      a2 = a2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      var h2 = 0, i3 = 0, j2 = 0, k2 = 0;
      h2 = c[g2 + 104 >> 2] | 0;
      i3 = c[g2 + 96 >> 2] | 0;
      if (a2 >>> 0 >= 8) {
        b[f2 >> 1] = (d[e2 >> 0] | 0) >>> 4 & 1;
        b[f2 + 2 >> 1] = (d[e2 >> 0] | 0) >>> 5 & 1;
        b[f2 + 4 >> 1] = (d[e2 >> 0] | 0) >>> 6 & 1;
        b[f2 + 6 >> 1] = (d[e2 >> 0] | 0) >>> 7 & 255;
        h2 = h2 + (a2 << 1) | 0;
        if ((b[h2 >> 1] | 0) > 1) {
          a2 = 1;
          g2 = 1;
          i3 = 4;
        } else
          return;
        while (1) {
          j2 = e2 + a2 | 0;
          a2 = i3 | 1;
          b[f2 + (i3 << 16 >> 16 << 1) >> 1] = d[j2 >> 0] & 1;
          b[f2 + (a2 << 16 >> 16 << 1) >> 1] = (d[j2 >> 0] | 0) >>> 1 & 1;
          k2 = i3 | 3;
          b[f2 + (a2 + 1 << 16 >> 16 << 16 >> 16 << 1) >> 1] = (d[j2 >> 0] | 0) >>> 2 & 1;
          b[f2 + (k2 << 16 >> 16 << 1) >> 1] = (d[j2 >> 0] | 0) >>> 3 & 1;
          b[f2 + (k2 + 1 << 16 >> 16 << 16 >> 16 << 1) >> 1] = (d[j2 >> 0] | 0) >>> 4 & 1;
          b[f2 + (k2 + 2 << 16 >> 16 << 16 >> 16 << 1) >> 1] = (d[j2 >> 0] | 0) >>> 5 & 1;
          b[f2 + (k2 + 3 << 16 >> 16 << 16 >> 16 << 1) >> 1] = (d[j2 >> 0] | 0) >>> 6 & 1;
          b[f2 + (k2 + 4 << 16 >> 16 << 16 >> 16 << 1) >> 1] = (d[j2 >> 0] | 0) >>> 7 & 255;
          g2 = g2 + 1 << 16 >> 16;
          if (g2 << 16 >> 16 < (b[h2 >> 1] | 0)) {
            a2 = g2 << 16 >> 16;
            i3 = i3 + 8 << 16 >> 16;
          } else
            break;
        }
        return;
      }
      k2 = c[(c[g2 + 100 >> 2] | 0) + (a2 << 2) >> 2] | 0;
      b[f2 + (b[k2 >> 1] << 1) >> 1] = (d[e2 >> 0] | 0) >>> 4 & 1;
      b[f2 + (b[k2 + 2 >> 1] << 1) >> 1] = (d[e2 >> 0] | 0) >>> 5 & 1;
      b[f2 + (b[k2 + 4 >> 1] << 1) >> 1] = (d[e2 >> 0] | 0) >>> 6 & 1;
      b[f2 + (b[k2 + 6 >> 1] << 1) >> 1] = (d[e2 >> 0] | 0) >>> 7 & 255;
      j2 = h2 + (a2 << 1) | 0;
      if ((b[j2 >> 1] | 0) <= 1)
        return;
      g2 = i3 + (a2 << 1) | 0;
      h2 = 1;
      a2 = 1;
      i3 = 4;
      while (1) {
        h2 = e2 + h2 | 0;
        i3 = i3 << 16 >> 16;
        if ((i3 | 0) < (b[g2 >> 1] | 0)) {
          b[f2 + (b[k2 + (i3 << 1) >> 1] << 1) >> 1] = d[h2 >> 0] & 1;
          i3 = i3 + 1 | 0;
          if ((i3 | 0) < (b[g2 >> 1] | 0)) {
            b[f2 + (b[k2 + (i3 << 1) >> 1] << 1) >> 1] = (d[h2 >> 0] | 0) >>> 1 & 1;
            i3 = i3 + 1 | 0;
            if ((i3 | 0) < (b[g2 >> 1] | 0)) {
              b[f2 + (b[k2 + (i3 << 1) >> 1] << 1) >> 1] = (d[h2 >> 0] | 0) >>> 2 & 1;
              i3 = i3 + 1 | 0;
              if ((i3 | 0) < (b[g2 >> 1] | 0)) {
                b[f2 + (b[k2 + (i3 << 1) >> 1] << 1) >> 1] = (d[h2 >> 0] | 0) >>> 3 & 1;
                i3 = i3 + 1 | 0;
                if ((i3 | 0) < (b[g2 >> 1] | 0)) {
                  b[f2 + (b[k2 + (i3 << 1) >> 1] << 1) >> 1] = (d[h2 >> 0] | 0) >>> 4 & 1;
                  i3 = i3 + 1 | 0;
                  if ((i3 | 0) < (b[g2 >> 1] | 0)) {
                    b[f2 + (b[k2 + (i3 << 1) >> 1] << 1) >> 1] = (d[h2 >> 0] | 0) >>> 5 & 1;
                    i3 = i3 + 1 | 0;
                    if ((i3 | 0) < (b[g2 >> 1] | 0)) {
                      b[f2 + (b[k2 + (i3 << 1) >> 1] << 1) >> 1] = (d[h2 >> 0] | 0) >>> 6 & 1;
                      i3 = i3 + 1 | 0;
                      if ((i3 | 0) < (b[g2 >> 1] | 0)) {
                        b[f2 + (b[k2 + (i3 << 1) >> 1] << 1) >> 1] = (d[h2 >> 0] | 0) >>> 7 & 1;
                        i3 = i3 + 1 | 0;
                      }
                    }
                  }
                }
              }
            }
          }
        }
        a2 = a2 + 1 << 16 >> 16;
        if (a2 << 16 >> 16 < (b[j2 >> 1] | 0))
          h2 = a2 << 16 >> 16;
        else
          break;
      }
      return;
    }
    function qb(a2, c2, d2, e2, f2) {
      a2 = a2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      var g2 = 0, h2 = 0, i3 = 0, j2 = 0;
      switch (d2 << 16 >> 16) {
        case 0: {
          j2 = 9;
          while (1) {
            i3 = b[a2 + (j2 << 1) >> 1] | 0;
            d2 = i3 << 16 >> 16;
            if (i3 << 16 >> 16 < 0)
              d2 = ~((d2 ^ -4) >> 2);
            else
              d2 = d2 >>> 2;
            h2 = b[c2 + (j2 << 1) >> 1] | 0;
            g2 = h2 << 16 >> 16;
            if (h2 << 16 >> 16 < 0)
              h2 = ~((g2 ^ -4) >> 2);
            else
              h2 = g2 >>> 2;
            b[e2 + (j2 << 1) >> 1] = Rd((i3 & 65535) - d2 & 65535, h2 & 65535, f2) | 0;
            if ((j2 | 0) > 0)
              j2 = j2 + -1 | 0;
            else
              break;
          }
          return;
        }
        case 40: {
          h2 = 9;
          while (1) {
            f2 = b[a2 + (h2 << 1) >> 1] | 0;
            d2 = f2 << 16 >> 16;
            if (f2 << 16 >> 16 < 0)
              g2 = ~((d2 ^ -2) >> 1);
            else
              g2 = d2 >>> 1;
            f2 = b[c2 + (h2 << 1) >> 1] | 0;
            d2 = f2 << 16 >> 16;
            if (f2 << 16 >> 16 < 0)
              d2 = ~((d2 ^ -2) >> 1);
            else
              d2 = d2 >>> 1;
            b[e2 + (h2 << 1) >> 1] = d2 + g2;
            if ((h2 | 0) > 0)
              h2 = h2 + -1 | 0;
            else
              break;
          }
          return;
        }
        case 80: {
          j2 = 9;
          while (1) {
            i3 = b[a2 + (j2 << 1) >> 1] | 0;
            d2 = i3 << 16 >> 16;
            if (i3 << 16 >> 16 < 0)
              i3 = ~((d2 ^ -4) >> 2);
            else
              i3 = d2 >>> 2;
            d2 = b[c2 + (j2 << 1) >> 1] | 0;
            g2 = d2 << 16 >> 16;
            if (d2 << 16 >> 16 < 0)
              h2 = ~((g2 ^ -4) >> 2);
            else
              h2 = g2 >>> 2;
            b[e2 + (j2 << 1) >> 1] = Rd(i3 & 65535, (d2 & 65535) - h2 & 65535, f2) | 0;
            if ((j2 | 0) > 0)
              j2 = j2 + -1 | 0;
            else
              break;
          }
          return;
        }
        case 120: {
          b[e2 + 18 >> 1] = b[c2 + 18 >> 1] | 0;
          b[e2 + 16 >> 1] = b[c2 + 16 >> 1] | 0;
          b[e2 + 14 >> 1] = b[c2 + 14 >> 1] | 0;
          b[e2 + 12 >> 1] = b[c2 + 12 >> 1] | 0;
          b[e2 + 10 >> 1] = b[c2 + 10 >> 1] | 0;
          b[e2 + 8 >> 1] = b[c2 + 8 >> 1] | 0;
          b[e2 + 6 >> 1] = b[c2 + 6 >> 1] | 0;
          b[e2 + 4 >> 1] = b[c2 + 4 >> 1] | 0;
          b[e2 + 2 >> 1] = b[c2 + 2 >> 1] | 0;
          b[e2 >> 1] = b[c2 >> 1] | 0;
          return;
        }
        default:
          return;
      }
    }
    function rb(a2, b2) {
      a2 = a2 | 0;
      b2 = b2 | 0;
      if (!a2) {
        a2 = -1;
        return a2 | 0;
      }
      Pe(a2 | 0, b2 | 0, 20) | 0;
      a2 = 0;
      return a2 | 0;
    }
    function sb(a2, d2, e2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      var f2 = 0, g2 = 0, h2 = 0, i3 = 0, j2 = 0, k2 = 0, l2 = 0;
      l2 = 0;
      do {
        k2 = a2 + (l2 << 1) | 0;
        f2 = b[k2 >> 1] | 0;
        i3 = f2 & 65535;
        j2 = i3 << 16;
        f2 = f2 << 16 >> 16;
        if ((f2 * 5243 | 0) == 1073741824) {
          c[e2 >> 2] = 1;
          h2 = 2147483647;
        } else
          h2 = f2 * 10486 | 0;
        g2 = j2 - h2 | 0;
        if (((g2 ^ j2) & (h2 ^ j2) | 0) < 0) {
          c[e2 >> 2] = 1;
          h2 = (i3 >>> 15) + 2147483647 | 0;
        } else
          h2 = g2;
        f2 = b[d2 + (l2 << 1) >> 1] | 0;
        g2 = f2 * 5243 | 0;
        if ((g2 | 0) != 1073741824) {
          f2 = (f2 * 10486 | 0) + h2 | 0;
          if ((g2 ^ h2 | 0) > 0 & (f2 ^ h2 | 0) < 0) {
            c[e2 >> 2] = 1;
            f2 = (h2 >>> 31) + 2147483647 | 0;
          }
        } else {
          c[e2 >> 2] = 1;
          f2 = 2147483647;
        }
        b[k2 >> 1] = Ce(f2, e2) | 0;
        l2 = l2 + 1 | 0;
      } while ((l2 | 0) != 10);
      return;
    }
    function tb(a2) {
      a2 = a2 | 0;
      var c2 = 0;
      if (!a2) {
        c2 = -1;
        return c2 | 0;
      }
      c2 = a2 + 18 | 0;
      do {
        b[a2 >> 1] = 0;
        a2 = a2 + 2 | 0;
      } while ((a2 | 0) < (c2 | 0));
      c2 = 0;
      return c2 | 0;
    }
    function ub(a2) {
      a2 = a2 | 0;
      b[a2 + 14 >> 1] = 1;
      return;
    }
    function vb(a2) {
      a2 = a2 | 0;
      b[a2 + 14 >> 1] = 0;
      return;
    }
    function wb(a2, d2, e2, f2, g2, h2, j2, k2, l2, m2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      j2 = j2 | 0;
      k2 = k2 | 0;
      l2 = l2 | 0;
      m2 = m2 | 0;
      var n2 = 0, o2 = 0, p2 = 0, q2 = 0, r2 = 0, s2 = 0, t2 = 0, u2 = 0, v2 = 0, w2 = 0, x2 = 0, y2 = 0, z2 = 0, A2 = 0, B2 = 0, C2 = 0;
      C2 = i2;
      i2 = i2 + 160 | 0;
      z2 = C2 + 80 | 0;
      A2 = C2;
      v2 = c[l2 + 120 >> 2] | 0;
      w2 = c[l2 + 124 >> 2] | 0;
      x2 = c[l2 + 128 >> 2] | 0;
      u2 = c[l2 + 132 >> 2] | 0;
      o2 = a2 + 6 | 0;
      t2 = a2 + 8 | 0;
      b[t2 >> 1] = b[o2 >> 1] | 0;
      r2 = a2 + 4 | 0;
      b[o2 >> 1] = b[r2 >> 1] | 0;
      s2 = a2 + 2 | 0;
      b[r2 >> 1] = b[s2 >> 1] | 0;
      b[s2 >> 1] = b[a2 >> 1] | 0;
      b[a2 >> 1] = g2;
      l2 = g2 << 16 >> 16 < 14746 ? g2 << 16 >> 16 > 9830 & 1 : 2;
      n2 = a2 + 12 | 0;
      g2 = b[n2 >> 1] | 0;
      p2 = g2 << 15;
      do
        if ((p2 | 0) <= 536870911)
          if ((p2 | 0) < -536870912) {
            c[m2 >> 2] = 1;
            g2 = -2147483648;
            break;
          } else {
            g2 = g2 << 17;
            break;
          }
        else {
          c[m2 >> 2] = 1;
          g2 = 2147483647;
        }
      while (0);
      y2 = f2 << 16 >> 16;
      q2 = a2 + 16 | 0;
      if ((Ce(g2, m2) | 0) << 16 >> 16 >= f2 << 16 >> 16) {
        p2 = b[q2 >> 1] | 0;
        if (p2 << 16 >> 16 > 0) {
          p2 = (p2 & 65535) + 65535 & 65535;
          b[q2 >> 1] = p2;
        }
        if (!(p2 << 16 >> 16)) {
          g2 = (b[a2 >> 1] | 0) < 9830;
          g2 = (b[s2 >> 1] | 0) < 9830 ? g2 ? 2 : 1 : g2 & 1;
          if ((b[r2 >> 1] | 0) < 9830)
            g2 = (g2 & 65535) + 1 & 65535;
          if ((b[o2 >> 1] | 0) < 9830)
            g2 = (g2 & 65535) + 1 & 65535;
          if ((b[t2 >> 1] | 0) < 9830)
            g2 = (g2 & 65535) + 1 & 65535;
          p2 = 0;
          l2 = g2 << 16 >> 16 > 2 ? 0 : l2;
        }
      } else {
        b[q2 >> 1] = 2;
        p2 = 2;
      }
      s2 = l2 << 16 >> 16;
      t2 = a2 + 10 | 0;
      s2 = (p2 << 16 >> 16 == 0 ? (s2 | 0) > ((b[t2 >> 1] | 0) + 1 | 0) : 0) ? s2 + 65535 & 65535 : l2;
      a2 = (b[a2 + 14 >> 1] | 0) == 1 ? 0 : f2 << 16 >> 16 < 10 ? 2 : s2 << 16 >> 16 < 2 & p2 << 16 >> 16 > 0 ? (s2 & 65535) + 1 & 65535 : s2;
      b[t2 >> 1] = a2;
      b[n2 >> 1] = f2;
      switch (d2 | 0) {
        case 4:
        case 6:
        case 7:
          break;
        default:
          if (a2 << 16 >> 16 < 2) {
            p2 = 0;
            l2 = 0;
            o2 = h2;
            n2 = z2;
            while (1) {
              if (!(b[o2 >> 1] | 0))
                g2 = 0;
              else {
                l2 = l2 << 16 >> 16;
                b[A2 + (l2 << 1) >> 1] = p2;
                g2 = b[o2 >> 1] | 0;
                l2 = l2 + 1 & 65535;
              }
              b[n2 >> 1] = g2;
              b[o2 >> 1] = 0;
              p2 = p2 + 1 << 16 >> 16;
              if (p2 << 16 >> 16 >= 40) {
                t2 = l2;
                break;
              } else {
                o2 = o2 + 2 | 0;
                n2 = n2 + 2 | 0;
              }
            }
            s2 = a2 << 16 >> 16 == 0;
            s2 = (d2 | 0) == 5 ? s2 ? v2 : w2 : s2 ? x2 : u2;
            if (t2 << 16 >> 16 > 0) {
              r2 = 0;
              do {
                q2 = b[A2 + (r2 << 1) >> 1] | 0;
                l2 = q2 << 16 >> 16;
                a2 = b[z2 + (l2 << 1) >> 1] | 0;
                if (q2 << 16 >> 16 < 40) {
                  p2 = a2 << 16 >> 16;
                  o2 = 39 - q2 & 65535;
                  n2 = q2;
                  l2 = h2 + (l2 << 1) | 0;
                  g2 = s2;
                  while (1) {
                    d2 = (Z(b[g2 >> 1] | 0, p2) | 0) >>> 15 & 65535;
                    b[l2 >> 1] = Rd(b[l2 >> 1] | 0, d2, m2) | 0;
                    n2 = n2 + 1 << 16 >> 16;
                    if (n2 << 16 >> 16 >= 40)
                      break;
                    else {
                      l2 = l2 + 2 | 0;
                      g2 = g2 + 2 | 0;
                    }
                  }
                  if (q2 << 16 >> 16 > 0) {
                    l2 = s2 + (o2 + 1 << 1) | 0;
                    B2 = 36;
                  }
                } else {
                  l2 = s2;
                  B2 = 36;
                }
                if ((B2 | 0) == 36) {
                  B2 = 0;
                  g2 = a2 << 16 >> 16;
                  p2 = 0;
                  o2 = h2;
                  while (1) {
                    d2 = (Z(b[l2 >> 1] | 0, g2) | 0) >>> 15 & 65535;
                    b[o2 >> 1] = Rd(b[o2 >> 1] | 0, d2, m2) | 0;
                    p2 = p2 + 1 << 16 >> 16;
                    if (p2 << 16 >> 16 >= q2 << 16 >> 16)
                      break;
                    else {
                      o2 = o2 + 2 | 0;
                      l2 = l2 + 2 | 0;
                    }
                  }
                }
                r2 = r2 + 1 | 0;
              } while ((r2 & 65535) << 16 >> 16 != t2 << 16 >> 16);
            }
          }
      }
      r2 = j2 << 16 >> 16;
      s2 = y2 << 1;
      g2 = k2 << 16 >> 16;
      n2 = 0 - g2 << 16;
      l2 = n2 >> 16;
      if (k2 << 16 >> 16 > 0) {
        p2 = 0;
        o2 = e2;
        while (1) {
          a2 = Z(b[e2 + (p2 << 1) >> 1] | 0, r2) | 0;
          if ((a2 | 0) == 1073741824) {
            c[m2 >> 2] = 1;
            n2 = 2147483647;
          } else
            n2 = a2 << 1;
          k2 = Z(s2, b[h2 >> 1] | 0) | 0;
          a2 = k2 + n2 | 0;
          if ((k2 ^ n2 | 0) > -1 & (a2 ^ n2 | 0) < 0) {
            c[m2 >> 2] = 1;
            a2 = (n2 >>> 31) + 2147483647 | 0;
          }
          k2 = a2 << g2;
          b[o2 >> 1] = Ce((k2 >> g2 | 0) == (a2 | 0) ? k2 : a2 >> 31 ^ 2147483647, m2) | 0;
          p2 = p2 + 1 | 0;
          if ((p2 | 0) == 40)
            break;
          else {
            h2 = h2 + 2 | 0;
            o2 = o2 + 2 | 0;
          }
        }
        i2 = C2;
        return;
      }
      if ((n2 | 0) < 2031616) {
        p2 = 0;
        o2 = e2;
        while (1) {
          a2 = Z(b[e2 + (p2 << 1) >> 1] | 0, r2) | 0;
          if ((a2 | 0) == 1073741824) {
            c[m2 >> 2] = 1;
            n2 = 2147483647;
          } else
            n2 = a2 << 1;
          k2 = Z(s2, b[h2 >> 1] | 0) | 0;
          a2 = k2 + n2 | 0;
          if ((k2 ^ n2 | 0) > -1 & (a2 ^ n2 | 0) < 0) {
            c[m2 >> 2] = 1;
            a2 = (n2 >>> 31) + 2147483647 | 0;
          }
          b[o2 >> 1] = Ce(a2 >> l2, m2) | 0;
          p2 = p2 + 1 | 0;
          if ((p2 | 0) == 40)
            break;
          else {
            h2 = h2 + 2 | 0;
            o2 = o2 + 2 | 0;
          }
        }
        i2 = C2;
        return;
      } else {
        o2 = 0;
        n2 = e2;
        while (1) {
          a2 = Z(b[e2 + (o2 << 1) >> 1] | 0, r2) | 0;
          if ((a2 | 0) == 1073741824) {
            c[m2 >> 2] = 1;
            a2 = 2147483647;
          } else
            a2 = a2 << 1;
          k2 = Z(s2, b[h2 >> 1] | 0) | 0;
          if ((k2 ^ a2 | 0) > -1 & (k2 + a2 ^ a2 | 0) < 0)
            c[m2 >> 2] = 1;
          b[n2 >> 1] = Ce(0, m2) | 0;
          o2 = o2 + 1 | 0;
          if ((o2 | 0) == 40)
            break;
          else {
            h2 = h2 + 2 | 0;
            n2 = n2 + 2 | 0;
          }
        }
        i2 = C2;
        return;
      }
    }
    function xb(a2) {
      a2 = a2 | 0;
      if (!a2) {
        a2 = -1;
        return a2 | 0;
      }
      b[a2 >> 1] = 0;
      b[a2 + 2 >> 1] = 0;
      b[a2 + 4 >> 1] = 0;
      b[a2 + 6 >> 1] = 0;
      b[a2 + 8 >> 1] = 0;
      b[a2 + 10 >> 1] = 0;
      a2 = 0;
      return a2 | 0;
    }
    function yb(a2, c2, d2, e2) {
      a2 = a2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      var f2 = 0, g2 = 0, h2 = 0, i3 = 0, j2 = 0, k2 = 0, l2 = 0, m2 = 0, n2 = 0, o2 = 0, p2 = 0, q2 = 0, r2 = 0;
      if (d2 << 16 >> 16 <= 0)
        return;
      f2 = a2 + 10 | 0;
      j2 = a2 + 8 | 0;
      l2 = a2 + 4 | 0;
      m2 = a2 + 6 | 0;
      n2 = a2 + 2 | 0;
      g2 = b[l2 >> 1] | 0;
      h2 = b[m2 >> 1] | 0;
      i3 = b[a2 >> 1] | 0;
      k2 = b[n2 >> 1] | 0;
      o2 = 0;
      while (1) {
        p2 = b[f2 >> 1] | 0;
        q2 = b[j2 >> 1] | 0;
        b[f2 >> 1] = q2;
        r2 = b[c2 >> 1] | 0;
        b[j2 >> 1] = r2;
        p2 = ((r2 << 16 >> 16) * 7699 | 0) + ((Z(i3 << 16 >> 16, -7667) | 0) + (((g2 << 16 >> 16) * 15836 | 0) + ((h2 << 16 >> 16) * 15836 >> 15)) + ((Z(k2 << 16 >> 16, -7667) | 0) >> 15)) + (Z(q2 << 16 >> 16, -15398) | 0) + ((p2 << 16 >> 16) * 7699 | 0) | 0;
        q2 = p2 << 3;
        p2 = (q2 >> 3 | 0) == (p2 | 0) ? q2 : p2 >> 31 ^ 2147483647;
        q2 = p2 << 1;
        b[c2 >> 1] = Ce((q2 >> 1 | 0) == (p2 | 0) ? q2 : p2 >> 31 ^ 2147483647, e2) | 0;
        i3 = b[l2 >> 1] | 0;
        b[a2 >> 1] = i3;
        k2 = b[m2 >> 1] | 0;
        b[n2 >> 1] = k2;
        g2 = p2 >>> 16 & 65535;
        b[l2 >> 1] = g2;
        h2 = (p2 >>> 1) - (p2 >> 16 << 15) & 65535;
        b[m2 >> 1] = h2;
        o2 = o2 + 1 << 16 >> 16;
        if (o2 << 16 >> 16 >= d2 << 16 >> 16)
          break;
        else
          c2 = c2 + 2 | 0;
      }
      return;
    }
    function zb(a2) {
      a2 = a2 | 0;
      if (!a2)
        a2 = -1;
      else {
        b[a2 >> 1] = 0;
        a2 = 0;
      }
      return a2 | 0;
    }
    function Ab(a2, d2, e2, f2, g2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      var h2 = 0, i3 = 0, j2 = 0, k2 = 0;
      j2 = f2 << 16 >> 16;
      h2 = d2 + (j2 + -1 << 1) | 0;
      j2 = j2 + -2 | 0;
      k2 = b[h2 >> 1] | 0;
      if (f2 << 16 >> 16 < 2)
        f2 = e2 << 16 >> 16;
      else {
        f2 = e2 << 16 >> 16;
        i3 = 0;
        d2 = d2 + (j2 << 1) | 0;
        while (1) {
          e2 = (Z(b[d2 >> 1] | 0, f2) | 0) >> 15;
          if ((e2 | 0) > 32767) {
            c[g2 >> 2] = 1;
            e2 = 32767;
          }
          b[h2 >> 1] = Ge(b[h2 >> 1] | 0, e2 & 65535, g2) | 0;
          h2 = h2 + -2 | 0;
          i3 = i3 + 1 << 16 >> 16;
          if ((i3 << 16 >> 16 | 0) > (j2 | 0))
            break;
          else
            d2 = d2 + -2 | 0;
        }
      }
      f2 = (Z(b[a2 >> 1] | 0, f2) | 0) >> 15;
      if ((f2 | 0) <= 32767) {
        j2 = f2;
        j2 = j2 & 65535;
        i3 = b[h2 >> 1] | 0;
        g2 = Ge(i3, j2, g2) | 0;
        b[h2 >> 1] = g2;
        b[a2 >> 1] = k2;
        return;
      }
      c[g2 >> 2] = 1;
      j2 = 32767;
      j2 = j2 & 65535;
      i3 = b[h2 >> 1] | 0;
      g2 = Ge(i3, j2, g2) | 0;
      b[h2 >> 1] = g2;
      b[a2 >> 1] = k2;
      return;
    }
    function Bb(a2) {
      a2 = a2 | 0;
      var c2 = 0, d2 = 0, e2 = 0;
      if (!a2) {
        e2 = -1;
        return e2 | 0;
      }
      Qe(a2 + 104 | 0, 0, 340) | 0;
      c2 = a2 + 102 | 0;
      d2 = a2;
      e2 = d2 + 100 | 0;
      do {
        b[d2 >> 1] = 0;
        d2 = d2 + 2 | 0;
      } while ((d2 | 0) < (e2 | 0));
      Ba(c2) | 0;
      zb(a2 + 100 | 0) | 0;
      e2 = 0;
      return e2 | 0;
    }
    function Cb(d2, e2, f2, g2, h2) {
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      var j2 = 0, k2 = 0, l2 = 0, m2 = 0, n2 = 0, o2 = 0, p2 = 0, q2 = 0, r2 = 0, s2 = 0, t2 = 0, u2 = 0, v2 = 0, w2 = 0, x2 = 0;
      w2 = i2;
      i2 = i2 + 96 | 0;
      s2 = w2 + 22 | 0;
      t2 = w2;
      u2 = w2 + 44 | 0;
      Pe(d2 + 124 | 0, f2 | 0, 320) | 0;
      o2 = u2 + 22 | 0;
      p2 = d2 + 100 | 0;
      q2 = d2 + 80 | 0;
      r2 = d2 + 102 | 0;
      if ((e2 & -2 | 0) == 6) {
        n2 = 0;
        while (1) {
          Ie(g2, 702, s2);
          Ie(g2, 722, t2);
          m2 = d2 + 104 + (n2 + 10 << 1) | 0;
          Be(s2, m2, d2, 40);
          k2 = u2;
          j2 = s2;
          e2 = k2 + 22 | 0;
          do {
            b[k2 >> 1] = b[j2 >> 1] | 0;
            k2 = k2 + 2 | 0;
            j2 = j2 + 2 | 0;
          } while ((k2 | 0) < (e2 | 0));
          k2 = o2;
          e2 = k2 + 22 | 0;
          do {
            b[k2 >> 1] = 0;
            k2 = k2 + 2 | 0;
          } while ((k2 | 0) < (e2 | 0));
          He(t2, u2, u2, 22, o2, 0);
          e2 = 0;
          k2 = 21;
          do {
            j2 = b[u2 + (k2 << 16 >> 16 << 1) >> 1] | 0;
            j2 = Z(j2, j2) | 0;
            if ((j2 | 0) == 1073741824) {
              v2 = 7;
              break;
            }
            l2 = j2 << 1;
            j2 = l2 + e2 | 0;
            if ((l2 ^ e2 | 0) > -1 & (j2 ^ e2 | 0) < 0) {
              c[h2 >> 2] = 1;
              e2 = (e2 >>> 31) + 2147483647 | 0;
            } else
              e2 = j2;
            k2 = k2 + -1 << 16 >> 16;
          } while (k2 << 16 >> 16 > -1);
          if ((v2 | 0) == 7) {
            v2 = 0;
            c[h2 >> 2] = 1;
          }
          l2 = e2 >>> 16 & 65535;
          j2 = 20;
          e2 = 0;
          k2 = 20;
          while (1) {
            j2 = Z(b[u2 + (j2 + 1 << 1) >> 1] | 0, b[u2 + (j2 << 1) >> 1] | 0) | 0;
            if ((j2 | 0) == 1073741824) {
              v2 = 13;
              break;
            }
            x2 = j2 << 1;
            j2 = x2 + e2 | 0;
            if ((x2 ^ e2 | 0) > -1 & (j2 ^ e2 | 0) < 0) {
              c[h2 >> 2] = 1;
              e2 = (e2 >>> 31) + 2147483647 | 0;
            } else
              e2 = j2;
            j2 = (k2 & 65535) + -1 << 16 >> 16;
            if (j2 << 16 >> 16 > -1) {
              j2 = j2 << 16 >> 16;
              k2 = k2 + -1 | 0;
            } else
              break;
          }
          if ((v2 | 0) == 13) {
            v2 = 0;
            c[h2 >> 2] = 1;
          }
          e2 = e2 >> 16;
          if ((e2 | 0) < 1)
            e2 = 0;
          else
            e2 = Td((e2 * 26214 | 0) >>> 15 & 65535, l2) | 0;
          Ab(p2, d2, e2, 40, h2);
          e2 = f2 + (n2 << 1) | 0;
          He(t2, d2, e2, 40, q2, 1);
          Ca(r2, m2, e2, 29491, 40, h2);
          e2 = (n2 << 16) + 2621440 | 0;
          if ((e2 | 0) < 10485760) {
            n2 = e2 >> 16;
            g2 = g2 + 22 | 0;
          } else
            break;
        }
        k2 = d2 + 104 | 0;
        j2 = d2 + 424 | 0;
        e2 = k2 + 20 | 0;
        do {
          a[k2 >> 0] = a[j2 >> 0] | 0;
          k2 = k2 + 1 | 0;
          j2 = j2 + 1 | 0;
        } while ((k2 | 0) < (e2 | 0));
        i2 = w2;
        return;
      } else {
        n2 = 0;
        while (1) {
          Ie(g2, 742, s2);
          Ie(g2, 762, t2);
          m2 = d2 + 104 + (n2 + 10 << 1) | 0;
          Be(s2, m2, d2, 40);
          k2 = u2;
          j2 = s2;
          e2 = k2 + 22 | 0;
          do {
            b[k2 >> 1] = b[j2 >> 1] | 0;
            k2 = k2 + 2 | 0;
            j2 = j2 + 2 | 0;
          } while ((k2 | 0) < (e2 | 0));
          k2 = o2;
          e2 = k2 + 22 | 0;
          do {
            b[k2 >> 1] = 0;
            k2 = k2 + 2 | 0;
          } while ((k2 | 0) < (e2 | 0));
          He(t2, u2, u2, 22, o2, 0);
          e2 = 0;
          k2 = 21;
          do {
            j2 = b[u2 + (k2 << 16 >> 16 << 1) >> 1] | 0;
            j2 = Z(j2, j2) | 0;
            if ((j2 | 0) == 1073741824) {
              v2 = 22;
              break;
            }
            x2 = j2 << 1;
            j2 = x2 + e2 | 0;
            if ((x2 ^ e2 | 0) > -1 & (j2 ^ e2 | 0) < 0) {
              c[h2 >> 2] = 1;
              e2 = (e2 >>> 31) + 2147483647 | 0;
            } else
              e2 = j2;
            k2 = k2 + -1 << 16 >> 16;
          } while (k2 << 16 >> 16 > -1);
          if ((v2 | 0) == 22) {
            v2 = 0;
            c[h2 >> 2] = 1;
          }
          l2 = e2 >>> 16 & 65535;
          j2 = 20;
          e2 = 0;
          k2 = 20;
          while (1) {
            j2 = Z(b[u2 + (j2 + 1 << 1) >> 1] | 0, b[u2 + (j2 << 1) >> 1] | 0) | 0;
            if ((j2 | 0) == 1073741824) {
              v2 = 28;
              break;
            }
            x2 = j2 << 1;
            j2 = x2 + e2 | 0;
            if ((x2 ^ e2 | 0) > -1 & (j2 ^ e2 | 0) < 0) {
              c[h2 >> 2] = 1;
              e2 = (e2 >>> 31) + 2147483647 | 0;
            } else
              e2 = j2;
            j2 = (k2 & 65535) + -1 << 16 >> 16;
            if (j2 << 16 >> 16 > -1) {
              j2 = j2 << 16 >> 16;
              k2 = k2 + -1 | 0;
            } else
              break;
          }
          if ((v2 | 0) == 28) {
            v2 = 0;
            c[h2 >> 2] = 1;
          }
          e2 = e2 >> 16;
          if ((e2 | 0) < 1)
            e2 = 0;
          else
            e2 = Td((e2 * 26214 | 0) >>> 15 & 65535, l2) | 0;
          Ab(p2, d2, e2, 40, h2);
          e2 = f2 + (n2 << 1) | 0;
          He(t2, d2, e2, 40, q2, 1);
          Ca(r2, m2, e2, 29491, 40, h2);
          e2 = (n2 << 16) + 2621440 | 0;
          if ((e2 | 0) < 10485760) {
            n2 = e2 >> 16;
            g2 = g2 + 22 | 0;
          } else
            break;
        }
        k2 = d2 + 104 | 0;
        j2 = d2 + 424 | 0;
        e2 = k2 + 20 | 0;
        do {
          a[k2 >> 0] = a[j2 >> 0] | 0;
          k2 = k2 + 1 | 0;
          j2 = j2 + 1 | 0;
        } while ((k2 | 0) < (e2 | 0));
        i2 = w2;
        return;
      }
    }
    function Db(a2, b2) {
      a2 = a2 | 0;
      b2 = b2 | 0;
      var d2 = 0, e2 = 0;
      if (!a2) {
        a2 = -1;
        return a2 | 0;
      }
      c[a2 >> 2] = 0;
      d2 = Je(1764) | 0;
      if (!d2) {
        a2 = -1;
        return a2 | 0;
      }
      if ((Ua(d2) | 0) << 16 >> 16 == 0 ? (e2 = d2 + 1748 | 0, (xb(e2) | 0) << 16 >> 16 == 0) : 0) {
        Va(d2, 0) | 0;
        Bb(d2 + 1304 | 0) | 0;
        xb(e2) | 0;
        c[d2 + 1760 >> 2] = 0;
        c[a2 >> 2] = d2;
        a2 = 0;
        return a2 | 0;
      }
      b2 = c[d2 >> 2] | 0;
      if (!b2) {
        a2 = -1;
        return a2 | 0;
      }
      Ke(b2);
      c[d2 >> 2] = 0;
      a2 = -1;
      return a2 | 0;
    }
    function Eb(a2) {
      a2 = a2 | 0;
      var b2 = 0;
      if (!a2)
        return;
      b2 = c[a2 >> 2] | 0;
      if (!b2)
        return;
      Ke(b2);
      c[a2 >> 2] = 0;
      return;
    }
    function Fb(a2, d2, f2, g2, h2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      var j2 = 0, k2 = 0, l2 = 0, m2 = 0, n2 = 0, o2 = 0, p2 = 0, q2 = 0, r2 = 0, s2 = 0, t2 = 0, u2 = 0, v2 = 0;
      v2 = i2;
      i2 = i2 + 208 | 0;
      u2 = v2 + 88 | 0;
      t2 = v2;
      s2 = a2 + 1164 | 0;
      j2 = c[a2 + 1256 >> 2] | 0;
      if ((g2 + -5 | 0) >>> 0 < 2) {
        r2 = j2 + 16 | 0;
        if ((b[r2 >> 1] | 0) > 0) {
          q2 = c[(c[a2 + 1260 >> 2] | 0) + 32 >> 2] | 0;
          p2 = 0;
          j2 = 0;
          while (1) {
            o2 = q2 + (p2 << 1) | 0;
            m2 = b[o2 >> 1] | 0;
            if (m2 << 16 >> 16 > 0) {
              l2 = f2;
              n2 = 0;
              k2 = 0;
              while (1) {
                k2 = e[l2 >> 1] | k2 << 1 & 131070;
                n2 = n2 + 1 << 16 >> 16;
                if (n2 << 16 >> 16 >= m2 << 16 >> 16)
                  break;
                else
                  l2 = l2 + 2 | 0;
              }
              k2 = k2 & 65535;
            } else
              k2 = 0;
            b[u2 + (p2 << 1) >> 1] = k2;
            j2 = j2 + 1 << 16 >> 16;
            if (j2 << 16 >> 16 < (b[r2 >> 1] | 0)) {
              f2 = f2 + (b[o2 >> 1] << 1) | 0;
              p2 = j2 << 16 >> 16;
            } else
              break;
          }
        }
      } else {
        q2 = j2 + (d2 << 1) | 0;
        if ((b[q2 >> 1] | 0) > 0) {
          r2 = c[(c[a2 + 1260 >> 2] | 0) + (d2 << 2) >> 2] | 0;
          o2 = 0;
          j2 = 0;
          while (1) {
            p2 = r2 + (o2 << 1) | 0;
            m2 = b[p2 >> 1] | 0;
            if (m2 << 16 >> 16 > 0) {
              l2 = f2;
              n2 = 0;
              k2 = 0;
              while (1) {
                k2 = e[l2 >> 1] | k2 << 1 & 131070;
                n2 = n2 + 1 << 16 >> 16;
                if (n2 << 16 >> 16 >= m2 << 16 >> 16)
                  break;
                else
                  l2 = l2 + 2 | 0;
              }
              k2 = k2 & 65535;
            } else
              k2 = 0;
            b[u2 + (o2 << 1) >> 1] = k2;
            j2 = j2 + 1 << 16 >> 16;
            if (j2 << 16 >> 16 < (b[q2 >> 1] | 0)) {
              f2 = f2 + (b[p2 >> 1] << 1) | 0;
              o2 = j2 << 16 >> 16;
            } else
              break;
          }
        }
      }
      Wa(a2, d2, u2, g2, h2, t2);
      Cb(a2 + 1304 | 0, d2, h2, t2, s2);
      yb(a2 + 1748 | 0, h2, 160, s2);
      j2 = 0;
      do {
        a2 = h2 + (j2 << 1) | 0;
        b[a2 >> 1] = e[a2 >> 1] & 65528;
        j2 = j2 + 1 | 0;
      } while ((j2 | 0) != 160);
      i2 = v2;
      return;
    }
    function Gb(a2, f2, g2, h2) {
      a2 = a2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      var i3 = 0, j2 = 0, k2 = 0;
      j2 = c[h2 + 100 >> 2] | 0;
      k2 = (e[(c[h2 + 96 >> 2] | 0) + (a2 << 1) >> 1] | 0) + 65535 | 0;
      h2 = k2 & 65535;
      i3 = h2 << 16 >> 16 > -1;
      if (a2 >>> 0 < 8) {
        if (!i3)
          return;
        j2 = c[j2 + (a2 << 2) >> 2] | 0;
        i3 = k2 << 16 >> 16;
        while (1) {
          b[g2 + (b[j2 + (i3 << 1) >> 1] << 1) >> 1] = (d[f2 + (i3 >> 3) >> 0] | 0) >>> (i3 & 7 ^ 7) & 1;
          h2 = h2 + -1 << 16 >> 16;
          if (h2 << 16 >> 16 > -1)
            i3 = h2 << 16 >> 16;
          else
            break;
        }
        return;
      } else {
        if (!i3)
          return;
        i3 = k2 << 16 >> 16;
        while (1) {
          b[g2 + (i3 << 1) >> 1] = (d[f2 + (i3 >> 3) >> 0] | 0) >>> (i3 & 7 ^ 7) & 1;
          h2 = h2 + -1 << 16 >> 16;
          if (h2 << 16 >> 16 > -1)
            i3 = h2 << 16 >> 16;
          else
            break;
        }
        return;
      }
    }
    function Hb(a2, b2, c2) {
      a2 = a2 | 0;
      b2 = b2 | 0;
      c2 = c2 | 0;
      a2 = vd(a2, c2, 31764) | 0;
      return ((sd(b2) | 0 | a2) << 16 >> 16 != 0) << 31 >> 31 | 0;
    }
    function Ib(a2, b2) {
      a2 = a2 | 0;
      b2 = b2 | 0;
      wd(a2);
      td(b2);
      return;
    }
    function Jb(d2, f2, g2, h2, j2, k2, l2) {
      d2 = d2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      j2 = j2 | 0;
      k2 = k2 | 0;
      l2 = l2 | 0;
      var m2 = 0, n2 = 0, o2 = 0, p2 = 0, q2 = 0;
      q2 = i2;
      i2 = i2 + 512 | 0;
      m2 = q2 + 8 | 0;
      n2 = q2 + 4 | 0;
      o2 = q2;
      c[o2 >> 2] = 0;
      p2 = l2 << 16 >> 16 == 3;
      if (!((l2 & 65535) < 2 | p2 & 1)) {
        if (l2 << 16 >> 16 != 2) {
          j2 = -1;
          i2 = q2;
          return j2 | 0;
        }
        xd(d2, g2, h2, m2 + 2 | 0, o2);
        d2 = c[o2 >> 2] | 0;
        c[k2 >> 2] = d2;
        ud(f2, d2, n2);
        f2 = c[n2 >> 2] | 0;
        b[m2 >> 1] = f2;
        b[m2 + 490 >> 1] = (f2 | 0) == 3 ? -1 : g2 & 65535;
        a[j2 >> 0] = f2;
        f2 = 1;
        do {
          m2 = m2 + 1 | 0;
          a[j2 + f2 >> 0] = a[m2 >> 0] | 0;
          f2 = f2 + 1 | 0;
        } while ((f2 | 0) != 492);
        m2 = 492;
        i2 = q2;
        return m2 | 0;
      }
      xd(d2, g2, h2, m2, o2);
      ud(f2, c[o2 >> 2] | 0, n2);
      h2 = c[n2 >> 2] | 0;
      if ((h2 | 0) != 3) {
        f2 = c[o2 >> 2] | 0;
        c[k2 >> 2] = f2;
        if ((f2 | 0) == 8) {
          switch (h2 | 0) {
            case 1: {
              b[m2 + 70 >> 1] = 0;
              break;
            }
            case 2: {
              o2 = m2 + 70 | 0;
              b[o2 >> 1] = e[o2 >> 1] | 0 | 1;
              break;
            }
          }
          b[m2 + 72 >> 1] = g2 & 1;
          b[m2 + 74 >> 1] = g2 >>> 1 & 1;
          b[m2 + 76 >> 1] = g2 >>> 2 & 1;
          f2 = 8;
        }
      } else {
        c[k2 >> 2] = 15;
        f2 = 15;
      }
      if (p2) {
        tc(f2, m2, j2, (c[d2 + 4 >> 2] | 0) + 2392 | 0);
        j2 = b[3404 + (c[k2 >> 2] << 16 >> 16 << 1) >> 1] | 0;
        i2 = q2;
        return j2 | 0;
      }
      switch (l2 << 16 >> 16) {
        case 0: {
          sc(f2, m2, j2, (c[d2 + 4 >> 2] | 0) + 2392 | 0);
          j2 = b[3404 + (c[k2 >> 2] << 16 >> 16 << 1) >> 1] | 0;
          i2 = q2;
          return j2 | 0;
        }
        case 1: {
          rc(f2, m2, j2, (c[d2 + 4 >> 2] | 0) + 2392 | 0);
          j2 = b[3436 + (c[k2 >> 2] << 16 >> 16 << 1) >> 1] | 0;
          i2 = q2;
          return j2 | 0;
        }
        default: {
          j2 = -1;
          i2 = q2;
          return j2 | 0;
        }
      }
    }
    function Kb(a2, c2, d2, e2, f2, g2) {
      a2 = a2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      var h2 = 0, j2 = 0, k2 = 0, l2 = 0, m2 = 0, n2 = 0, o2 = 0, p2 = 0, q2 = 0, r2 = 0, s2 = 0, t2 = 0, u2 = 0, v2 = 0, w2 = 0, x2 = 0, y2 = 0;
      y2 = i2;
      i2 = i2 + 480 | 0;
      x2 = y2;
      g2 = 240;
      l2 = f2;
      k2 = a2;
      j2 = x2;
      h2 = 0;
      while (1) {
        w2 = ((Z(b[l2 >> 1] | 0, b[k2 >> 1] | 0) | 0) + 16384 | 0) >>> 15;
        b[j2 >> 1] = w2;
        w2 = w2 << 16;
        h2 = (Z(w2 >> 15, w2 >> 16) | 0) + h2 | 0;
        if ((h2 | 0) < 0) {
          m2 = 4;
          break;
        }
        g2 = g2 + -1 | 0;
        if (!((g2 & 65535) << 16 >> 16)) {
          g2 = 0;
          break;
        } else {
          l2 = l2 + 2 | 0;
          k2 = k2 + 2 | 0;
          j2 = j2 + 2 | 0;
        }
      }
      if ((m2 | 0) == 4) {
        h2 = g2 & 65535;
        j2 = 240 - g2 | 0;
        if (!(h2 << 16 >> 16))
          g2 = 0;
        else {
          l2 = h2;
          k2 = f2 + (j2 << 1) | 0;
          g2 = a2 + (j2 << 1) | 0;
          h2 = x2 + (j2 << 1) | 0;
          while (1) {
            b[h2 >> 1] = ((Z(b[k2 >> 1] | 0, b[g2 >> 1] | 0) | 0) + 16384 | 0) >>> 15;
            l2 = l2 + -1 << 16 >> 16;
            if (!(l2 << 16 >> 16)) {
              g2 = 0;
              break;
            } else {
              k2 = k2 + 2 | 0;
              g2 = g2 + 2 | 0;
              h2 = h2 + 2 | 0;
            }
          }
        }
        do {
          k2 = g2 & 65535;
          g2 = 120;
          j2 = x2;
          h2 = 0;
          while (1) {
            w2 = (b[j2 >> 1] | 0) >>> 2;
            u2 = j2 + 2 | 0;
            b[j2 >> 1] = w2;
            w2 = w2 << 16 >> 16;
            w2 = Z(w2, w2) | 0;
            v2 = (b[u2 >> 1] | 0) >>> 2;
            b[u2 >> 1] = v2;
            v2 = v2 << 16 >> 16;
            h2 = ((Z(v2, v2) | 0) + w2 << 1) + h2 | 0;
            g2 = g2 + -1 << 16 >> 16;
            if (!(g2 << 16 >> 16))
              break;
            else
              j2 = j2 + 4 | 0;
          }
          g2 = k2 + 4 | 0;
        } while ((h2 | 0) < 1);
      }
      w2 = h2 + 1 | 0;
      v2 = (pe(w2) | 0) << 16 >> 16;
      w2 = w2 << v2;
      b[d2 >> 1] = w2 >>> 16;
      b[e2 >> 1] = (w2 >>> 1) - (w2 >> 16 << 15);
      w2 = x2 + 478 | 0;
      l2 = c2 << 16 >> 16;
      if (c2 << 16 >> 16 <= 0) {
        x2 = v2 - g2 | 0;
        x2 = x2 & 65535;
        i2 = y2;
        return x2 | 0;
      }
      r2 = x2 + 476 | 0;
      s2 = v2 + 1 | 0;
      t2 = 239 - l2 | 0;
      u2 = x2 + (236 - l2 << 1) | 0;
      c2 = l2;
      d2 = d2 + (l2 << 1) | 0;
      e2 = e2 + (l2 << 1) | 0;
      while (1) {
        m2 = Z((t2 >>> 1) + 65535 & 65535, -2) | 0;
        k2 = x2 + (m2 + 236 << 1) | 0;
        m2 = u2 + (m2 << 1) | 0;
        f2 = 240 - c2 | 0;
        q2 = f2 + -1 | 0;
        j2 = x2 + (q2 << 1) | 0;
        a2 = q2 >>> 1 & 65535;
        f2 = x2 + (f2 + -2 << 1) | 0;
        l2 = Z(b[w2 >> 1] | 0, b[j2 >> 1] | 0) | 0;
        if (!(a2 << 16 >> 16)) {
          m2 = f2;
          k2 = r2;
        } else {
          p2 = r2;
          o2 = w2;
          while (1) {
            h2 = j2 + -4 | 0;
            n2 = o2 + -4 | 0;
            l2 = (Z(b[p2 >> 1] | 0, b[f2 >> 1] | 0) | 0) + l2 | 0;
            a2 = a2 + -1 << 16 >> 16;
            l2 = (Z(b[n2 >> 1] | 0, b[h2 >> 1] | 0) | 0) + l2 | 0;
            if (!(a2 << 16 >> 16))
              break;
            else {
              f2 = j2 + -6 | 0;
              p2 = o2 + -6 | 0;
              j2 = h2;
              o2 = n2;
            }
          }
        }
        if (q2 & 1)
          l2 = (Z(b[k2 >> 1] | 0, b[m2 >> 1] | 0) | 0) + l2 | 0;
        q2 = l2 << s2;
        b[d2 >> 1] = q2 >>> 16;
        b[e2 >> 1] = (q2 >>> 1) - (q2 >> 16 << 15);
        if ((c2 & 65535) + -1 << 16 >> 16 << 16 >> 16 > 0) {
          t2 = t2 + 1 | 0;
          u2 = u2 + 2 | 0;
          c2 = c2 + -1 | 0;
          d2 = d2 + -2 | 0;
          e2 = e2 + -2 | 0;
        } else
          break;
      }
      x2 = v2 - g2 | 0;
      x2 = x2 & 65535;
      i2 = y2;
      return x2 | 0;
    }
    function Lb(a2, c2, d2, f2, g2, h2, j2, k2) {
      a2 = a2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      j2 = j2 | 0;
      k2 = k2 | 0;
      var l2 = 0, m2 = 0, n2 = 0, o2 = 0, p2 = 0, q2 = 0, r2 = 0, s2 = 0, t2 = 0, u2 = 0, v2 = 0, w2 = 0, x2 = 0, y2 = 0, z2 = 0, A2 = 0, B2 = 0, C2 = 0, D2 = 0, E2 = 0, F2 = 0, G2 = 0, H2 = 0, I2 = 0, J2 = 0, K2 = 0;
      E2 = i2;
      i2 = i2 + 3440 | 0;
      D2 = E2 + 3420 | 0;
      z2 = E2 + 3400 | 0;
      A2 = E2 + 3224 | 0;
      C2 = E2;
      x2 = E2 + 3320 | 0;
      B2 = E2 + 3240 | 0;
      y2 = E2 + 24 | 0;
      hc(d2, a2, x2, 2, k2);
      rd(x2, c2, B2, A2, 5, z2, 5, k2);
      fc(d2, B2, y2, k2);
      pd(10, 5, 5, x2, y2, z2, A2, C2, k2);
      c2 = f2;
      k2 = c2 + 80 | 0;
      do {
        b[c2 >> 1] = 0;
        c2 = c2 + 2 | 0;
      } while ((c2 | 0) < (k2 | 0));
      b[h2 >> 1] = 65535;
      b[h2 + 2 >> 1] = 65535;
      b[h2 + 4 >> 1] = 65535;
      b[h2 + 6 >> 1] = 65535;
      b[h2 + 8 >> 1] = 65535;
      p2 = 0;
      q2 = C2;
      r2 = D2;
      do {
        a2 = b[q2 >> 1] | 0;
        q2 = q2 + 2 | 0;
        l2 = (a2 * 6554 | 0) >>> 15;
        m2 = l2 << 16 >> 16;
        c2 = f2 + (a2 << 1) | 0;
        k2 = b[c2 >> 1] | 0;
        if ((b[B2 + (a2 << 1) >> 1] | 0) > 0) {
          b[c2 >> 1] = k2 + 4096;
          b[r2 >> 1] = 8192;
          n2 = l2;
        } else {
          b[c2 >> 1] = k2 + 61440;
          b[r2 >> 1] = -8192;
          n2 = m2 + 8 | 0;
        }
        r2 = r2 + 2 | 0;
        o2 = n2 & 65535;
        c2 = a2 - (l2 << 2) - m2 << 16 >> 16;
        l2 = h2 + (c2 << 1) | 0;
        k2 = b[l2 >> 1] | 0;
        a2 = k2 << 16 >> 16;
        do
          if (k2 << 16 >> 16 >= 0) {
            m2 = n2 << 16 >> 16;
            if (!((m2 ^ a2) & 8)) {
              c2 = h2 + (c2 + 5 << 1) | 0;
              if ((a2 | 0) > (m2 | 0)) {
                b[c2 >> 1] = k2;
                b[l2 >> 1] = o2;
                break;
              } else {
                b[c2 >> 1] = o2;
                break;
              }
            } else {
              c2 = h2 + (c2 + 5 << 1) | 0;
              if ((a2 & 7) >>> 0 > (m2 & 7) >>> 0) {
                b[c2 >> 1] = o2;
                break;
              } else {
                b[c2 >> 1] = k2;
                b[l2 >> 1] = o2;
                break;
              }
            }
          } else
            b[l2 >> 1] = o2;
        while (0);
        p2 = p2 + 1 << 16 >> 16;
      } while (p2 << 16 >> 16 < 10);
      r2 = D2 + 2 | 0;
      p2 = D2 + 4 | 0;
      n2 = D2 + 6 | 0;
      m2 = D2 + 8 | 0;
      l2 = D2 + 10 | 0;
      c2 = D2 + 12 | 0;
      k2 = D2 + 14 | 0;
      a2 = D2 + 16 | 0;
      s2 = D2 + 18 | 0;
      t2 = 40;
      u2 = d2 + (0 - (b[C2 >> 1] | 0) << 1) | 0;
      v2 = d2 + (0 - (b[C2 + 2 >> 1] | 0) << 1) | 0;
      w2 = d2 + (0 - (b[C2 + 4 >> 1] | 0) << 1) | 0;
      x2 = d2 + (0 - (b[C2 + 6 >> 1] | 0) << 1) | 0;
      y2 = d2 + (0 - (b[C2 + 8 >> 1] | 0) << 1) | 0;
      z2 = d2 + (0 - (b[C2 + 10 >> 1] | 0) << 1) | 0;
      A2 = d2 + (0 - (b[C2 + 12 >> 1] | 0) << 1) | 0;
      B2 = d2 + (0 - (b[C2 + 14 >> 1] | 0) << 1) | 0;
      f2 = d2 + (0 - (b[C2 + 16 >> 1] | 0) << 1) | 0;
      q2 = d2 + (0 - (b[C2 + 18 >> 1] | 0) << 1) | 0;
      o2 = g2;
      while (1) {
        K2 = (Z(b[D2 >> 1] | 0, b[u2 >> 1] | 0) | 0) >> 7;
        J2 = (Z(b[r2 >> 1] | 0, b[v2 >> 1] | 0) | 0) >> 7;
        I2 = (Z(b[p2 >> 1] | 0, b[w2 >> 1] | 0) | 0) >> 7;
        H2 = (Z(b[n2 >> 1] | 0, b[x2 >> 1] | 0) | 0) >> 7;
        G2 = (Z(b[m2 >> 1] | 0, b[y2 >> 1] | 0) | 0) >> 7;
        F2 = (Z(b[l2 >> 1] | 0, b[z2 >> 1] | 0) | 0) >> 7;
        C2 = (Z(b[c2 >> 1] | 0, b[A2 >> 1] | 0) | 0) >> 7;
        d2 = (Z(b[k2 >> 1] | 0, b[B2 >> 1] | 0) | 0) >>> 7;
        g2 = (Z(b[a2 >> 1] | 0, b[f2 >> 1] | 0) | 0) >>> 7;
        b[o2 >> 1] = (K2 + 128 + J2 + I2 + H2 + G2 + F2 + C2 + d2 + g2 + ((Z(b[s2 >> 1] | 0, b[q2 >> 1] | 0) | 0) >>> 7) | 0) >>> 8;
        t2 = t2 + -1 << 16 >> 16;
        if (!(t2 << 16 >> 16))
          break;
        else {
          u2 = u2 + 2 | 0;
          v2 = v2 + 2 | 0;
          w2 = w2 + 2 | 0;
          x2 = x2 + 2 | 0;
          y2 = y2 + 2 | 0;
          z2 = z2 + 2 | 0;
          A2 = A2 + 2 | 0;
          B2 = B2 + 2 | 0;
          f2 = f2 + 2 | 0;
          q2 = q2 + 2 | 0;
          o2 = o2 + 2 | 0;
        }
      }
      c2 = 0;
      do {
        k2 = h2 + (c2 << 1) | 0;
        a2 = b[k2 >> 1] | 0;
        if ((c2 | 0) < 5)
          a2 = (e[j2 + ((a2 & 7) << 1) >> 1] | a2 & 8) & 65535;
        else
          a2 = b[j2 + ((a2 & 7) << 1) >> 1] | 0;
        b[k2 >> 1] = a2;
        c2 = c2 + 1 | 0;
      } while ((c2 | 0) != 10);
      i2 = E2;
      return;
    }
    function Mb(a2, d2, e2, f2, g2, h2, j2, k2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      j2 = j2 | 0;
      k2 = k2 | 0;
      var l2 = 0, m2 = 0, n2 = 0, o2 = 0, p2 = 0, q2 = 0, r2 = 0, s2 = 0, t2 = 0, u2 = 0, v2 = 0, w2 = 0, x2 = 0, y2 = 0, z2 = 0, A2 = 0, B2 = 0, C2 = 0, D2 = 0, E2 = 0, F2 = 0, G2 = 0, H2 = 0, I2 = 0, J2 = 0, K2 = 0, L2 = 0, M2 = 0, N2 = 0;
      N2 = i2;
      i2 = i2 + 3456 | 0;
      I2 = N2 + 3448 | 0;
      G2 = N2 + 3360 | 0;
      E2 = N2 + 3368 | 0;
      p2 = N2 + 3280 | 0;
      H2 = N2 + 3200 | 0;
      F2 = N2;
      K2 = (f2 & 65535) << 17;
      M2 = e2 << 16 >> 16;
      J2 = e2 << 16 >> 16 < 40;
      if (J2) {
        f2 = K2 >> 16;
        e2 = M2;
        do {
          m2 = (Z(b[d2 + (e2 - M2 << 1) >> 1] | 0, f2) | 0) >> 15;
          if ((m2 | 0) > 32767) {
            c[k2 >> 2] = 1;
            m2 = 32767;
          }
          D2 = d2 + (e2 << 1) | 0;
          b[D2 >> 1] = Rd(b[D2 >> 1] | 0, m2 & 65535, k2) | 0;
          e2 = e2 + 1 | 0;
        } while ((e2 & 65535) << 16 >> 16 != 40);
      }
      hc(d2, a2, E2, 1, k2);
      qd(E2, H2, p2, 8);
      fc(d2, H2, F2, k2);
      D2 = G2 + 2 | 0;
      b[G2 >> 1] = 0;
      b[D2 >> 1] = 1;
      a2 = 1;
      m2 = 0;
      o2 = 1;
      p2 = 0;
      n2 = -1;
      do {
        B2 = b[2830 + (p2 << 1) >> 1] | 0;
        C2 = B2 << 16 >> 16;
        A2 = 0;
        do {
          y2 = b[2834 + (A2 << 1) >> 1] | 0;
          z2 = y2 << 16 >> 16;
          x2 = a2;
          v2 = C2;
          u2 = o2;
          w2 = B2;
          t2 = n2;
          while (1) {
            l2 = b[E2 + (v2 << 1) >> 1] | 0;
            r2 = b[F2 + (v2 * 80 | 0) + (v2 << 1) >> 1] | 0;
            e2 = z2;
            o2 = 1;
            s2 = y2;
            a2 = y2;
            n2 = -1;
            while (1) {
              f2 = Rd(l2, b[E2 + (e2 << 1) >> 1] | 0, k2) | 0;
              f2 = f2 << 16 >> 16;
              f2 = (Z(f2, f2) | 0) >>> 15;
              q2 = (b[F2 + (v2 * 80 | 0) + (e2 << 1) >> 1] << 15) + 32768 + ((b[F2 + (e2 * 80 | 0) + (e2 << 1) >> 1] | 0) + r2 << 14) | 0;
              if (((Z(f2 << 16 >> 16, o2 << 16 >> 16) | 0) - (Z(q2 >> 16, n2 << 16 >> 16) | 0) << 1 | 0) > 0) {
                o2 = q2 >>> 16 & 65535;
                a2 = s2;
                n2 = f2 & 65535;
              }
              q2 = e2 + 5 | 0;
              s2 = q2 & 65535;
              if (s2 << 16 >> 16 >= 40)
                break;
              else
                e2 = q2 << 16 >> 16;
            }
            if (((Z(n2 << 16 >> 16, u2 << 16 >> 16) | 0) - (Z(o2 << 16 >> 16, t2 << 16 >> 16) | 0) << 1 | 0) > 0) {
              b[G2 >> 1] = w2;
              b[D2 >> 1] = a2;
              m2 = w2;
            } else {
              a2 = x2;
              o2 = u2;
              n2 = t2;
            }
            q2 = v2 + 5 | 0;
            w2 = q2 & 65535;
            if (w2 << 16 >> 16 >= 40)
              break;
            else {
              x2 = a2;
              v2 = q2 << 16 >> 16;
              u2 = o2;
              t2 = n2;
            }
          }
          A2 = A2 + 1 | 0;
        } while ((A2 | 0) != 4);
        p2 = p2 + 1 | 0;
      } while ((p2 | 0) != 2);
      r2 = a2;
      s2 = m2;
      f2 = g2;
      e2 = f2 + 80 | 0;
      do {
        b[f2 >> 1] = 0;
        f2 = f2 + 2 | 0;
      } while ((f2 | 0) < (e2 | 0));
      o2 = s2;
      e2 = 0;
      q2 = 0;
      f2 = 0;
      while (1) {
        m2 = o2 << 16 >> 16;
        l2 = b[H2 + (m2 << 1) >> 1] | 0;
        a2 = (m2 * 6554 | 0) >>> 15;
        o2 = a2 << 16;
        p2 = o2 >> 15;
        n2 = m2 - (p2 + (a2 << 3) << 16 >> 17) | 0;
        switch (n2 << 16 >> 16 | 0) {
          case 0: {
            p2 = o2 >> 10;
            a2 = 1;
            break;
          }
          case 1: {
            if (!((e2 & 65535) << 16 >> 16))
              a2 = 0;
            else {
              p2 = a2 << 22 >> 16 | 16;
              a2 = 1;
            }
            break;
          }
          case 2: {
            p2 = a2 << 22 >> 16 | 32;
            a2 = 1;
            break;
          }
          case 3: {
            p2 = a2 << 17 >> 16 | 1;
            a2 = 0;
            break;
          }
          case 4: {
            p2 = a2 << 22 >> 16 | 48;
            a2 = 1;
            break;
          }
          default: {
            p2 = a2;
            a2 = n2 & 65535;
          }
        }
        p2 = p2 & 65535;
        n2 = g2 + (m2 << 1) | 0;
        if (l2 << 16 >> 16 > 0) {
          b[n2 >> 1] = 8191;
          b[I2 + (e2 << 1) >> 1] = 32767;
          m2 = a2 << 16 >> 16;
          if (a2 << 16 >> 16 < 0) {
            m2 = 0 - m2 << 16;
            if ((m2 | 0) < 983040)
              m2 = 1 >>> (m2 >> 16) & 65535;
            else
              m2 = 0;
          } else {
            F2 = 1 << m2;
            m2 = (F2 << 16 >> 16 >> m2 | 0) == 1 ? F2 & 65535 : 32767;
          }
          f2 = Rd(f2, m2, k2) | 0;
        } else {
          b[n2 >> 1] = -8192;
          b[I2 + (e2 << 1) >> 1] = -32768;
        }
        m2 = Rd(q2, p2, k2) | 0;
        e2 = e2 + 1 | 0;
        if ((e2 | 0) == 2) {
          q2 = m2;
          break;
        }
        o2 = b[G2 + (e2 << 1) >> 1] | 0;
        q2 = m2;
      }
      b[j2 >> 1] = f2;
      p2 = I2 + 2 | 0;
      o2 = b[I2 >> 1] | 0;
      a2 = 0;
      n2 = d2 + (0 - (s2 << 16 >> 16) << 1) | 0;
      m2 = d2 + (0 - (r2 << 16 >> 16) << 1) | 0;
      do {
        f2 = Z(b[n2 >> 1] | 0, o2) | 0;
        n2 = n2 + 2 | 0;
        if ((f2 | 0) != 1073741824 ? (L2 = f2 << 1, !((f2 | 0) > 0 & (L2 | 0) < 0)) : 0)
          l2 = L2;
        else {
          c[k2 >> 2] = 1;
          l2 = 2147483647;
        }
        e2 = Z(b[p2 >> 1] | 0, b[m2 >> 1] | 0) | 0;
        m2 = m2 + 2 | 0;
        if ((e2 | 0) != 1073741824) {
          f2 = (e2 << 1) + l2 | 0;
          if ((e2 ^ l2 | 0) > 0 & (f2 ^ l2 | 0) < 0) {
            c[k2 >> 2] = 1;
            f2 = (l2 >>> 31) + 2147483647 | 0;
          }
        } else {
          c[k2 >> 2] = 1;
          f2 = 2147483647;
        }
        b[h2 + (a2 << 1) >> 1] = Ce(f2, k2) | 0;
        a2 = a2 + 1 | 0;
      } while ((a2 | 0) != 40);
      if (!J2) {
        i2 = N2;
        return q2 | 0;
      }
      e2 = K2 >> 16;
      f2 = M2;
      do {
        l2 = (Z(b[g2 + (f2 - M2 << 1) >> 1] | 0, e2) | 0) >> 15;
        if ((l2 | 0) > 32767) {
          c[k2 >> 2] = 1;
          l2 = 32767;
        }
        h2 = g2 + (f2 << 1) | 0;
        b[h2 >> 1] = Rd(b[h2 >> 1] | 0, l2 & 65535, k2) | 0;
        f2 = f2 + 1 | 0;
      } while ((f2 & 65535) << 16 >> 16 != 40);
      i2 = N2;
      return q2 | 0;
    }
    function Nb(a2, d2, e2, f2, g2, h2, j2, k2, l2, m2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      j2 = j2 | 0;
      k2 = k2 | 0;
      l2 = l2 | 0;
      m2 = m2 | 0;
      var n2 = 0, o2 = 0, p2 = 0, q2 = 0, r2 = 0, s2 = 0, t2 = 0, u2 = 0, v2 = 0, w2 = 0, x2 = 0;
      x2 = i2;
      i2 = i2 + 3456 | 0;
      r2 = x2 + 3360 | 0;
      s2 = x2 + 3368 | 0;
      t2 = x2 + 3280 | 0;
      u2 = x2 + 3200 | 0;
      v2 = x2;
      w2 = g2 << 16 >> 16;
      p2 = w2 << 1;
      if ((p2 | 0) == (w2 << 17 >> 16 | 0))
        q2 = p2;
      else {
        c[m2 >> 2] = 1;
        q2 = g2 << 16 >> 16 > 0 ? 32767 : -32768;
      }
      w2 = f2 << 16 >> 16;
      n2 = f2 << 16 >> 16 < 40;
      if (n2) {
        g2 = q2 << 16 >> 16;
        o2 = w2;
        do {
          f2 = e2 + (o2 << 1) | 0;
          p2 = (Z(b[e2 + (o2 - w2 << 1) >> 1] | 0, g2) | 0) >> 15;
          if ((p2 | 0) > 32767) {
            c[m2 >> 2] = 1;
            p2 = 32767;
          }
          b[f2 >> 1] = Rd(b[f2 >> 1] | 0, p2 & 65535, m2) | 0;
          o2 = o2 + 1 | 0;
        } while ((o2 & 65535) << 16 >> 16 != 40);
      }
      hc(e2, d2, s2, 1, m2);
      qd(s2, u2, t2, 8);
      fc(e2, u2, v2, m2);
      Ob(a2, s2, v2, l2, r2);
      p2 = Pb(a2, r2, u2, h2, e2, j2, k2, m2) | 0;
      if (!n2) {
        i2 = x2;
        return p2 | 0;
      }
      o2 = q2 << 16 >> 16;
      g2 = w2;
      do {
        f2 = h2 + (g2 << 1) | 0;
        n2 = (Z(b[h2 + (g2 - w2 << 1) >> 1] | 0, o2) | 0) >> 15;
        if ((n2 | 0) > 32767) {
          c[m2 >> 2] = 1;
          n2 = 32767;
        }
        b[f2 >> 1] = Rd(b[f2 >> 1] | 0, n2 & 65535, m2) | 0;
        g2 = g2 + 1 | 0;
      } while ((g2 & 65535) << 16 >> 16 != 40);
      i2 = x2;
      return p2 | 0;
    }
    function Ob(a2, c2, d2, f2, g2) {
      a2 = a2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      var h2 = 0, i3 = 0, j2 = 0, k2 = 0, l2 = 0, m2 = 0, n2 = 0, o2 = 0, p2 = 0, q2 = 0, r2 = 0, s2 = 0, t2 = 0, u2 = 0, v2 = 0, w2 = 0, x2 = 0;
      x2 = g2 + 2 | 0;
      b[g2 >> 1] = 0;
      b[x2 >> 1] = 1;
      v2 = a2 << 16 >> 16 << 1;
      h2 = 1;
      w2 = 0;
      a2 = -1;
      do {
        u2 = (w2 << 3) + v2 << 16 >> 16;
        k2 = b[f2 + (u2 << 1) >> 1] | 0;
        u2 = b[f2 + ((u2 | 1) << 1) >> 1] | 0;
        i3 = k2 << 16 >> 16;
        a:
          do
            if (k2 << 16 >> 16 < 40) {
              t2 = u2 << 16 >> 16;
              if (u2 << 16 >> 16 < 40)
                s2 = h2;
              else
                while (1) {
                  if ((a2 << 16 >> 16 | 0) < (0 - (h2 << 16 >> 16) | 0)) {
                    b[g2 >> 1] = k2;
                    b[x2 >> 1] = u2;
                    j2 = 1;
                    a2 = -1;
                  } else
                    j2 = h2;
                  h2 = i3 + 5 | 0;
                  k2 = h2 & 65535;
                  if (k2 << 16 >> 16 >= 40) {
                    h2 = j2;
                    break a;
                  } else {
                    i3 = h2 << 16 >> 16;
                    h2 = j2;
                  }
                }
              while (1) {
                q2 = b[d2 + (i3 * 80 | 0) + (i3 << 1) >> 1] | 0;
                p2 = e[c2 + (i3 << 1) >> 1] | 0;
                o2 = t2;
                h2 = 1;
                r2 = u2;
                j2 = u2;
                l2 = -1;
                while (1) {
                  n2 = (e[c2 + (o2 << 1) >> 1] | 0) + p2 << 16 >> 16;
                  n2 = (Z(n2, n2) | 0) >>> 15;
                  m2 = (b[d2 + (i3 * 80 | 0) + (o2 << 1) >> 1] << 15) + 32768 + ((b[d2 + (o2 * 80 | 0) + (o2 << 1) >> 1] | 0) + q2 << 14) | 0;
                  if (((Z(n2 << 16 >> 16, h2 << 16 >> 16) | 0) - (Z(m2 >> 16, l2 << 16 >> 16) | 0) << 1 | 0) > 0) {
                    h2 = m2 >>> 16 & 65535;
                    j2 = r2;
                    l2 = n2 & 65535;
                  }
                  m2 = o2 + 5 | 0;
                  r2 = m2 & 65535;
                  if (r2 << 16 >> 16 >= 40)
                    break;
                  else
                    o2 = m2 << 16 >> 16;
                }
                if (((Z(l2 << 16 >> 16, s2 << 16 >> 16) | 0) - (Z(h2 << 16 >> 16, a2 << 16 >> 16) | 0) << 1 | 0) > 0) {
                  b[g2 >> 1] = k2;
                  b[x2 >> 1] = j2;
                  a2 = l2;
                } else
                  h2 = s2;
                i3 = i3 + 5 | 0;
                k2 = i3 & 65535;
                if (k2 << 16 >> 16 >= 40)
                  break;
                else {
                  i3 = i3 << 16 >> 16;
                  s2 = h2;
                }
              }
            }
          while (0);
        w2 = w2 + 1 | 0;
      } while ((w2 | 0) != 2);
      return;
    }
    function Pb(a2, d2, e2, f2, g2, h2, i3, j2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      i3 = i3 | 0;
      j2 = j2 | 0;
      var k2 = 0, l2 = 0, m2 = 0, n2 = 0, o2 = 0, p2 = 0;
      k2 = f2;
      l2 = k2 + 80 | 0;
      do {
        b[k2 >> 1] = 0;
        k2 = k2 + 2 | 0;
      } while ((k2 | 0) < (l2 | 0));
      k2 = b[d2 >> 1] | 0;
      o2 = (k2 * 6554 | 0) >>> 15;
      l2 = o2 << 16 >> 16;
      n2 = (748250 >>> ((k2 + (Z(l2, -5) | 0) << 16 >> 16) + ((a2 << 16 >> 16) * 5 | 0) | 0) & 1 | 0) == 0;
      m2 = (b[e2 + (k2 << 1) >> 1] | 0) > 0;
      p2 = m2 ? 32767 : -32768;
      b[f2 + (k2 << 1) >> 1] = m2 ? 8191 : -8192;
      k2 = d2 + 2 | 0;
      a2 = b[k2 >> 1] | 0;
      f2 = f2 + (a2 << 1) | 0;
      if ((b[e2 + (a2 << 1) >> 1] | 0) > 0) {
        b[f2 >> 1] = 8191;
        e2 = 32767;
        f2 = (m2 & 1 | 2) & 65535;
      } else {
        b[f2 >> 1] = -8192;
        e2 = -32768;
        f2 = m2 & 1;
      }
      o2 = ((a2 * 6554 | 0) >>> 15 << 3) + (n2 ? o2 : l2 + 64 | 0) & 65535;
      b[i3 >> 1] = f2;
      n2 = 0;
      m2 = g2 + (0 - (b[d2 >> 1] | 0) << 1) | 0;
      f2 = g2 + (0 - (b[k2 >> 1] | 0) << 1) | 0;
      do {
        k2 = Z(p2, b[m2 >> 1] | 0) | 0;
        m2 = m2 + 2 | 0;
        if ((k2 | 0) == 1073741824) {
          c[j2 >> 2] = 1;
          a2 = 2147483647;
        } else
          a2 = k2 << 1;
        l2 = Z(e2, b[f2 >> 1] | 0) | 0;
        f2 = f2 + 2 | 0;
        if ((l2 | 0) != 1073741824) {
          k2 = (l2 << 1) + a2 | 0;
          if ((l2 ^ a2 | 0) > 0 & (k2 ^ a2 | 0) < 0) {
            c[j2 >> 2] = 1;
            k2 = (a2 >>> 31) + 2147483647 | 0;
          }
        } else {
          c[j2 >> 2] = 1;
          k2 = 2147483647;
        }
        b[h2 + (n2 << 1) >> 1] = Ce(k2, j2) | 0;
        n2 = n2 + 1 | 0;
      } while ((n2 | 0) != 40);
      return o2 | 0;
    }
    function Qb(a2, d2, f2, g2, h2, j2, k2, l2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      j2 = j2 | 0;
      k2 = k2 | 0;
      l2 = l2 | 0;
      var m2 = 0, n2 = 0, o2 = 0, p2 = 0, q2 = 0, r2 = 0, s2 = 0, t2 = 0, u2 = 0, v2 = 0, w2 = 0, x2 = 0, y2 = 0, z2 = 0, A2 = 0, B2 = 0, C2 = 0, D2 = 0, E2 = 0, F2 = 0, G2 = 0, H2 = 0, I2 = 0, J2 = 0, K2 = 0, L2 = 0, M2 = 0, N2 = 0, O2 = 0, P2 = 0, Q2 = 0, R2 = 0, S2 = 0, T2 = 0, U2 = 0;
      U2 = i2;
      i2 = i2 + 3440 | 0;
      M2 = U2 + 3360 | 0;
      N2 = U2 + 3280 | 0;
      P2 = U2 + 3200 | 0;
      O2 = U2;
      R2 = (g2 & 65535) << 17;
      T2 = f2 << 16 >> 16;
      Q2 = f2 << 16 >> 16 < 40;
      if (Q2) {
        f2 = R2 >> 16;
        m2 = T2;
        do {
          g2 = (Z(b[d2 + (m2 - T2 << 1) >> 1] | 0, f2) | 0) >> 15;
          if ((g2 | 0) > 32767) {
            c[l2 >> 2] = 1;
            g2 = 32767;
          }
          L2 = d2 + (m2 << 1) | 0;
          b[L2 >> 1] = Rd(b[L2 >> 1] | 0, g2 & 65535, l2) | 0;
          m2 = m2 + 1 | 0;
        } while ((m2 & 65535) << 16 >> 16 != 40);
      }
      hc(d2, a2, M2, 1, l2);
      qd(M2, P2, N2, 6);
      fc(d2, P2, O2, l2);
      L2 = 1;
      n2 = 2;
      o2 = 1;
      g2 = 0;
      m2 = 1;
      a2 = -1;
      p2 = 1;
      while (1) {
        K2 = 2;
        s2 = 2;
        while (1) {
          H2 = 0;
          I2 = 0;
          J2 = p2;
          G2 = s2;
          while (1) {
            if (I2 << 16 >> 16 < 40) {
              C2 = J2 << 16 >> 16;
              D2 = J2 << 16 >> 16 < 40;
              E2 = G2 << 16 >> 16;
              F2 = G2 << 16 >> 16 < 40;
              A2 = I2 << 16 >> 16;
              B2 = I2;
              while (1) {
                if ((b[N2 + (A2 << 1) >> 1] | 0) > -1) {
                  x2 = b[O2 + (A2 * 80 | 0) + (A2 << 1) >> 1] | 0;
                  if (D2) {
                    y2 = e[M2 + (A2 << 1) >> 1] | 0;
                    w2 = C2;
                    r2 = 1;
                    z2 = J2;
                    f2 = J2;
                    s2 = 0;
                    q2 = -1;
                    while (1) {
                      u2 = (e[M2 + (w2 << 1) >> 1] | 0) + y2 | 0;
                      v2 = u2 << 16 >> 16;
                      v2 = (Z(v2, v2) | 0) >>> 15;
                      t2 = (b[O2 + (A2 * 80 | 0) + (w2 << 1) >> 1] << 15) + 32768 + ((b[O2 + (w2 * 80 | 0) + (w2 << 1) >> 1] | 0) + x2 << 14) | 0;
                      if (((Z(v2 << 16 >> 16, r2 << 16 >> 16) | 0) - (Z(t2 >> 16, q2 << 16 >> 16) | 0) << 1 | 0) > 0) {
                        r2 = t2 >>> 16 & 65535;
                        f2 = z2;
                        s2 = u2 & 65535;
                        q2 = v2 & 65535;
                      }
                      t2 = w2 + 5 | 0;
                      z2 = t2 & 65535;
                      if (z2 << 16 >> 16 >= 40)
                        break;
                      else
                        w2 = t2 << 16 >> 16;
                    }
                  } else {
                    r2 = 1;
                    f2 = J2;
                    s2 = 0;
                  }
                  if (F2) {
                    y2 = s2 & 65535;
                    z2 = f2 << 16 >> 16;
                    w2 = (r2 << 16 >> 16 << 14) + 32768 | 0;
                    v2 = E2;
                    s2 = 1;
                    x2 = G2;
                    q2 = G2;
                    r2 = -1;
                    while (1) {
                      u2 = (e[M2 + (v2 << 1) >> 1] | 0) + y2 << 16 >> 16;
                      u2 = (Z(u2, u2) | 0) >>> 15;
                      t2 = w2 + (b[O2 + (v2 * 80 | 0) + (v2 << 1) >> 1] << 12) + ((b[O2 + (A2 * 80 | 0) + (v2 << 1) >> 1] | 0) + (b[O2 + (z2 * 80 | 0) + (v2 << 1) >> 1] | 0) << 13) | 0;
                      if (((Z(u2 << 16 >> 16, s2 << 16 >> 16) | 0) - (Z(t2 >> 16, r2 << 16 >> 16) | 0) << 1 | 0) > 0) {
                        s2 = t2 >>> 16 & 65535;
                        q2 = x2;
                        r2 = u2 & 65535;
                      }
                      t2 = v2 + 5 | 0;
                      x2 = t2 & 65535;
                      if (x2 << 16 >> 16 >= 40) {
                        w2 = s2;
                        v2 = r2;
                        break;
                      } else
                        v2 = t2 << 16 >> 16;
                    }
                  } else {
                    w2 = 1;
                    q2 = G2;
                    v2 = -1;
                  }
                  s2 = Z(v2 << 16 >> 16, m2 << 16 >> 16) | 0;
                  if ((s2 | 0) == 1073741824) {
                    c[l2 >> 2] = 1;
                    t2 = 2147483647;
                  } else
                    t2 = s2 << 1;
                  s2 = Z(w2 << 16 >> 16, a2 << 16 >> 16) | 0;
                  if ((s2 | 0) == 1073741824) {
                    c[l2 >> 2] = 1;
                    r2 = 2147483647;
                  } else
                    r2 = s2 << 1;
                  s2 = t2 - r2 | 0;
                  if (((s2 ^ t2) & (r2 ^ t2) | 0) < 0) {
                    c[l2 >> 2] = 1;
                    s2 = (t2 >>> 31) + 2147483647 | 0;
                  }
                  z2 = (s2 | 0) > 0;
                  n2 = z2 ? q2 : n2;
                  o2 = z2 ? f2 : o2;
                  g2 = z2 ? B2 : g2;
                  m2 = z2 ? w2 : m2;
                  a2 = z2 ? v2 : a2;
                }
                s2 = A2 + 5 | 0;
                B2 = s2 & 65535;
                if (B2 << 16 >> 16 >= 40)
                  break;
                else
                  A2 = s2 << 16 >> 16;
              }
            }
            H2 = H2 + 1 << 16 >> 16;
            if (H2 << 16 >> 16 >= 3)
              break;
            else {
              F2 = G2;
              G2 = J2;
              J2 = I2;
              I2 = F2;
            }
          }
          f2 = K2 + 2 | 0;
          s2 = f2 & 65535;
          if (s2 << 16 >> 16 >= 5)
            break;
          else
            K2 = f2 & 65535;
        }
        f2 = L2 + 2 | 0;
        p2 = f2 & 65535;
        if (p2 << 16 >> 16 < 4)
          L2 = f2 & 65535;
        else {
          s2 = n2;
          n2 = o2;
          break;
        }
      }
      f2 = h2;
      m2 = f2 + 80 | 0;
      do {
        b[f2 >> 1] = 0;
        f2 = f2 + 2 | 0;
      } while ((f2 | 0) < (m2 | 0));
      v2 = g2 << 16 >> 16;
      a2 = b[P2 + (v2 << 1) >> 1] | 0;
      g2 = (v2 * 6554 | 0) >>> 15;
      f2 = g2 << 16;
      m2 = v2 - (((f2 >> 16) * 327680 | 0) >>> 16) | 0;
      switch (m2 << 16 >> 16 | 0) {
        case 1: {
          g2 = f2 >> 12;
          break;
        }
        case 2: {
          g2 = f2 >> 8;
          m2 = 2;
          break;
        }
        case 3: {
          g2 = g2 << 20 >> 16 | 8;
          m2 = 1;
          break;
        }
        case 4: {
          g2 = g2 << 24 >> 16 | 128;
          m2 = 2;
          break;
        }
      }
      f2 = h2 + (v2 << 1) | 0;
      if (a2 << 16 >> 16 > 0) {
        b[f2 >> 1] = 8191;
        z2 = 32767;
        o2 = 65536 << (m2 << 16 >> 16) >>> 16 & 65535;
      } else {
        b[f2 >> 1] = -8192;
        z2 = -32768;
        o2 = 0;
      }
      t2 = n2 << 16 >> 16;
      n2 = b[P2 + (t2 << 1) >> 1] | 0;
      f2 = (t2 * 6554 | 0) >>> 15;
      m2 = f2 << 16;
      a2 = t2 - (((m2 >> 16) * 327680 | 0) >>> 16) | 0;
      switch (a2 << 16 >> 16 | 0) {
        case 1: {
          f2 = m2 >> 12;
          break;
        }
        case 2: {
          f2 = m2 >> 8;
          a2 = 2;
          break;
        }
        case 3: {
          f2 = f2 << 20 >> 16 | 8;
          a2 = 1;
          break;
        }
        case 4: {
          f2 = f2 << 24 >> 16 | 128;
          a2 = 2;
          break;
        }
      }
      m2 = h2 + (t2 << 1) | 0;
      if (n2 << 16 >> 16 > 0) {
        b[m2 >> 1] = 8191;
        u2 = 32767;
        o2 = (65536 << (a2 << 16 >> 16) >>> 16) + (o2 & 65535) & 65535;
      } else {
        b[m2 >> 1] = -8192;
        u2 = -32768;
      }
      p2 = f2 + g2 | 0;
      r2 = s2 << 16 >> 16;
      n2 = b[P2 + (r2 << 1) >> 1] | 0;
      g2 = (r2 * 6554 | 0) >>> 15;
      f2 = g2 << 16;
      m2 = r2 - (((f2 >> 16) * 327680 | 0) >>> 16) | 0;
      switch (m2 << 16 >> 16 | 0) {
        case 1: {
          f2 = f2 >> 12;
          break;
        }
        case 2: {
          f2 = f2 >> 8;
          m2 = 2;
          break;
        }
        case 3: {
          f2 = g2 << 20 >> 16 | 8;
          m2 = 1;
          break;
        }
        case 4: {
          f2 = g2 << 24 >> 16 | 128;
          m2 = 2;
          break;
        }
        default:
          f2 = g2;
      }
      g2 = h2 + (r2 << 1) | 0;
      if (n2 << 16 >> 16 > 0) {
        b[g2 >> 1] = 8191;
        s2 = 32767;
        g2 = (65536 << (m2 << 16 >> 16) >>> 16) + (o2 & 65535) & 65535;
      } else {
        b[g2 >> 1] = -8192;
        s2 = -32768;
        g2 = o2;
      }
      q2 = p2 + f2 | 0;
      b[k2 >> 1] = g2;
      o2 = 0;
      p2 = d2 + (0 - v2 << 1) | 0;
      a2 = d2 + (0 - t2 << 1) | 0;
      n2 = d2 + (0 - r2 << 1) | 0;
      do {
        g2 = Z(b[p2 >> 1] | 0, z2) | 0;
        p2 = p2 + 2 | 0;
        if ((g2 | 0) != 1073741824 ? (S2 = g2 << 1, !((g2 | 0) > 0 & (S2 | 0) < 0)) : 0)
          m2 = S2;
        else {
          c[l2 >> 2] = 1;
          m2 = 2147483647;
        }
        g2 = Z(b[a2 >> 1] | 0, u2) | 0;
        a2 = a2 + 2 | 0;
        if ((g2 | 0) != 1073741824) {
          f2 = (g2 << 1) + m2 | 0;
          if ((g2 ^ m2 | 0) > 0 & (f2 ^ m2 | 0) < 0) {
            c[l2 >> 2] = 1;
            f2 = (m2 >>> 31) + 2147483647 | 0;
          }
        } else {
          c[l2 >> 2] = 1;
          f2 = 2147483647;
        }
        m2 = Z(b[n2 >> 1] | 0, s2) | 0;
        n2 = n2 + 2 | 0;
        if ((m2 | 0) != 1073741824) {
          g2 = (m2 << 1) + f2 | 0;
          if ((m2 ^ f2 | 0) > 0 & (g2 ^ f2 | 0) < 0) {
            c[l2 >> 2] = 1;
            g2 = (f2 >>> 31) + 2147483647 | 0;
          }
        } else {
          c[l2 >> 2] = 1;
          g2 = 2147483647;
        }
        b[j2 + (o2 << 1) >> 1] = Ce(g2, l2) | 0;
        o2 = o2 + 1 | 0;
      } while ((o2 | 0) != 40);
      g2 = q2 & 65535;
      if (!Q2) {
        i2 = U2;
        return g2 | 0;
      }
      m2 = R2 >> 16;
      f2 = T2;
      do {
        a2 = (Z(b[h2 + (f2 - T2 << 1) >> 1] | 0, m2) | 0) >> 15;
        if ((a2 | 0) > 32767) {
          c[l2 >> 2] = 1;
          a2 = 32767;
        }
        j2 = h2 + (f2 << 1) | 0;
        b[j2 >> 1] = Rd(b[j2 >> 1] | 0, a2 & 65535, l2) | 0;
        f2 = f2 + 1 | 0;
      } while ((f2 & 65535) << 16 >> 16 != 40);
      i2 = U2;
      return g2 | 0;
    }
    function Rb(a2, d2, f2, g2, h2, j2, k2, l2, m2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      j2 = j2 | 0;
      k2 = k2 | 0;
      l2 = l2 | 0;
      m2 = m2 | 0;
      var n2 = 0, o2 = 0, p2 = 0, q2 = 0, r2 = 0, s2 = 0, t2 = 0, u2 = 0, v2 = 0, w2 = 0, x2 = 0, y2 = 0, z2 = 0, A2 = 0, B2 = 0, C2 = 0, D2 = 0, E2 = 0, F2 = 0, G2 = 0, H2 = 0, I2 = 0, J2 = 0, K2 = 0, L2 = 0, M2 = 0, N2 = 0, O2 = 0, P2 = 0, Q2 = 0, R2 = 0, S2 = 0, T2 = 0, U2 = 0, V2 = 0, W2 = 0, X2 = 0, Y2 = 0, _2 = 0, $2 = 0, aa2 = 0, ba2 = 0, ca2 = 0, da2 = 0;
      da2 = i2;
      i2 = i2 + 3456 | 0;
      _2 = da2 + 3448 | 0;
      X2 = da2 + 3360 | 0;
      U2 = da2 + 3368 | 0;
      V2 = da2 + 3280 | 0;
      Y2 = da2 + 3200 | 0;
      W2 = da2;
      aa2 = (g2 & 65535) << 17;
      ca2 = f2 << 16 >> 16;
      $2 = f2 << 16 >> 16 < 40;
      if ($2) {
        f2 = aa2 >> 16;
        n2 = ca2;
        do {
          g2 = (Z(b[d2 + (n2 - ca2 << 1) >> 1] | 0, f2) | 0) >> 15;
          if ((g2 | 0) > 32767) {
            c[m2 >> 2] = 1;
            g2 = 32767;
          }
          T2 = d2 + (n2 << 1) | 0;
          b[T2 >> 1] = Rd(b[T2 >> 1] | 0, g2 & 65535, m2) | 0;
          n2 = n2 + 1 | 0;
        } while ((n2 & 65535) << 16 >> 16 != 40);
      }
      hc(d2, a2, U2, 1, m2);
      qd(U2, Y2, V2, 4);
      fc(d2, Y2, W2, m2);
      R2 = X2 + 2 | 0;
      b[X2 >> 1] = 0;
      S2 = X2 + 4 | 0;
      b[R2 >> 1] = 1;
      T2 = X2 + 6 | 0;
      b[S2 >> 1] = 2;
      b[T2 >> 1] = 3;
      r2 = 3;
      p2 = 2;
      o2 = 1;
      g2 = 0;
      f2 = 1;
      n2 = -1;
      q2 = 3;
      do {
        M2 = 0;
        N2 = 0;
        O2 = q2;
        P2 = 1;
        Q2 = 2;
        while (1) {
          if (N2 << 16 >> 16 < 40) {
            G2 = P2 << 16 >> 16;
            H2 = P2 << 16 >> 16 < 40;
            I2 = Q2 << 16 >> 16;
            J2 = Q2 << 16 >> 16 < 40;
            K2 = O2 << 16 >> 16;
            L2 = O2 << 16 >> 16 < 40;
            F2 = N2 << 16 >> 16;
            E2 = p2;
            C2 = o2;
            B2 = f2;
            D2 = N2;
            while (1) {
              if ((b[V2 + (F2 << 1) >> 1] | 0) > -1) {
                t2 = b[W2 + (F2 * 80 | 0) + (F2 << 1) >> 1] | 0;
                if (H2) {
                  s2 = e[U2 + (F2 << 1) >> 1] | 0;
                  u2 = G2;
                  z2 = 1;
                  p2 = P2;
                  o2 = P2;
                  x2 = 0;
                  y2 = -1;
                  while (1) {
                    w2 = (e[U2 + (u2 << 1) >> 1] | 0) + s2 | 0;
                    v2 = w2 << 16 >> 16;
                    v2 = (Z(v2, v2) | 0) >>> 15;
                    A2 = (b[W2 + (F2 * 80 | 0) + (u2 << 1) >> 1] << 15) + 32768 + ((b[W2 + (u2 * 80 | 0) + (u2 << 1) >> 1] | 0) + t2 << 14) | 0;
                    if (((Z(v2 << 16 >> 16, z2 << 16 >> 16) | 0) - (Z(A2 >> 16, y2 << 16 >> 16) | 0) << 1 | 0) > 0) {
                      z2 = A2 >>> 16 & 65535;
                      o2 = p2;
                      x2 = w2 & 65535;
                      y2 = v2 & 65535;
                    }
                    A2 = u2 + 5 | 0;
                    p2 = A2 & 65535;
                    if (p2 << 16 >> 16 >= 40)
                      break;
                    else
                      u2 = A2 << 16 >> 16;
                  }
                } else {
                  z2 = 1;
                  o2 = P2;
                  x2 = 0;
                }
                if (J2) {
                  f2 = x2 & 65535;
                  a2 = o2 << 16 >> 16;
                  t2 = (z2 << 16 >> 16 << 14) + 32768 | 0;
                  u2 = I2;
                  A2 = 1;
                  s2 = Q2;
                  p2 = Q2;
                  y2 = 0;
                  x2 = -1;
                  while (1) {
                    w2 = (e[U2 + (u2 << 1) >> 1] | 0) + f2 | 0;
                    v2 = w2 << 16 >> 16;
                    v2 = (Z(v2, v2) | 0) >>> 15;
                    z2 = t2 + (b[W2 + (u2 * 80 | 0) + (u2 << 1) >> 1] << 12) + ((b[W2 + (F2 * 80 | 0) + (u2 << 1) >> 1] | 0) + (b[W2 + (a2 * 80 | 0) + (u2 << 1) >> 1] | 0) << 13) | 0;
                    if (((Z(v2 << 16 >> 16, A2 << 16 >> 16) | 0) - (Z(z2 >> 16, x2 << 16 >> 16) | 0) << 1 | 0) > 0) {
                      A2 = z2 >>> 16 & 65535;
                      p2 = s2;
                      y2 = w2 & 65535;
                      x2 = v2 & 65535;
                    }
                    z2 = u2 + 5 | 0;
                    s2 = z2 & 65535;
                    if (s2 << 16 >> 16 >= 40)
                      break;
                    else
                      u2 = z2 << 16 >> 16;
                  }
                } else {
                  A2 = 1;
                  p2 = Q2;
                  y2 = 0;
                }
                if (L2) {
                  t2 = y2 & 65535;
                  s2 = p2 << 16 >> 16;
                  a2 = o2 << 16 >> 16;
                  v2 = (A2 & 65535) << 16 | 32768;
                  w2 = K2;
                  f2 = 1;
                  u2 = O2;
                  z2 = O2;
                  A2 = -1;
                  while (1) {
                    x2 = (e[U2 + (w2 << 1) >> 1] | 0) + t2 << 16 >> 16;
                    x2 = (Z(x2, x2) | 0) >>> 15;
                    y2 = (b[W2 + (w2 * 80 | 0) + (w2 << 1) >> 1] << 12) + v2 + ((b[W2 + (a2 * 80 | 0) + (w2 << 1) >> 1] | 0) + (b[W2 + (s2 * 80 | 0) + (w2 << 1) >> 1] | 0) + (b[W2 + (F2 * 80 | 0) + (w2 << 1) >> 1] | 0) << 13) | 0;
                    if (((Z(x2 << 16 >> 16, f2 << 16 >> 16) | 0) - (Z(y2 >> 16, A2 << 16 >> 16) | 0) << 1 | 0) > 0) {
                      f2 = y2 >>> 16 & 65535;
                      z2 = u2;
                      A2 = x2 & 65535;
                    }
                    y2 = w2 + 5 | 0;
                    u2 = y2 & 65535;
                    if (u2 << 16 >> 16 >= 40)
                      break;
                    else
                      w2 = y2 << 16 >> 16;
                  }
                } else {
                  f2 = 1;
                  z2 = O2;
                  A2 = -1;
                }
                if (((Z(A2 << 16 >> 16, B2 << 16 >> 16) | 0) - (Z(f2 << 16 >> 16, n2 << 16 >> 16) | 0) << 1 | 0) > 0) {
                  b[X2 >> 1] = D2;
                  b[R2 >> 1] = o2;
                  b[S2 >> 1] = p2;
                  b[T2 >> 1] = z2;
                  r2 = z2;
                  g2 = D2;
                  n2 = A2;
                } else {
                  p2 = E2;
                  o2 = C2;
                  f2 = B2;
                }
              } else {
                p2 = E2;
                o2 = C2;
                f2 = B2;
              }
              w2 = F2 + 5 | 0;
              D2 = w2 & 65535;
              if (D2 << 16 >> 16 >= 40)
                break;
              else {
                F2 = w2 << 16 >> 16;
                E2 = p2;
                C2 = o2;
                B2 = f2;
              }
            }
          }
          M2 = M2 + 1 << 16 >> 16;
          if (M2 << 16 >> 16 >= 4)
            break;
          else {
            K2 = Q2;
            L2 = O2;
            Q2 = P2;
            P2 = N2;
            O2 = K2;
            N2 = L2;
          }
        }
        q2 = q2 + 1 << 16 >> 16;
      } while (q2 << 16 >> 16 < 5);
      A2 = r2;
      z2 = p2;
      y2 = o2;
      x2 = g2;
      g2 = h2;
      f2 = g2 + 80 | 0;
      do {
        b[g2 >> 1] = 0;
        g2 = g2 + 2 | 0;
      } while ((g2 | 0) < (f2 | 0));
      a2 = x2;
      f2 = 0;
      n2 = 0;
      g2 = 0;
      while (1) {
        p2 = a2 << 16 >> 16;
        q2 = b[Y2 + (p2 << 1) >> 1] | 0;
        a2 = p2 * 13108 >> 16;
        o2 = p2 - ((a2 * 327680 | 0) >>> 16) | 0;
        a2 = b[l2 + (a2 << 1) >> 1] | 0;
        switch (o2 << 16 >> 16 | 0) {
          case 1: {
            r2 = a2 << 16 >> 16 << 3 & 65535;
            break;
          }
          case 2: {
            r2 = a2 << 16 >> 16 << 6 & 65535;
            break;
          }
          case 3: {
            r2 = a2 << 16 >> 16 << 10 & 65535;
            break;
          }
          case 4: {
            r2 = ((a2 & 65535) << 10 | 512) & 65535;
            o2 = 3;
            break;
          }
          default:
            r2 = a2;
        }
        a2 = h2 + (p2 << 1) | 0;
        if (q2 << 16 >> 16 > 0) {
          b[a2 >> 1] = 8191;
          a2 = 32767;
          g2 = (65536 << (o2 << 16 >> 16) >>> 16) + (g2 & 65535) & 65535;
        } else {
          b[a2 >> 1] = -8192;
          a2 = -32768;
        }
        b[_2 + (f2 << 1) >> 1] = a2;
        n2 = (r2 & 65535) + (n2 & 65535) | 0;
        f2 = f2 + 1 | 0;
        if ((f2 | 0) == 4) {
          w2 = n2;
          break;
        }
        a2 = b[X2 + (f2 << 1) >> 1] | 0;
      }
      b[k2 >> 1] = g2;
      t2 = _2 + 2 | 0;
      u2 = _2 + 4 | 0;
      v2 = _2 + 6 | 0;
      a2 = b[_2 >> 1] | 0;
      s2 = 0;
      o2 = d2 + (0 - (x2 << 16 >> 16) << 1) | 0;
      p2 = d2 + (0 - (y2 << 16 >> 16) << 1) | 0;
      q2 = d2 + (0 - (z2 << 16 >> 16) << 1) | 0;
      r2 = d2 + (0 - (A2 << 16 >> 16) << 1) | 0;
      do {
        g2 = Z(b[o2 >> 1] | 0, a2) | 0;
        o2 = o2 + 2 | 0;
        if ((g2 | 0) != 1073741824 ? (ba2 = g2 << 1, !((g2 | 0) > 0 & (ba2 | 0) < 0)) : 0)
          n2 = ba2;
        else {
          c[m2 >> 2] = 1;
          n2 = 2147483647;
        }
        g2 = Z(b[t2 >> 1] | 0, b[p2 >> 1] | 0) | 0;
        p2 = p2 + 2 | 0;
        if ((g2 | 0) != 1073741824) {
          f2 = (g2 << 1) + n2 | 0;
          if ((g2 ^ n2 | 0) > 0 & (f2 ^ n2 | 0) < 0) {
            c[m2 >> 2] = 1;
            f2 = (n2 >>> 31) + 2147483647 | 0;
          }
        } else {
          c[m2 >> 2] = 1;
          f2 = 2147483647;
        }
        g2 = Z(b[u2 >> 1] | 0, b[q2 >> 1] | 0) | 0;
        q2 = q2 + 2 | 0;
        if ((g2 | 0) != 1073741824) {
          n2 = (g2 << 1) + f2 | 0;
          if ((g2 ^ f2 | 0) > 0 & (n2 ^ f2 | 0) < 0) {
            c[m2 >> 2] = 1;
            n2 = (f2 >>> 31) + 2147483647 | 0;
          }
        } else {
          c[m2 >> 2] = 1;
          n2 = 2147483647;
        }
        f2 = Z(b[v2 >> 1] | 0, b[r2 >> 1] | 0) | 0;
        r2 = r2 + 2 | 0;
        if ((f2 | 0) != 1073741824) {
          g2 = (f2 << 1) + n2 | 0;
          if ((f2 ^ n2 | 0) > 0 & (g2 ^ n2 | 0) < 0) {
            c[m2 >> 2] = 1;
            g2 = (n2 >>> 31) + 2147483647 | 0;
          }
        } else {
          c[m2 >> 2] = 1;
          g2 = 2147483647;
        }
        b[j2 + (s2 << 1) >> 1] = Ce(g2, m2) | 0;
        s2 = s2 + 1 | 0;
      } while ((s2 | 0) != 40);
      g2 = w2 & 65535;
      if (((ca2 << 16) + -2621440 | 0) > -1 | $2 ^ 1) {
        i2 = da2;
        return g2 | 0;
      }
      n2 = aa2 >> 16;
      f2 = ca2;
      do {
        a2 = (Z(b[h2 + (f2 - ca2 << 1) >> 1] | 0, n2) | 0) >> 15;
        if ((a2 | 0) > 32767) {
          c[m2 >> 2] = 1;
          a2 = 32767;
        }
        j2 = h2 + (f2 << 1) | 0;
        b[j2 >> 1] = Rd(b[j2 >> 1] | 0, a2 & 65535, m2) | 0;
        f2 = f2 + 1 | 0;
      } while ((f2 & 65535) << 16 >> 16 != 40);
      i2 = da2;
      return g2 | 0;
    }
    function Sb(a2, d2, f2, g2, h2, j2, k2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      j2 = j2 | 0;
      k2 = k2 | 0;
      var l2 = 0, m2 = 0, n2 = 0, o2 = 0, p2 = 0, q2 = 0, r2 = 0, s2 = 0, t2 = 0, u2 = 0, v2 = 0, w2 = 0, x2 = 0, y2 = 0, z2 = 0, A2 = 0, B2 = 0, C2 = 0, D2 = 0, E2 = 0, F2 = 0, G2 = 0, H2 = 0, I2 = 0, J2 = 0, K2 = 0, L2 = 0;
      L2 = i2;
      i2 = i2 + 3440 | 0;
      t2 = L2 + 3424 | 0;
      G2 = L2 + 3408 | 0;
      H2 = L2 + 3240 | 0;
      u2 = L2 + 3224 | 0;
      E2 = L2 + 3328 | 0;
      s2 = L2 + 3248 | 0;
      F2 = L2 + 24 | 0;
      K2 = L2 + 16 | 0;
      J2 = L2;
      gc(f2, a2, E2, 2, 4, 4, k2);
      rd(E2, d2, s2, H2, 4, G2, 4, k2);
      fc(f2, s2, F2, k2);
      pd(8, 4, 4, E2, F2, G2, H2, u2, k2);
      d2 = g2;
      a2 = d2 + 80 | 0;
      do {
        b[d2 >> 1] = 0;
        d2 = d2 + 2 | 0;
      } while ((d2 | 0) < (a2 | 0));
      b[J2 >> 1] = -1;
      b[K2 >> 1] = -1;
      C2 = J2 + 2 | 0;
      b[C2 >> 1] = -1;
      D2 = K2 + 2 | 0;
      b[D2 >> 1] = -1;
      E2 = J2 + 4 | 0;
      b[E2 >> 1] = -1;
      F2 = K2 + 4 | 0;
      b[F2 >> 1] = -1;
      H2 = J2 + 6 | 0;
      b[H2 >> 1] = -1;
      G2 = K2 + 6 | 0;
      b[G2 >> 1] = -1;
      q2 = 0;
      do {
        o2 = b[u2 + (q2 << 1) >> 1] | 0;
        d2 = o2 >>> 2;
        m2 = d2 & 65535;
        a2 = o2 & 3;
        n2 = (b[s2 + (o2 << 1) >> 1] | 0) > 0;
        o2 = g2 + (o2 << 1) | 0;
        r2 = n2 & 1 ^ 1;
        b[o2 >> 1] = (e[o2 >> 1] | 0) + (n2 ? 8191 : 57345);
        b[t2 + (q2 << 1) >> 1] = n2 ? 32767 : -32768;
        n2 = J2 + (a2 << 1) | 0;
        o2 = b[n2 >> 1] | 0;
        do
          if (o2 << 16 >> 16 >= 0) {
            p2 = K2 + (a2 << 1) | 0;
            l2 = (o2 << 16 >> 16 | 0) <= (d2 << 16 >> 16 | 0);
            d2 = J2 + ((a2 | 4) << 1) | 0;
            if ((r2 & 65535 | 0) == (e[p2 >> 1] & 1 | 0))
              if (l2) {
                b[d2 >> 1] = m2;
                break;
              } else {
                b[d2 >> 1] = o2;
                b[n2 >> 1] = m2;
                b[p2 >> 1] = r2;
                break;
              }
            else if (l2) {
              b[d2 >> 1] = o2;
              b[n2 >> 1] = m2;
              b[p2 >> 1] = r2;
              break;
            } else {
              b[d2 >> 1] = m2;
              break;
            }
          } else {
            b[n2 >> 1] = m2;
            b[K2 + (a2 << 1) >> 1] = r2;
          }
        while (0);
        q2 = q2 + 1 | 0;
      } while ((q2 | 0) != 8);
      v2 = t2 + 2 | 0;
      w2 = t2 + 4 | 0;
      x2 = t2 + 6 | 0;
      y2 = t2 + 8 | 0;
      z2 = t2 + 10 | 0;
      A2 = t2 + 12 | 0;
      B2 = t2 + 14 | 0;
      t2 = b[t2 >> 1] | 0;
      q2 = 0;
      p2 = f2 + (0 - (b[u2 >> 1] | 0) << 1) | 0;
      o2 = f2 + (0 - (b[u2 + 2 >> 1] | 0) << 1) | 0;
      n2 = f2 + (0 - (b[u2 + 4 >> 1] | 0) << 1) | 0;
      m2 = f2 + (0 - (b[u2 + 6 >> 1] | 0) << 1) | 0;
      d2 = f2 + (0 - (b[u2 + 8 >> 1] | 0) << 1) | 0;
      a2 = f2 + (0 - (b[u2 + 10 >> 1] | 0) << 1) | 0;
      l2 = f2 + (0 - (b[u2 + 12 >> 1] | 0) << 1) | 0;
      f2 = f2 + (0 - (b[u2 + 14 >> 1] | 0) << 1) | 0;
      do {
        r2 = Z(b[p2 >> 1] | 0, t2) | 0;
        p2 = p2 + 2 | 0;
        if ((r2 | 0) != 1073741824 ? (I2 = r2 << 1, !((r2 | 0) > 0 & (I2 | 0) < 0)) : 0)
          r2 = I2;
        else {
          c[k2 >> 2] = 1;
          r2 = 2147483647;
        }
        s2 = Z(b[v2 >> 1] | 0, b[o2 >> 1] | 0) | 0;
        o2 = o2 + 2 | 0;
        if ((s2 | 0) != 1073741824) {
          g2 = (s2 << 1) + r2 | 0;
          if ((s2 ^ r2 | 0) > 0 & (g2 ^ r2 | 0) < 0) {
            c[k2 >> 2] = 1;
            r2 = (r2 >>> 31) + 2147483647 | 0;
          } else
            r2 = g2;
        } else {
          c[k2 >> 2] = 1;
          r2 = 2147483647;
        }
        s2 = Z(b[w2 >> 1] | 0, b[n2 >> 1] | 0) | 0;
        n2 = n2 + 2 | 0;
        if ((s2 | 0) != 1073741824) {
          g2 = (s2 << 1) + r2 | 0;
          if ((s2 ^ r2 | 0) > 0 & (g2 ^ r2 | 0) < 0) {
            c[k2 >> 2] = 1;
            g2 = (r2 >>> 31) + 2147483647 | 0;
          }
        } else {
          c[k2 >> 2] = 1;
          g2 = 2147483647;
        }
        s2 = Z(b[x2 >> 1] | 0, b[m2 >> 1] | 0) | 0;
        m2 = m2 + 2 | 0;
        if ((s2 | 0) != 1073741824) {
          r2 = (s2 << 1) + g2 | 0;
          if ((s2 ^ g2 | 0) > 0 & (r2 ^ g2 | 0) < 0) {
            c[k2 >> 2] = 1;
            r2 = (g2 >>> 31) + 2147483647 | 0;
          }
        } else {
          c[k2 >> 2] = 1;
          r2 = 2147483647;
        }
        s2 = Z(b[y2 >> 1] | 0, b[d2 >> 1] | 0) | 0;
        d2 = d2 + 2 | 0;
        if ((s2 | 0) != 1073741824) {
          g2 = (s2 << 1) + r2 | 0;
          if ((s2 ^ r2 | 0) > 0 & (g2 ^ r2 | 0) < 0) {
            c[k2 >> 2] = 1;
            g2 = (r2 >>> 31) + 2147483647 | 0;
          }
        } else {
          c[k2 >> 2] = 1;
          g2 = 2147483647;
        }
        s2 = Z(b[z2 >> 1] | 0, b[a2 >> 1] | 0) | 0;
        a2 = a2 + 2 | 0;
        if ((s2 | 0) != 1073741824) {
          r2 = (s2 << 1) + g2 | 0;
          if ((s2 ^ g2 | 0) > 0 & (r2 ^ g2 | 0) < 0) {
            c[k2 >> 2] = 1;
            r2 = (g2 >>> 31) + 2147483647 | 0;
          }
        } else {
          c[k2 >> 2] = 1;
          r2 = 2147483647;
        }
        s2 = Z(b[A2 >> 1] | 0, b[l2 >> 1] | 0) | 0;
        l2 = l2 + 2 | 0;
        if ((s2 | 0) != 1073741824) {
          g2 = (s2 << 1) + r2 | 0;
          if ((s2 ^ r2 | 0) > 0 & (g2 ^ r2 | 0) < 0) {
            c[k2 >> 2] = 1;
            g2 = (r2 >>> 31) + 2147483647 | 0;
          }
        } else {
          c[k2 >> 2] = 1;
          g2 = 2147483647;
        }
        s2 = Z(b[B2 >> 1] | 0, b[f2 >> 1] | 0) | 0;
        f2 = f2 + 2 | 0;
        if ((s2 | 0) != 1073741824) {
          r2 = (s2 << 1) + g2 | 0;
          if ((s2 ^ g2 | 0) > 0 & (r2 ^ g2 | 0) < 0) {
            c[k2 >> 2] = 1;
            r2 = (g2 >>> 31) + 2147483647 | 0;
          }
        } else {
          c[k2 >> 2] = 1;
          r2 = 2147483647;
        }
        b[h2 + (q2 << 1) >> 1] = Ce(r2, k2) | 0;
        q2 = q2 + 1 | 0;
      } while ((q2 | 0) != 40);
      b[j2 >> 1] = b[K2 >> 1] | 0;
      b[j2 + 2 >> 1] = b[D2 >> 1] | 0;
      b[j2 + 4 >> 1] = b[F2 >> 1] | 0;
      b[j2 + 6 >> 1] = b[G2 >> 1] | 0;
      a2 = b[J2 >> 1] | 0;
      d2 = b[J2 + 8 >> 1] | 0;
      l2 = b[C2 >> 1] | 0;
      b[j2 + 8 >> 1] = d2 << 1 & 2 | a2 & 1 | l2 << 2 & 4 | (((d2 >> 1) * 327680 | 0) + (a2 >>> 1 << 16) + (Z(l2 >> 1, 1638400) | 0) | 0) >>> 13 & 65528;
      l2 = b[E2 >> 1] | 0;
      a2 = b[J2 + 12 >> 1] | 0;
      d2 = b[J2 + 10 >> 1] | 0;
      b[j2 + 10 >> 1] = a2 << 1 & 2 | l2 & 1 | d2 << 2 & 4 | (((a2 >> 1) * 327680 | 0) + (l2 >>> 1 << 16) + (Z(d2 >> 1, 1638400) | 0) | 0) >>> 13 & 65528;
      d2 = b[J2 + 14 >> 1] | 0;
      l2 = b[H2 >> 1] | 0;
      a2 = l2 << 16 >> 16 >>> 1;
      if (!(d2 & 2)) {
        h2 = a2;
        k2 = d2 << 16 >> 16;
        K2 = k2 >> 1;
        K2 = K2 * 327680 | 0;
        h2 = h2 << 16;
        K2 = h2 + K2 | 0;
        K2 = K2 << 5;
        K2 = K2 >> 16;
        K2 = K2 | 12;
        K2 = K2 * 2622 | 0;
        K2 = K2 >>> 16;
        h2 = l2 & 65535;
        h2 = h2 & 1;
        k2 = k2 << 17;
        k2 = k2 & 131072;
        K2 = K2 << 18;
        k2 = K2 | k2;
        k2 = k2 >>> 16;
        h2 = k2 | h2;
        h2 = h2 & 65535;
        j2 = j2 + 12 | 0;
        b[j2 >> 1] = h2;
        i2 = L2;
        return;
      }
      h2 = 4 - (a2 << 16 >> 16) | 0;
      k2 = d2 << 16 >> 16;
      K2 = k2 >> 1;
      K2 = K2 * 327680 | 0;
      h2 = h2 << 16;
      K2 = h2 + K2 | 0;
      K2 = K2 << 5;
      K2 = K2 >> 16;
      K2 = K2 | 12;
      K2 = K2 * 2622 | 0;
      K2 = K2 >>> 16;
      h2 = l2 & 65535;
      h2 = h2 & 1;
      k2 = k2 << 17;
      k2 = k2 & 131072;
      K2 = K2 << 18;
      k2 = K2 | k2;
      k2 = k2 >>> 16;
      h2 = k2 | h2;
      h2 = h2 & 65535;
      j2 = j2 + 12 | 0;
      b[j2 >> 1] = h2;
      i2 = L2;
      return;
    }
    function Tb(a2, d2, e2, f2, g2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      var h2 = 0, i3 = 0, j2 = 0, k2 = 0, l2 = 0, m2 = 0, n2 = 0, o2 = 0, p2 = 0, q2 = 0, r2 = 0, s2 = 0, t2 = 0;
      r2 = e2 << 16 >> 16;
      h2 = 0 - r2 | 0;
      e2 = g2 + (h2 << 2) | 0;
      g2 = ((r2 - (f2 << 16 >> 16) | 0) >>> 2) + 1 & 65535;
      if (g2 << 16 >> 16 <= 0)
        return;
      r2 = d2 << 16 >> 16 >>> 1 & 65535;
      if (!(r2 << 16 >> 16)) {
        while (1) {
          c[e2 >> 2] = 0;
          c[e2 + 4 >> 2] = 0;
          c[e2 + 8 >> 2] = 0;
          c[e2 + 12 >> 2] = 0;
          if (g2 << 16 >> 16 > 1) {
            e2 = e2 + 16 | 0;
            g2 = g2 + -1 << 16 >> 16;
          } else
            break;
        }
        return;
      }
      q2 = a2 + (h2 << 1) | 0;
      while (1) {
        l2 = q2 + 4 | 0;
        n2 = b[l2 >> 1] | 0;
        j2 = b[q2 >> 1] | 0;
        m2 = n2;
        k2 = r2;
        o2 = a2;
        p2 = q2;
        q2 = q2 + 8 | 0;
        i3 = 0;
        h2 = 0;
        f2 = 0;
        d2 = 0;
        while (1) {
          t2 = b[o2 >> 1] | 0;
          s2 = (Z(j2 << 16 >> 16, t2) | 0) + i3 | 0;
          i3 = b[p2 + 2 >> 1] | 0;
          h2 = (Z(i3, t2) | 0) + h2 | 0;
          j2 = (Z(m2 << 16 >> 16, t2) | 0) + f2 | 0;
          f2 = b[p2 + 6 >> 1] | 0;
          m2 = (Z(f2, t2) | 0) + d2 | 0;
          d2 = b[o2 + 2 >> 1] | 0;
          i3 = s2 + (Z(d2, i3) | 0) | 0;
          h2 = h2 + (Z(n2 << 16 >> 16, d2) | 0) | 0;
          l2 = l2 + 4 | 0;
          f2 = j2 + (Z(d2, f2) | 0) | 0;
          j2 = b[l2 >> 1] | 0;
          d2 = m2 + (Z(j2 << 16 >> 16, d2) | 0) | 0;
          k2 = k2 + -1 << 16 >> 16;
          if (!(k2 << 16 >> 16))
            break;
          t2 = n2;
          m2 = j2;
          n2 = b[p2 + 8 >> 1] | 0;
          o2 = o2 + 4 | 0;
          p2 = p2 + 4 | 0;
          j2 = t2;
        }
        c[e2 >> 2] = i3 << 1;
        c[e2 + 4 >> 2] = h2 << 1;
        c[e2 + 8 >> 2] = f2 << 1;
        c[e2 + 12 >> 2] = d2 << 1;
        if (g2 << 16 >> 16 <= 1)
          break;
        else {
          e2 = e2 + 16 | 0;
          g2 = g2 + -1 << 16 >> 16;
        }
      }
      return;
    }
    function Ub(a2, d2, f2, g2, h2, j2, k2, l2, m2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      j2 = j2 | 0;
      k2 = k2 | 0;
      l2 = l2 | 0;
      m2 = m2 | 0;
      var n2 = 0, o2 = 0, p2 = 0, q2 = 0, r2 = 0, s2 = 0, t2 = 0, u2 = 0, v2 = 0, w2 = 0, x2 = 0, y2 = 0;
      y2 = i2;
      i2 = i2 + 16 | 0;
      w2 = y2 + 2 | 0;
      x2 = y2;
      do
        if (h2 << 16 >> 16 > 0) {
          s2 = g2 << 16 >> 16;
          u2 = 0;
          p2 = 0;
          g2 = 0;
          o2 = 0;
          t2 = 0;
          while (1) {
            n2 = b[a2 + (u2 << 1) >> 1] | 0;
            q2 = n2 << 16 >> 16;
            p2 = (Z(q2, q2) | 0) + p2 | 0;
            q2 = b[d2 + (u2 << 1) >> 1] | 0;
            g2 = (Z(q2, q2) | 0) + g2 | 0;
            o2 = (Z(b[f2 + (u2 << 1) >> 1] | 0, q2) | 0) + o2 | 0;
            q2 = Z(q2, s2) | 0;
            if ((q2 | 0) == 1073741824) {
              c[m2 >> 2] = 1;
              r2 = 2147483647;
            } else
              r2 = q2 << 1;
            q2 = r2 << 1;
            q2 = (Ge(n2, Ce((q2 >> 1 | 0) == (r2 | 0) ? q2 : r2 >> 31 ^ 2147483647, m2) | 0, m2) | 0) << 16 >> 16;
            q2 = Z(q2, q2) | 0;
            if ((q2 | 0) != 1073741824) {
              n2 = (q2 << 1) + t2 | 0;
              if ((q2 ^ t2 | 0) > 0 & (n2 ^ t2 | 0) < 0) {
                c[m2 >> 2] = 1;
                n2 = (t2 >>> 31) + 2147483647 | 0;
              }
            } else {
              c[m2 >> 2] = 1;
              n2 = 2147483647;
            }
            u2 = u2 + 1 | 0;
            if ((u2 & 65535) << 16 >> 16 == h2 << 16 >> 16) {
              t2 = n2;
              break;
            } else
              t2 = n2;
          }
          p2 = p2 << 1;
          g2 = g2 << 1;
          o2 = o2 << 1;
          if ((p2 | 0) >= 0) {
            if ((p2 | 0) < 400) {
              n2 = t2;
              v2 = 14;
              break;
            }
          } else {
            c[m2 >> 2] = 1;
            p2 = 2147483647;
          }
          r2 = pe(p2) | 0;
          q2 = r2 << 16 >> 16;
          if (r2 << 16 >> 16 > 0) {
            n2 = p2 << q2;
            if ((n2 >> q2 | 0) != (p2 | 0))
              n2 = p2 >> 31 ^ 2147483647;
          } else {
            n2 = 0 - q2 << 16;
            if ((n2 | 0) < 2031616)
              n2 = p2 >> (n2 >> 16);
            else
              n2 = 0;
          }
          b[j2 >> 1] = n2 >>> 16;
          p2 = g2;
          s2 = o2;
          n2 = t2;
          g2 = 15 - (r2 & 65535) & 65535;
        } else {
          g2 = 0;
          o2 = 0;
          n2 = 0;
          v2 = 14;
        }
      while (0);
      if ((v2 | 0) == 14) {
        b[j2 >> 1] = 0;
        p2 = g2;
        s2 = o2;
        g2 = -15;
      }
      b[k2 >> 1] = g2;
      if ((p2 | 0) < 0) {
        c[m2 >> 2] = 1;
        p2 = 2147483647;
      }
      q2 = pe(p2) | 0;
      o2 = q2 << 16 >> 16;
      if (q2 << 16 >> 16 > 0) {
        g2 = p2 << o2;
        if ((g2 >> o2 | 0) != (p2 | 0))
          g2 = p2 >> 31 ^ 2147483647;
      } else {
        g2 = 0 - o2 << 16;
        if ((g2 | 0) < 2031616)
          g2 = p2 >> (g2 >> 16);
        else
          g2 = 0;
      }
      b[j2 + 2 >> 1] = g2 >>> 16;
      b[k2 + 2 >> 1] = 15 - (q2 & 65535);
      p2 = pe(s2) | 0;
      o2 = p2 << 16 >> 16;
      if (p2 << 16 >> 16 > 0) {
        g2 = s2 << o2;
        if ((g2 >> o2 | 0) != (s2 | 0))
          g2 = s2 >> 31 ^ 2147483647;
      } else {
        g2 = 0 - o2 << 16;
        if ((g2 | 0) < 2031616)
          g2 = s2 >> (g2 >> 16);
        else
          g2 = 0;
      }
      b[j2 + 4 >> 1] = g2 >>> 16;
      b[k2 + 4 >> 1] = 2 - (p2 & 65535);
      p2 = pe(n2) | 0;
      g2 = p2 << 16 >> 16;
      if (p2 << 16 >> 16 > 0) {
        o2 = n2 << g2;
        if ((o2 >> g2 | 0) != (n2 | 0))
          o2 = n2 >> 31 ^ 2147483647;
      } else {
        g2 = 0 - g2 << 16;
        if ((g2 | 0) < 2031616)
          o2 = n2 >> (g2 >> 16);
        else
          o2 = 0;
      }
      g2 = o2 >>> 16 & 65535;
      n2 = 15 - (p2 & 65535) & 65535;
      b[j2 + 6 >> 1] = g2;
      b[k2 + 6 >> 1] = n2;
      if ((o2 >> 16 | 0) <= 0) {
        m2 = 0;
        b[l2 >> 1] = m2;
        i2 = y2;
        return;
      }
      o2 = b[j2 >> 1] | 0;
      if (!(o2 << 16 >> 16)) {
        m2 = 0;
        b[l2 >> 1] = m2;
        i2 = y2;
        return;
      }
      g2 = Td(De(o2, 1, m2) | 0, g2) | 0;
      g2 = (g2 & 65535) << 16;
      o2 = ((Ge(n2, b[k2 >> 1] | 0, m2) | 0) & 65535) + 3 | 0;
      n2 = o2 & 65535;
      o2 = o2 << 16 >> 16;
      if (n2 << 16 >> 16 > 0)
        n2 = n2 << 16 >> 16 < 31 ? g2 >> o2 : 0;
      else {
        k2 = 0 - o2 << 16 >> 16;
        n2 = g2 << k2;
        n2 = (n2 >> k2 | 0) == (g2 | 0) ? n2 : g2 >> 31 ^ 2147483647;
      }
      de(n2, w2, x2, m2);
      x2 = Ic((e[w2 >> 1] | 0) + 65509 & 65535, b[x2 >> 1] | 0, m2) | 0;
      w2 = x2 << 13;
      m2 = Ce((w2 >> 13 | 0) == (x2 | 0) ? w2 : x2 >> 31 ^ 2147483647, m2) | 0;
      b[l2 >> 1] = m2;
      i2 = y2;
      return;
    }
    function Vb(a2, d2, f2, g2, h2, j2, k2, l2, m2, n2, o2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      j2 = j2 | 0;
      k2 = k2 | 0;
      l2 = l2 | 0;
      m2 = m2 | 0;
      n2 = n2 | 0;
      o2 = o2 | 0;
      var p2 = 0, q2 = 0, r2 = 0, s2 = 0, t2 = 0, u2 = 0, v2 = 0, w2 = 0, x2 = 0, y2 = 0;
      y2 = i2;
      i2 = i2 + 80 | 0;
      v2 = y2;
      b[k2 >> 1] = b[j2 >> 1] | 0;
      b[l2 >> 1] = b[j2 + 2 >> 1] | 0;
      r2 = b[j2 + 4 >> 1] | 0;
      if (r2 << 16 >> 16 == -32768)
        r2 = 32767;
      else
        r2 = 0 - (r2 & 65535) & 65535;
      b[k2 + 2 >> 1] = r2;
      b[l2 + 2 >> 1] = (e[j2 + 6 >> 1] | 0) + 1;
      switch (a2 | 0) {
        case 0:
        case 5: {
          u2 = 0;
          q2 = 0;
          p2 = 0;
          t2 = 0;
          break;
        }
        default: {
          u2 = 0;
          q2 = 1;
          p2 = 1;
          t2 = 1;
        }
      }
      while (1) {
        s2 = (b[h2 + (u2 << 1) >> 1] | 0) >>> 3;
        b[v2 + (u2 << 1) >> 1] = s2;
        s2 = s2 << 16 >> 16;
        r2 = Z(s2, s2) | 0;
        if ((r2 | 0) != 1073741824) {
          j2 = (r2 << 1) + q2 | 0;
          if ((r2 ^ q2 | 0) > 0 & (j2 ^ q2 | 0) < 0) {
            c[o2 >> 2] = 1;
            q2 = (q2 >>> 31) + 2147483647 | 0;
          } else
            q2 = j2;
        } else {
          c[o2 >> 2] = 1;
          q2 = 2147483647;
        }
        r2 = Z(b[d2 + (u2 << 1) >> 1] | 0, s2) | 0;
        if ((r2 | 0) != 1073741824) {
          j2 = (r2 << 1) + p2 | 0;
          if ((r2 ^ p2 | 0) > 0 & (j2 ^ p2 | 0) < 0) {
            c[o2 >> 2] = 1;
            p2 = (p2 >>> 31) + 2147483647 | 0;
          } else
            p2 = j2;
        } else {
          c[o2 >> 2] = 1;
          p2 = 2147483647;
        }
        r2 = Z(b[g2 + (u2 << 1) >> 1] | 0, s2) | 0;
        if ((r2 | 0) != 1073741824) {
          j2 = (r2 << 1) + t2 | 0;
          if ((r2 ^ t2 | 0) > 0 & (j2 ^ t2 | 0) < 0) {
            c[o2 >> 2] = 1;
            j2 = (t2 >>> 31) + 2147483647 | 0;
          }
        } else {
          c[o2 >> 2] = 1;
          j2 = 2147483647;
        }
        u2 = u2 + 1 | 0;
        if ((u2 | 0) == 40) {
          g2 = j2;
          s2 = p2;
          break;
        } else
          t2 = j2;
      }
      p2 = pe(q2) | 0;
      j2 = p2 << 16 >> 16;
      if (p2 << 16 >> 16 > 0) {
        r2 = q2 << j2;
        if ((r2 >> j2 | 0) != (q2 | 0))
          r2 = q2 >> 31 ^ 2147483647;
      } else {
        r2 = 0 - j2 << 16;
        if ((r2 | 0) < 2031616)
          r2 = q2 >> (r2 >> 16);
        else
          r2 = 0;
      }
      h2 = k2 + 4 | 0;
      b[h2 >> 1] = r2 >>> 16;
      d2 = l2 + 4 | 0;
      b[d2 >> 1] = -3 - (p2 & 65535);
      q2 = pe(s2) | 0;
      j2 = q2 << 16 >> 16;
      if (q2 << 16 >> 16 > 0) {
        r2 = s2 << j2;
        if ((r2 >> j2 | 0) != (s2 | 0))
          r2 = s2 >> 31 ^ 2147483647;
      } else {
        r2 = 0 - j2 << 16;
        if ((r2 | 0) < 2031616)
          r2 = s2 >> (r2 >> 16);
        else
          r2 = 0;
      }
      j2 = r2 >>> 16;
      b[k2 + 6 >> 1] = (j2 | 0) == 32768 ? 32767 : 0 - j2 & 65535;
      b[l2 + 6 >> 1] = 7 - (q2 & 65535);
      q2 = pe(g2) | 0;
      j2 = q2 << 16 >> 16;
      if (q2 << 16 >> 16 > 0) {
        r2 = g2 << j2;
        if ((r2 >> j2 | 0) != (g2 | 0))
          r2 = g2 >> 31 ^ 2147483647;
      } else {
        r2 = 0 - j2 << 16;
        if ((r2 | 0) < 2031616)
          r2 = g2 >> (r2 >> 16);
        else
          r2 = 0;
      }
      b[k2 + 8 >> 1] = r2 >>> 16;
      b[l2 + 8 >> 1] = 7 - (q2 & 65535);
      switch (a2 | 0) {
        case 0:
        case 5: {
          r2 = 0;
          p2 = 0;
          break;
        }
        default: {
          i2 = y2;
          return;
        }
      }
      do {
        p2 = (Z(b[v2 + (r2 << 1) >> 1] | 0, b[f2 + (r2 << 1) >> 1] | 0) | 0) + p2 | 0;
        r2 = r2 + 1 | 0;
      } while ((r2 | 0) != 40);
      j2 = p2 << 1;
      r2 = pe(j2) | 0;
      q2 = r2 << 16 >> 16;
      if (r2 << 16 >> 16 > 0) {
        p2 = j2 << q2;
        if ((p2 >> q2 | 0) == (j2 | 0)) {
          w2 = p2;
          x2 = 40;
        } else {
          w2 = j2 >> 31 ^ 2147483647;
          x2 = 40;
        }
      } else {
        p2 = 0 - q2 << 16;
        if ((p2 | 0) < 2031616) {
          w2 = j2 >> (p2 >> 16);
          x2 = 40;
        }
      }
      if ((x2 | 0) == 40 ? (w2 >> 16 | 0) >= 1 : 0) {
        o2 = De(w2 >>> 16 & 65535, 1, o2) | 0;
        b[m2 >> 1] = Td(o2, b[h2 >> 1] | 0) | 0;
        b[n2 >> 1] = 65528 - (r2 & 65535) - (e[d2 >> 1] | 0);
        i2 = y2;
        return;
      }
      b[m2 >> 1] = 0;
      b[n2 >> 1] = 0;
      i2 = y2;
      return;
    }
    function Wb(a2, d2, e2, f2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      var g2 = 0, h2 = 0, i3 = 0;
      h2 = 0;
      g2 = 0;
      do {
        i3 = b[a2 + (h2 << 1) >> 1] | 0;
        g2 = (Z(i3, i3) | 0) + g2 | 0;
        h2 = h2 + 1 | 0;
      } while ((h2 | 0) != 40);
      if ((g2 | 0) < 0) {
        c[f2 >> 2] = 1;
        g2 = 2147483647;
      }
      f2 = pe(g2) | 0;
      a2 = f2 << 16 >> 16;
      if (f2 << 16 >> 16 > 0) {
        h2 = g2 << a2;
        if ((h2 >> a2 | 0) == (g2 | 0))
          g2 = h2;
        else
          g2 = g2 >> 31 ^ 2147483647;
      } else {
        a2 = 0 - a2 << 16;
        if ((a2 | 0) < 2031616)
          g2 = g2 >> (a2 >> 16);
        else
          g2 = 0;
      }
      b[e2 >> 1] = g2 >>> 16;
      b[d2 >> 1] = 16 - (f2 & 65535);
      return;
    }
    function Xb(a2, d2, e2, f2, g2, h2, j2, k2, l2, m2, n2, o2, p2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      j2 = j2 | 0;
      k2 = k2 | 0;
      l2 = l2 | 0;
      m2 = m2 | 0;
      n2 = n2 | 0;
      o2 = o2 | 0;
      p2 = p2 | 0;
      var q2 = 0, r2 = 0, s2 = 0, t2 = 0;
      r2 = i2;
      i2 = i2 + 16 | 0;
      q2 = r2;
      if (m2 >>> 0 < 2) {
        j2 = Nb(n2, a2, d2, e2, f2, j2, k2, q2, c[o2 + 76 >> 2] | 0, p2) | 0;
        p2 = c[l2 >> 2] | 0;
        b[p2 >> 1] = j2;
        j2 = b[q2 >> 1] | 0;
        c[l2 >> 2] = p2 + 4;
        b[p2 + 2 >> 1] = j2;
        i2 = r2;
        return;
      }
      switch (m2 | 0) {
        case 2: {
          j2 = Mb(a2, d2, e2, f2, j2, k2, q2, p2) | 0;
          p2 = c[l2 >> 2] | 0;
          b[p2 >> 1] = j2;
          j2 = b[q2 >> 1] | 0;
          c[l2 >> 2] = p2 + 4;
          b[p2 + 2 >> 1] = j2;
          i2 = r2;
          return;
        }
        case 3: {
          j2 = Qb(a2, d2, e2, f2, j2, k2, q2, p2) | 0;
          p2 = c[l2 >> 2] | 0;
          b[p2 >> 1] = j2;
          j2 = b[q2 >> 1] | 0;
          c[l2 >> 2] = p2 + 4;
          b[p2 + 2 >> 1] = j2;
          i2 = r2;
          return;
        }
        default: {
          if ((m2 & -2 | 0) == 4) {
            j2 = Rb(a2, d2, e2, f2, j2, k2, q2, c[o2 + 36 >> 2] | 0, p2) | 0;
            p2 = c[l2 >> 2] | 0;
            b[p2 >> 1] = j2;
            j2 = b[q2 >> 1] | 0;
            c[l2 >> 2] = p2 + 4;
            b[p2 + 2 >> 1] = j2;
            i2 = r2;
            return;
          }
          if ((m2 | 0) != 6) {
            n2 = g2 << 16 >> 16;
            n2 = (n2 << 17 >> 17 | 0) == (n2 | 0) ? n2 << 1 : n2 >>> 15 ^ 32767;
            g2 = e2 << 16 >> 16 < 40;
            if (!g2) {
              Lb(a2, h2, d2, j2, k2, c[l2 >> 2] | 0, c[o2 + 36 >> 2] | 0, p2);
              c[l2 >> 2] = (c[l2 >> 2] | 0) + 20;
              i2 = r2;
              return;
            }
            q2 = e2 << 16 >> 16;
            m2 = n2 << 16 >> 16;
            f2 = q2;
            do {
              t2 = (Z(b[d2 + (f2 - q2 << 1) >> 1] | 0, m2) | 0) >>> 15 & 65535;
              s2 = d2 + (f2 << 1) | 0;
              b[s2 >> 1] = Rd(b[s2 >> 1] | 0, t2, p2) | 0;
              f2 = f2 + 1 | 0;
            } while ((f2 & 65535) << 16 >> 16 != 40);
            Lb(a2, h2, d2, j2, k2, c[l2 >> 2] | 0, c[o2 + 36 >> 2] | 0, p2);
            c[l2 >> 2] = (c[l2 >> 2] | 0) + 20;
            if (!g2) {
              i2 = r2;
              return;
            }
            g2 = e2 << 16 >> 16;
            m2 = n2 << 16 >> 16;
            q2 = g2;
            do {
              f2 = (Z(b[j2 + (q2 - g2 << 1) >> 1] | 0, m2) | 0) >> 15;
              if ((f2 | 0) > 32767) {
                c[p2 >> 2] = 1;
                f2 = 32767;
              }
              t2 = j2 + (q2 << 1) | 0;
              b[t2 >> 1] = Rd(b[t2 >> 1] | 0, f2 & 65535, p2) | 0;
              q2 = q2 + 1 | 0;
            } while ((q2 & 65535) << 16 >> 16 != 40);
            i2 = r2;
            return;
          }
          o2 = f2 << 16 >> 16;
          o2 = (o2 << 17 >> 17 | 0) == (o2 | 0) ? o2 << 1 : o2 >>> 15 ^ 32767;
          n2 = e2 << 16 >> 16 < 40;
          if (!n2) {
            Sb(a2, h2, d2, j2, k2, c[l2 >> 2] | 0, p2);
            c[l2 >> 2] = (c[l2 >> 2] | 0) + 14;
            i2 = r2;
            return;
          }
          q2 = e2 << 16 >> 16;
          m2 = o2 << 16 >> 16;
          f2 = q2;
          do {
            g2 = (Z(b[d2 + (f2 - q2 << 1) >> 1] | 0, m2) | 0) >> 15;
            if ((g2 | 0) > 32767) {
              c[p2 >> 2] = 1;
              g2 = 32767;
            }
            t2 = d2 + (f2 << 1) | 0;
            b[t2 >> 1] = Rd(b[t2 >> 1] | 0, g2 & 65535, p2) | 0;
            f2 = f2 + 1 | 0;
          } while ((f2 & 65535) << 16 >> 16 != 40);
          Sb(a2, h2, d2, j2, k2, c[l2 >> 2] | 0, p2);
          c[l2 >> 2] = (c[l2 >> 2] | 0) + 14;
          if (!n2) {
            i2 = r2;
            return;
          }
          g2 = e2 << 16 >> 16;
          m2 = o2 << 16 >> 16;
          q2 = g2;
          do {
            f2 = (Z(b[j2 + (q2 - g2 << 1) >> 1] | 0, m2) | 0) >> 15;
            if ((f2 | 0) > 32767) {
              c[p2 >> 2] = 1;
              f2 = 32767;
            }
            t2 = j2 + (q2 << 1) | 0;
            b[t2 >> 1] = Rd(b[t2 >> 1] | 0, f2 & 65535, p2) | 0;
            q2 = q2 + 1 | 0;
          } while ((q2 & 65535) << 16 >> 16 != 40);
          i2 = r2;
          return;
        }
      }
    }
    function Yb(a2) {
      a2 = a2 | 0;
      var b2 = 0;
      if (!a2) {
        a2 = -1;
        return a2 | 0;
      }
      c[a2 >> 2] = 0;
      b2 = Je(4) | 0;
      if (!b2) {
        a2 = -1;
        return a2 | 0;
      }
      if (!((Uc(b2) | 0) << 16 >> 16)) {
        Vc(c[b2 >> 2] | 0) | 0;
        c[a2 >> 2] = b2;
        a2 = 0;
        return a2 | 0;
      } else {
        Wc(b2);
        Ke(b2);
        a2 = -1;
        return a2 | 0;
      }
    }
    function Zb(a2) {
      a2 = a2 | 0;
      var b2 = 0;
      if (!a2)
        return;
      b2 = c[a2 >> 2] | 0;
      if (!b2)
        return;
      Wc(b2);
      Ke(c[a2 >> 2] | 0);
      c[a2 >> 2] = 0;
      return;
    }
    function _b(a2) {
      a2 = a2 | 0;
      if (!a2) {
        a2 = -1;
        return a2 | 0;
      }
      Vc(c[a2 >> 2] | 0) | 0;
      a2 = 0;
      return a2 | 0;
    }
    function $b(a2, d2, f2, g2, h2, j2, k2, l2, m2, n2, o2, p2, q2, r2, s2, t2, u2, v2, w2, x2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      j2 = j2 | 0;
      k2 = k2 | 0;
      l2 = l2 | 0;
      m2 = m2 | 0;
      n2 = n2 | 0;
      o2 = o2 | 0;
      p2 = p2 | 0;
      q2 = q2 | 0;
      r2 = r2 | 0;
      s2 = s2 | 0;
      t2 = t2 | 0;
      u2 = u2 | 0;
      v2 = v2 | 0;
      w2 = w2 | 0;
      x2 = x2 | 0;
      var y2 = 0, z2 = 0, A2 = 0, B2 = 0;
      z2 = i2;
      i2 = i2 + 16 | 0;
      B2 = z2 + 2 | 0;
      A2 = z2;
      b[q2 >> 1] = Xc(c[a2 >> 2] | 0, f2, h2, k2, m2, j2, 40, g2, r2, A2, B2, x2) | 0;
      a2 = b[B2 >> 1] | 0;
      g2 = c[u2 >> 2] | 0;
      c[u2 >> 2] = g2 + 2;
      b[g2 >> 1] = a2;
      se(k2, b[q2 >> 1] | 0, b[r2 >> 1] | 0, 40, b[A2 >> 1] | 0, x2);
      ec(k2, j2, p2, 40);
      b[s2 >> 1] = Dc(f2, m2, p2, t2, 40, x2) | 0;
      b[v2 >> 1] = 32767;
      if (n2 << 16 >> 16 != 0 ? (y2 = b[s2 >> 1] | 0, y2 << 16 >> 16 > 15565) : 0)
        y2 = Ed(d2, y2, x2) | 0;
      else
        y2 = 0;
      if (f2 >>> 0 < 2) {
        B2 = b[s2 >> 1] | 0;
        b[s2 >> 1] = B2 << 16 >> 16 > 13926 ? 13926 : B2;
        if (y2 << 16 >> 16)
          b[v2 >> 1] = 15565;
      } else {
        if (y2 << 16 >> 16) {
          b[v2 >> 1] = 15565;
          b[s2 >> 1] = 15565;
        }
        if ((f2 | 0) == 7) {
          A2 = nd(7, b[v2 >> 1] | 0, s2, 0, 0, w2, x2) | 0;
          B2 = c[u2 >> 2] | 0;
          c[u2 >> 2] = B2 + 2;
          b[B2 >> 1] = A2;
        }
      }
      q2 = b[s2 >> 1] | 0;
      y2 = 0;
      while (1) {
        A2 = Z(b[p2 >> 1] | 0, q2) | 0;
        b[o2 >> 1] = (e[m2 >> 1] | 0) - (A2 >>> 14);
        A2 = (Z(b[k2 >> 1] | 0, q2) | 0) >>> 14;
        B2 = l2 + (y2 << 1) | 0;
        b[B2 >> 1] = (e[B2 >> 1] | 0) - A2;
        y2 = y2 + 1 | 0;
        if ((y2 | 0) == 40)
          break;
        else {
          k2 = k2 + 2 | 0;
          m2 = m2 + 2 | 0;
          o2 = o2 + 2 | 0;
          p2 = p2 + 2 | 0;
        }
      }
      i2 = z2;
      return;
    }
    function ac(a2, b2) {
      a2 = a2 | 0;
      b2 = b2 | 0;
      var d2 = 0, e2 = 0, f2 = 0, g2 = 0;
      g2 = i2;
      i2 = i2 + 16 | 0;
      f2 = g2;
      if (!a2) {
        a2 = -1;
        i2 = g2;
        return a2 | 0;
      }
      c[a2 >> 2] = 0;
      d2 = Je(2532) | 0;
      c[f2 >> 2] = d2;
      if (!d2) {
        a2 = -1;
        i2 = g2;
        return a2 | 0;
      }
      Yd(d2 + 2392 | 0);
      c[d2 + 2188 >> 2] = 0;
      c[(c[f2 >> 2] | 0) + 2192 >> 2] = 0;
      c[(c[f2 >> 2] | 0) + 2196 >> 2] = 0;
      c[(c[f2 >> 2] | 0) + 2200 >> 2] = 0;
      c[(c[f2 >> 2] | 0) + 2204 >> 2] = 0;
      c[(c[f2 >> 2] | 0) + 2208 >> 2] = 0;
      c[(c[f2 >> 2] | 0) + 2212 >> 2] = 0;
      c[(c[f2 >> 2] | 0) + 2220 >> 2] = 0;
      e2 = c[f2 >> 2] | 0;
      c[e2 + 2216 >> 2] = b2;
      c[e2 + 2528 >> 2] = 0;
      d2 = e2;
      if ((((((((Yb(e2 + 2196 | 0) | 0) << 16 >> 16 == 0 ? (ie(e2 + 2192 | 0) | 0) << 16 >> 16 == 0 : 0) ? (yc(e2 + 2200 | 0) | 0) << 16 >> 16 == 0 : 0) ? (_c(e2 + 2204 | 0) | 0) << 16 >> 16 == 0 : 0) ? (Ad(e2 + 2208 | 0) | 0) << 16 >> 16 == 0 : 0) ? (Gd(e2 + 2212 | 0) | 0) << 16 >> 16 == 0 : 0) ? (jc(e2 + 2220 | 0, c[e2 + 2432 >> 2] | 0) | 0) << 16 >> 16 == 0 : 0) ? (Pc(e2 + 2188 | 0) | 0) << 16 >> 16 == 0 : 0) {
        cc(e2) | 0;
        c[a2 >> 2] = d2;
        a2 = 0;
        i2 = g2;
        return a2 | 0;
      }
      bc(f2);
      a2 = -1;
      i2 = g2;
      return a2 | 0;
    }
    function bc(a2) {
      a2 = a2 | 0;
      var b2 = 0;
      if (!a2)
        return;
      b2 = c[a2 >> 2] | 0;
      if (!b2)
        return;
      Qc(b2 + 2188 | 0);
      ke((c[a2 >> 2] | 0) + 2192 | 0);
      zc((c[a2 >> 2] | 0) + 2200 | 0);
      Zb((c[a2 >> 2] | 0) + 2196 | 0);
      ad((c[a2 >> 2] | 0) + 2204 | 0);
      Cd((c[a2 >> 2] | 0) + 2208 | 0);
      Id((c[a2 >> 2] | 0) + 2212 | 0);
      lc((c[a2 >> 2] | 0) + 2220 | 0);
      Ke(c[a2 >> 2] | 0);
      c[a2 >> 2] = 0;
      return;
    }
    function cc(a2) {
      a2 = a2 | 0;
      var d2 = 0, e2 = 0, f2 = 0, g2 = 0;
      if (!a2) {
        g2 = -1;
        return g2 | 0;
      }
      c[a2 + 652 >> 2] = a2 + 320;
      c[a2 + 640 >> 2] = a2 + 240;
      c[a2 + 644 >> 2] = a2 + 160;
      c[a2 + 648 >> 2] = a2 + 80;
      c[a2 + 1264 >> 2] = a2 + 942;
      c[a2 + 1912 >> 2] = a2 + 1590;
      f2 = a2 + 1938 | 0;
      c[a2 + 2020 >> 2] = f2;
      c[a2 + 2384 >> 2] = a2 + 2304;
      d2 = a2 + 2028 | 0;
      c[a2 + 2024 >> 2] = a2 + 2108;
      c[a2 + 2528 >> 2] = 0;
      Qe(a2 | 0, 0, 640) | 0;
      Qe(a2 + 1282 | 0, 0, 308) | 0;
      Qe(a2 + 656 | 0, 0, 286) | 0;
      e2 = a2 + 2224 | 0;
      g2 = f2 + 80 | 0;
      do {
        b[f2 >> 1] = 0;
        f2 = f2 + 2 | 0;
      } while ((f2 | 0) < (g2 | 0));
      f2 = d2;
      g2 = f2 + 80 | 0;
      do {
        b[f2 >> 1] = 0;
        f2 = f2 + 2 | 0;
      } while ((f2 | 0) < (g2 | 0));
      d2 = a2 + 1268 | 0;
      f2 = e2;
      g2 = f2 + 80 | 0;
      do {
        b[f2 >> 1] = 0;
        f2 = f2 + 2 | 0;
      } while ((f2 | 0) < (g2 | 0));
      b[d2 >> 1] = 40;
      b[a2 + 1270 >> 1] = 40;
      b[a2 + 1272 >> 1] = 40;
      b[a2 + 1274 >> 1] = 40;
      b[a2 + 1276 >> 1] = 40;
      Rc(c[a2 + 2188 >> 2] | 0) | 0;
      je(c[a2 + 2192 >> 2] | 0) | 0;
      _b(c[a2 + 2196 >> 2] | 0) | 0;
      Ac(c[a2 + 2200 >> 2] | 0) | 0;
      $c(c[a2 + 2204 >> 2] | 0) | 0;
      Bd(c[a2 + 2208 >> 2] | 0) | 0;
      Hd(c[a2 + 2212 >> 2] | 0) | 0;
      kc(c[a2 + 2220 >> 2] | 0, c[a2 + 2432 >> 2] | 0) | 0;
      b[a2 + 2388 >> 1] = 0;
      g2 = 0;
      return g2 | 0;
    }
    function dc(a2, d2, e2, f2, g2, h2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      var j2 = 0, k2 = 0, l2 = 0, m2 = 0, n2 = 0, o2 = 0, p2 = 0, q2 = 0, r2 = 0, s2 = 0, t2 = 0, u2 = 0, v2 = 0, w2 = 0, x2 = 0, y2 = 0, z2 = 0, A2 = 0, B2 = 0, C2 = 0, D2 = 0, E2 = 0, F2 = 0, G2 = 0, H2 = 0, I2 = 0, J2 = 0, K2 = 0, L2 = 0, M2 = 0, N2 = 0, O2 = 0, P2 = 0, Q2 = 0, R2 = 0, S2 = 0, T2 = 0, U2 = 0, V2 = 0, W2 = 0, X2 = 0, Y2 = 0, Z2 = 0, _2 = 0, $2 = 0, aa2 = 0, ba2 = 0, ca2 = 0, da2 = 0, ea2 = 0, fa2 = 0, ga2 = 0, ha2 = 0, ia2 = 0, ja2 = 0, ka2 = 0, la2 = 0, ma2 = 0, na2 = 0, oa2 = 0, pa2 = 0, qa2 = 0;
      qa2 = i2;
      i2 = i2 + 1184 | 0;
      T2 = qa2;
      n2 = qa2 + 1096 | 0;
      o2 = qa2 + 1008 | 0;
      l2 = qa2 + 904 | 0;
      ka2 = qa2 + 928 | 0;
      la2 = qa2 + 824 | 0;
      X2 = qa2 + 744 | 0;
      na2 = qa2 + 664 | 0;
      oa2 = qa2 + 584 | 0;
      Z2 = qa2 + 328 | 0;
      ha2 = qa2 + 504 | 0;
      ia2 = qa2 + 424 | 0;
      ma2 = qa2 + 344 | 0;
      pa2 = qa2 + 248 | 0;
      Y2 = qa2 + 168 | 0;
      da2 = qa2 + 88 | 0;
      fa2 = qa2 + 68 | 0;
      ga2 = qa2 + 48 | 0;
      ea2 = qa2 + 28 | 0;
      ja2 = qa2 + 24 | 0;
      ba2 = qa2 + 22 | 0;
      $2 = qa2 + 20 | 0;
      W2 = qa2 + 16 | 0;
      U2 = qa2 + 12 | 0;
      V2 = qa2 + 10 | 0;
      aa2 = qa2 + 8 | 0;
      _2 = qa2 + 6 | 0;
      ca2 = qa2 + 4 | 0;
      c[T2 >> 2] = f2;
      S2 = a2 + 2528 | 0;
      j2 = a2 + 652 | 0;
      Oe(c[j2 >> 2] | 0, e2 | 0, 320) | 0;
      c[g2 >> 2] = d2;
      m2 = a2 + 2216 | 0;
      if (!(c[m2 >> 2] | 0)) {
        e2 = a2 + 2220 | 0;
        f2 = 0;
      } else {
        f2 = Nd(c[a2 + 2212 >> 2] | 0, c[j2 >> 2] | 0, S2) | 0;
        R2 = a2 + 2220 | 0;
        e2 = R2;
        f2 = oc(c[R2 >> 2] | 0, f2, g2, S2) | 0;
      }
      R2 = a2 + 2392 | 0;
      Sc(c[a2 + 2188 >> 2] | 0, d2, c[a2 + 644 >> 2] | 0, c[a2 + 648 >> 2] | 0, n2, R2, S2);
      k2 = a2 + 2192 | 0;
      le(c[k2 >> 2] | 0, d2, c[g2 >> 2] | 0, n2, o2, l2, T2, S2);
      nc(c[e2 >> 2] | 0, l2, c[j2 >> 2] | 0, S2);
      if ((c[g2 >> 2] | 0) == 8) {
        mc(c[e2 >> 2] | 0, f2, c[(c[k2 >> 2] | 0) + 40 >> 2] | 0, (c[a2 + 2200 >> 2] | 0) + 32 | 0, T2, S2);
        Qe(a2 + 1282 | 0, 0, 308) | 0;
        j2 = a2 + 2244 | 0;
        q2 = j2 + 20 | 0;
        do {
          b[j2 >> 1] = 0;
          j2 = j2 + 2 | 0;
        } while ((j2 | 0) < (q2 | 0));
        j2 = a2 + 2284 | 0;
        q2 = j2 + 20 | 0;
        do {
          b[j2 >> 1] = 0;
          j2 = j2 + 2 | 0;
        } while ((j2 | 0) < (q2 | 0));
        j2 = c[a2 + 2020 >> 2] | 0;
        q2 = j2 + 80 | 0;
        do {
          b[j2 >> 1] = 0;
          j2 = j2 + 2 | 0;
        } while ((j2 | 0) < (q2 | 0));
        j2 = a2 + 2028 | 0;
        q2 = j2 + 80 | 0;
        do {
          b[j2 >> 1] = 0;
          j2 = j2 + 2 | 0;
        } while ((j2 | 0) < (q2 | 0));
        je(c[k2 >> 2] | 0) | 0;
        j2 = c[k2 >> 2] | 0;
        e2 = l2;
        q2 = j2 + 20 | 0;
        do {
          b[j2 >> 1] = b[e2 >> 1] | 0;
          j2 = j2 + 2 | 0;
          e2 = e2 + 2 | 0;
        } while ((j2 | 0) < (q2 | 0));
        j2 = (c[k2 >> 2] | 0) + 20 | 0;
        e2 = l2;
        q2 = j2 + 20 | 0;
        do {
          b[j2 >> 1] = b[e2 >> 1] | 0;
          j2 = j2 + 2 | 0;
          e2 = e2 + 2 | 0;
        } while ((j2 | 0) < (q2 | 0));
        _b(c[a2 + 2196 >> 2] | 0) | 0;
        b[a2 + 2388 >> 1] = 0;
        Q2 = 0;
      } else
        Q2 = Dd(c[a2 + 2208 >> 2] | 0, c[k2 >> 2] | 0, S2) | 0;
      N2 = a2 + 640 | 0;
      k2 = a2 + 2264 | 0;
      j2 = a2 + 1264 | 0;
      e2 = a2 + 2204 | 0;
      f2 = a2 + 2212 | 0;
      O2 = a2 + 1268 | 0;
      P2 = a2 + 1278 | 0;
      cd(d2, 2842, 2862, 2882, n2, 0, c[N2 >> 2] | 0, k2, c[j2 >> 2] | 0, S2);
      if (d2 >>> 0 > 1) {
        Tc(c[e2 >> 2] | 0, c[f2 >> 2] | 0, d2, c[j2 >> 2] | 0, W2, O2, P2, 0, c[m2 >> 2] | 0, S2);
        cd(d2, 2842, 2862, 2882, n2, 80, c[N2 >> 2] | 0, k2, c[j2 >> 2] | 0, S2);
        Tc(c[e2 >> 2] | 0, c[f2 >> 2] | 0, d2, (c[j2 >> 2] | 0) + 160 | 0, W2 + 2 | 0, O2, P2, 1, c[m2 >> 2] | 0, S2);
      } else {
        cd(d2, 2842, 2862, 2882, n2, 80, c[N2 >> 2] | 0, k2, c[j2 >> 2] | 0, S2);
        Tc(c[e2 >> 2] | 0, c[f2 >> 2] | 0, d2, c[j2 >> 2] | 0, W2, O2, P2, 1, c[m2 >> 2] | 0, S2);
        b[W2 + 2 >> 1] = b[W2 >> 1] | 0;
      }
      if (c[m2 >> 2] | 0)
        Md(c[f2 >> 2] | 0, W2, S2);
      if ((c[g2 >> 2] | 0) == 8) {
        oa2 = a2 + 656 | 0;
        pa2 = a2 + 976 | 0;
        Oe(oa2 | 0, pa2 | 0, 286) | 0;
        pa2 = a2 + 320 | 0;
        Oe(a2 | 0, pa2 | 0, 320) | 0;
        i2 = qa2;
        return 0;
      }
      z2 = a2 + 2224 | 0;
      A2 = a2 + 2244 | 0;
      B2 = a2 + 2284 | 0;
      C2 = a2 + 2388 | 0;
      D2 = a2 + 2020 | 0;
      E2 = a2 + 1916 | 0;
      F2 = a2 + 1912 | 0;
      G2 = a2 + 2024 | 0;
      H2 = a2 + 2384 | 0;
      I2 = a2 + 2196 | 0;
      J2 = a2 + 2208 | 0;
      K2 = a2 + 2464 | 0;
      L2 = a2 + 2200 | 0;
      M2 = a2 + 2224 | 0;
      w2 = a2 + 2244 | 0;
      x2 = a2 + 1270 | 0;
      y2 = a2 + 1280 | 0;
      v2 = 0;
      m2 = 0;
      l2 = 0;
      s2 = 0;
      t2 = 0;
      k2 = 0;
      u2 = -1;
      while (1) {
        p2 = u2;
        u2 = u2 + 1 << 16 >> 16;
        s2 = 1 - (s2 << 16 >> 16) | 0;
        f2 = s2 & 65535;
        r2 = (s2 & 65535 | 0) != 0;
        e2 = c[g2 >> 2] | 0;
        j2 = (e2 | 0) == 0;
        do
          if (r2)
            if (j2) {
              j2 = fa2;
              e2 = z2;
              q2 = j2 + 20 | 0;
              do {
                b[j2 >> 1] = b[e2 >> 1] | 0;
                j2 = j2 + 2 | 0;
                e2 = e2 + 2 | 0;
              } while ((j2 | 0) < (q2 | 0));
              j2 = ga2;
              e2 = A2;
              q2 = j2 + 20 | 0;
              do {
                b[j2 >> 1] = b[e2 >> 1] | 0;
                j2 = j2 + 2 | 0;
                e2 = e2 + 2 | 0;
              } while ((j2 | 0) < (q2 | 0));
              j2 = ea2;
              e2 = B2;
              q2 = j2 + 20 | 0;
              do {
                b[j2 >> 1] = b[e2 >> 1] | 0;
                j2 = j2 + 2 | 0;
                e2 = e2 + 2 | 0;
              } while ((j2 | 0) < (q2 | 0));
              b[ja2 >> 1] = b[C2 >> 1] | 0;
              d2 = (c[N2 >> 2] | 0) + (v2 << 1) | 0;
              j2 = 20;
              break;
            } else {
              d2 = (c[N2 >> 2] | 0) + (v2 << 1) | 0;
              j2 = 19;
              break;
            }
          else {
            d2 = (c[N2 >> 2] | 0) + (v2 << 1) | 0;
            if (j2)
              j2 = 20;
            else
              j2 = 19;
          }
        while (0);
        if ((j2 | 0) == 19)
          yd(e2, 2842, 2862, 2882, n2, o2, d2, B2, w2, c[D2 >> 2] | 0, E2, (c[F2 >> 2] | 0) + (v2 << 1) | 0, c[G2 >> 2] | 0, ka2, ha2, c[H2 >> 2] | 0);
        else if ((j2 | 0) == 20 ? (yd(0, 2842, 2862, 2882, n2, o2, d2, B2, ga2, c[D2 >> 2] | 0, E2, (c[F2 >> 2] | 0) + (v2 << 1) | 0, c[G2 >> 2] | 0, ka2, ha2, c[H2 >> 2] | 0), r2) : 0) {
          j2 = da2;
          e2 = c[G2 >> 2] | 0;
          q2 = j2 + 80 | 0;
          do {
            b[j2 >> 1] = b[e2 >> 1] | 0;
            j2 = j2 + 2 | 0;
            e2 = e2 + 2 | 0;
          } while ((j2 | 0) < (q2 | 0));
        }
        j2 = ia2;
        e2 = ha2;
        q2 = j2 + 80 | 0;
        do {
          b[j2 >> 1] = b[e2 >> 1] | 0;
          j2 = j2 + 2 | 0;
          e2 = e2 + 2 | 0;
        } while ((j2 | 0) < (q2 | 0));
        $b(c[I2 >> 2] | 0, c[J2 >> 2] | 0, c[g2 >> 2] | 0, t2, W2, c[G2 >> 2] | 0, (c[F2 >> 2] | 0) + (v2 << 1) | 0, ia2, ka2, Q2, la2, na2, U2, V2, aa2, Z2, T2, ca2, c[K2 >> 2] | 0, S2);
        switch (p2 << 16 >> 16) {
          case -1: {
            if ((b[P2 >> 1] | 0) > 0)
              b[x2 >> 1] = b[U2 >> 1] | 0;
            break;
          }
          case 2: {
            if ((b[y2 >> 1] | 0) > 0)
              b[O2 >> 1] = b[U2 >> 1] | 0;
            break;
          }
        }
        Xb(la2, c[G2 >> 2] | 0, b[U2 >> 1] | 0, b[C2 >> 1] | 0, b[aa2 >> 1] | 0, ia2, X2, oa2, T2, c[g2 >> 2] | 0, u2, R2, S2);
        Bc(c[L2 >> 2] | 0, c[g2 >> 2] | 0, ha2, (c[F2 >> 2] | 0) + (v2 << 1) | 0, X2, ka2, la2, na2, oa2, Z2, f2, b[ca2 >> 1] | 0, ba2, $2, aa2, _2, T2, R2, S2);
        Fd(c[J2 >> 2] | 0, b[aa2 >> 1] | 0, S2);
        d2 = c[g2 >> 2] | 0;
        do
          if (!d2)
            if (r2) {
              j2 = ma2;
              e2 = ka2;
              q2 = j2 + 80 | 0;
              do {
                b[j2 >> 1] = b[e2 >> 1] | 0;
                j2 = j2 + 2 | 0;
                e2 = e2 + 2 | 0;
              } while ((j2 | 0) < (q2 | 0));
              j2 = pa2;
              e2 = oa2;
              q2 = j2 + 80 | 0;
              do {
                b[j2 >> 1] = b[e2 >> 1] | 0;
                j2 = j2 + 2 | 0;
                e2 = e2 + 2 | 0;
              } while ((j2 | 0) < (q2 | 0));
              j2 = Y2;
              e2 = X2;
              q2 = j2 + 80 | 0;
              do {
                b[j2 >> 1] = b[e2 >> 1] | 0;
                j2 = j2 + 2 | 0;
                e2 = e2 + 2 | 0;
              } while ((j2 | 0) < (q2 | 0));
              l2 = b[U2 >> 1] | 0;
              m2 = b[V2 >> 1] | 0;
              zd(c[N2 >> 2] | 0, 0, t2, b[aa2 >> 1] | 0, b[_2 >> 1] | 0, o2, h2, ka2, X2, na2, oa2, fa2, B2, ga2, c[F2 >> 2] | 0, C2, S2);
              b[C2 >> 1] = b[ja2 >> 1] | 0;
              k2 = t2;
              break;
            } else {
              j2 = B2;
              e2 = ea2;
              q2 = j2 + 20 | 0;
              do {
                b[j2 >> 1] = b[e2 >> 1] | 0;
                j2 = j2 + 2 | 0;
                e2 = e2 + 2 | 0;
              } while ((j2 | 0) < (q2 | 0));
              r2 = k2 << 16 >> 16;
              se((c[F2 >> 2] | 0) + (r2 << 1) | 0, l2, m2, 40, 1, S2);
              ec((c[F2 >> 2] | 0) + (r2 << 1) | 0, da2, na2, 40);
              zd(c[N2 >> 2] | 0, c[g2 >> 2] | 0, k2, b[ba2 >> 1] | 0, b[$2 >> 1] | 0, o2 + -22 | 0, h2, ma2, Y2, na2, pa2, M2, B2, w2, c[F2 >> 2] | 0, ja2, S2);
              yd(c[g2 >> 2] | 0, 2842, 2862, 2882, n2, o2, (c[N2 >> 2] | 0) + (v2 << 1) | 0, B2, w2, c[D2 >> 2] | 0, E2, (c[F2 >> 2] | 0) + (v2 << 1) | 0, c[G2 >> 2] | 0, ka2, ha2, c[H2 >> 2] | 0);
              se((c[F2 >> 2] | 0) + (v2 << 1) | 0, b[U2 >> 1] | 0, b[V2 >> 1] | 0, 40, 1, S2);
              ec((c[F2 >> 2] | 0) + (v2 << 1) | 0, c[G2 >> 2] | 0, na2, 40);
              zd(c[N2 >> 2] | 0, c[g2 >> 2] | 0, t2, b[aa2 >> 1] | 0, b[_2 >> 1] | 0, o2, h2, ka2, X2, na2, oa2, M2, B2, w2, c[F2 >> 2] | 0, C2, S2);
              break;
            }
          else
            zd(c[N2 >> 2] | 0, d2, t2, b[aa2 >> 1] | 0, b[_2 >> 1] | 0, o2, h2, ka2, X2, na2, oa2, M2, B2, w2, c[F2 >> 2] | 0, C2, S2);
        while (0);
        d2 = v2 + 40 | 0;
        t2 = d2 & 65535;
        if (t2 << 16 >> 16 >= 160)
          break;
        else {
          v2 = d2 << 16 >> 16;
          n2 = n2 + 22 | 0;
          o2 = o2 + 22 | 0;
        }
      }
      Oe(a2 + 1282 | 0, a2 + 1602 | 0, 308) | 0;
      oa2 = a2 + 656 | 0;
      pa2 = a2 + 976 | 0;
      Oe(oa2 | 0, pa2 | 0, 286) | 0;
      pa2 = a2 + 320 | 0;
      Oe(a2 | 0, pa2 | 0, 320) | 0;
      i2 = qa2;
      return 0;
    }
    function ec(a2, c2, d2, e2) {
      a2 = a2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      var f2 = 0, g2 = 0, h2 = 0, i3 = 0, j2 = 0, k2 = 0, l2 = 0, m2 = 0, n2 = 0, o2 = 0, p2 = 0, q2 = 0;
      o2 = e2 << 16 >> 16;
      if (e2 << 16 >> 16 > 1)
        n2 = 1;
      else
        return;
      while (1) {
        f2 = b[a2 >> 1] | 0;
        i3 = c2 + (n2 + -1 << 1) | 0;
        e2 = Z(b[c2 + (n2 << 1) >> 1] | 0, f2) | 0;
        k2 = b[i3 >> 1] | 0;
        f2 = Z(k2 << 16 >> 16, f2) | 0;
        h2 = (n2 + 131071 | 0) >>> 1;
        j2 = h2 & 65535;
        g2 = b[a2 + 2 >> 1] | 0;
        if (!(j2 << 16 >> 16)) {
          c2 = i3;
          h2 = k2;
        } else {
          l2 = (h2 << 1) + 131070 & 131070;
          m2 = n2 - l2 | 0;
          h2 = a2;
          do {
            q2 = (Z(k2 << 16 >> 16, g2) | 0) + e2 | 0;
            p2 = h2;
            h2 = h2 + 4 | 0;
            e2 = b[i3 + -2 >> 1] | 0;
            g2 = (Z(e2, g2) | 0) + f2 | 0;
            f2 = b[h2 >> 1] | 0;
            i3 = i3 + -4 | 0;
            e2 = q2 + (Z(f2, e2) | 0) | 0;
            k2 = b[i3 >> 1] | 0;
            f2 = g2 + (Z(k2 << 16 >> 16, f2) | 0) | 0;
            j2 = j2 + -1 << 16 >> 16;
            g2 = b[p2 + 6 >> 1] | 0;
          } while (j2 << 16 >> 16 != 0);
          h2 = c2 + (m2 + -3 << 1) | 0;
          a2 = a2 + (l2 + 2 << 1) | 0;
          c2 = h2;
          h2 = b[h2 >> 1] | 0;
        }
        e2 = (Z(h2 << 16 >> 16, g2) | 0) + e2 | 0;
        b[d2 >> 1] = f2 >>> 12;
        b[d2 + 2 >> 1] = e2 >>> 12;
        e2 = (n2 << 16) + 131072 >> 16;
        if ((e2 | 0) < (o2 | 0)) {
          d2 = d2 + 4 | 0;
          a2 = a2 + (1 - n2 << 1) | 0;
          n2 = e2;
        } else
          break;
      }
      return;
    }
    function fc(a2, c2, d2, e2) {
      a2 = a2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      var f2 = 0, g2 = 0, h2 = 0, j2 = 0, k2 = 0, l2 = 0, m2 = 0, n2 = 0, o2 = 0, p2 = 0, q2 = 0, r2 = 0, s2 = 0, t2 = 0, u2 = 0, v2 = 0, w2 = 0, x2 = 0, y2 = 0, z2 = 0, A2 = 0, B2 = 0;
      z2 = i2;
      i2 = i2 + 80 | 0;
      y2 = z2;
      h2 = 20;
      g2 = a2;
      f2 = 1;
      while (1) {
        x2 = b[g2 >> 1] | 0;
        x2 = (Z(x2, x2) | 0) + f2 | 0;
        f2 = b[g2 + 2 >> 1] | 0;
        f2 = x2 + (Z(f2, f2) | 0) | 0;
        h2 = h2 + -1 << 16 >> 16;
        if (!(h2 << 16 >> 16))
          break;
        else
          g2 = g2 + 4 | 0;
      }
      f2 = f2 << 1;
      if ((f2 | 0) < 0) {
        g2 = 20;
        f2 = a2;
        e2 = y2;
        while (1) {
          b[e2 >> 1] = (b[f2 >> 1] | 0) >>> 1;
          b[e2 + 2 >> 1] = (b[f2 + 2 >> 1] | 0) >>> 1;
          g2 = g2 + -1 << 16 >> 16;
          if (!(g2 << 16 >> 16)) {
            x2 = y2;
            break;
          } else {
            f2 = f2 + 4 | 0;
            e2 = e2 + 4 | 0;
          }
        }
      } else {
        f2 = ce(f2 >> 1, e2) | 0;
        if ((f2 | 0) < 16777215)
          f2 = ((f2 >> 9) * 32440 | 0) >>> 15 << 16 >> 16;
        else
          f2 = 32440;
        h2 = 20;
        g2 = a2;
        e2 = y2;
        while (1) {
          b[e2 >> 1] = ((Z(b[g2 >> 1] | 0, f2) | 0) + 32 | 0) >>> 6;
          b[e2 + 2 >> 1] = ((Z(b[g2 + 2 >> 1] | 0, f2) | 0) + 32 | 0) >>> 6;
          h2 = h2 + -1 << 16 >> 16;
          if (!(h2 << 16 >> 16)) {
            x2 = y2;
            break;
          } else {
            g2 = g2 + 4 | 0;
            e2 = e2 + 4 | 0;
          }
        }
      }
      h2 = 20;
      g2 = x2;
      e2 = d2 + 3198 | 0;
      f2 = 0;
      while (1) {
        w2 = b[g2 >> 1] | 0;
        w2 = (Z(w2, w2) | 0) + f2 | 0;
        b[e2 >> 1] = (w2 + 16384 | 0) >>> 15;
        v2 = b[g2 + 2 >> 1] | 0;
        f2 = (Z(v2, v2) | 0) + w2 | 0;
        b[e2 + -82 >> 1] = (f2 + 16384 | 0) >>> 15;
        h2 = h2 + -1 << 16 >> 16;
        if (!(h2 << 16 >> 16))
          break;
        else {
          g2 = g2 + 4 | 0;
          e2 = e2 + -164 | 0;
        }
      }
      w2 = c2 + 78 | 0;
      v2 = 1;
      while (1) {
        f2 = 39 - v2 | 0;
        a2 = d2 + 3120 + (f2 << 1) | 0;
        e2 = d2 + (f2 * 80 | 0) + 78 | 0;
        f2 = c2 + (f2 << 1) | 0;
        k2 = y2 + (v2 << 1) | 0;
        g2 = 65575 - v2 | 0;
        j2 = g2 & 65535;
        h2 = b[x2 >> 1] | 0;
        if (!(j2 << 16 >> 16)) {
          j2 = w2;
          g2 = 0;
        } else {
          r2 = g2 + 65535 & 65535;
          t2 = r2 * 41 | 0;
          u2 = (Z(v2, -40) | 0) - t2 | 0;
          s2 = 0 - v2 | 0;
          t2 = s2 - t2 | 0;
          s2 = s2 - r2 | 0;
          q2 = v2 + r2 | 0;
          p2 = b[k2 >> 1] | 0;
          n2 = x2;
          o2 = w2;
          l2 = d2 + ((38 - v2 | 0) * 80 | 0) + 78 | 0;
          g2 = 0;
          m2 = 0;
          while (1) {
            k2 = k2 + 2 | 0;
            g2 = (Z(p2 << 16 >> 16, h2) | 0) + g2 | 0;
            n2 = n2 + 2 | 0;
            p2 = b[k2 >> 1] | 0;
            m2 = (Z(p2 << 16 >> 16, h2) | 0) + m2 | 0;
            B2 = f2;
            f2 = f2 + -2 | 0;
            h2 = b[f2 >> 1] | 0;
            A2 = b[o2 >> 1] << 1;
            B2 = (Z((Z(A2, b[B2 >> 1] | 0) | 0) >> 16, (g2 << 1) + 32768 >> 16) | 0) >>> 15 & 65535;
            b[e2 >> 1] = B2;
            b[a2 >> 1] = B2;
            h2 = (Z((Z(A2, h2) | 0) >> 16, (m2 << 1) + 32768 >> 16) | 0) >>> 15 & 65535;
            b[a2 + -2 >> 1] = h2;
            b[l2 >> 1] = h2;
            j2 = j2 + -1 << 16 >> 16;
            h2 = b[n2 >> 1] | 0;
            if (!(j2 << 16 >> 16))
              break;
            else {
              o2 = o2 + -2 | 0;
              a2 = a2 + -82 | 0;
              e2 = e2 + -82 | 0;
              l2 = l2 + -82 | 0;
            }
          }
          k2 = y2 + (q2 + 1 << 1) | 0;
          j2 = c2 + (38 - r2 << 1) | 0;
          f2 = c2 + (s2 + 38 << 1) | 0;
          a2 = d2 + 3040 + (t2 + 38 << 1) | 0;
          e2 = d2 + 3040 + (u2 + 38 << 1) | 0;
        }
        B2 = (Z(b[k2 >> 1] | 0, h2) | 0) + g2 | 0;
        B2 = (Z((B2 << 1) + 32768 >> 16, (Z(b[j2 >> 1] << 1, b[f2 >> 1] | 0) | 0) >> 16) | 0) >>> 15 & 65535;
        b[a2 >> 1] = B2;
        b[e2 >> 1] = B2;
        e2 = (v2 << 16) + 131072 | 0;
        if ((e2 | 0) < 2621440)
          v2 = e2 >> 16;
        else
          break;
      }
      i2 = z2;
      return;
    }
    function gc(a2, d2, e2, f2, g2, h2, j2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      j2 = j2 | 0;
      var k2 = 0, l2 = 0, m2 = 0, n2 = 0, o2 = 0, p2 = 0, q2 = 0, r2 = 0;
      r2 = i2;
      i2 = i2 + 160 | 0;
      q2 = r2;
      if (g2 << 16 >> 16 > 0) {
        o2 = h2 & 65535;
        p2 = 0;
        k2 = 5;
        do {
          if ((p2 | 0) < 40) {
            n2 = p2;
            m2 = p2 & 65535;
            h2 = 0;
            while (1) {
              if (m2 << 16 >> 16 < 40) {
                m2 = m2 << 16 >> 16;
                l2 = 0;
                do {
                  l2 = (Z(b[a2 + (m2 - n2 << 1) >> 1] | 0, b[d2 + (m2 << 1) >> 1] | 0) | 0) + l2 | 0;
                  m2 = m2 + 1 | 0;
                } while ((m2 & 65535) << 16 >> 16 != 40);
              } else
                l2 = 0;
              l2 = l2 << 1;
              c[q2 + (n2 << 2) >> 2] = l2;
              l2 = Gc(l2) | 0;
              h2 = (l2 | 0) > (h2 | 0) ? l2 : h2;
              l2 = n2 + o2 | 0;
              m2 = l2 & 65535;
              if (m2 << 16 >> 16 >= 40)
                break;
              else
                n2 = l2 << 16 >> 16;
            }
          } else
            h2 = 0;
          k2 = (h2 >> 1) + k2 | 0;
          p2 = p2 + 1 | 0;
        } while ((p2 & 65535) << 16 >> 16 != g2 << 16 >> 16);
      } else
        k2 = 5;
      f2 = ((pe(k2) | 0) & 65535) - (f2 & 65535) | 0;
      h2 = f2 << 16 >> 16;
      l2 = 0 - h2 << 16;
      k2 = (l2 | 0) < 2031616;
      l2 = l2 >> 16;
      if ((f2 & 65535) << 16 >> 16 > 0)
        if (k2) {
          k2 = 0;
          do {
            f2 = c[q2 + (k2 << 2) >> 2] | 0;
            d2 = f2 << h2;
            b[e2 + (k2 << 1) >> 1] = Ce((d2 >> h2 | 0) == (f2 | 0) ? d2 : f2 >> 31 ^ 2147483647, j2) | 0;
            k2 = k2 + 1 | 0;
          } while ((k2 | 0) != 40);
          i2 = r2;
          return;
        } else {
          k2 = 0;
          do {
            f2 = c[q2 + (k2 << 2) >> 2] | 0;
            d2 = f2 << h2;
            b[e2 + (k2 << 1) >> 1] = Ce((d2 >> h2 | 0) == (f2 | 0) ? d2 : f2 >> 31 ^ 2147483647, j2) | 0;
            k2 = k2 + 1 | 0;
          } while ((k2 | 0) != 40);
          i2 = r2;
          return;
        }
      else if (k2) {
        k2 = 0;
        do {
          b[e2 + (k2 << 1) >> 1] = Ce(c[q2 + (k2 << 2) >> 2] >> l2, j2) | 0;
          k2 = k2 + 1 | 0;
        } while ((k2 | 0) != 40);
        i2 = r2;
        return;
      } else {
        k2 = 0;
        do {
          b[e2 + (k2 << 1) >> 1] = Ce(0, j2) | 0;
          k2 = k2 + 1 | 0;
        } while ((k2 | 0) != 40);
        i2 = r2;
        return;
      }
    }
    function hc(a2, d2, e2, f2, g2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      var h2 = 0, j2 = 0, k2 = 0, l2 = 0, m2 = 0, n2 = 0, o2 = 0, p2 = 0, q2 = 0, r2 = 0, s2 = 0, t2 = 0, u2 = 0, v2 = 0, w2 = 0, x2 = 0, y2 = 0, z2 = 0;
      z2 = i2;
      i2 = i2 + 160 | 0;
      y2 = z2;
      v2 = a2 + 2 | 0;
      w2 = b[a2 >> 1] | 0;
      x2 = 0;
      g2 = 5;
      do {
        u2 = x2;
        k2 = 0;
        while (1) {
          n2 = d2 + (u2 << 1) | 0;
          t2 = 40 - u2 | 0;
          h2 = (t2 + 131071 | 0) >>> 1 & 65535;
          l2 = d2 + (u2 + 1 << 1) | 0;
          j2 = Z(b[n2 >> 1] << 1, w2) | 0;
          if (!(h2 << 16 >> 16))
            h2 = v2;
          else {
            s2 = 131111 - u2 + 131070 & 131070;
            r2 = u2 + s2 | 0;
            q2 = v2;
            p2 = a2;
            o2 = n2;
            while (1) {
              m2 = o2 + 4 | 0;
              n2 = p2 + 4 | 0;
              j2 = (Z(b[l2 >> 1] << 1, b[q2 >> 1] | 0) | 0) + j2 | 0;
              h2 = h2 + -1 << 16 >> 16;
              j2 = (Z(b[m2 >> 1] << 1, b[n2 >> 1] | 0) | 0) + j2 | 0;
              if (!(h2 << 16 >> 16))
                break;
              else {
                l2 = o2 + 6 | 0;
                q2 = p2 + 6 | 0;
                p2 = n2;
                o2 = m2;
              }
            }
            l2 = d2 + (r2 + 3 << 1) | 0;
            h2 = a2 + (s2 + 3 << 1) | 0;
          }
          if (!(t2 & 1))
            j2 = (Z(b[l2 >> 1] << 1, b[h2 >> 1] | 0) | 0) + j2 | 0;
          c[y2 + (u2 << 2) >> 2] = j2;
          j2 = (j2 | 0) < 0 ? 0 - j2 | 0 : j2;
          k2 = (j2 | 0) > (k2 | 0) ? j2 : k2;
          j2 = u2 + 5 | 0;
          if ((j2 & 65535) << 16 >> 16 < 40)
            u2 = j2 << 16 >> 16;
          else
            break;
        }
        g2 = (k2 >> 1) + g2 | 0;
        x2 = x2 + 1 | 0;
      } while ((x2 | 0) != 5);
      f2 = ((pe(g2) | 0) & 65535) - (f2 & 65535) | 0;
      j2 = f2 << 16 >> 16;
      g2 = 0 - j2 << 16;
      k2 = g2 >> 16;
      if ((f2 & 65535) << 16 >> 16 > 0) {
        h2 = 20;
        g2 = y2;
        while (1) {
          y2 = c[g2 >> 2] | 0;
          f2 = y2 << j2;
          b[e2 >> 1] = (((f2 >> j2 | 0) == (y2 | 0) ? f2 : y2 >> 31 ^ 2147483647) + 32768 | 0) >>> 16;
          y2 = c[g2 + 4 >> 2] | 0;
          f2 = y2 << j2;
          b[e2 + 2 >> 1] = (((f2 >> j2 | 0) == (y2 | 0) ? f2 : y2 >> 31 ^ 2147483647) + 32768 | 0) >>> 16;
          h2 = h2 + -1 << 16 >> 16;
          if (!(h2 << 16 >> 16))
            break;
          else {
            e2 = e2 + 4 | 0;
            g2 = g2 + 8 | 0;
          }
        }
        i2 = z2;
        return;
      }
      if ((g2 | 0) < 2031616) {
        h2 = 20;
        g2 = y2;
        while (1) {
          b[e2 >> 1] = ((c[g2 >> 2] >> k2) + 32768 | 0) >>> 16;
          b[e2 + 2 >> 1] = ((c[g2 + 4 >> 2] >> k2) + 32768 | 0) >>> 16;
          h2 = h2 + -1 << 16 >> 16;
          if (!(h2 << 16 >> 16))
            break;
          else {
            e2 = e2 + 4 | 0;
            g2 = g2 + 8 | 0;
          }
        }
        i2 = z2;
        return;
      } else {
        b[e2 >> 1] = 0;
        y2 = e2 + 4 | 0;
        b[e2 + 2 >> 1] = 0;
        b[y2 >> 1] = 0;
        f2 = y2 + 4 | 0;
        b[y2 + 2 >> 1] = 0;
        b[f2 >> 1] = 0;
        y2 = f2 + 4 | 0;
        b[f2 + 2 >> 1] = 0;
        b[y2 >> 1] = 0;
        f2 = y2 + 4 | 0;
        b[y2 + 2 >> 1] = 0;
        b[f2 >> 1] = 0;
        y2 = f2 + 4 | 0;
        b[f2 + 2 >> 1] = 0;
        b[y2 >> 1] = 0;
        f2 = y2 + 4 | 0;
        b[y2 + 2 >> 1] = 0;
        b[f2 >> 1] = 0;
        y2 = f2 + 4 | 0;
        b[f2 + 2 >> 1] = 0;
        b[y2 >> 1] = 0;
        f2 = y2 + 4 | 0;
        b[y2 + 2 >> 1] = 0;
        b[f2 >> 1] = 0;
        y2 = f2 + 4 | 0;
        b[f2 + 2 >> 1] = 0;
        b[y2 >> 1] = 0;
        f2 = y2 + 4 | 0;
        b[y2 + 2 >> 1] = 0;
        b[f2 >> 1] = 0;
        y2 = f2 + 4 | 0;
        b[f2 + 2 >> 1] = 0;
        b[y2 >> 1] = 0;
        f2 = y2 + 4 | 0;
        b[y2 + 2 >> 1] = 0;
        b[f2 >> 1] = 0;
        y2 = f2 + 4 | 0;
        b[f2 + 2 >> 1] = 0;
        b[y2 >> 1] = 0;
        f2 = y2 + 4 | 0;
        b[y2 + 2 >> 1] = 0;
        b[f2 >> 1] = 0;
        y2 = f2 + 4 | 0;
        b[f2 + 2 >> 1] = 0;
        b[y2 >> 1] = 0;
        f2 = y2 + 4 | 0;
        b[y2 + 2 >> 1] = 0;
        b[f2 >> 1] = 0;
        y2 = f2 + 4 | 0;
        b[f2 + 2 >> 1] = 0;
        b[y2 >> 1] = 0;
        f2 = y2 + 4 | 0;
        b[y2 + 2 >> 1] = 0;
        b[f2 >> 1] = 0;
        y2 = f2 + 4 | 0;
        b[f2 + 2 >> 1] = 0;
        b[y2 >> 1] = 0;
        b[y2 + 2 >> 1] = 0;
        i2 = z2;
        return;
      }
    }
    function ic(a2, b2, d2, e2) {
      a2 = a2 | 0;
      b2 = b2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      var f2 = 0, g2 = 0, h2 = 0;
      h2 = (Td(16383, b2) | 0) << 16 >> 16;
      b2 = Z(h2, b2 << 16 >> 16) | 0;
      if ((b2 | 0) == 1073741824) {
        c[e2 >> 2] = 1;
        f2 = 2147483647;
      } else
        f2 = b2 << 1;
      g2 = (Z(h2, d2 << 16 >> 16) | 0) >> 15;
      b2 = f2 + (g2 << 1) | 0;
      if ((f2 ^ g2 | 0) > 0 & (b2 ^ f2 | 0) < 0) {
        c[e2 >> 2] = 1;
        b2 = (f2 >>> 31) + 2147483647 | 0;
      }
      f2 = 2147483647 - b2 | 0;
      d2 = f2 >> 16;
      b2 = Z(d2, h2) | 0;
      if ((b2 | 0) == 1073741824) {
        c[e2 >> 2] = 1;
        g2 = 2147483647;
      } else
        g2 = b2 << 1;
      h2 = (Z((f2 >>> 1) - (d2 << 15) << 16 >> 16, h2) | 0) >> 15;
      b2 = g2 + (h2 << 1) | 0;
      if ((g2 ^ h2 | 0) > 0 & (b2 ^ g2 | 0) < 0) {
        c[e2 >> 2] = 1;
        b2 = (g2 >>> 31) + 2147483647 | 0;
      }
      g2 = b2 >> 16;
      h2 = a2 >> 16;
      d2 = Z(g2, h2) | 0;
      d2 = (d2 | 0) == 1073741824 ? 2147483647 : d2 << 1;
      f2 = (Z((b2 >>> 1) - (g2 << 15) << 16 >> 16, h2) | 0) >> 15;
      e2 = (f2 << 1) + d2 | 0;
      e2 = (f2 ^ d2 | 0) > 0 & (e2 ^ d2 | 0) < 0 ? (d2 >>> 31) + 2147483647 | 0 : e2;
      h2 = (Z(g2, (a2 >>> 1) - (h2 << 15) << 16 >> 16) | 0) >> 15;
      a2 = e2 + (h2 << 1) | 0;
      a2 = (e2 ^ h2 | 0) > 0 & (a2 ^ e2 | 0) < 0 ? (e2 >>> 31) + 2147483647 | 0 : a2;
      e2 = a2 << 2;
      return ((e2 >> 2 | 0) == (a2 | 0) ? e2 : a2 >> 31 ^ 2147483647) | 0;
    }
    function jc(a2, d2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      var e2 = 0, f2 = 0, g2 = 0, h2 = 0;
      if (!a2) {
        h2 = -1;
        return h2 | 0;
      }
      c[a2 >> 2] = 0;
      e2 = Je(192) | 0;
      if (!e2) {
        h2 = -1;
        return h2 | 0;
      }
      f2 = e2 + 176 | 0;
      b[f2 >> 1] = 0;
      b[f2 + 2 >> 1] = 0;
      b[f2 + 4 >> 1] = 0;
      b[f2 + 6 >> 1] = 0;
      b[f2 + 8 >> 1] = 0;
      b[f2 + 10 >> 1] = 0;
      f2 = e2;
      g2 = d2;
      h2 = f2 + 20 | 0;
      do {
        b[f2 >> 1] = b[g2 >> 1] | 0;
        f2 = f2 + 2 | 0;
        g2 = g2 + 2 | 0;
      } while ((f2 | 0) < (h2 | 0));
      f2 = e2 + 20 | 0;
      g2 = d2;
      h2 = f2 + 20 | 0;
      do {
        b[f2 >> 1] = b[g2 >> 1] | 0;
        f2 = f2 + 2 | 0;
        g2 = g2 + 2 | 0;
      } while ((f2 | 0) < (h2 | 0));
      f2 = e2 + 40 | 0;
      g2 = d2;
      h2 = f2 + 20 | 0;
      do {
        b[f2 >> 1] = b[g2 >> 1] | 0;
        f2 = f2 + 2 | 0;
        g2 = g2 + 2 | 0;
      } while ((f2 | 0) < (h2 | 0));
      f2 = e2 + 60 | 0;
      g2 = d2;
      h2 = f2 + 20 | 0;
      do {
        b[f2 >> 1] = b[g2 >> 1] | 0;
        f2 = f2 + 2 | 0;
        g2 = g2 + 2 | 0;
      } while ((f2 | 0) < (h2 | 0));
      f2 = e2 + 80 | 0;
      g2 = d2;
      h2 = f2 + 20 | 0;
      do {
        b[f2 >> 1] = b[g2 >> 1] | 0;
        f2 = f2 + 2 | 0;
        g2 = g2 + 2 | 0;
      } while ((f2 | 0) < (h2 | 0));
      f2 = e2 + 100 | 0;
      g2 = d2;
      h2 = f2 + 20 | 0;
      do {
        b[f2 >> 1] = b[g2 >> 1] | 0;
        f2 = f2 + 2 | 0;
        g2 = g2 + 2 | 0;
      } while ((f2 | 0) < (h2 | 0));
      f2 = e2 + 120 | 0;
      g2 = d2;
      h2 = f2 + 20 | 0;
      do {
        b[f2 >> 1] = b[g2 >> 1] | 0;
        f2 = f2 + 2 | 0;
        g2 = g2 + 2 | 0;
      } while ((f2 | 0) < (h2 | 0));
      f2 = e2 + 140 | 0;
      g2 = d2;
      h2 = f2 + 20 | 0;
      do {
        b[f2 >> 1] = b[g2 >> 1] | 0;
        f2 = f2 + 2 | 0;
        g2 = g2 + 2 | 0;
      } while ((f2 | 0) < (h2 | 0));
      f2 = e2 + 160 | 0;
      h2 = f2 + 20 | 0;
      do {
        b[f2 >> 1] = 0;
        f2 = f2 + 2 | 0;
      } while ((f2 | 0) < (h2 | 0));
      b[e2 + 188 >> 1] = 7;
      b[e2 + 190 >> 1] = 32767;
      c[a2 >> 2] = e2;
      h2 = 0;
      return h2 | 0;
    }
    function kc(a2, c2) {
      a2 = a2 | 0;
      c2 = c2 | 0;
      var d2 = 0, e2 = 0, f2 = 0;
      if (!a2) {
        f2 = -1;
        return f2 | 0;
      }
      d2 = a2 + 176 | 0;
      b[d2 >> 1] = 0;
      b[d2 + 2 >> 1] = 0;
      b[d2 + 4 >> 1] = 0;
      b[d2 + 6 >> 1] = 0;
      b[d2 + 8 >> 1] = 0;
      b[d2 + 10 >> 1] = 0;
      d2 = a2;
      e2 = c2;
      f2 = d2 + 20 | 0;
      do {
        b[d2 >> 1] = b[e2 >> 1] | 0;
        d2 = d2 + 2 | 0;
        e2 = e2 + 2 | 0;
      } while ((d2 | 0) < (f2 | 0));
      d2 = a2 + 20 | 0;
      e2 = c2;
      f2 = d2 + 20 | 0;
      do {
        b[d2 >> 1] = b[e2 >> 1] | 0;
        d2 = d2 + 2 | 0;
        e2 = e2 + 2 | 0;
      } while ((d2 | 0) < (f2 | 0));
      d2 = a2 + 40 | 0;
      e2 = c2;
      f2 = d2 + 20 | 0;
      do {
        b[d2 >> 1] = b[e2 >> 1] | 0;
        d2 = d2 + 2 | 0;
        e2 = e2 + 2 | 0;
      } while ((d2 | 0) < (f2 | 0));
      d2 = a2 + 60 | 0;
      e2 = c2;
      f2 = d2 + 20 | 0;
      do {
        b[d2 >> 1] = b[e2 >> 1] | 0;
        d2 = d2 + 2 | 0;
        e2 = e2 + 2 | 0;
      } while ((d2 | 0) < (f2 | 0));
      d2 = a2 + 80 | 0;
      e2 = c2;
      f2 = d2 + 20 | 0;
      do {
        b[d2 >> 1] = b[e2 >> 1] | 0;
        d2 = d2 + 2 | 0;
        e2 = e2 + 2 | 0;
      } while ((d2 | 0) < (f2 | 0));
      d2 = a2 + 100 | 0;
      e2 = c2;
      f2 = d2 + 20 | 0;
      do {
        b[d2 >> 1] = b[e2 >> 1] | 0;
        d2 = d2 + 2 | 0;
        e2 = e2 + 2 | 0;
      } while ((d2 | 0) < (f2 | 0));
      d2 = a2 + 120 | 0;
      e2 = c2;
      f2 = d2 + 20 | 0;
      do {
        b[d2 >> 1] = b[e2 >> 1] | 0;
        d2 = d2 + 2 | 0;
        e2 = e2 + 2 | 0;
      } while ((d2 | 0) < (f2 | 0));
      d2 = a2 + 140 | 0;
      e2 = c2;
      f2 = d2 + 20 | 0;
      do {
        b[d2 >> 1] = b[e2 >> 1] | 0;
        d2 = d2 + 2 | 0;
        e2 = e2 + 2 | 0;
      } while ((d2 | 0) < (f2 | 0));
      d2 = a2 + 160 | 0;
      f2 = d2 + 20 | 0;
      do {
        b[d2 >> 1] = 0;
        d2 = d2 + 2 | 0;
      } while ((d2 | 0) < (f2 | 0));
      b[a2 + 188 >> 1] = 7;
      b[a2 + 190 >> 1] = 32767;
      f2 = 1;
      return f2 | 0;
    }
    function lc(a2) {
      a2 = a2 | 0;
      var b2 = 0;
      if (!a2)
        return;
      b2 = c[a2 >> 2] | 0;
      if (!b2)
        return;
      Ke(b2);
      c[a2 >> 2] = 0;
      return;
    }
    function mc(a2, d2, e2, f2, g2, h2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      var j2 = 0, k2 = 0, l2 = 0, m2 = 0, n2 = 0, o2 = 0, p2 = 0, q2 = 0, r2 = 0, s2 = 0, t2 = 0, u2 = 0, v2 = 0, w2 = 0, x2 = 0, y2 = 0, z2 = 0, A2 = 0, B2 = 0, C2 = 0, D2 = 0;
      C2 = i2;
      i2 = i2 + 112 | 0;
      z2 = C2 + 80 | 0;
      A2 = C2 + 60 | 0;
      B2 = C2 + 40 | 0;
      y2 = C2;
      if (d2 << 16 >> 16 == 0 ? (j2 = a2 + 178 | 0, (b[j2 >> 1] | 0) != 0) : 0) {
        B2 = a2 + 180 | 0;
        h2 = a2 + 182 | 0;
        e2 = j2;
        B2 = b[B2 >> 1] | 0;
        f2 = c[g2 >> 2] | 0;
        A2 = f2 + 2 | 0;
        b[f2 >> 1] = B2;
        h2 = b[h2 >> 1] | 0;
        B2 = f2 + 4 | 0;
        b[A2 >> 1] = h2;
        A2 = a2 + 184 | 0;
        A2 = b[A2 >> 1] | 0;
        h2 = f2 + 6 | 0;
        b[B2 >> 1] = A2;
        B2 = a2 + 186 | 0;
        B2 = b[B2 >> 1] | 0;
        a2 = f2 + 8 | 0;
        b[h2 >> 1] = B2;
        e2 = b[e2 >> 1] | 0;
        f2 = f2 + 10 | 0;
        c[g2 >> 2] = f2;
        b[a2 >> 1] = e2;
        i2 = C2;
        return;
      }
      s2 = y2 + 36 | 0;
      t2 = y2 + 32 | 0;
      u2 = y2 + 28 | 0;
      v2 = y2 + 24 | 0;
      w2 = y2 + 20 | 0;
      x2 = y2 + 16 | 0;
      p2 = y2 + 12 | 0;
      q2 = y2 + 8 | 0;
      r2 = y2 + 4 | 0;
      d2 = y2;
      j2 = d2 + 40 | 0;
      do {
        c[d2 >> 2] = 0;
        d2 = d2 + 4 | 0;
      } while ((d2 | 0) < (j2 | 0));
      o2 = 7;
      d2 = 0;
      while (1) {
        n2 = b[a2 + 160 + (o2 << 1) >> 1] | 0;
        j2 = n2 << 16 >> 16;
        if (n2 << 16 >> 16 < 0)
          j2 = ~((j2 ^ -4) >> 2);
        else
          j2 = j2 >>> 2;
        d2 = Rd(d2, j2 & 65535, h2) | 0;
        l2 = o2 * 10 | 0;
        n2 = 9;
        while (1) {
          m2 = y2 + (n2 << 2) | 0;
          k2 = c[m2 >> 2] | 0;
          D2 = b[a2 + (n2 + l2 << 1) >> 1] | 0;
          j2 = D2 + k2 | 0;
          if ((D2 ^ k2 | 0) > -1 & (j2 ^ k2 | 0) < 0) {
            c[h2 >> 2] = 1;
            j2 = (k2 >>> 31) + 2147483647 | 0;
          }
          c[m2 >> 2] = j2;
          if ((n2 | 0) > 0)
            n2 = n2 + -1 | 0;
          else
            break;
        }
        if ((o2 | 0) > 0)
          o2 = o2 + -1 | 0;
        else
          break;
      }
      j2 = d2 << 16 >> 16;
      if (d2 << 16 >> 16 < 0)
        j2 = ~((j2 ^ -2) >> 1);
      else
        j2 = j2 >>> 1;
      b[A2 + 18 >> 1] = (c[s2 >> 2] | 0) >>> 3;
      b[A2 + 16 >> 1] = (c[t2 >> 2] | 0) >>> 3;
      b[A2 + 14 >> 1] = (c[u2 >> 2] | 0) >>> 3;
      b[A2 + 12 >> 1] = (c[v2 >> 2] | 0) >>> 3;
      b[A2 + 10 >> 1] = (c[w2 >> 2] | 0) >>> 3;
      b[A2 + 8 >> 1] = (c[x2 >> 2] | 0) >>> 3;
      b[A2 + 6 >> 1] = (c[p2 >> 2] | 0) >>> 3;
      b[A2 + 4 >> 1] = (c[q2 >> 2] | 0) >>> 3;
      b[A2 + 2 >> 1] = (c[r2 >> 2] | 0) >>> 3;
      b[A2 >> 1] = (c[y2 >> 2] | 0) >>> 3;
      d2 = a2 + 178 | 0;
      j2 = (((j2 << 16) + 167772160 | 0) >>> 16) + 128 | 0;
      b[d2 >> 1] = j2;
      j2 = j2 << 16;
      if ((j2 | 0) < 0)
        j2 = ~((j2 >> 16 ^ -256) >> 8);
      else
        j2 = j2 >> 24;
      b[d2 >> 1] = j2;
      if ((j2 | 0) <= 63) {
        if ((j2 | 0) < 0) {
          b[d2 >> 1] = 0;
          j2 = 0;
        }
      } else {
        b[d2 >> 1] = 63;
        j2 = 63;
      }
      D2 = Ge(j2 << 8 & 65535, 11560, h2) | 0;
      D2 = D2 << 16 >> 16 > 0 ? 0 : D2 << 16 >> 16 < -14436 ? -14436 : D2;
      b[f2 >> 1] = D2;
      b[f2 + 2 >> 1] = D2;
      b[f2 + 4 >> 1] = D2;
      b[f2 + 6 >> 1] = D2;
      D2 = ((D2 << 16 >> 16) * 5443 | 0) >>> 15 & 65535;
      b[f2 + 8 >> 1] = D2;
      b[f2 + 10 >> 1] = D2;
      b[f2 + 12 >> 1] = D2;
      b[f2 + 14 >> 1] = D2;
      ne(A2, z2, 10, h2);
      Ae(z2, 205, 10, h2);
      me(z2, A2, 10, h2);
      f2 = a2 + 182 | 0;
      D2 = a2 + 180 | 0;
      te(e2, 8, A2, B2, f2, D2, h2);
      h2 = f2;
      f2 = d2;
      D2 = b[D2 >> 1] | 0;
      e2 = c[g2 >> 2] | 0;
      B2 = e2 + 2 | 0;
      b[e2 >> 1] = D2;
      h2 = b[h2 >> 1] | 0;
      D2 = e2 + 4 | 0;
      b[B2 >> 1] = h2;
      B2 = a2 + 184 | 0;
      B2 = b[B2 >> 1] | 0;
      h2 = e2 + 6 | 0;
      b[D2 >> 1] = B2;
      a2 = a2 + 186 | 0;
      a2 = b[a2 >> 1] | 0;
      D2 = e2 + 8 | 0;
      b[h2 >> 1] = a2;
      a2 = b[f2 >> 1] | 0;
      e2 = e2 + 10 | 0;
      c[g2 >> 2] = e2;
      b[D2 >> 1] = a2;
      i2 = C2;
      return;
    }
    function nc(a2, d2, f2, g2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      var h2 = 0, j2 = 0, k2 = 0, l2 = 0, m2 = 0, n2 = 0;
      n2 = i2;
      i2 = i2 + 16 | 0;
      k2 = n2 + 2 | 0;
      m2 = n2;
      l2 = a2 + 176 | 0;
      j2 = (e[l2 >> 1] | 0) + 1 | 0;
      j2 = (j2 & 65535 | 0) == 8 ? 0 : j2 & 65535;
      b[l2 >> 1] = j2;
      j2 = a2 + ((j2 << 16 >> 16) * 10 << 1) | 0;
      h2 = j2 + 20 | 0;
      do {
        b[j2 >> 1] = b[d2 >> 1] | 0;
        j2 = j2 + 2 | 0;
        d2 = d2 + 2 | 0;
      } while ((j2 | 0) < (h2 | 0));
      d2 = 0;
      h2 = 160;
      while (1) {
        j2 = b[f2 >> 1] | 0;
        d2 = (Z(j2 << 1, j2) | 0) + d2 | 0;
        if ((d2 | 0) < 0) {
          d2 = 2147483647;
          break;
        }
        h2 = h2 + -1 << 16 >> 16;
        if (!(h2 << 16 >> 16))
          break;
        else
          f2 = f2 + 2 | 0;
      }
      de(d2, k2, m2, g2);
      d2 = b[k2 >> 1] | 0;
      k2 = d2 << 16 >> 16;
      f2 = k2 << 10;
      if ((f2 | 0) != (k2 << 26 >> 16 | 0)) {
        c[g2 >> 2] = 1;
        f2 = d2 << 16 >> 16 > 0 ? 32767 : -32768;
      }
      b[a2 + 160 + (b[l2 >> 1] << 1) >> 1] = (((b[m2 >> 1] | 0) >>> 5) + f2 << 16) + -558432256 >> 17;
      i2 = n2;
      return;
    }
    function oc(a2, d2, e2, f2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      var g2 = 0, h2 = 0, i3 = 0;
      h2 = a2 + 190 | 0;
      i3 = Rd(b[h2 >> 1] | 0, 1, f2) | 0;
      b[h2 >> 1] = i3;
      g2 = a2 + 188 | 0;
      do
        if (!(d2 << 16 >> 16)) {
          a2 = b[g2 >> 1] | 0;
          if (!(a2 << 16 >> 16)) {
            b[h2 >> 1] = 0;
            c[e2 >> 2] = 8;
            a2 = 1;
            break;
          }
          h2 = (a2 & 65535) + 65535 & 65535;
          b[g2 >> 1] = h2;
          if ((Rd(i3, h2, f2) | 0) << 16 >> 16 < 30) {
            c[e2 >> 2] = 8;
            a2 = 0;
          } else
            a2 = 0;
        } else {
          b[g2 >> 1] = 7;
          a2 = 0;
        }
      while (0);
      return a2 | 0;
    }
    function pc(a2, b2, c2, d2, e2, f2, g2, h2) {
      a2 = a2 | 0;
      b2 = b2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      if (!(f2 << 16 >> 16)) {
        f2 = a2 << 16 >> 16;
        if (((f2 << 16) + -5570560 | 0) < 65536) {
          b2 = (f2 * 3 | 0) + -58 + (b2 << 16 >> 16) | 0;
          b2 = b2 & 65535;
          return b2 | 0;
        } else {
          b2 = f2 + 112 | 0;
          b2 = b2 & 65535;
          return b2 | 0;
        }
      }
      if (!(g2 << 16 >> 16)) {
        h2 = (a2 & 65535) - (d2 & 65535) << 16;
        b2 = (b2 << 16 >> 16) + 2 + (h2 >> 15) + (h2 >> 16) | 0;
        b2 = b2 & 65535;
        return b2 | 0;
      }
      d2 = d2 << 16 >> 16;
      d2 = (((c2 & 65535) - d2 << 16) + -327680 | 0) > 0 ? d2 + 5 & 65535 : c2;
      e2 = e2 << 16 >> 16;
      c2 = a2 << 16 >> 16;
      d2 = (((e2 - (d2 & 65535) << 16) + -262144 | 0) > 0 ? e2 + 65532 & 65535 : d2) << 16 >> 16;
      e2 = d2 * 196608 | 0;
      a2 = e2 + -393216 >> 16;
      f2 = ((b2 & 65535) << 16) + (c2 * 196608 | 0) >> 16;
      if (!(a2 - f2 & 32768)) {
        b2 = c2 + 5 - d2 | 0;
        b2 = b2 & 65535;
        return b2 | 0;
      }
      if ((e2 + 196608 >> 16 | 0) > (f2 | 0)) {
        b2 = f2 + 3 - a2 | 0;
        b2 = b2 & 65535;
        return b2 | 0;
      } else {
        b2 = c2 + 11 - d2 | 0;
        b2 = b2 & 65535;
        return b2 | 0;
      }
    }
    function qc(a2, b2, c2, d2, e2) {
      a2 = a2 | 0;
      b2 = b2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      e2 = a2 << 16 >> 16;
      do
        if (!(d2 << 16 >> 16))
          if (a2 << 16 >> 16 < 95) {
            e2 = ((e2 * 393216 | 0) + -6881280 >> 16) + (b2 << 16 >> 16) | 0;
            break;
          } else {
            e2 = e2 + 368 | 0;
            break;
          }
        else
          e2 = ((((e2 - (c2 & 65535) | 0) * 393216 | 0) + 196608 | 0) >>> 16) + (b2 & 65535) | 0;
      while (0);
      return e2 & 65535 | 0;
    }
    function rc(d2, f2, g2, h2) {
      d2 = d2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      var i3 = 0, j2 = 0, k2 = 0, l2 = 0, m2 = 0, n2 = 0;
      i3 = c[h2 + 96 >> 2] | 0;
      if (d2 >>> 0 < 8) {
        m2 = (c[h2 + 100 >> 2] | 0) + (d2 << 2) | 0;
        l2 = c[m2 >> 2] | 0;
        a[g2 >> 0] = b[f2 + (b[l2 >> 1] << 1) >> 1] << 4 | d2 | b[f2 + (b[l2 + 2 >> 1] << 1) >> 1] << 5 | b[f2 + (b[l2 + 4 >> 1] << 1) >> 1] << 6 | b[f2 + (b[l2 + 6 >> 1] << 1) >> 1] << 7;
        l2 = i3 + (d2 << 1) | 0;
        h2 = b[l2 >> 1] | 0;
        if ((h2 + -7 | 0) > 4) {
          i3 = 4;
          k2 = 4;
          d2 = 1;
          while (1) {
            n2 = b[f2 + (b[(c[m2 >> 2] | 0) + (i3 << 1) >> 1] << 1) >> 1] | 0;
            h2 = g2 + (d2 << 16 >> 16) | 0;
            a[h2 >> 0] = n2;
            n2 = e[f2 + (b[(c[m2 >> 2] | 0) + ((k2 | 1) << 16 >> 16 << 1) >> 1] << 1) >> 1] << 1 | n2 & 65535;
            a[h2 >> 0] = n2;
            n2 = e[f2 + (b[(c[m2 >> 2] | 0) + ((k2 | 2) << 16 >> 16 << 1) >> 1] << 1) >> 1] << 2 | n2;
            a[h2 >> 0] = n2;
            n2 = e[f2 + (b[(c[m2 >> 2] | 0) + ((k2 | 3) << 16 >> 16 << 1) >> 1] << 1) >> 1] << 3 | n2;
            a[h2 >> 0] = n2;
            n2 = e[f2 + (b[(c[m2 >> 2] | 0) + (k2 + 4 << 16 >> 16 << 16 >> 16 << 1) >> 1] << 1) >> 1] << 4 | n2;
            a[h2 >> 0] = n2;
            n2 = e[f2 + (b[(c[m2 >> 2] | 0) + (k2 + 5 << 16 >> 16 << 16 >> 16 << 1) >> 1] << 1) >> 1] << 5 | n2;
            a[h2 >> 0] = n2;
            n2 = e[f2 + (b[(c[m2 >> 2] | 0) + (k2 + 6 << 16 >> 16 << 16 >> 16 << 1) >> 1] << 1) >> 1] << 6 | n2;
            a[h2 >> 0] = n2;
            j2 = k2 + 8 << 16 >> 16;
            d2 = d2 + 1 << 16 >> 16;
            a[h2 >> 0] = e[f2 + (b[(c[m2 >> 2] | 0) + (k2 + 7 << 16 >> 16 << 16 >> 16 << 1) >> 1] << 1) >> 1] << 7 | n2;
            i3 = j2 << 16 >> 16;
            h2 = b[l2 >> 1] | 0;
            if ((i3 | 0) >= (h2 + -7 | 0))
              break;
            else
              k2 = j2;
          }
        } else {
          j2 = 4;
          d2 = 1;
        }
        l2 = h2 + 4 & 7;
        if (!l2)
          return;
        i3 = g2 + (d2 << 16 >> 16) | 0;
        a[i3 >> 0] = 0;
        h2 = 0;
        k2 = 0;
        d2 = 0;
        while (1) {
          k2 = (e[f2 + (b[(c[m2 >> 2] | 0) + (j2 << 16 >> 16 << 1) >> 1] << 1) >> 1] & 255) << h2 | k2 & 255;
          a[i3 >> 0] = k2;
          d2 = d2 + 1 << 16 >> 16;
          h2 = d2 << 16 >> 16;
          if ((h2 | 0) >= (l2 | 0))
            break;
          else
            j2 = j2 + 1 << 16 >> 16;
        }
        return;
      }
      if ((d2 | 0) == 15) {
        a[g2 >> 0] = 15;
        return;
      }
      a[g2 >> 0] = b[f2 >> 1] << 4 | d2 | b[f2 + 2 >> 1] << 5 | b[f2 + 4 >> 1] << 6 | b[f2 + 6 >> 1] << 7;
      h2 = i3 + (d2 << 1) | 0;
      d2 = b[h2 >> 1] | 0;
      i3 = ((d2 & 65535) << 16) + 262144 >> 16;
      m2 = i3 & -8;
      k2 = (m2 + 524281 | 0) >>> 3 & 65535;
      if (k2 << 16 >> 16 > 0) {
        i3 = ((i3 & -8) + 524281 | 0) >>> 3;
        l2 = ((i3 << 3) + 524280 & 524280) + 12 | 0;
        j2 = 1;
        d2 = f2 + 8 | 0;
        while (1) {
          a[g2 + (j2 << 16 >> 16) >> 0] = e[d2 + 2 >> 1] << 1 | e[d2 >> 1] | e[d2 + 4 >> 1] << 2 | e[d2 + 6 >> 1] << 3 | e[d2 + 8 >> 1] << 4 | e[d2 + 10 >> 1] << 5 | e[d2 + 12 >> 1] << 6 | e[d2 + 14 >> 1] << 7;
          if (k2 << 16 >> 16 > 1) {
            k2 = k2 + -1 << 16 >> 16;
            j2 = j2 + 1 << 16 >> 16;
            d2 = d2 + 16 | 0;
          } else
            break;
        }
        d2 = b[h2 >> 1] | 0;
        j2 = (i3 << 16) + 65536 >> 16;
      } else {
        l2 = 4;
        j2 = 1;
      }
      d2 = (0 - m2 | 4) + (d2 & 65535) << 16;
      k2 = d2 >> 16;
      if (!k2)
        return;
      j2 = g2 + j2 | 0;
      a[j2 >> 0] = 0;
      if ((d2 | 0) > 0) {
        d2 = 0;
        i3 = 0;
        h2 = 0;
      } else
        return;
      do {
        i3 = i3 & 255 | b[f2 + (l2 + d2 << 1) >> 1] << d2;
        a[j2 >> 0] = i3;
        h2 = h2 + 1 << 16 >> 16;
        d2 = h2 << 16 >> 16;
      } while ((d2 | 0) < (k2 | 0));
      return;
    }
    function sc(d2, f2, g2, h2) {
      d2 = d2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      var i3 = 0, j2 = 0, k2 = 0, l2 = 0, m2 = 0, n2 = 0, o2 = 0, p2 = 0;
      o2 = c[h2 + 100 >> 2] | 0;
      n2 = c[h2 + 96 >> 2] | 0;
      a[g2 >> 0] = d2 & 15;
      n2 = n2 + (d2 << 1) | 0;
      i3 = b[n2 >> 1] | 0;
      if (d2 >>> 0 >= 8) {
        l2 = ((i3 & 65535) << 16) + -458752 | 0;
        if ((l2 | 0) > 0) {
          m2 = 1;
          k2 = f2;
          while (1) {
            f2 = k2 + 16 | 0;
            h2 = m2 + 1 << 16 >> 16;
            a[g2 + (m2 << 16 >> 16) >> 0] = e[k2 + 14 >> 1] | e[k2 + 12 >> 1] << 1 | ((e[k2 + 2 >> 1] << 6 | e[k2 >> 1] << 7 | e[k2 + 4 >> 1] << 5 | e[k2 + 6 >> 1] << 4) & 240 | e[k2 + 8 >> 1] << 3 | e[k2 + 10 >> 1] << 2) & 252;
            l2 = l2 + -524288 & -65536;
            if ((l2 | 0) <= 0)
              break;
            else {
              m2 = h2;
              k2 = f2;
            }
          }
          i3 = b[n2 >> 1] | 0;
        } else
          h2 = 1;
        m2 = i3 & 7;
        i3 = g2 + (h2 << 16 >> 16) | 0;
        a[i3 >> 0] = 0;
        if (!m2)
          return;
        else {
          j2 = 0;
          k2 = 0;
          l2 = 0;
          h2 = f2;
        }
        while (1) {
          k2 = k2 & 255 | b[h2 >> 1] << 7 - j2;
          a[i3 >> 0] = k2;
          l2 = l2 + 1 << 16 >> 16;
          j2 = l2 << 16 >> 16;
          if ((j2 | 0) >= (m2 | 0))
            break;
          else
            h2 = h2 + 2 | 0;
        }
        return;
      }
      k2 = i3 << 16 >> 16;
      if (i3 << 16 >> 16 > 7) {
        i3 = o2 + (d2 << 2) | 0;
        h2 = 0;
        m2 = 0;
        j2 = 1;
        while (1) {
          p2 = e[f2 + (b[(c[i3 >> 2] | 0) + (h2 << 1) >> 1] << 1) >> 1] << 7;
          k2 = g2 + (j2 << 16 >> 16) | 0;
          a[k2 >> 0] = p2;
          p2 = e[f2 + (b[(c[i3 >> 2] | 0) + ((m2 | 1) << 16 >> 16 << 1) >> 1] << 1) >> 1] << 6 | p2;
          a[k2 >> 0] = p2;
          p2 = e[f2 + (b[(c[i3 >> 2] | 0) + ((m2 | 2) << 16 >> 16 << 1) >> 1] << 1) >> 1] << 5 | p2;
          a[k2 >> 0] = p2;
          p2 = e[f2 + (b[(c[i3 >> 2] | 0) + ((m2 | 3) << 16 >> 16 << 1) >> 1] << 1) >> 1] << 4 | p2;
          a[k2 >> 0] = p2;
          p2 = e[f2 + (b[(c[i3 >> 2] | 0) + ((m2 | 4) << 16 >> 16 << 1) >> 1] << 1) >> 1] << 3 | p2 & 240;
          a[k2 >> 0] = p2;
          p2 = e[f2 + (b[(c[i3 >> 2] | 0) + ((m2 | 5) << 16 >> 16 << 1) >> 1] << 1) >> 1] << 2 | p2;
          a[k2 >> 0] = p2;
          p2 = e[f2 + (b[(c[i3 >> 2] | 0) + ((m2 | 6) << 16 >> 16 << 1) >> 1] << 1) >> 1] << 1 | p2;
          a[k2 >> 0] = p2;
          l2 = m2 + 8 << 16 >> 16;
          j2 = j2 + 1 << 16 >> 16;
          a[k2 >> 0] = p2 & 254 | e[f2 + (b[(c[i3 >> 2] | 0) + ((m2 | 7) << 16 >> 16 << 1) >> 1] << 1) >> 1];
          h2 = l2 << 16 >> 16;
          k2 = b[n2 >> 1] | 0;
          if ((h2 | 0) >= (k2 + -7 | 0))
            break;
          else
            m2 = l2;
        }
      } else {
        l2 = 0;
        j2 = 1;
      }
      n2 = k2 & 7;
      m2 = g2 + (j2 << 16 >> 16) | 0;
      a[m2 >> 0] = 0;
      if (!n2)
        return;
      j2 = o2 + (d2 << 2) | 0;
      i3 = 0;
      h2 = 0;
      k2 = 0;
      while (1) {
        h2 = (e[f2 + (b[(c[j2 >> 2] | 0) + (l2 << 16 >> 16 << 1) >> 1] << 1) >> 1] & 255) << 7 - i3 | h2 & 255;
        a[m2 >> 0] = h2;
        k2 = k2 + 1 << 16 >> 16;
        i3 = k2 << 16 >> 16;
        if ((i3 | 0) >= (n2 | 0))
          break;
        else
          l2 = l2 + 1 << 16 >> 16;
      }
      return;
    }
    function tc(d2, f2, g2, h2) {
      d2 = d2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      var i3 = 0, j2 = 0, k2 = 0, l2 = 0, m2 = 0, n2 = 0, o2 = 0, p2 = 0;
      o2 = c[h2 + 100 >> 2] | 0;
      n2 = c[h2 + 96 >> 2] | 0;
      a[g2 >> 0] = d2 << 3;
      n2 = n2 + (d2 << 1) | 0;
      i3 = b[n2 >> 1] | 0;
      if (d2 >>> 0 >= 8) {
        l2 = ((i3 & 65535) << 16) + -458752 | 0;
        if ((l2 | 0) > 0) {
          m2 = 1;
          k2 = f2;
          while (1) {
            f2 = k2 + 16 | 0;
            h2 = m2 + 1 << 16 >> 16;
            a[g2 + (m2 << 16 >> 16) >> 0] = e[k2 + 14 >> 1] | e[k2 + 12 >> 1] << 1 | ((e[k2 + 2 >> 1] << 6 | e[k2 >> 1] << 7 | e[k2 + 4 >> 1] << 5 | e[k2 + 6 >> 1] << 4) & 240 | e[k2 + 8 >> 1] << 3 | e[k2 + 10 >> 1] << 2) & 252;
            l2 = l2 + -524288 & -65536;
            if ((l2 | 0) <= 0)
              break;
            else {
              m2 = h2;
              k2 = f2;
            }
          }
          i3 = b[n2 >> 1] | 0;
        } else
          h2 = 1;
        m2 = i3 & 7;
        i3 = g2 + (h2 << 16 >> 16) | 0;
        a[i3 >> 0] = 0;
        if (!m2)
          return;
        else {
          j2 = 0;
          k2 = 0;
          l2 = 0;
          h2 = f2;
        }
        while (1) {
          k2 = k2 & 255 | b[h2 >> 1] << 7 - j2;
          a[i3 >> 0] = k2;
          l2 = l2 + 1 << 16 >> 16;
          j2 = l2 << 16 >> 16;
          if ((j2 | 0) >= (m2 | 0))
            break;
          else
            h2 = h2 + 2 | 0;
        }
        return;
      }
      k2 = i3 << 16 >> 16;
      if (i3 << 16 >> 16 > 7) {
        i3 = o2 + (d2 << 2) | 0;
        h2 = 0;
        m2 = 0;
        j2 = 1;
        while (1) {
          p2 = e[f2 + (b[(c[i3 >> 2] | 0) + (h2 << 1) >> 1] << 1) >> 1] << 7;
          k2 = g2 + (j2 << 16 >> 16) | 0;
          a[k2 >> 0] = p2;
          p2 = e[f2 + (b[(c[i3 >> 2] | 0) + ((m2 | 1) << 16 >> 16 << 1) >> 1] << 1) >> 1] << 6 | p2;
          a[k2 >> 0] = p2;
          p2 = e[f2 + (b[(c[i3 >> 2] | 0) + ((m2 | 2) << 16 >> 16 << 1) >> 1] << 1) >> 1] << 5 | p2;
          a[k2 >> 0] = p2;
          p2 = e[f2 + (b[(c[i3 >> 2] | 0) + ((m2 | 3) << 16 >> 16 << 1) >> 1] << 1) >> 1] << 4 | p2;
          a[k2 >> 0] = p2;
          p2 = e[f2 + (b[(c[i3 >> 2] | 0) + ((m2 | 4) << 16 >> 16 << 1) >> 1] << 1) >> 1] << 3 | p2 & 240;
          a[k2 >> 0] = p2;
          p2 = e[f2 + (b[(c[i3 >> 2] | 0) + ((m2 | 5) << 16 >> 16 << 1) >> 1] << 1) >> 1] << 2 | p2;
          a[k2 >> 0] = p2;
          p2 = e[f2 + (b[(c[i3 >> 2] | 0) + ((m2 | 6) << 16 >> 16 << 1) >> 1] << 1) >> 1] << 1 | p2;
          a[k2 >> 0] = p2;
          l2 = m2 + 8 << 16 >> 16;
          j2 = j2 + 1 << 16 >> 16;
          a[k2 >> 0] = p2 & 254 | e[f2 + (b[(c[i3 >> 2] | 0) + ((m2 | 7) << 16 >> 16 << 1) >> 1] << 1) >> 1];
          h2 = l2 << 16 >> 16;
          k2 = b[n2 >> 1] | 0;
          if ((h2 | 0) >= (k2 + -7 | 0))
            break;
          else
            m2 = l2;
        }
      } else {
        l2 = 0;
        j2 = 1;
      }
      n2 = k2 & 7;
      m2 = g2 + (j2 << 16 >> 16) | 0;
      a[m2 >> 0] = 0;
      if (!n2)
        return;
      j2 = o2 + (d2 << 2) | 0;
      i3 = 0;
      h2 = 0;
      k2 = 0;
      while (1) {
        h2 = (e[f2 + (b[(c[j2 >> 2] | 0) + (l2 << 16 >> 16 << 1) >> 1] << 1) >> 1] & 255) << 7 - i3 | h2 & 255;
        a[m2 >> 0] = h2;
        k2 = k2 + 1 << 16 >> 16;
        i3 = k2 << 16 >> 16;
        if ((i3 | 0) >= (n2 | 0))
          break;
        else
          l2 = l2 + 1 << 16 >> 16;
      }
      return;
    }
    function uc(a2) {
      a2 = a2 | 0;
      var d2 = 0;
      if (!a2) {
        a2 = -1;
        return a2 | 0;
      }
      c[a2 >> 2] = 0;
      d2 = Je(16) | 0;
      if (!d2) {
        a2 = -1;
        return a2 | 0;
      }
      b[d2 >> 1] = 0;
      b[d2 + 2 >> 1] = 0;
      b[d2 + 4 >> 1] = 0;
      b[d2 + 6 >> 1] = 0;
      b[d2 + 8 >> 1] = 0;
      b[d2 + 10 >> 1] = 0;
      b[d2 + 12 >> 1] = 0;
      b[d2 + 14 >> 1] = 0;
      c[a2 >> 2] = d2;
      a2 = 0;
      return a2 | 0;
    }
    function vc(a2) {
      a2 = a2 | 0;
      if (!a2) {
        a2 = -1;
        return a2 | 0;
      }
      b[a2 >> 1] = 0;
      b[a2 + 2 >> 1] = 0;
      b[a2 + 4 >> 1] = 0;
      b[a2 + 6 >> 1] = 0;
      b[a2 + 8 >> 1] = 0;
      b[a2 + 10 >> 1] = 0;
      b[a2 + 12 >> 1] = 0;
      b[a2 + 14 >> 1] = 0;
      a2 = 0;
      return a2 | 0;
    }
    function wc(a2) {
      a2 = a2 | 0;
      var b2 = 0;
      if (!a2)
        return;
      b2 = c[a2 >> 2] | 0;
      if (!b2)
        return;
      Ke(b2);
      c[a2 >> 2] = 0;
      return;
    }
    function xc(a2, d2, e2, f2, g2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      var h2 = 0, i3 = 0, j2 = 0, k2 = 0, l2 = 0;
      j2 = d2 << 16 >> 16 < 2722 ? 0 : d2 << 16 >> 16 < 5444 ? 1 : 2;
      i3 = Ee(e2, 1, g2) | 0;
      l2 = a2 + 4 | 0;
      if (!(e2 << 16 >> 16 > 200 ? i3 << 16 >> 16 > (b[l2 >> 1] | 0) : 0)) {
        i3 = b[a2 >> 1] | 0;
        if (i3 << 16 >> 16) {
          h2 = i3 + -1 << 16 >> 16;
          b[a2 >> 1] = h2;
          h2 = h2 << 16 >> 16 != 0;
          k2 = 5;
        }
      } else {
        b[a2 >> 1] = 8;
        h2 = 1;
        k2 = 5;
      }
      if ((k2 | 0) == 5) {
        if ((j2 & 65535) < 2 & h2)
          j2 = (j2 & 65535) + 1 & 65535;
      }
      k2 = a2 + 6 | 0;
      b[k2 >> 1] = d2;
      h2 = Zd(k2, 5) | 0;
      if (!(j2 << 16 >> 16 != 0 | h2 << 16 >> 16 > 5443))
        if (h2 << 16 >> 16 < 0)
          h2 = 16384;
        else {
          h2 = h2 << 16 >> 16;
          h2 = (((h2 << 18 >> 18 | 0) == (h2 | 0) ? h2 << 2 : h2 >>> 15 ^ 32767) << 16 >> 16) * 24660 >> 15;
          if ((h2 | 0) > 32767) {
            c[g2 >> 2] = 1;
            h2 = 32767;
          }
          h2 = 16384 - h2 & 65535;
        }
      else
        h2 = 0;
      i3 = a2 + 2 | 0;
      if (!(b[i3 >> 1] | 0))
        h2 = De(h2, 1, g2) | 0;
      b[f2 >> 1] = h2;
      b[i3 >> 1] = h2;
      b[l2 >> 1] = e2;
      f2 = a2 + 12 | 0;
      b[a2 + 14 >> 1] = b[f2 >> 1] | 0;
      e2 = a2 + 10 | 0;
      b[f2 >> 1] = b[e2 >> 1] | 0;
      a2 = a2 + 8 | 0;
      b[e2 >> 1] = b[a2 >> 1] | 0;
      b[a2 >> 1] = b[k2 >> 1] | 0;
      return;
    }
    function yc(a2) {
      a2 = a2 | 0;
      var d2 = 0, e2 = 0, f2 = 0, g2 = 0, h2 = 0, i3 = 0;
      if (!a2) {
        a2 = -1;
        return a2 | 0;
      }
      c[a2 >> 2] = 0;
      d2 = Je(68) | 0;
      f2 = d2;
      if (!d2) {
        a2 = -1;
        return a2 | 0;
      }
      c[d2 + 28 >> 2] = 0;
      g2 = d2 + 64 | 0;
      c[g2 >> 2] = 0;
      h2 = d2 + 32 | 0;
      if (((Ud(h2) | 0) << 16 >> 16 == 0 ? (i3 = d2 + 48 | 0, (Ud(i3) | 0) << 16 >> 16 == 0) : 0) ? (uc(g2) | 0) << 16 >> 16 == 0 : 0) {
        e2 = d2 + 32 | 0;
        do {
          b[d2 >> 1] = 0;
          d2 = d2 + 2 | 0;
        } while ((d2 | 0) < (e2 | 0));
        Ud(h2) | 0;
        Ud(i3) | 0;
        vc(c[g2 >> 2] | 0) | 0;
        c[a2 >> 2] = f2;
        a2 = 0;
        return a2 | 0;
      }
      wc(g2);
      Ke(d2);
      a2 = -1;
      return a2 | 0;
    }
    function zc(a2) {
      a2 = a2 | 0;
      var b2 = 0;
      if (!a2)
        return;
      b2 = c[a2 >> 2] | 0;
      if (!b2)
        return;
      wc(b2 + 64 | 0);
      Ke(c[a2 >> 2] | 0);
      c[a2 >> 2] = 0;
      return;
    }
    function Ac(a2) {
      a2 = a2 | 0;
      var d2 = 0, e2 = 0, f2 = 0;
      if (!a2) {
        f2 = -1;
        return f2 | 0;
      }
      d2 = a2 + 32 | 0;
      e2 = a2;
      f2 = e2 + 32 | 0;
      do {
        b[e2 >> 1] = 0;
        e2 = e2 + 2 | 0;
      } while ((e2 | 0) < (f2 | 0));
      Ud(d2) | 0;
      Ud(a2 + 48 | 0) | 0;
      vc(c[a2 + 64 >> 2] | 0) | 0;
      f2 = 0;
      return f2 | 0;
    }
    function Bc(a2, d2, f2, g2, h2, j2, k2, l2, m2, n2, o2, p2, q2, r2, s2, t2, u2, v2, w2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      j2 = j2 | 0;
      k2 = k2 | 0;
      l2 = l2 | 0;
      m2 = m2 | 0;
      n2 = n2 | 0;
      o2 = o2 | 0;
      p2 = p2 | 0;
      q2 = q2 | 0;
      r2 = r2 | 0;
      s2 = s2 | 0;
      t2 = t2 | 0;
      u2 = u2 | 0;
      v2 = v2 | 0;
      w2 = w2 | 0;
      var x2 = 0, y2 = 0, z2 = 0, A2 = 0, B2 = 0, C2 = 0, D2 = 0, E2 = 0, F2 = 0, G2 = 0, H2 = 0;
      H2 = i2;
      i2 = i2 + 48 | 0;
      y2 = H2 + 34 | 0;
      A2 = H2 + 32 | 0;
      C2 = H2 + 30 | 0;
      B2 = H2 + 28 | 0;
      z2 = H2 + 18 | 0;
      x2 = H2 + 8 | 0;
      D2 = H2 + 6 | 0;
      E2 = H2 + 4 | 0;
      F2 = H2 + 2 | 0;
      G2 = H2;
      if (d2) {
        o2 = a2 + 32 | 0;
        Vd(o2, d2, h2, y2, A2, D2, E2, w2);
        do
          if ((d2 | 0) != 7) {
            Vb(d2, j2, k2, l2, m2, n2, z2, x2, G2, F2, w2);
            if ((d2 | 0) == 5) {
              ld(c[a2 + 64 >> 2] | 0, f2, g2, h2, z2, x2, b[D2 >> 1] | 0, b[E2 >> 1] | 0, b[y2 >> 1] | 0, b[A2 >> 1] | 0, 40, b[G2 >> 1] | 0, b[F2 >> 1] | 0, p2, s2, t2, C2, B2, u2, v2, w2);
              break;
            } else {
              a2 = od(d2, b[y2 >> 1] | 0, b[A2 >> 1] | 0, z2, x2, p2, s2, t2, C2, B2, v2, w2) | 0;
              j2 = c[u2 >> 2] | 0;
              c[u2 >> 2] = j2 + 2;
              b[j2 >> 1] = a2;
              break;
            }
          } else {
            b[t2 >> 1] = Cc(k2, m2, w2) | 0;
            a2 = md(7, b[y2 >> 1] | 0, b[A2 >> 1] | 0, t2, C2, B2, c[v2 + 68 >> 2] | 0, w2) | 0;
            j2 = c[u2 >> 2] | 0;
            c[u2 >> 2] = j2 + 2;
            b[j2 >> 1] = a2;
          }
        while (0);
        Wd(o2, b[C2 >> 1] | 0, b[B2 >> 1] | 0);
        i2 = H2;
        return;
      }
      if (!(o2 << 16 >> 16)) {
        Vd(a2 + 48 | 0, 0, h2, y2, A2, D2, E2, w2);
        Vb(0, j2, k2, l2, m2, n2, z2, x2, G2, F2, w2);
        Wb(j2, D2, E2, w2);
        j2 = jd(a2 + 32 | 0, b[a2 >> 1] | 0, b[a2 + 2 >> 1] | 0, a2 + 8 | 0, a2 + 18 | 0, b[a2 + 4 >> 1] | 0, b[a2 + 6 >> 1] | 0, h2, b[y2 >> 1] | 0, b[A2 >> 1] | 0, x2, z2, b[D2 >> 1] | 0, b[E2 >> 1] | 0, p2, q2, r2, s2, t2, w2) | 0;
        b[c[a2 + 28 >> 2] >> 1] = j2;
        i2 = H2;
        return;
      }
      o2 = c[u2 >> 2] | 0;
      c[u2 >> 2] = o2 + 2;
      c[a2 + 28 >> 2] = o2;
      o2 = a2 + 48 | 0;
      f2 = a2 + 32 | 0;
      q2 = f2;
      q2 = e[q2 >> 1] | e[q2 + 2 >> 1] << 16;
      f2 = f2 + 4 | 0;
      f2 = e[f2 >> 1] | e[f2 + 2 >> 1] << 16;
      u2 = o2;
      r2 = u2;
      b[r2 >> 1] = q2;
      b[r2 + 2 >> 1] = q2 >>> 16;
      u2 = u2 + 4 | 0;
      b[u2 >> 1] = f2;
      b[u2 + 2 >> 1] = f2 >>> 16;
      u2 = a2 + 40 | 0;
      f2 = u2;
      f2 = e[f2 >> 1] | e[f2 + 2 >> 1] << 16;
      u2 = u2 + 4 | 0;
      u2 = e[u2 >> 1] | e[u2 + 2 >> 1] << 16;
      r2 = a2 + 56 | 0;
      q2 = r2;
      b[q2 >> 1] = f2;
      b[q2 + 2 >> 1] = f2 >>> 16;
      r2 = r2 + 4 | 0;
      b[r2 >> 1] = u2;
      b[r2 + 2 >> 1] = u2 >>> 16;
      r2 = a2 + 2 | 0;
      Vd(o2, 0, h2, a2, r2, D2, E2, w2);
      Vb(0, j2, k2, l2, m2, n2, a2 + 18 | 0, a2 + 8 | 0, G2, F2, w2);
      l2 = (e[F2 >> 1] | 0) + 1 | 0;
      u2 = b[G2 >> 1] | 0;
      q2 = l2 << 16 >> 16;
      if ((l2 & 65535) << 16 >> 16 < 0) {
        v2 = 0 - q2 << 16;
        if ((v2 | 0) < 983040)
          v2 = u2 << 16 >> 16 >> (v2 >> 16) & 65535;
        else
          v2 = 0;
      } else {
        u2 = u2 << 16 >> 16;
        v2 = u2 << q2;
        if ((v2 << 16 >> 16 >> q2 | 0) == (u2 | 0))
          v2 = v2 & 65535;
        else
          v2 = (u2 >>> 15 ^ 32767) & 65535;
      }
      b[t2 >> 1] = v2;
      Wb(j2, a2 + 4 | 0, a2 + 6 | 0, w2);
      id(o2, b[a2 >> 1] | 0, b[r2 >> 1] | 0, b[F2 >> 1] | 0, b[G2 >> 1] | 0, w2);
      i2 = H2;
      return;
    }
    function Cc(a2, c2, d2) {
      a2 = a2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      var e2 = 0, f2 = 0, g2 = 0;
      f2 = 10;
      d2 = a2;
      e2 = c2;
      a2 = 0;
      while (1) {
        a2 = (Z(b[e2 >> 1] >> 1, b[d2 >> 1] | 0) | 0) + a2 | 0;
        a2 = a2 + (Z(b[e2 + 2 >> 1] >> 1, b[d2 + 2 >> 1] | 0) | 0) | 0;
        a2 = a2 + (Z(b[e2 + 4 >> 1] >> 1, b[d2 + 4 >> 1] | 0) | 0) | 0;
        a2 = a2 + (Z(b[e2 + 6 >> 1] >> 1, b[d2 + 6 >> 1] | 0) | 0) | 0;
        f2 = f2 + -1 << 16 >> 16;
        if (!(f2 << 16 >> 16))
          break;
        else {
          d2 = d2 + 8 | 0;
          e2 = e2 + 8 | 0;
        }
      }
      d2 = a2 << 1;
      f2 = pe(d2 | 1) | 0;
      g2 = f2 << 16 >> 16;
      d2 = (f2 << 16 >> 16 < 17 ? d2 >> 17 - g2 : d2 << g2 + -17) & 65535;
      if (d2 << 16 >> 16 < 1) {
        c2 = 0;
        return c2 | 0;
      } else {
        f2 = 20;
        e2 = c2;
        a2 = 0;
      }
      while (1) {
        c2 = b[e2 >> 1] >> 1;
        c2 = ((Z(c2, c2) | 0) >>> 2) + a2 | 0;
        a2 = b[e2 + 2 >> 1] >> 1;
        a2 = c2 + ((Z(a2, a2) | 0) >>> 2) | 0;
        f2 = f2 + -1 << 16 >> 16;
        if (!(f2 << 16 >> 16))
          break;
        else
          e2 = e2 + 4 | 0;
      }
      a2 = a2 << 3;
      f2 = pe(a2) | 0;
      c2 = f2 << 16 >> 16;
      d2 = Td(d2, (f2 << 16 >> 16 < 16 ? a2 >> 16 - c2 : a2 << c2 + -16) & 65535) | 0;
      c2 = (g2 << 16) + 327680 - (c2 << 16) | 0;
      a2 = c2 >> 16;
      if ((c2 | 0) > 65536)
        a2 = d2 << 16 >> 16 >> a2 + -1;
      else
        a2 = d2 << 16 >> 16 << 1 - a2;
      c2 = a2 & 65535;
      return c2 | 0;
    }
    function Dc(a2, d2, e2, f2, g2, h2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      var i3 = 0, j2 = 0, k2 = 0, l2 = 0, m2 = 0, n2 = 0, o2 = 0, p2 = 0, q2 = 0, r2 = 0;
      c[h2 >> 2] = 0;
      m2 = g2 << 16 >> 16;
      k2 = m2 >>> 2 & 65535;
      o2 = k2 << 16 >> 16 == 0;
      if (o2)
        j2 = 0;
      else {
        l2 = k2;
        i3 = e2;
        j2 = 0;
        while (1) {
          p2 = b[i3 >> 1] | 0;
          p2 = (Z(p2, p2) | 0) + j2 | 0;
          j2 = b[i3 + 2 >> 1] | 0;
          j2 = p2 + (Z(j2, j2) | 0) | 0;
          p2 = b[i3 + 4 >> 1] | 0;
          p2 = j2 + (Z(p2, p2) | 0) | 0;
          j2 = b[i3 + 6 >> 1] | 0;
          j2 = p2 + (Z(j2, j2) | 0) | 0;
          l2 = l2 + -1 << 16 >> 16;
          if (!(l2 << 16 >> 16))
            break;
          else
            i3 = i3 + 8 | 0;
        }
      }
      if (!((j2 >>> 31 ^ 1) & (j2 | 0) < 1073741824)) {
        j2 = m2 >>> 1 & 65535;
        if (!(j2 << 16 >> 16))
          j2 = 1;
        else {
          i3 = j2;
          l2 = e2;
          j2 = 0;
          while (1) {
            p2 = b[l2 >> 1] >> 2;
            p2 = (Z(p2, p2) | 0) + j2 | 0;
            j2 = b[l2 + 2 >> 1] >> 2;
            j2 = p2 + (Z(j2, j2) | 0) | 0;
            i3 = i3 + -1 << 16 >> 16;
            if (!(i3 << 16 >> 16))
              break;
            else
              l2 = l2 + 4 | 0;
          }
          j2 = j2 << 1 | 1;
        }
        p2 = (pe(j2) | 0) << 16 >> 16;
        n2 = p2 + 65532 & 65535;
        p2 = Ce(j2 << p2, h2) | 0;
      } else {
        m2 = j2 << 1 | 1;
        p2 = pe(m2) | 0;
        n2 = p2;
        p2 = Ce(m2 << (p2 << 16 >> 16), h2) | 0;
      }
      c[h2 >> 2] = 0;
      do
        if (!(g2 << 16 >> 16)) {
          j2 = 1;
          q2 = 14;
        } else {
          m2 = g2;
          l2 = d2;
          j2 = e2;
          g2 = 0;
          while (1) {
            r2 = Z(b[j2 >> 1] | 0, b[l2 >> 1] | 0) | 0;
            i3 = r2 + g2 | 0;
            if ((r2 ^ g2 | 0) > 0 & (i3 ^ g2 | 0) < 0)
              break;
            m2 = m2 + -1 << 16 >> 16;
            if (!(m2 << 16 >> 16)) {
              q2 = 13;
              break;
            } else {
              l2 = l2 + 2 | 0;
              j2 = j2 + 2 | 0;
              g2 = i3;
            }
          }
          if ((q2 | 0) == 13) {
            j2 = i3 << 1 | 1;
            q2 = 14;
            break;
          }
          c[h2 >> 2] = 1;
          if (o2)
            j2 = 1;
          else {
            j2 = d2;
            i3 = 0;
            while (1) {
              i3 = (Z(b[e2 >> 1] >> 2, b[j2 >> 1] | 0) | 0) + i3 | 0;
              i3 = i3 + (Z(b[e2 + 2 >> 1] >> 2, b[j2 + 2 >> 1] | 0) | 0) | 0;
              i3 = i3 + (Z(b[e2 + 4 >> 1] >> 2, b[j2 + 4 >> 1] | 0) | 0) | 0;
              i3 = i3 + (Z(b[e2 + 6 >> 1] >> 2, b[j2 + 6 >> 1] | 0) | 0) | 0;
              k2 = k2 + -1 << 16 >> 16;
              if (!(k2 << 16 >> 16))
                break;
              else {
                j2 = j2 + 8 | 0;
                e2 = e2 + 8 | 0;
              }
            }
            j2 = i3 << 1 | 1;
          }
          e2 = (pe(j2) | 0) << 16 >> 16;
          i3 = e2 + 65532 & 65535;
          e2 = Ce(j2 << e2, h2) | 0;
        }
      while (0);
      if ((q2 | 0) == 14) {
        e2 = pe(j2) | 0;
        i3 = e2;
        e2 = Ce(j2 << (e2 << 16 >> 16), h2) | 0;
      }
      b[f2 >> 1] = p2;
      j2 = n2 << 16 >> 16;
      b[f2 + 2 >> 1] = 15 - j2;
      b[f2 + 4 >> 1] = e2;
      i3 = i3 << 16 >> 16;
      b[f2 + 6 >> 1] = 15 - i3;
      if (e2 << 16 >> 16 < 4) {
        r2 = 0;
        return r2 | 0;
      }
      i3 = De(Td(e2 << 16 >> 16 >>> 1 & 65535, p2) | 0, i3 - j2 & 65535, h2) | 0;
      i3 = i3 << 16 >> 16 > 19661 ? 19661 : i3;
      if ((a2 | 0) != 7) {
        r2 = i3;
        return r2 | 0;
      }
      r2 = i3 & 65532;
      return r2 | 0;
    }
    function Ec(a2, d2, e2, f2, g2, h2, i3) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      i3 = i3 | 0;
      var j2 = 0, k2 = 0, l2 = 0, m2 = 0, n2 = 0, o2 = 0;
      k2 = (f2 & 65535) + 65535 & 65535;
      if (k2 << 16 >> 16 > g2 << 16 >> 16) {
        n2 = f2 + -1 << 16 >> 16 << 16 >> 16;
        f2 = -2147483648;
        while (1) {
          l2 = c[a2 + (0 - n2 << 2) >> 2] | 0;
          j2 = l2 << 1;
          l2 = (j2 >> 1 | 0) == (l2 | 0) ? j2 : l2 >> 31 ^ 2147483647;
          j2 = c[a2 + (~n2 << 2) >> 2] | 0;
          m2 = l2 - j2 | 0;
          if (((m2 ^ l2) & (l2 ^ j2) | 0) < 0) {
            c[i3 >> 2] = 1;
            m2 = (l2 >>> 31) + 2147483647 | 0;
          }
          l2 = c[a2 + (1 - n2 << 2) >> 2] | 0;
          j2 = m2 - l2 | 0;
          if (((j2 ^ m2) & (l2 ^ m2) | 0) < 0) {
            c[i3 >> 2] = 1;
            j2 = (m2 >>> 31) + 2147483647 | 0;
          }
          m2 = Gc(j2) | 0;
          f2 = (m2 | 0) < (f2 | 0) ? f2 : m2;
          k2 = k2 + -1 << 16 >> 16;
          if (k2 << 16 >> 16 <= g2 << 16 >> 16) {
            g2 = f2;
            break;
          } else
            n2 = n2 + -1 | 0;
        }
      } else
        g2 = -2147483648;
      a2 = e2 << 16 >> 16 > 0;
      if (a2) {
        f2 = 0;
        j2 = d2;
        k2 = 0;
        while (1) {
          m2 = b[j2 >> 1] | 0;
          m2 = Z(m2, m2) | 0;
          if ((m2 | 0) != 1073741824) {
            l2 = (m2 << 1) + k2 | 0;
            if ((m2 ^ k2 | 0) > 0 & (l2 ^ k2 | 0) < 0) {
              c[i3 >> 2] = 1;
              k2 = (k2 >>> 31) + 2147483647 | 0;
            } else
              k2 = l2;
          } else {
            c[i3 >> 2] = 1;
            k2 = 2147483647;
          }
          f2 = f2 + 1 << 16 >> 16;
          if (f2 << 16 >> 16 >= e2 << 16 >> 16)
            break;
          else
            j2 = j2 + 2 | 0;
        }
        if (a2) {
          a2 = 0;
          n2 = d2;
          f2 = d2 + -2 | 0;
          j2 = 0;
          while (1) {
            m2 = Z(b[f2 >> 1] | 0, b[n2 >> 1] | 0) | 0;
            if ((m2 | 0) != 1073741824) {
              l2 = (m2 << 1) + j2 | 0;
              if ((m2 ^ j2 | 0) > 0 & (l2 ^ j2 | 0) < 0) {
                c[i3 >> 2] = 1;
                j2 = (j2 >>> 31) + 2147483647 | 0;
              } else
                j2 = l2;
            } else {
              c[i3 >> 2] = 1;
              j2 = 2147483647;
            }
            a2 = a2 + 1 << 16 >> 16;
            if (a2 << 16 >> 16 >= e2 << 16 >> 16)
              break;
            else {
              n2 = n2 + 2 | 0;
              f2 = f2 + 2 | 0;
            }
          }
        } else
          j2 = 0;
      } else {
        k2 = 0;
        j2 = 0;
      }
      f2 = k2 << 1;
      f2 = (f2 >> 1 | 0) == (k2 | 0) ? f2 : k2 >> 31 ^ 2147483647;
      e2 = j2 << 1;
      e2 = (e2 >> 1 | 0) == (j2 | 0) ? e2 : j2 >> 31 ^ 2147483647;
      k2 = f2 - e2 | 0;
      if (((k2 ^ f2) & (e2 ^ f2) | 0) < 0) {
        c[i3 >> 2] = 1;
        k2 = (f2 >>> 31) + 2147483647 | 0;
      }
      a2 = Gc(k2) | 0;
      n2 = ((pe(g2) | 0) & 65535) + 65535 | 0;
      k2 = n2 << 16 >> 16;
      if ((n2 & 65535) << 16 >> 16 > 0) {
        f2 = g2 << k2;
        if ((f2 >> k2 | 0) != (g2 | 0))
          f2 = g2 >> 31 ^ 2147483647;
      } else {
        k2 = 0 - k2 << 16;
        if ((k2 | 0) < 2031616)
          f2 = g2 >> (k2 >> 16);
        else
          f2 = 0;
      }
      m2 = pe(a2) | 0;
      j2 = m2 << 16 >> 16;
      if (m2 << 16 >> 16 > 0) {
        k2 = a2 << j2;
        if ((k2 >> j2 | 0) == (a2 | 0))
          o2 = 33;
        else {
          k2 = a2 >> 31 ^ 2147483647;
          o2 = 33;
        }
      } else {
        k2 = 0 - j2 << 16;
        if ((k2 | 0) < 2031616) {
          k2 = a2 >> (k2 >> 16);
          o2 = 33;
        } else
          l2 = 0;
      }
      if ((o2 | 0) == 33)
        if (k2 >>> 0 > 65535)
          l2 = Td(f2 >>> 16 & 65535, k2 >>> 16 & 65535) | 0;
        else
          l2 = 0;
      k2 = m2 & 65535;
      o2 = (n2 & 65535) - k2 | 0;
      f2 = o2 & 65535;
      if (!(o2 & 32768)) {
        i3 = De(l2, f2, i3) | 0;
        b[h2 >> 1] = i3;
        return 0;
      }
      if (f2 << 16 >> 16 != -32768) {
        i3 = k2 - n2 | 0;
        j2 = i3 << 16 >> 16;
        if ((i3 & 65535) << 16 >> 16 < 0) {
          j2 = 0 - j2 << 16;
          if ((j2 | 0) >= 983040) {
            i3 = 0;
            b[h2 >> 1] = i3;
            return 0;
          }
          i3 = l2 << 16 >> 16 >> (j2 >> 16) & 65535;
          b[h2 >> 1] = i3;
          return 0;
        }
      } else
        j2 = 32767;
      f2 = l2 << 16 >> 16;
      k2 = f2 << j2;
      if ((k2 << 16 >> 16 >> j2 | 0) == (f2 | 0)) {
        i3 = k2 & 65535;
        b[h2 >> 1] = i3;
        return 0;
      }
      i3 = (f2 >>> 15 ^ 32767) & 65535;
      b[h2 >> 1] = i3;
      return 0;
    }
    function Fc(a2, c2, d2, e2) {
      a2 = a2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      if (d2 << 16 >> 16)
        c2 = c2 << 16 >> 16 << 1 & 65535;
      if (c2 << 16 >> 16 < 0) {
        a2 = a2 + -2 | 0;
        c2 = (c2 & 65535) + 6 & 65535;
      }
      d2 = c2 << 16 >> 16;
      e2 = 6 - d2 << 16 >> 16;
      c2 = (Z(b[3468 + (d2 << 1) >> 1] | 0, b[a2 >> 1] | 0) | 0) + 16384 | 0;
      c2 = c2 + (Z(b[3468 + (e2 << 1) >> 1] | 0, b[a2 + 2 >> 1] | 0) | 0) | 0;
      c2 = c2 + (Z(b[3468 + (d2 + 6 << 1) >> 1] | 0, b[a2 + -2 >> 1] | 0) | 0) | 0;
      c2 = c2 + (Z(b[3468 + (e2 + 6 << 1) >> 1] | 0, b[a2 + 4 >> 1] | 0) | 0) | 0;
      c2 = (Z(b[3468 + (d2 + 12 << 1) >> 1] | 0, b[a2 + -4 >> 1] | 0) | 0) + c2 | 0;
      c2 = c2 + (Z(b[3468 + (e2 + 12 << 1) >> 1] | 0, b[a2 + 6 >> 1] | 0) | 0) | 0;
      d2 = c2 + (Z(b[3468 + (d2 + 18 << 1) >> 1] | 0, b[a2 + -6 >> 1] | 0) | 0) | 0;
      return (d2 + (Z(b[3468 + (e2 + 18 << 1) >> 1] | 0, b[a2 + 8 >> 1] | 0) | 0) | 0) >>> 15 & 65535 | 0;
    }
    function Gc(a2) {
      a2 = a2 | 0;
      a2 = a2 - (a2 >>> 31) | 0;
      return a2 >> 31 ^ a2 | 0;
    }
    function Hc(a2, c2, d2, e2) {
      a2 = a2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      var f2 = 0, g2 = 0, h2 = 0, i3 = 0, j2 = 0;
      if (!(a2 << 16 >> 16))
        return;
      else {
        f2 = 3518;
        g2 = 3538;
        e2 = d2;
      }
      while (1) {
        e2 = e2 + 2 | 0;
        c2 = c2 + 2 | 0;
        j2 = b[c2 >> 1] | 0;
        i3 = b[f2 >> 1] | 0;
        d2 = Z(i3, j2) | 0;
        d2 = (d2 | 0) == 1073741824 ? 2147483647 : d2 << 1;
        j2 = (Z(b[g2 >> 1] | 0, j2) | 0) >> 15;
        h2 = (j2 << 1) + d2 | 0;
        h2 = (d2 ^ j2 | 0) > 0 & (h2 ^ d2 | 0) < 0 ? (d2 >>> 31) + 2147483647 | 0 : h2;
        i3 = (Z(i3, b[e2 >> 1] | 0) | 0) >> 15;
        d2 = h2 + (i3 << 1) | 0;
        d2 = (h2 ^ i3 | 0) > 0 & (d2 ^ h2 | 0) < 0 ? (h2 >>> 31) + 2147483647 | 0 : d2;
        b[c2 >> 1] = d2 >>> 16;
        b[e2 >> 1] = (d2 >>> 1) - (d2 >> 16 << 15);
        a2 = a2 + -1 << 16 >> 16;
        if (!(a2 << 16 >> 16))
          break;
        else {
          f2 = f2 + 2 | 0;
          g2 = g2 + 2 | 0;
        }
      }
      return;
    }
    function Ic(a2, b2, d2) {
      a2 = a2 | 0;
      b2 = b2 | 0;
      d2 = d2 | 0;
      var e2 = 0, f2 = 0;
      e2 = a2 & 65535;
      f2 = e2 << 16;
      b2 = b2 << 16 >> 16;
      a2 = (b2 << 1) + f2 | 0;
      if (!((b2 ^ f2 | 0) > 0 & (a2 ^ f2 | 0) < 0)) {
        f2 = a2;
        return f2 | 0;
      }
      c[d2 >> 2] = 1;
      f2 = (e2 >>> 15) + 2147483647 | 0;
      return f2 | 0;
    }
    function Jc(a2) {
      a2 = a2 | 0;
      var d2 = 0, e2 = 0, f2 = 0;
      if (!a2) {
        f2 = -1;
        return f2 | 0;
      }
      c[a2 >> 2] = 0;
      d2 = Je(22) | 0;
      if (!d2) {
        f2 = -1;
        return f2 | 0;
      }
      b[d2 >> 1] = 4096;
      e2 = d2 + 2 | 0;
      f2 = e2 + 20 | 0;
      do {
        b[e2 >> 1] = 0;
        e2 = e2 + 2 | 0;
      } while ((e2 | 0) < (f2 | 0));
      c[a2 >> 2] = d2;
      f2 = 0;
      return f2 | 0;
    }
    function Kc(a2) {
      a2 = a2 | 0;
      var c2 = 0;
      if (!a2) {
        c2 = -1;
        return c2 | 0;
      }
      b[a2 >> 1] = 4096;
      a2 = a2 + 2 | 0;
      c2 = a2 + 20 | 0;
      do {
        b[a2 >> 1] = 0;
        a2 = a2 + 2 | 0;
      } while ((a2 | 0) < (c2 | 0));
      c2 = 0;
      return c2 | 0;
    }
    function Lc(a2) {
      a2 = a2 | 0;
      var b2 = 0;
      if (!a2)
        return;
      b2 = c[a2 >> 2] | 0;
      if (!b2)
        return;
      Ke(b2);
      c[a2 >> 2] = 0;
      return;
    }
    function Mc(a2, c2, d2, f2, g2, h2) {
      a2 = a2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      var j2 = 0, k2 = 0, l2 = 0, m2 = 0, n2 = 0, o2 = 0, p2 = 0, q2 = 0, r2 = 0, s2 = 0, t2 = 0, u2 = 0, v2 = 0, w2 = 0, x2 = 0, y2 = 0, z2 = 0, A2 = 0, B2 = 0, C2 = 0, D2 = 0, E2 = 0, F2 = 0, G2 = 0, H2 = 0, I2 = 0, J2 = 0, K2 = 0, L2 = 0, M2 = 0;
      K2 = i2;
      i2 = i2 + 96 | 0;
      I2 = K2 + 66 | 0;
      J2 = K2 + 44 | 0;
      H2 = K2 + 22 | 0;
      k2 = K2;
      D2 = c2 + 2 | 0;
      G2 = d2 + 2 | 0;
      F2 = (b[G2 >> 1] << 1) + (e[D2 >> 1] << 16) | 0;
      j2 = Gc(F2) | 0;
      j2 = ic(j2, b[c2 >> 1] | 0, b[d2 >> 1] | 0, h2) | 0;
      if ((F2 | 0) > 0)
        j2 = Oc(j2) | 0;
      B2 = j2 >> 16;
      b[g2 >> 1] = Ce(j2, h2) | 0;
      v2 = j2 >> 20;
      E2 = I2 + 2 | 0;
      b[E2 >> 1] = v2;
      F2 = J2 + 2 | 0;
      b[F2 >> 1] = (j2 >>> 5) - (v2 << 15);
      v2 = Z(B2, B2) | 0;
      v2 = (v2 | 0) == 1073741824 ? 2147483647 : v2 << 1;
      B2 = (Z((j2 >>> 1) - (B2 << 15) << 16 >> 16, B2) | 0) >> 15;
      C2 = B2 << 1;
      A2 = C2 + v2 | 0;
      A2 = (B2 ^ v2 | 0) > 0 & (A2 ^ v2 | 0) < 0 ? (v2 >>> 31) + 2147483647 | 0 : A2;
      C2 = A2 + C2 | 0;
      C2 = 2147483647 - (Gc((A2 ^ B2 | 0) > 0 & (C2 ^ A2 | 0) < 0 ? (A2 >>> 31) + 2147483647 | 0 : C2) | 0) | 0;
      A2 = C2 >> 16;
      B2 = b[c2 >> 1] | 0;
      v2 = Z(A2, B2) | 0;
      v2 = (v2 | 0) == 1073741824 ? 2147483647 : v2 << 1;
      B2 = (Z((C2 >>> 1) - (A2 << 15) << 16 >> 16, B2) | 0) >> 15;
      C2 = (B2 << 1) + v2 | 0;
      C2 = (B2 ^ v2 | 0) > 0 & (C2 ^ v2 | 0) < 0 ? (v2 >>> 31) + 2147483647 | 0 : C2;
      A2 = (Z(b[d2 >> 1] | 0, A2) | 0) >> 15;
      v2 = C2 + (A2 << 1) | 0;
      v2 = (C2 ^ A2 | 0) > 0 & (v2 ^ C2 | 0) < 0 ? (C2 >>> 31) + 2147483647 | 0 : v2;
      C2 = pe(v2) | 0;
      v2 = v2 << (C2 << 16 >> 16);
      A2 = H2 + 2 | 0;
      B2 = k2 + 2 | 0;
      l2 = v2;
      v2 = (v2 >>> 1) - (v2 >> 16 << 15) | 0;
      w2 = k2 + 4 | 0;
      x2 = H2 + 4 | 0;
      y2 = 2;
      z2 = 2;
      while (1) {
        u2 = l2 >>> 16;
        j2 = u2 & 65535;
        r2 = v2 & 65535;
        s2 = z2 + -1 | 0;
        n2 = I2 + (s2 << 1) | 0;
        t2 = J2 + (s2 << 1) | 0;
        q2 = 1;
        p2 = n2;
        o2 = t2;
        m2 = D2;
        k2 = G2;
        l2 = 0;
        while (1) {
          L2 = b[m2 >> 1] | 0;
          M2 = ((Z(b[o2 >> 1] | 0, L2) | 0) >> 15) + l2 | 0;
          l2 = b[p2 >> 1] | 0;
          l2 = M2 + (Z(l2, L2) | 0) + ((Z(l2, b[k2 >> 1] | 0) | 0) >> 15) | 0;
          q2 = q2 + 1 << 16 >> 16;
          if ((q2 << 16 >> 16 | 0) >= (z2 | 0))
            break;
          else {
            p2 = p2 + -2 | 0;
            o2 = o2 + -2 | 0;
            m2 = m2 + 2 | 0;
            k2 = k2 + 2 | 0;
          }
        }
        M2 = (e[c2 + (z2 << 1) >> 1] << 16) + (l2 << 5) + (b[d2 + (z2 << 1) >> 1] << 1) | 0;
        l2 = ic(Gc(M2) | 0, j2, r2, h2) | 0;
        if ((M2 | 0) > 0)
          l2 = Oc(l2) | 0;
        k2 = C2 << 16 >> 16;
        if (C2 << 16 >> 16 > 0) {
          j2 = l2 << k2;
          if ((j2 >> k2 | 0) != (l2 | 0))
            j2 = l2 >> 31 ^ 2147483647;
        } else {
          k2 = 0 - k2 << 16;
          if ((k2 | 0) < 2031616)
            j2 = l2 >> (k2 >> 16);
          else
            j2 = 0;
        }
        q2 = j2 >> 16;
        if ((z2 | 0) < 5)
          b[g2 + (s2 << 1) >> 1] = (j2 + 32768 | 0) >>> 16;
        M2 = (j2 >>> 16) - (j2 >>> 31) | 0;
        if (((M2 << 16 >> 31 ^ M2) & 65535) << 16 >> 16 > 32750) {
          j2 = 16;
          break;
        }
        o2 = (j2 >>> 1) - (q2 << 15) << 16 >> 16;
        p2 = 1;
        l2 = t2;
        k2 = A2;
        m2 = B2;
        while (1) {
          L2 = (Z(b[l2 >> 1] | 0, q2) | 0) >> 15;
          t2 = b[n2 >> 1] | 0;
          M2 = (Z(t2, o2) | 0) >> 15;
          t2 = Z(t2, q2) | 0;
          M2 = t2 + L2 + (b[J2 + (p2 << 1) >> 1] | 0) + (b[I2 + (p2 << 1) >> 1] << 15) + M2 | 0;
          b[k2 >> 1] = M2 >>> 15;
          b[m2 >> 1] = M2 & 32767;
          p2 = p2 + 1 | 0;
          if ((p2 & 65535) << 16 >> 16 == y2 << 16 >> 16)
            break;
          else {
            n2 = n2 + -2 | 0;
            l2 = l2 + -2 | 0;
            k2 = k2 + 2 | 0;
            m2 = m2 + 2 | 0;
          }
        }
        b[x2 >> 1] = j2 >> 20;
        b[w2 >> 1] = (j2 >>> 5) - (b[H2 + (z2 << 1) >> 1] << 15);
        L2 = Z(q2, q2) | 0;
        L2 = (L2 | 0) == 1073741824 ? 2147483647 : L2 << 1;
        j2 = (Z(o2, q2) | 0) >> 15;
        M2 = j2 << 1;
        k2 = M2 + L2 | 0;
        k2 = (j2 ^ L2 | 0) > 0 & (k2 ^ L2 | 0) < 0 ? (L2 >>> 31) + 2147483647 | 0 : k2;
        M2 = k2 + M2 | 0;
        M2 = 2147483647 - (Gc((k2 ^ j2 | 0) > 0 & (M2 ^ k2 | 0) < 0 ? (k2 >>> 31) + 2147483647 | 0 : M2) | 0) | 0;
        k2 = M2 >> 16;
        j2 = u2 << 16 >> 16;
        j2 = ((Z(k2, v2 << 16 >> 16) | 0) >> 15) + (Z(k2, j2) | 0) + ((Z((M2 >>> 1) - (k2 << 15) << 16 >> 16, j2) | 0) >> 15) << 1;
        k2 = (pe(j2) | 0) << 16 >> 16;
        j2 = j2 << k2;
        M2 = z2 << 1;
        Oe(E2 | 0, A2 | 0, M2 | 0) | 0;
        Oe(F2 | 0, B2 | 0, M2 | 0) | 0;
        z2 = z2 + 1 | 0;
        if ((z2 | 0) >= 11) {
          j2 = 20;
          break;
        } else {
          C2 = k2 + (C2 & 65535) & 65535;
          l2 = j2;
          v2 = (j2 >> 1) - (j2 >> 16 << 15) | 0;
          w2 = w2 + 2 | 0;
          x2 = x2 + 2 | 0;
          y2 = y2 + 1 << 16 >> 16;
        }
      }
      if ((j2 | 0) == 16) {
        j2 = f2 + 22 | 0;
        do {
          b[f2 >> 1] = b[a2 >> 1] | 0;
          f2 = f2 + 2 | 0;
          a2 = a2 + 2 | 0;
        } while ((f2 | 0) < (j2 | 0));
        M2 = g2;
        L2 = M2;
        b[L2 >> 1] = 0;
        b[L2 + 2 >> 1] = 0 >>> 16;
        M2 = M2 + 4 | 0;
        b[M2 >> 1] = 0;
        b[M2 + 2 >> 1] = 0 >>> 16;
        i2 = K2;
        return 0;
      } else if ((j2 | 0) == 20) {
        b[f2 >> 1] = 4096;
        M2 = ((b[F2 >> 1] | 0) + 8192 + (b[E2 >> 1] << 15) | 0) >>> 14 & 65535;
        b[f2 + 2 >> 1] = M2;
        b[a2 + 2 >> 1] = M2;
        M2 = ((b[J2 + 4 >> 1] | 0) + 8192 + (b[I2 + 4 >> 1] << 15) | 0) >>> 14 & 65535;
        b[f2 + 4 >> 1] = M2;
        b[a2 + 4 >> 1] = M2;
        M2 = ((b[J2 + 6 >> 1] | 0) + 8192 + (b[I2 + 6 >> 1] << 15) | 0) >>> 14 & 65535;
        b[f2 + 6 >> 1] = M2;
        b[a2 + 6 >> 1] = M2;
        M2 = ((b[J2 + 8 >> 1] | 0) + 8192 + (b[I2 + 8 >> 1] << 15) | 0) >>> 14 & 65535;
        b[f2 + 8 >> 1] = M2;
        b[a2 + 8 >> 1] = M2;
        M2 = ((b[J2 + 10 >> 1] | 0) + 8192 + (b[I2 + 10 >> 1] << 15) | 0) >>> 14 & 65535;
        b[f2 + 10 >> 1] = M2;
        b[a2 + 10 >> 1] = M2;
        M2 = ((b[J2 + 12 >> 1] | 0) + 8192 + (b[I2 + 12 >> 1] << 15) | 0) >>> 14 & 65535;
        b[f2 + 12 >> 1] = M2;
        b[a2 + 12 >> 1] = M2;
        M2 = ((b[J2 + 14 >> 1] | 0) + 8192 + (b[I2 + 14 >> 1] << 15) | 0) >>> 14 & 65535;
        b[f2 + 14 >> 1] = M2;
        b[a2 + 14 >> 1] = M2;
        M2 = ((b[J2 + 16 >> 1] | 0) + 8192 + (b[I2 + 16 >> 1] << 15) | 0) >>> 14 & 65535;
        b[f2 + 16 >> 1] = M2;
        b[a2 + 16 >> 1] = M2;
        M2 = ((b[J2 + 18 >> 1] | 0) + 8192 + (b[I2 + 18 >> 1] << 15) | 0) >>> 14 & 65535;
        b[f2 + 18 >> 1] = M2;
        b[a2 + 18 >> 1] = M2;
        M2 = ((b[J2 + 20 >> 1] | 0) + 8192 + (b[I2 + 20 >> 1] << 15) | 0) >>> 14 & 65535;
        b[f2 + 20 >> 1] = M2;
        b[a2 + 20 >> 1] = M2;
        i2 = K2;
        return 0;
      }
      return 0;
    }
    function Nc(a2, c2, d2, e2) {
      a2 = a2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      e2 = a2 >> 16;
      b[c2 >> 1] = e2;
      b[d2 >> 1] = (a2 >>> 1) - (e2 << 15);
      return;
    }
    function Oc(a2) {
      a2 = a2 | 0;
      return ((a2 | 0) == -2147483648 ? 2147483647 : 0 - a2 | 0) | 0;
    }
    function Pc(a2) {
      a2 = a2 | 0;
      var b2 = 0;
      if (!a2) {
        a2 = -1;
        return a2 | 0;
      }
      c[a2 >> 2] = 0;
      b2 = Je(4) | 0;
      if (!b2) {
        a2 = -1;
        return a2 | 0;
      }
      c[b2 >> 2] = 0;
      if (!((Jc(b2) | 0) << 16 >> 16)) {
        Kc(c[b2 >> 2] | 0) | 0;
        c[a2 >> 2] = b2;
        a2 = 0;
        return a2 | 0;
      } else {
        Lc(b2);
        Ke(b2);
        a2 = -1;
        return a2 | 0;
      }
    }
    function Qc(a2) {
      a2 = a2 | 0;
      var b2 = 0;
      if (!a2)
        return;
      b2 = c[a2 >> 2] | 0;
      if (!b2)
        return;
      Lc(b2);
      Ke(c[a2 >> 2] | 0);
      c[a2 >> 2] = 0;
      return;
    }
    function Rc(a2) {
      a2 = a2 | 0;
      if (!a2) {
        a2 = -1;
        return a2 | 0;
      }
      Kc(c[a2 >> 2] | 0) | 0;
      a2 = 0;
      return a2 | 0;
    }
    function Sc(a2, b2, d2, e2, f2, g2, h2) {
      a2 = a2 | 0;
      b2 = b2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      var j2 = 0, k2 = 0, l2 = 0, m2 = 0;
      m2 = i2;
      i2 = i2 + 64 | 0;
      l2 = m2 + 48 | 0;
      k2 = m2 + 22 | 0;
      j2 = m2;
      if ((b2 | 0) == 7) {
        d2 = c[g2 + 116 >> 2] | 0;
        Kb(e2, 10, j2, k2, c[g2 + 112 >> 2] | 0, h2) | 0;
        Hc(10, j2, k2, h2);
        Mc(c[a2 >> 2] | 0, j2, k2, f2 + 22 | 0, l2, h2) | 0;
        Kb(e2, 10, j2, k2, d2, h2) | 0;
        Hc(10, j2, k2, h2);
        Mc(c[a2 >> 2] | 0, j2, k2, f2 + 66 | 0, l2, h2) | 0;
        i2 = m2;
        return;
      } else {
        Kb(d2, 10, j2, k2, c[g2 + 108 >> 2] | 0, h2) | 0;
        Hc(10, j2, k2, h2);
        Mc(c[a2 >> 2] | 0, j2, k2, f2 + 66 | 0, l2, h2) | 0;
        i2 = m2;
        return;
      }
    }
    function Tc(a2, c2, d2, e2, f2, g2, h2, i3, j2, k2) {
      a2 = a2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      i3 = i3 | 0;
      j2 = j2 | 0;
      k2 = k2 | 0;
      if ((d2 | 0) == 6) {
        b[f2 >> 1] = bd(a2, c2, e2, 20, 143, 80, g2, h2, i3, j2, k2) | 0;
        return;
      }
      b[h2 >> 1] = 0;
      b[h2 + 2 >> 1] = 0;
      if (d2 >>> 0 < 2) {
        b[f2 >> 1] = Yc(c2, d2, e2, 20, 143, 160, i3, j2, k2) | 0;
        return;
      }
      if (d2 >>> 0 < 6) {
        b[f2 >> 1] = Yc(c2, d2, e2, 20, 143, 80, i3, j2, k2) | 0;
        return;
      } else {
        b[f2 >> 1] = Yc(c2, d2, e2, 18, 143, 80, i3, j2, k2) | 0;
        return;
      }
    }
    function Uc(a2) {
      a2 = a2 | 0;
      var d2 = 0;
      if ((a2 | 0) != 0 ? (c[a2 >> 2] = 0, d2 = Je(2) | 0, (d2 | 0) != 0) : 0) {
        b[d2 >> 1] = 0;
        c[a2 >> 2] = d2;
        d2 = 0;
      } else
        d2 = -1;
      return d2 | 0;
    }
    function Vc(a2) {
      a2 = a2 | 0;
      if (!a2)
        a2 = -1;
      else {
        b[a2 >> 1] = 0;
        a2 = 0;
      }
      return a2 | 0;
    }
    function Wc(a2) {
      a2 = a2 | 0;
      var b2 = 0;
      if (!a2)
        return;
      b2 = c[a2 >> 2] | 0;
      if (!b2)
        return;
      Ke(b2);
      c[a2 >> 2] = 0;
      return;
    }
    function Xc(a2, c2, d2, f2, g2, h2, j2, k2, l2, m2, n2, o2) {
      a2 = a2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      j2 = j2 | 0;
      k2 = k2 | 0;
      l2 = l2 | 0;
      m2 = m2 | 0;
      n2 = n2 | 0;
      o2 = o2 | 0;
      var p2 = 0, q2 = 0, r2 = 0, s2 = 0, t2 = 0, u2 = 0, v2 = 0, w2 = 0, x2 = 0, y2 = 0, z2 = 0, A2 = 0, B2 = 0, C2 = 0, D2 = 0, E2 = 0, F2 = 0, G2 = 0, H2 = 0, I2 = 0, J2 = 0, K2 = 0, L2 = 0, M2 = 0, N2 = 0, O2 = 0, P2 = 0, Q2 = 0, R2 = 0, S2 = 0, T2 = 0, U2 = 0;
      U2 = i2;
      i2 = i2 + 240 | 0;
      u2 = U2 + 160 | 0;
      v2 = U2 + 80 | 0;
      O2 = U2;
      N2 = b[3558 + (c2 * 18 | 0) >> 1] | 0;
      T2 = b[3558 + (c2 * 18 | 0) + 2 >> 1] | 0;
      p2 = b[3558 + (c2 * 18 | 0) + 4 >> 1] | 0;
      P2 = b[3558 + (c2 * 18 | 0) + 6 >> 1] | 0;
      s2 = b[3558 + (c2 * 18 | 0) + 12 >> 1] | 0;
      r2 = b[3558 + (c2 * 18 | 0) + 14 >> 1] | 0;
      q2 = b[3558 + (c2 * 18 | 0) + 16 >> 1] | 0;
      a:
        do
          switch (k2 << 16 >> 16) {
            case 0:
            case 80:
              if (c2 >>> 0 < 2 & k2 << 16 >> 16 == 80) {
                Q2 = (e[a2 >> 1] | 0) - (s2 & 65535) | 0;
                Q2 = (Q2 << 16 >> 16 | 0) < (q2 << 16 >> 16 | 0) ? q2 : Q2 & 65535;
                M2 = r2 << 16 >> 16;
                R2 = (Q2 & 65535) + M2 & 65535;
                S2 = R2 << 16 >> 16 > 143;
                Q2 = S2 ? 143 - M2 & 65535 : Q2;
                R2 = S2 ? 143 : R2;
                S2 = 1;
                break a;
              } else {
                Q2 = (e[d2 + ((k2 << 16 >> 16 != 0 & 1) << 1) >> 1] | 0) - (e[3558 + (c2 * 18 | 0) + 8 >> 1] | 0) | 0;
                Q2 = (Q2 << 16 >> 16 | 0) < (q2 << 16 >> 16 | 0) ? q2 : Q2 & 65535;
                M2 = b[3558 + (c2 * 18 | 0) + 10 >> 1] | 0;
                R2 = (Q2 & 65535) + M2 & 65535;
                S2 = R2 << 16 >> 16 > 143;
                Q2 = S2 ? 143 - M2 & 65535 : Q2;
                R2 = S2 ? 143 : R2;
                S2 = 0;
                break a;
              }
            default: {
              Q2 = (e[a2 >> 1] | 0) - (s2 & 65535) | 0;
              Q2 = (Q2 << 16 >> 16 | 0) < (q2 << 16 >> 16 | 0) ? q2 : Q2 & 65535;
              M2 = r2 << 16 >> 16;
              R2 = (Q2 & 65535) + M2 & 65535;
              S2 = R2 << 16 >> 16 > 143;
              Q2 = S2 ? 143 - M2 & 65535 : Q2;
              R2 = S2 ? 143 : R2;
              S2 = 1;
            }
          }
        while (0);
      L2 = Q2 & 65535;
      k2 = L2 + 65532 | 0;
      t2 = k2 & 65535;
      K2 = (R2 & 65535) + 4 & 65535;
      M2 = k2 << 16 >> 16;
      k2 = 0 - (k2 & 65535) | 0;
      s2 = k2 & 65535;
      ec(f2 + (k2 << 16 >> 16 << 1) | 0, h2, u2, j2);
      k2 = j2 << 16 >> 16;
      B2 = k2 >>> 1 & 65535;
      w2 = B2 << 16 >> 16 == 0;
      if (w2)
        j2 = 1;
      else {
        j2 = B2;
        q2 = u2;
        d2 = v2;
        r2 = 0;
        while (1) {
          J2 = b[q2 >> 1] | 0;
          b[d2 >> 1] = J2 >>> 2;
          J2 = (Z(J2, J2) | 0) + r2 | 0;
          r2 = b[q2 + 2 >> 1] | 0;
          b[d2 + 2 >> 1] = r2 >>> 2;
          r2 = J2 + (Z(r2, r2) | 0) | 0;
          j2 = j2 + -1 << 16 >> 16;
          if (!(j2 << 16 >> 16))
            break;
          else {
            q2 = q2 + 4 | 0;
            d2 = d2 + 4 | 0;
          }
        }
        j2 = (r2 | 0) < 33554433;
      }
      J2 = j2 ? 0 : 2;
      A2 = j2 ? u2 : v2;
      x2 = j2 ? u2 : v2;
      b:
        do
          if (t2 << 16 >> 16 <= K2 << 16 >> 16) {
            y2 = k2 + -1 | 0;
            G2 = A2 + (y2 << 1) | 0;
            H2 = h2 + (y2 << 1) | 0;
            I2 = A2 + (k2 + -2 << 1) | 0;
            D2 = y2 >>> 1;
            E2 = D2 & 65535;
            z2 = E2 << 16 >> 16 == 0;
            F2 = j2 ? 12 : 14;
            D2 = (D2 << 1) + 131070 & 131070;
            d2 = k2 + -3 - D2 | 0;
            C2 = A2 + (d2 << 1) | 0;
            D2 = A2 + (k2 + -4 - D2 << 1) | 0;
            h2 = h2 + (d2 << 1) | 0;
            if (!w2) {
              w2 = M2;
              while (1) {
                v2 = B2;
                u2 = x2;
                q2 = g2;
                r2 = 0;
                j2 = 0;
                while (1) {
                  v2 = v2 + -1 << 16 >> 16;
                  k2 = b[u2 >> 1] | 0;
                  r2 = (Z(k2, b[q2 >> 1] | 0) | 0) + r2 | 0;
                  k2 = (Z(k2, k2) | 0) + j2 | 0;
                  j2 = b[u2 + 2 >> 1] | 0;
                  r2 = r2 + (Z(j2, b[q2 + 2 >> 1] | 0) | 0) | 0;
                  j2 = k2 + (Z(j2, j2) | 0) | 0;
                  if (!(v2 << 16 >> 16))
                    break;
                  else {
                    u2 = u2 + 4 | 0;
                    q2 = q2 + 4 | 0;
                  }
                }
                u2 = ce(j2 << 1, o2) | 0;
                j2 = u2 >> 16;
                q2 = r2 << 1 >> 16;
                v2 = Z(j2, q2) | 0;
                v2 = (v2 | 0) == 1073741824 ? 2147483647 : v2 << 1;
                q2 = (Z((u2 >>> 1) - (j2 << 15) << 16 >> 16, q2) | 0) >> 15;
                u2 = (q2 << 1) + v2 | 0;
                u2 = (q2 ^ v2 | 0) > 0 & (u2 ^ v2 | 0) < 0 ? (v2 >>> 31) + 2147483647 | 0 : u2;
                j2 = (Z(j2, r2 & 32767) | 0) >> 15;
                v2 = u2 + (j2 << 1) | 0;
                b[O2 + (w2 - M2 << 1) >> 1] = (u2 ^ j2 | 0) > 0 & (v2 ^ u2 | 0) < 0 ? (u2 >>> 31) + 65535 | 0 : v2;
                if (t2 << 16 >> 16 != K2 << 16 >> 16) {
                  s2 = s2 + -1 << 16 >> 16;
                  v2 = b[f2 + (s2 << 16 >> 16 << 1) >> 1] | 0;
                  if (z2) {
                    u2 = y2;
                    j2 = I2;
                    r2 = H2;
                    q2 = G2;
                  } else {
                    u2 = E2;
                    j2 = I2;
                    r2 = H2;
                    q2 = G2;
                    while (1) {
                      w2 = (Z(b[r2 >> 1] | 0, v2) | 0) >> F2;
                      b[q2 >> 1] = w2 + (e[j2 >> 1] | 0);
                      w2 = (Z(b[r2 + -2 >> 1] | 0, v2) | 0) >> F2;
                      b[q2 + -2 >> 1] = w2 + (e[j2 + -2 >> 1] | 0);
                      u2 = u2 + -1 << 16 >> 16;
                      if (!(u2 << 16 >> 16)) {
                        u2 = d2;
                        j2 = D2;
                        r2 = h2;
                        q2 = C2;
                        break;
                      } else {
                        j2 = j2 + -4 | 0;
                        r2 = r2 + -4 | 0;
                        q2 = q2 + -4 | 0;
                      }
                    }
                  }
                  w2 = (Z(b[r2 >> 1] | 0, v2) | 0) >> F2;
                  b[q2 >> 1] = w2 + (e[j2 >> 1] | 0);
                  b[A2 + (u2 + -1 << 1) >> 1] = v2 >> J2;
                }
                t2 = t2 + 1 << 16 >> 16;
                if (t2 << 16 >> 16 > K2 << 16 >> 16)
                  break b;
                else
                  w2 = t2 << 16 >> 16;
              }
            }
            if (z2) {
              j2 = A2 + (k2 + -2 << 1) | 0;
              r2 = M2;
              while (1) {
                ce(0, o2) | 0;
                b[O2 + (r2 - M2 << 1) >> 1] = 0;
                if (t2 << 16 >> 16 != K2 << 16 >> 16) {
                  s2 = s2 + -1 << 16 >> 16;
                  g2 = b[f2 + (s2 << 16 >> 16 << 1) >> 1] | 0;
                  E2 = (Z(b[H2 >> 1] | 0, g2) | 0) >> F2;
                  b[G2 >> 1] = E2 + (e[I2 >> 1] | 0);
                  b[j2 >> 1] = g2 >> J2;
                }
                t2 = t2 + 1 << 16 >> 16;
                if (t2 << 16 >> 16 > K2 << 16 >> 16)
                  break b;
                else
                  r2 = t2 << 16 >> 16;
              }
            }
            u2 = A2 + (d2 + -1 << 1) | 0;
            j2 = M2;
            while (1) {
              ce(0, o2) | 0;
              b[O2 + (j2 - M2 << 1) >> 1] = 0;
              if (t2 << 16 >> 16 != K2 << 16 >> 16) {
                s2 = s2 + -1 << 16 >> 16;
                j2 = b[f2 + (s2 << 16 >> 16 << 1) >> 1] | 0;
                r2 = E2;
                q2 = I2;
                d2 = H2;
                k2 = G2;
                while (1) {
                  g2 = (Z(b[d2 >> 1] | 0, j2) | 0) >> F2;
                  b[k2 >> 1] = g2 + (e[q2 >> 1] | 0);
                  g2 = (Z(b[d2 + -2 >> 1] | 0, j2) | 0) >> F2;
                  b[k2 + -2 >> 1] = g2 + (e[q2 + -2 >> 1] | 0);
                  r2 = r2 + -1 << 16 >> 16;
                  if (!(r2 << 16 >> 16))
                    break;
                  else {
                    q2 = q2 + -4 | 0;
                    d2 = d2 + -4 | 0;
                    k2 = k2 + -4 | 0;
                  }
                }
                g2 = (Z(b[h2 >> 1] | 0, j2) | 0) >> F2;
                b[C2 >> 1] = g2 + (e[D2 >> 1] | 0);
                b[u2 >> 1] = j2 >> J2;
              }
              t2 = t2 + 1 << 16 >> 16;
              if (t2 << 16 >> 16 > K2 << 16 >> 16)
                break;
              else
                j2 = t2 << 16 >> 16;
            }
          }
        while (0);
      t2 = Q2 << 16 >> 16;
      d2 = L2 + 1 & 65535;
      if (d2 << 16 >> 16 > R2 << 16 >> 16)
        h2 = Q2;
      else {
        s2 = Q2;
        k2 = b[O2 + (t2 - M2 << 1) >> 1] | 0;
        while (1) {
          r2 = b[O2 + ((d2 << 16 >> 16) - M2 << 1) >> 1] | 0;
          q2 = r2 << 16 >> 16 < k2 << 16 >> 16;
          s2 = q2 ? s2 : d2;
          d2 = d2 + 1 << 16 >> 16;
          if (d2 << 16 >> 16 > R2 << 16 >> 16) {
            h2 = s2;
            break;
          } else
            k2 = q2 ? k2 : r2;
        }
      }
      c:
        do
          if (!(S2 << 16 >> 16 == 0 ? h2 << 16 >> 16 > N2 << 16 >> 16 : 0)) {
            if (!(c2 >>> 0 < 4 & S2 << 16 >> 16 != 0)) {
              s2 = O2 + ((h2 << 16 >> 16) - M2 << 1) | 0;
              r2 = Fc(s2, p2, T2, o2) | 0;
              d2 = (p2 & 65535) + 1 & 65535;
              if (d2 << 16 >> 16 <= P2 << 16 >> 16)
                while (1) {
                  q2 = Fc(s2, d2, T2, o2) | 0;
                  k2 = q2 << 16 >> 16 > r2 << 16 >> 16;
                  p2 = k2 ? d2 : p2;
                  d2 = d2 + 1 << 16 >> 16;
                  if (d2 << 16 >> 16 > P2 << 16 >> 16)
                    break;
                  else
                    r2 = k2 ? q2 : r2;
                }
              if ((c2 + -7 | 0) >>> 0 < 2) {
                P2 = p2 << 16 >> 16 == -3;
                d2 = (P2 << 31 >> 31) + h2 << 16 >> 16;
                p2 = P2 ? 3 : p2;
                break;
              }
              switch (p2 << 16 >> 16) {
                case -2: {
                  d2 = h2 + -1 << 16 >> 16;
                  p2 = 1;
                  break c;
                }
                case 2: {
                  d2 = h2 + 1 << 16 >> 16;
                  p2 = -1;
                  break c;
                }
                default: {
                  d2 = h2;
                  break c;
                }
              }
            }
            N2 = b[a2 >> 1] | 0;
            N2 = ((N2 << 16 >> 16) - t2 | 0) > 5 ? t2 + 5 & 65535 : N2;
            k2 = R2 << 16 >> 16;
            N2 = (k2 - (N2 << 16 >> 16) | 0) > 4 ? k2 + 65532 & 65535 : N2;
            k2 = h2 << 16 >> 16;
            d2 = N2 << 16 >> 16;
            if ((k2 | 0) == (d2 + -1 | 0) ? 1 : h2 << 16 >> 16 == N2 << 16 >> 16) {
              s2 = O2 + (k2 - M2 << 1) | 0;
              k2 = Fc(s2, p2, T2, o2) | 0;
              d2 = (p2 & 65535) + 1 & 65535;
              if (d2 << 16 >> 16 <= P2 << 16 >> 16)
                while (1) {
                  r2 = Fc(s2, d2, T2, o2) | 0;
                  q2 = r2 << 16 >> 16 > k2 << 16 >> 16;
                  p2 = q2 ? d2 : p2;
                  d2 = d2 + 1 << 16 >> 16;
                  if (d2 << 16 >> 16 > P2 << 16 >> 16)
                    break;
                  else
                    k2 = q2 ? r2 : k2;
                }
              if ((c2 + -7 | 0) >>> 0 < 2) {
                P2 = p2 << 16 >> 16 == -3;
                d2 = (P2 << 31 >> 31) + h2 << 16 >> 16;
                p2 = P2 ? 3 : p2;
                break;
              }
              switch (p2 << 16 >> 16) {
                case -2: {
                  d2 = h2 + -1 << 16 >> 16;
                  p2 = 1;
                  break c;
                }
                case 2: {
                  d2 = h2 + 1 << 16 >> 16;
                  p2 = -1;
                  break c;
                }
                default: {
                  d2 = h2;
                  break c;
                }
              }
            }
            if ((k2 | 0) == (d2 + -2 | 0)) {
              d2 = O2 + (k2 - M2 << 1) | 0;
              k2 = Fc(d2, 0, T2, o2) | 0;
              if ((c2 | 0) != 8) {
                p2 = 0;
                s2 = 1;
                while (1) {
                  r2 = Fc(d2, s2, T2, o2) | 0;
                  q2 = r2 << 16 >> 16 > k2 << 16 >> 16;
                  p2 = q2 ? s2 : p2;
                  s2 = s2 + 1 << 16 >> 16;
                  if (s2 << 16 >> 16 > P2 << 16 >> 16)
                    break;
                  else
                    k2 = q2 ? r2 : k2;
                }
                if ((c2 + -7 | 0) >>> 0 >= 2)
                  switch (p2 << 16 >> 16) {
                    case -2: {
                      d2 = h2 + -1 << 16 >> 16;
                      p2 = 1;
                      break c;
                    }
                    case 2: {
                      d2 = h2 + 1 << 16 >> 16;
                      p2 = -1;
                      break c;
                    }
                    default: {
                      d2 = h2;
                      break c;
                    }
                  }
              } else
                p2 = 0;
              P2 = p2 << 16 >> 16 == -3;
              d2 = (P2 << 31 >> 31) + h2 << 16 >> 16;
              p2 = P2 ? 3 : p2;
              break;
            }
            if ((k2 | 0) == (d2 + 1 | 0)) {
              s2 = O2 + (k2 - M2 << 1) | 0;
              d2 = Fc(s2, p2, T2, o2) | 0;
              k2 = (p2 & 65535) + 1 & 65535;
              if (k2 << 16 >> 16 <= 0)
                while (1) {
                  q2 = Fc(s2, k2, T2, o2) | 0;
                  r2 = q2 << 16 >> 16 > d2 << 16 >> 16;
                  p2 = r2 ? k2 : p2;
                  k2 = k2 + 1 << 16 >> 16;
                  if (k2 << 16 >> 16 > 0)
                    break;
                  else
                    d2 = r2 ? q2 : d2;
                }
              if ((c2 + -7 | 0) >>> 0 < 2) {
                P2 = p2 << 16 >> 16 == -3;
                d2 = (P2 << 31 >> 31) + h2 << 16 >> 16;
                p2 = P2 ? 3 : p2;
                break;
              }
              switch (p2 << 16 >> 16) {
                case -2: {
                  d2 = h2 + -1 << 16 >> 16;
                  p2 = 1;
                  break c;
                }
                case 2: {
                  d2 = h2 + 1 << 16 >> 16;
                  p2 = -1;
                  break c;
                }
                default: {
                  d2 = h2;
                  break c;
                }
              }
            } else {
              d2 = h2;
              p2 = 0;
            }
          } else {
            d2 = h2;
            p2 = 0;
          }
        while (0);
      if ((c2 + -7 | 0) >>> 0 > 1) {
        P2 = a2;
        a2 = pc(d2, p2, b[a2 >> 1] | 0, Q2, R2, S2, c2 >>> 0 < 4 & 1, o2) | 0;
        b[n2 >> 1] = a2;
        b[P2 >> 1] = d2;
        b[m2 >> 1] = T2;
        b[l2 >> 1] = p2;
        i2 = U2;
        return d2 | 0;
      } else {
        o2 = qc(d2, p2, Q2, S2, o2) | 0;
        b[n2 >> 1] = o2;
        b[a2 >> 1] = d2;
        b[m2 >> 1] = T2;
        b[l2 >> 1] = p2;
        i2 = U2;
        return d2 | 0;
      }
    }
    function Yc(a2, d2, e2, f2, g2, h2, j2, k2, l2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      j2 = j2 | 0;
      k2 = k2 | 0;
      l2 = l2 | 0;
      var m2 = 0, n2 = 0, o2 = 0, p2 = 0, q2 = 0, r2 = 0, s2 = 0, t2 = 0, u2 = 0, v2 = 0, w2 = 0, x2 = 0, y2 = 0, z2 = 0, A2 = 0, B2 = 0, C2 = 0, D2 = 0;
      D2 = i2;
      i2 = i2 + 1200 | 0;
      B2 = D2 + 1188 | 0;
      A2 = D2 + 580 | 0;
      C2 = D2 + 578 | 0;
      z2 = D2 + 576 | 0;
      v2 = D2;
      x2 = D2 + 582 | 0;
      y2 = (k2 | 0) != 0;
      do
        if (y2)
          if (d2 >>> 0 < 2) {
            Ld(a2, 1, l2);
            break;
          } else {
            Ld(a2, 0, l2);
            break;
          }
      while (0);
      w2 = g2 << 16 >> 16;
      o2 = 0 - w2 | 0;
      n2 = e2 + (o2 << 1) | 0;
      o2 = o2 & 65535;
      s2 = h2 << 16 >> 16;
      do
        if (o2 << 16 >> 16 < h2 << 16 >> 16) {
          r2 = o2;
          q2 = n2;
          o2 = 0;
          while (1) {
            t2 = b[q2 >> 1] | 0;
            o2 = (Z(t2 << 1, t2) | 0) + o2 | 0;
            if ((o2 | 0) < 0)
              break;
            r2 = r2 + 1 << 16 >> 16;
            if (r2 << 16 >> 16 >= h2 << 16 >> 16) {
              u2 = 14;
              break;
            } else
              q2 = q2 + 2 | 0;
          }
          if ((u2 | 0) == 14) {
            if ((o2 | 0) < 1048576) {
              u2 = 15;
              break;
            }
            Oe(x2 | 0, n2 | 0, s2 + w2 << 1 | 0) | 0;
            t2 = 0;
            break;
          }
          m2 = s2 + w2 | 0;
          p2 = m2 >>> 1;
          r2 = p2 & 65535;
          if (!(r2 << 16 >> 16))
            o2 = x2;
          else {
            t2 = ((p2 << 1) + 131070 & 131070) + 2 | 0;
            s2 = t2 - w2 | 0;
            q2 = x2;
            while (1) {
              b[q2 >> 1] = (b[n2 >> 1] | 0) >>> 3;
              b[q2 + 2 >> 1] = (b[n2 + 2 >> 1] | 0) >>> 3;
              r2 = r2 + -1 << 16 >> 16;
              if (!(r2 << 16 >> 16))
                break;
              else {
                n2 = n2 + 4 | 0;
                q2 = q2 + 4 | 0;
              }
            }
            n2 = e2 + (s2 << 1) | 0;
            o2 = x2 + (t2 << 1) | 0;
          }
          if (!(m2 & 1))
            t2 = 3;
          else {
            b[o2 >> 1] = (b[n2 >> 1] | 0) >>> 3;
            t2 = 3;
          }
        } else
          u2 = 15;
      while (0);
      if ((u2 | 0) == 15) {
        t2 = s2 + w2 | 0;
        o2 = t2 >>> 1;
        p2 = o2 & 65535;
        if (!(p2 << 16 >> 16))
          o2 = x2;
        else {
          s2 = ((o2 << 1) + 131070 & 131070) + 2 | 0;
          q2 = s2 - w2 | 0;
          r2 = x2;
          while (1) {
            b[r2 >> 1] = b[n2 >> 1] << 3;
            b[r2 + 2 >> 1] = b[n2 + 2 >> 1] << 3;
            p2 = p2 + -1 << 16 >> 16;
            if (!(p2 << 16 >> 16))
              break;
            else {
              n2 = n2 + 4 | 0;
              r2 = r2 + 4 | 0;
            }
          }
          n2 = e2 + (q2 << 1) | 0;
          o2 = x2 + (s2 << 1) | 0;
        }
        if (!(t2 & 1))
          t2 = -3;
        else {
          b[o2 >> 1] = b[n2 >> 1] << 3;
          t2 = -3;
        }
      }
      s2 = v2 + (w2 << 2) | 0;
      q2 = x2 + (w2 << 1) | 0;
      Tb(q2, h2, g2, f2, s2);
      m2 = (d2 | 0) == 7 & 1;
      o2 = f2 << 16 >> 16;
      n2 = o2 << 2;
      if ((n2 | 0) != (o2 << 18 >> 16 | 0)) {
        c[l2 >> 2] = 1;
        n2 = f2 << 16 >> 16 > 0 ? 32767 : -32768;
      }
      r2 = Zc(a2, s2, q2, t2, m2, h2, g2, n2 & 65535, B2, k2, l2) | 0;
      o2 = o2 << 1;
      p2 = Zc(a2, s2, q2, t2, m2, h2, n2 + 65535 & 65535, o2 & 65535, A2, k2, l2) | 0;
      o2 = Zc(a2, s2, q2, t2, m2, h2, o2 + 65535 & 65535, f2, C2, k2, l2) | 0;
      if (j2 << 16 >> 16 == 1 & y2) {
        Ec(s2, q2, h2, g2, f2, z2, l2) | 0;
        Jd(a2, b[z2 >> 1] | 0);
      }
      n2 = b[B2 >> 1] | 0;
      m2 = b[A2 >> 1] | 0;
      if (((n2 << 16 >> 16) * 55706 >> 16 | 0) >= (m2 << 16 >> 16 | 0)) {
        A2 = n2;
        B2 = r2;
        A2 = A2 << 16 >> 16;
        A2 = A2 * 55706 | 0;
        A2 = A2 >> 16;
        C2 = b[C2 >> 1] | 0;
        C2 = C2 << 16 >> 16;
        C2 = (A2 | 0) < (C2 | 0);
        C2 = C2 ? o2 : B2;
        i2 = D2;
        return C2 | 0;
      }
      b[B2 >> 1] = m2;
      A2 = m2;
      B2 = p2;
      A2 = A2 << 16 >> 16;
      A2 = A2 * 55706 | 0;
      A2 = A2 >> 16;
      C2 = b[C2 >> 1] | 0;
      C2 = C2 << 16 >> 16;
      C2 = (A2 | 0) < (C2 | 0);
      C2 = C2 ? o2 : B2;
      i2 = D2;
      return C2 | 0;
    }
    function Zc(a2, d2, e2, f2, g2, h2, i3, j2, k2, l2, m2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      i3 = i3 | 0;
      j2 = j2 | 0;
      k2 = k2 | 0;
      l2 = l2 | 0;
      m2 = m2 | 0;
      var n2 = 0, o2 = 0, p2 = 0, q2 = 0, r2 = 0;
      if (i3 << 16 >> 16 < j2 << 16 >> 16) {
        j2 = -2147483648;
        p2 = i3;
      } else {
        p2 = i3;
        n2 = -2147483648;
        o2 = d2 + (0 - (i3 << 16 >> 16) << 2) | 0;
        d2 = i3;
        while (1) {
          i3 = c[o2 >> 2] | 0;
          r2 = (i3 | 0) < (n2 | 0);
          d2 = r2 ? d2 : p2;
          n2 = r2 ? n2 : i3;
          p2 = p2 + -1 << 16 >> 16;
          if (p2 << 16 >> 16 < j2 << 16 >> 16) {
            j2 = n2;
            p2 = d2;
            break;
          } else
            o2 = o2 + 4 | 0;
        }
      }
      d2 = h2 << 16 >> 16 >>> 2 & 65535;
      if (!(d2 << 16 >> 16))
        d2 = 0;
      else {
        n2 = d2;
        i3 = e2 + (0 - (p2 << 16 >> 16) << 1) | 0;
        d2 = 0;
        while (1) {
          r2 = b[i3 >> 1] | 0;
          r2 = (Z(r2, r2) | 0) + d2 | 0;
          d2 = b[i3 + 2 >> 1] | 0;
          d2 = r2 + (Z(d2, d2) | 0) | 0;
          r2 = b[i3 + 4 >> 1] | 0;
          r2 = d2 + (Z(r2, r2) | 0) | 0;
          d2 = b[i3 + 6 >> 1] | 0;
          d2 = r2 + (Z(d2, d2) | 0) | 0;
          n2 = n2 + -1 << 16 >> 16;
          if (!(n2 << 16 >> 16))
            break;
          else
            i3 = i3 + 8 | 0;
        }
        d2 = d2 << 1;
      }
      if (l2)
        Kd(a2, j2, d2, m2);
      d2 = ce(d2, m2) | 0;
      i3 = g2 << 16 >> 16 != 0;
      if (i3)
        d2 = (d2 | 0) > 1073741823 ? 2147483647 : d2 << 1;
      g2 = j2 >> 16;
      a2 = d2 >> 16;
      m2 = Z(a2, g2) | 0;
      m2 = (m2 | 0) == 1073741824 ? 2147483647 : m2 << 1;
      d2 = (Z((d2 >>> 1) - (a2 << 15) << 16 >> 16, g2) | 0) >> 15;
      r2 = (d2 << 1) + m2 | 0;
      r2 = (d2 ^ m2 | 0) > 0 & (r2 ^ m2 | 0) < 0 ? (m2 >>> 31) + 2147483647 | 0 : r2;
      g2 = (Z(a2, (j2 >>> 1) - (g2 << 15) << 16 >> 16) | 0) >> 15;
      d2 = r2 + (g2 << 1) | 0;
      d2 = (r2 ^ g2 | 0) > 0 & (d2 ^ r2 | 0) < 0 ? (r2 >>> 31) + 2147483647 | 0 : d2;
      if (!i3) {
        b[k2 >> 1] = d2;
        return p2 | 0;
      }
      i3 = f2 << 16 >> 16;
      if (f2 << 16 >> 16 > 0)
        if (f2 << 16 >> 16 < 31) {
          i3 = d2 >> i3;
          q2 = 16;
        } else
          i3 = 0;
      else {
        q2 = 0 - i3 << 16 >> 16;
        i3 = d2 << q2;
        i3 = (i3 >> q2 | 0) == (d2 | 0) ? i3 : d2 >> 31 ^ 2147483647;
        q2 = 16;
      }
      if ((q2 | 0) == 16) {
        if ((i3 | 0) > 65535) {
          b[k2 >> 1] = 32767;
          return p2 | 0;
        }
        if ((i3 | 0) < -65536) {
          b[k2 >> 1] = -32768;
          return p2 | 0;
        }
      }
      b[k2 >> 1] = i3 >>> 1;
      return p2 | 0;
    }
    function _c(a2) {
      a2 = a2 | 0;
      var d2 = 0;
      if (!a2) {
        a2 = -1;
        return a2 | 0;
      }
      c[a2 >> 2] = 0;
      d2 = Je(6) | 0;
      if (!d2) {
        a2 = -1;
        return a2 | 0;
      }
      b[d2 >> 1] = 40;
      b[d2 + 2 >> 1] = 0;
      b[d2 + 4 >> 1] = 0;
      c[a2 >> 2] = d2;
      a2 = 0;
      return a2 | 0;
    }
    function $c(a2) {
      a2 = a2 | 0;
      if (!a2) {
        a2 = -1;
        return a2 | 0;
      }
      b[a2 >> 1] = 40;
      b[a2 + 2 >> 1] = 0;
      b[a2 + 4 >> 1] = 0;
      a2 = 0;
      return a2 | 0;
    }
    function ad(a2) {
      a2 = a2 | 0;
      var b2 = 0;
      if (!a2)
        return;
      b2 = c[a2 >> 2] | 0;
      if (!b2)
        return;
      Ke(b2);
      c[a2 >> 2] = 0;
      return;
    }
    function bd(a2, d2, e2, f2, g2, h2, j2, k2, l2, m2, n2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      j2 = j2 | 0;
      k2 = k2 | 0;
      l2 = l2 | 0;
      m2 = m2 | 0;
      n2 = n2 | 0;
      var o2 = 0, p2 = 0, q2 = 0, r2 = 0, s2 = 0, t2 = 0, u2 = 0, v2 = 0, w2 = 0, x2 = 0, y2 = 0, z2 = 0, A2 = 0, B2 = 0, C2 = 0, D2 = 0, E2 = 0, F2 = 0;
      F2 = i2;
      i2 = i2 + 1200 | 0;
      w2 = F2 + 1186 | 0;
      x2 = F2 + 1184 | 0;
      E2 = F2 + 1182 | 0;
      v2 = F2;
      z2 = F2 + 576 | 0;
      y2 = g2 << 16 >> 16;
      D2 = z2 + (y2 << 1) | 0;
      o2 = (0 - y2 & 65535) << 16 >> 16 < h2 << 16 >> 16;
      if (o2) {
        s2 = 0 - g2 << 16 >> 16 << 16 >> 16;
        p2 = 0;
        do {
          r2 = b[e2 + (s2 << 1) >> 1] | 0;
          r2 = Z(r2, r2) | 0;
          if ((r2 | 0) != 1073741824) {
            q2 = (r2 << 1) + p2 | 0;
            if ((r2 ^ p2 | 0) > 0 & (q2 ^ p2 | 0) < 0) {
              c[n2 >> 2] = 1;
              p2 = (p2 >>> 31) + 2147483647 | 0;
            } else
              p2 = q2;
          } else {
            c[n2 >> 2] = 1;
            p2 = 2147483647;
          }
          s2 = s2 + 1 | 0;
        } while ((s2 & 65535) << 16 >> 16 != h2 << 16 >> 16);
      } else
        p2 = 0;
      if ((2147483646 - p2 & p2 | 0) >= 0)
        if ((p2 | 0) == 2147483647) {
          if (o2) {
            p2 = 0 - g2 << 16 >> 16 << 16 >> 16;
            do {
              b[z2 + (p2 + y2 << 1) >> 1] = De(b[e2 + (p2 << 1) >> 1] | 0, 3, n2) | 0;
              p2 = p2 + 1 | 0;
            } while ((p2 & 65535) << 16 >> 16 != h2 << 16 >> 16);
          }
        } else
          t2 = 14;
      else {
        c[n2 >> 2] = 1;
        t2 = 14;
      }
      do
        if ((t2 | 0) == 14) {
          if ((1048575 - p2 & p2 | 0) < 0) {
            c[n2 >> 2] = 1;
            p2 = (p2 >>> 31) + 2147483647 | 0;
          } else
            p2 = p2 + -1048576 | 0;
          if ((p2 | 0) >= 0) {
            if (!o2)
              break;
            C2 = 0 - g2 << 16 >> 16 << 16 >> 16;
            Oe(z2 + (y2 + C2 << 1) | 0, e2 + (C2 << 1) | 0, (((h2 + g2 << 16 >> 16) + -1 & 65535) << 1) + 2 | 0) | 0;
            break;
          }
          if (o2) {
            p2 = 0 - g2 << 16 >> 16 << 16 >> 16;
            do {
              C2 = b[e2 + (p2 << 1) >> 1] | 0;
              b[z2 + (p2 + y2 << 1) >> 1] = (C2 << 19 >> 19 | 0) == (C2 | 0) ? C2 << 3 : C2 >>> 15 ^ 32767;
              p2 = p2 + 1 | 0;
            } while ((p2 & 65535) << 16 >> 16 != h2 << 16 >> 16);
          }
        }
      while (0);
      B2 = v2 + (y2 << 2) | 0;
      Tb(D2, h2, g2, f2, B2);
      s2 = b[a2 >> 1] | 0;
      C2 = a2 + 4 | 0;
      A2 = k2 + (l2 << 16 >> 16 << 1) | 0;
      a:
        do
          if (g2 << 16 >> 16 < f2 << 16 >> 16)
            u2 = g2;
          else {
            if ((b[C2 >> 1] | 0) <= 0) {
              e2 = g2;
              k2 = -2147483648;
              r2 = g2;
              t2 = 3402;
              while (1) {
                Nc(c[v2 + (y2 - (e2 << 16 >> 16) << 2) >> 2] | 0, w2, x2, n2);
                q2 = b[x2 >> 1] | 0;
                p2 = b[t2 >> 1] | 0;
                s2 = Z(p2, b[w2 >> 1] | 0) | 0;
                if ((s2 | 0) == 1073741824) {
                  c[n2 >> 2] = 1;
                  o2 = 2147483647;
                } else
                  o2 = s2 << 1;
                u2 = (Z(p2, q2 << 16 >> 16) | 0) >> 15;
                s2 = o2 + (u2 << 1) | 0;
                if ((o2 ^ u2 | 0) > 0 & (s2 ^ o2 | 0) < 0) {
                  c[n2 >> 2] = 1;
                  s2 = (o2 >>> 31) + 2147483647 | 0;
                }
                q2 = (s2 | 0) < (k2 | 0);
                r2 = q2 ? r2 : e2;
                e2 = e2 + -1 << 16 >> 16;
                if (e2 << 16 >> 16 < f2 << 16 >> 16) {
                  u2 = r2;
                  break a;
                } else {
                  k2 = q2 ? k2 : s2;
                  t2 = t2 + -2 | 0;
                }
              }
            }
            k2 = g2;
            o2 = -2147483648;
            r2 = g2;
            u2 = 2902 + (y2 + 123 - (s2 << 16 >> 16) << 1) | 0;
            e2 = 3402;
            while (1) {
              Nc(c[v2 + (y2 - (k2 << 16 >> 16) << 2) >> 2] | 0, w2, x2, n2);
              t2 = b[x2 >> 1] | 0;
              q2 = b[e2 >> 1] | 0;
              s2 = Z(q2, b[w2 >> 1] | 0) | 0;
              if ((s2 | 0) == 1073741824) {
                c[n2 >> 2] = 1;
                p2 = 2147483647;
              } else
                p2 = s2 << 1;
              t2 = (Z(q2, t2 << 16 >> 16) | 0) >> 15;
              s2 = p2 + (t2 << 1) | 0;
              if ((p2 ^ t2 | 0) > 0 & (s2 ^ p2 | 0) < 0) {
                c[n2 >> 2] = 1;
                s2 = (p2 >>> 31) + 2147483647 | 0;
              }
              Nc(s2, w2, x2, n2);
              t2 = b[x2 >> 1] | 0;
              q2 = b[u2 >> 1] | 0;
              s2 = Z(q2, b[w2 >> 1] | 0) | 0;
              if ((s2 | 0) == 1073741824) {
                c[n2 >> 2] = 1;
                p2 = 2147483647;
              } else
                p2 = s2 << 1;
              t2 = (Z(q2, t2 << 16 >> 16) | 0) >> 15;
              s2 = p2 + (t2 << 1) | 0;
              if ((p2 ^ t2 | 0) > 0 & (s2 ^ p2 | 0) < 0) {
                c[n2 >> 2] = 1;
                s2 = (p2 >>> 31) + 2147483647 | 0;
              }
              q2 = (s2 | 0) < (o2 | 0);
              r2 = q2 ? r2 : k2;
              k2 = k2 + -1 << 16 >> 16;
              if (k2 << 16 >> 16 < f2 << 16 >> 16) {
                u2 = r2;
                break;
              } else {
                o2 = q2 ? o2 : s2;
                u2 = u2 + -2 | 0;
                e2 = e2 + -2 | 0;
              }
            }
          }
        while (0);
      if (h2 << 16 >> 16 > 0) {
        k2 = 0;
        e2 = D2;
        t2 = z2 + (y2 - (u2 << 16 >> 16) << 1) | 0;
        r2 = 0;
        p2 = 0;
        while (1) {
          s2 = b[t2 >> 1] | 0;
          q2 = Z(s2, b[e2 >> 1] | 0) | 0;
          if ((q2 | 0) != 1073741824) {
            o2 = (q2 << 1) + r2 | 0;
            if ((q2 ^ r2 | 0) > 0 & (o2 ^ r2 | 0) < 0) {
              c[n2 >> 2] = 1;
              r2 = (r2 >>> 31) + 2147483647 | 0;
            } else
              r2 = o2;
          } else {
            c[n2 >> 2] = 1;
            r2 = 2147483647;
          }
          o2 = Z(s2, s2) | 0;
          if ((o2 | 0) != 1073741824) {
            q2 = (o2 << 1) + p2 | 0;
            if ((o2 ^ p2 | 0) > 0 & (q2 ^ p2 | 0) < 0) {
              c[n2 >> 2] = 1;
              p2 = (p2 >>> 31) + 2147483647 | 0;
            } else
              p2 = q2;
          } else {
            c[n2 >> 2] = 1;
            p2 = 2147483647;
          }
          k2 = k2 + 1 << 16 >> 16;
          if (k2 << 16 >> 16 >= h2 << 16 >> 16)
            break;
          else {
            e2 = e2 + 2 | 0;
            t2 = t2 + 2 | 0;
          }
        }
      } else {
        r2 = 0;
        p2 = 0;
      }
      q2 = (m2 | 0) == 0;
      if (!q2) {
        Ld(d2, 0, n2);
        Kd(d2, r2, p2, n2);
      }
      o2 = (Ce(p2, n2) | 0) << 16 >> 16;
      if ((o2 * 13107 | 0) == 1073741824) {
        c[n2 >> 2] = 1;
        p2 = 2147483647;
      } else
        p2 = o2 * 26214 | 0;
      o2 = r2 - p2 | 0;
      if (((o2 ^ r2) & (p2 ^ r2) | 0) < 0) {
        c[n2 >> 2] = 1;
        o2 = (r2 >>> 31) + 2147483647 | 0;
      }
      m2 = Ce(o2, n2) | 0;
      b[A2 >> 1] = m2;
      if (m2 << 16 >> 16 > 0) {
        o2 = j2 + 6 | 0;
        b[j2 + 8 >> 1] = b[o2 >> 1] | 0;
        m2 = j2 + 4 | 0;
        b[o2 >> 1] = b[m2 >> 1] | 0;
        o2 = j2 + 2 | 0;
        b[m2 >> 1] = b[o2 >> 1] | 0;
        b[o2 >> 1] = b[j2 >> 1] | 0;
        b[j2 >> 1] = u2;
        b[a2 >> 1] = Zd(j2, 5) | 0;
        b[a2 + 2 >> 1] = 32767;
        o2 = 32767;
      } else {
        b[a2 >> 1] = u2;
        a2 = a2 + 2 | 0;
        o2 = ((b[a2 >> 1] | 0) * 29491 | 0) >>> 15 & 65535;
        b[a2 >> 1] = o2;
      }
      b[C2 >> 1] = ((Ge(o2, 9830, n2) | 0) & 65535) >>> 15 ^ 1;
      if (q2) {
        i2 = F2;
        return u2 | 0;
      }
      if ((Ge(l2, 1, n2) | 0) << 16 >> 16) {
        i2 = F2;
        return u2 | 0;
      }
      Ec(B2, D2, h2, g2, f2, E2, n2) | 0;
      Jd(d2, b[E2 >> 1] | 0);
      i2 = F2;
      return u2 | 0;
    }
    function cd(a2, b2, c2, d2, e2, f2, g2, h2, j2, k2) {
      a2 = a2 | 0;
      b2 = b2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      j2 = j2 | 0;
      k2 = k2 | 0;
      var l2 = 0, m2 = 0;
      k2 = i2;
      i2 = i2 + 48 | 0;
      m2 = k2 + 22 | 0;
      l2 = k2;
      b2 = a2 >>> 0 < 6 ? b2 : c2;
      c2 = f2 << 16 >> 16 > 0 ? 22 : 0;
      a2 = e2 + (c2 << 1) | 0;
      Ie(a2, b2, m2);
      Ie(a2, d2, l2);
      a2 = f2 << 16 >> 16;
      f2 = j2 + (a2 << 1) | 0;
      Be(m2, g2 + (a2 << 1) | 0, f2, 40);
      He(l2, f2, f2, 40, h2, 1);
      c2 = e2 + (((c2 << 16) + 720896 | 0) >>> 16 << 1) | 0;
      Ie(c2, b2, m2);
      Ie(c2, d2, l2);
      a2 = (a2 << 16) + 2621440 >> 16;
      j2 = j2 + (a2 << 1) | 0;
      Be(m2, g2 + (a2 << 1) | 0, j2, 40);
      He(l2, j2, j2, 40, h2, 1);
      i2 = k2;
      return;
    }
    function dd(a2) {
      a2 = a2 | 0;
      var d2 = 0;
      if (!a2) {
        a2 = -1;
        return a2 | 0;
      }
      c[a2 >> 2] = 0;
      d2 = Je(12) | 0;
      if (!d2) {
        a2 = -1;
        return a2 | 0;
      }
      b[d2 >> 1] = 0;
      b[d2 + 2 >> 1] = 0;
      b[d2 + 4 >> 1] = 0;
      b[d2 + 6 >> 1] = 0;
      b[d2 + 8 >> 1] = 0;
      b[d2 + 10 >> 1] = 0;
      c[a2 >> 2] = d2;
      a2 = 0;
      return a2 | 0;
    }
    function ed(a2) {
      a2 = a2 | 0;
      if (!a2) {
        a2 = -1;
        return a2 | 0;
      }
      b[a2 >> 1] = 0;
      b[a2 + 2 >> 1] = 0;
      b[a2 + 4 >> 1] = 0;
      b[a2 + 6 >> 1] = 0;
      b[a2 + 8 >> 1] = 0;
      b[a2 + 10 >> 1] = 0;
      a2 = 0;
      return a2 | 0;
    }
    function fd(a2) {
      a2 = a2 | 0;
      var b2 = 0;
      if (!a2)
        return;
      b2 = c[a2 >> 2] | 0;
      if (!b2)
        return;
      Ke(b2);
      c[a2 >> 2] = 0;
      return;
    }
    function gd(a2, c2, d2) {
      a2 = a2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      var e2 = 0, f2 = 0, g2 = 0, h2 = 0, i3 = 0, j2 = 0, k2 = 0, l2 = 0, m2 = 0, n2 = 0, o2 = 0;
      m2 = a2 + 10 | 0;
      f2 = b[m2 >> 1] | 0;
      n2 = a2 + 8 | 0;
      e2 = b[n2 >> 1] | 0;
      if (!(d2 << 16 >> 16)) {
        a2 = e2;
        l2 = f2;
        b[m2 >> 1] = l2;
        b[n2 >> 1] = a2;
        return;
      }
      i3 = a2 + 4 | 0;
      j2 = a2 + 6 | 0;
      k2 = a2 + 2 | 0;
      h2 = b[j2 >> 1] | 0;
      l2 = b[i3 >> 1] | 0;
      g2 = d2;
      d2 = f2;
      while (1) {
        o2 = (Z(b[a2 >> 1] | 0, -3733) | 0) + (((l2 << 16 >> 16) * 7807 | 0) + ((h2 << 16 >> 16) * 7807 >> 15)) | 0;
        b[a2 >> 1] = l2;
        o2 = o2 + ((Z(b[k2 >> 1] | 0, -3733) | 0) >> 15) | 0;
        b[k2 >> 1] = h2;
        o2 = ((d2 << 16 >> 16) * 1899 | 0) + o2 + (Z(e2 << 16 >> 16, -3798) | 0) | 0;
        d2 = b[c2 >> 1] | 0;
        o2 = o2 + ((d2 << 16 >> 16) * 1899 | 0) | 0;
        b[c2 >> 1] = (o2 + 2048 | 0) >>> 12;
        f2 = o2 >>> 12;
        l2 = f2 & 65535;
        b[i3 >> 1] = l2;
        h2 = (o2 << 3) - (f2 << 15) & 65535;
        b[j2 >> 1] = h2;
        g2 = g2 + -1 << 16 >> 16;
        if (!(g2 << 16 >> 16))
          break;
        else {
          o2 = e2;
          c2 = c2 + 2 | 0;
          e2 = d2;
          d2 = o2;
        }
      }
      b[m2 >> 1] = e2;
      b[n2 >> 1] = d2;
      return;
    }
    function hd(a2, d2, e2, f2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      var g2 = 0, h2 = 0, i3 = 0, j2 = 0;
      g2 = b[(c[f2 + 88 >> 2] | 0) + (a2 << 1) >> 1] | 0;
      if (!(g2 << 16 >> 16))
        return;
      j2 = e2;
      i3 = c[(c[f2 + 92 >> 2] | 0) + (a2 << 2) >> 2] | 0;
      while (1) {
        e2 = b[i3 >> 1] | 0;
        if (!(e2 << 16 >> 16))
          e2 = 0;
        else {
          a2 = b[d2 >> 1] | 0;
          h2 = e2;
          f2 = j2 + ((e2 << 16 >> 16) + -1 << 1) | 0;
          while (1) {
            e2 = a2 << 16 >> 16;
            b[f2 >> 1] = e2 & 1;
            h2 = h2 + -1 << 16 >> 16;
            if (!(h2 << 16 >> 16))
              break;
            else {
              a2 = e2 >>> 1 & 65535;
              f2 = f2 + -2 | 0;
            }
          }
          e2 = b[i3 >> 1] | 0;
        }
        d2 = d2 + 2 | 0;
        g2 = g2 + -1 << 16 >> 16;
        if (!(g2 << 16 >> 16))
          break;
        else {
          j2 = j2 + (e2 << 16 >> 16 << 1) | 0;
          i3 = i3 + 2 | 0;
        }
      }
      return;
    }
    function id(a2, d2, f2, g2, h2, j2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      j2 = j2 | 0;
      var k2 = 0, l2 = 0, m2 = 0, n2 = 0, o2 = 0;
      o2 = i2;
      i2 = i2 + 16 | 0;
      m2 = o2 + 2 | 0;
      n2 = o2;
      k2 = h2 << 16 >> 16;
      if (h2 << 16 >> 16 < 1) {
        j2 = -5443;
        n2 = -32768;
        Wd(a2, n2, j2);
        i2 = o2;
        return;
      }
      l2 = re(14, f2, j2) | 0;
      if ((k2 | 0) < (l2 << 16 >> 16 | 0))
        f2 = g2;
      else {
        f2 = (g2 & 65535) + 1 & 65535;
        h2 = k2 >>> 1 & 65535;
      }
      g2 = Td(h2, l2 & 65535) | 0;
      b[n2 >> 1] = g2;
      de(g2 << 16 >> 16, m2, n2, j2);
      b[m2 >> 1] = ((((f2 & 65535) - (d2 & 65535) << 16) + -65536 | 0) >>> 16) + (e[m2 >> 1] | 0);
      g2 = Ee(b[n2 >> 1] | 0, 5, j2) | 0;
      k2 = b[m2 >> 1] | 0;
      g2 = ((k2 & 65535) << 10) + (g2 & 65535) & 65535;
      if (g2 << 16 >> 16 > 18284) {
        j2 = 3037;
        n2 = 18284;
        Wd(a2, n2, j2);
        i2 = o2;
        return;
      }
      h2 = b[n2 >> 1] | 0;
      k2 = k2 << 16 >> 16;
      if ((k2 * 24660 | 0) == 1073741824) {
        c[j2 >> 2] = 1;
        f2 = 2147483647;
      } else
        f2 = k2 * 49320 | 0;
      n2 = (h2 << 16 >> 16) * 24660 >> 15;
      k2 = f2 + (n2 << 1) | 0;
      if ((f2 ^ n2 | 0) > 0 & (k2 ^ f2 | 0) < 0) {
        c[j2 >> 2] = 1;
        k2 = (f2 >>> 31) + 2147483647 | 0;
      }
      n2 = k2 << 13;
      j2 = Ce((n2 >> 13 | 0) == (k2 | 0) ? n2 : k2 >> 31 ^ 2147483647, j2) | 0;
      n2 = g2;
      Wd(a2, n2, j2);
      i2 = o2;
      return;
    }
    function jd(a2, d2, f2, g2, h2, j2, k2, l2, m2, n2, o2, p2, q2, r2, s2, t2, u2, v2, w2, x2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      j2 = j2 | 0;
      k2 = k2 | 0;
      l2 = l2 | 0;
      m2 = m2 | 0;
      n2 = n2 | 0;
      o2 = o2 | 0;
      p2 = p2 | 0;
      q2 = q2 | 0;
      r2 = r2 | 0;
      s2 = s2 | 0;
      t2 = t2 | 0;
      u2 = u2 | 0;
      v2 = v2 | 0;
      w2 = w2 | 0;
      x2 = x2 | 0;
      var y2 = 0, z2 = 0, A2 = 0, B2 = 0, C2 = 0, D2 = 0, E2 = 0, F2 = 0, G2 = 0, H2 = 0, I2 = 0, J2 = 0, K2 = 0, L2 = 0, M2 = 0, N2 = 0, O2 = 0, P2 = 0, Q2 = 0, R2 = 0, S2 = 0, T2 = 0, U2 = 0, V2 = 0, W2 = 0, X2 = 0, Y2 = 0, _2 = 0, $2 = 0, aa2 = 0, ba2 = 0, ca2 = 0, da2 = 0, ea2 = 0, fa2 = 0, ga2 = 0, ha2 = 0;
      ha2 = i2;
      i2 = i2 + 80 | 0;
      da2 = ha2 + 66 | 0;
      ea2 = ha2 + 64 | 0;
      fa2 = ha2 + 62 | 0;
      ga2 = ha2 + 60 | 0;
      O2 = ha2 + 40 | 0;
      P2 = ha2 + 20 | 0;
      M2 = ha2;
      b[da2 >> 1] = d2;
      b[ea2 >> 1] = m2;
      b[fa2 >> 1] = n2;
      L2 = re(14, f2, x2) | 0;
      ca2 = L2 & 65535;
      b[ga2 >> 1] = ca2;
      N2 = re(14, n2, x2) | 0;
      K2 = (e[g2 >> 1] | 0) + 65523 | 0;
      b[M2 >> 1] = K2;
      E2 = (e[g2 + 2 >> 1] | 0) + 65522 | 0;
      F2 = M2 + 2 | 0;
      b[F2 >> 1] = E2;
      G2 = ((d2 & 65535) << 16) + -720896 | 0;
      B2 = G2 >> 16;
      G2 = (G2 >>> 15) + 15 + (e[g2 + 4 >> 1] | 0) | 0;
      H2 = M2 + 4 | 0;
      b[H2 >> 1] = G2;
      I2 = (e[g2 + 6 >> 1] | 0) + B2 | 0;
      J2 = M2 + 6 | 0;
      b[J2 >> 1] = I2;
      B2 = B2 + 1 + (e[g2 + 8 >> 1] | 0) | 0;
      C2 = M2 + 8 | 0;
      b[C2 >> 1] = B2;
      y2 = (e[o2 >> 1] | 0) + 65523 & 65535;
      b[M2 + 10 >> 1] = y2;
      D2 = (e[o2 + 2 >> 1] | 0) + 65522 & 65535;
      b[M2 + 12 >> 1] = D2;
      z2 = ((m2 & 65535) << 16) + -720896 | 0;
      g2 = z2 >> 16;
      z2 = (z2 >>> 15) + 15 + (e[o2 + 4 >> 1] | 0) & 65535;
      b[M2 + 14 >> 1] = z2;
      A2 = (e[o2 + 6 >> 1] | 0) + g2 & 65535;
      b[M2 + 16 >> 1] = A2;
      g2 = g2 + 1 + (e[o2 + 8 >> 1] | 0) & 65535;
      b[M2 + 18 >> 1] = g2;
      aa2 = (j2 & 65535) - (q2 & 65535) << 16;
      m2 = aa2 >> 16;
      if ((aa2 | 0) > 0) {
        n2 = k2;
        f2 = r2 << 16 >> 16 >> m2 & 65535;
      } else {
        n2 = k2 << 16 >> 16 >> 0 - m2 & 65535;
        f2 = r2;
      }
      if ((Ee(f2, 1, x2) | 0) << 16 >> 16 > n2 << 16 >> 16)
        f2 = 1;
      else
        f2 = (((n2 << 16 >> 16) + 3 >> 2 | 0) > (f2 << 16 >> 16 | 0)) << 31 >> 31;
      o2 = K2 + f2 & 65535;
      b[M2 >> 1] = o2;
      aa2 = E2 + f2 & 65535;
      b[F2 >> 1] = aa2;
      $2 = G2 + f2 & 65535;
      b[H2 >> 1] = $2;
      _2 = I2 + f2 & 65535;
      b[J2 >> 1] = _2;
      Y2 = B2 + f2 & 65535;
      b[C2 >> 1] = Y2;
      m2 = g2 << 16 >> 16 > o2 << 16 >> 16 ? g2 : o2;
      m2 = A2 << 16 >> 16 > m2 << 16 >> 16 ? A2 : m2;
      m2 = z2 << 16 >> 16 > m2 << 16 >> 16 ? z2 : m2;
      m2 = D2 << 16 >> 16 > m2 << 16 >> 16 ? D2 : m2;
      m2 = y2 << 16 >> 16 > m2 << 16 >> 16 ? y2 : m2;
      m2 = Y2 << 16 >> 16 > m2 << 16 >> 16 ? Y2 : m2;
      m2 = _2 << 16 >> 16 > m2 << 16 >> 16 ? _2 : m2;
      m2 = $2 << 16 >> 16 > m2 << 16 >> 16 ? $2 : m2;
      m2 = (aa2 << 16 >> 16 > m2 << 16 >> 16 ? aa2 : m2) + 1 & 65535;
      g2 = 0;
      while (1) {
        f2 = m2 - (o2 & 65535) | 0;
        o2 = f2 & 65535;
        n2 = e[h2 >> 1] << 16;
        f2 = f2 << 16 >> 16;
        if (o2 << 16 >> 16 > 0)
          o2 = o2 << 16 >> 16 < 31 ? n2 >> f2 : 0;
        else {
          aa2 = 0 - f2 << 16 >> 16;
          o2 = n2 << aa2;
          o2 = (o2 >> aa2 | 0) == (n2 | 0) ? o2 : n2 >> 31 ^ 2147483647;
        }
        aa2 = o2 >> 16;
        b[O2 + (g2 << 1) >> 1] = aa2;
        b[P2 + (g2 << 1) >> 1] = (o2 >>> 1) - (aa2 << 15);
        g2 = g2 + 1 | 0;
        if ((g2 | 0) == 5) {
          f2 = 5;
          n2 = p2;
          break;
        }
        o2 = b[M2 + (g2 << 1) >> 1] | 0;
        h2 = h2 + 2 | 0;
      }
      while (1) {
        g2 = m2 - (y2 & 65535) | 0;
        y2 = g2 & 65535;
        o2 = e[n2 >> 1] << 16;
        g2 = g2 << 16 >> 16;
        if (y2 << 16 >> 16 > 0)
          o2 = y2 << 16 >> 16 < 31 ? o2 >> g2 : 0;
        else {
          $2 = 0 - g2 << 16 >> 16;
          aa2 = o2 << $2;
          o2 = (aa2 >> $2 | 0) == (o2 | 0) ? aa2 : o2 >> 31 ^ 2147483647;
        }
        aa2 = o2 >> 16;
        b[O2 + (f2 << 1) >> 1] = aa2;
        b[P2 + (f2 << 1) >> 1] = (o2 >>> 1) - (aa2 << 15);
        o2 = f2 + 1 | 0;
        if ((o2 & 65535) << 16 >> 16 == 10)
          break;
        y2 = b[M2 + (o2 << 1) >> 1] | 0;
        f2 = o2;
        n2 = n2 + 2 | 0;
      }
      Q2 = L2 << 16 >> 16;
      R2 = b[O2 >> 1] | 0;
      S2 = b[P2 >> 1] | 0;
      T2 = b[O2 + 2 >> 1] | 0;
      U2 = b[P2 + 2 >> 1] | 0;
      V2 = b[O2 + 4 >> 1] | 0;
      W2 = b[P2 + 4 >> 1] | 0;
      X2 = b[O2 + 6 >> 1] | 0;
      Y2 = b[P2 + 6 >> 1] | 0;
      _2 = b[O2 + 8 >> 1] | 0;
      $2 = b[P2 + 8 >> 1] | 0;
      aa2 = s2 & 65535;
      q2 = N2 << 16 >> 16;
      j2 = b[O2 + 10 >> 1] | 0;
      A2 = b[P2 + 10 >> 1] | 0;
      z2 = b[O2 + 12 >> 1] | 0;
      h2 = b[P2 + 12 >> 1] | 0;
      f2 = b[O2 + 14 >> 1] | 0;
      n2 = b[P2 + 14 >> 1] | 0;
      g2 = b[O2 + 16 >> 1] | 0;
      y2 = b[P2 + 16 >> 1] | 0;
      B2 = b[O2 + 18 >> 1] | 0;
      P2 = b[P2 + 18 >> 1] | 0;
      m2 = 2147483647;
      O2 = 0;
      o2 = 0;
      C2 = 782;
      do {
        M2 = b[C2 >> 1] | 0;
        I2 = (Z(Q2, b[C2 + 2 >> 1] | 0) | 0) >>> 15 << 16;
        p2 = I2 >> 16;
        G2 = M2 << 1;
        K2 = (Z(G2, M2) | 0) >> 16;
        r2 = Z(K2, R2) | 0;
        if ((r2 | 0) == 1073741824) {
          c[x2 >> 2] = 1;
          J2 = 2147483647;
        } else
          J2 = r2 << 1;
        N2 = (Z(S2, K2) | 0) >> 15;
        r2 = J2 + (N2 << 1) | 0;
        if ((J2 ^ N2 | 0) > 0 & (r2 ^ J2 | 0) < 0) {
          c[x2 >> 2] = 1;
          r2 = (J2 >>> 31) + 2147483647 | 0;
        }
        K2 = Z(T2, M2) | 0;
        if ((K2 | 0) == 1073741824) {
          c[x2 >> 2] = 1;
          J2 = 2147483647;
        } else
          J2 = K2 << 1;
        N2 = (Z(U2, M2) | 0) >> 15;
        K2 = J2 + (N2 << 1) | 0;
        if ((J2 ^ N2 | 0) > 0 & (K2 ^ J2 | 0) < 0) {
          c[x2 >> 2] = 1;
          K2 = (J2 >>> 31) + 2147483647 | 0;
        }
        I2 = (Z(I2 >> 15, p2) | 0) >> 16;
        J2 = Z(V2, I2) | 0;
        if ((J2 | 0) == 1073741824) {
          c[x2 >> 2] = 1;
          H2 = 2147483647;
        } else
          H2 = J2 << 1;
        N2 = (Z(W2, I2) | 0) >> 15;
        J2 = H2 + (N2 << 1) | 0;
        if ((H2 ^ N2 | 0) > 0 & (J2 ^ H2 | 0) < 0) {
          c[x2 >> 2] = 1;
          J2 = (H2 >>> 31) + 2147483647 | 0;
        }
        I2 = Z(X2, p2) | 0;
        if ((I2 | 0) == 1073741824) {
          c[x2 >> 2] = 1;
          H2 = 2147483647;
        } else
          H2 = I2 << 1;
        N2 = (Z(Y2, p2) | 0) >> 15;
        I2 = H2 + (N2 << 1) | 0;
        if ((H2 ^ N2 | 0) > 0 & (I2 ^ H2 | 0) < 0) {
          c[x2 >> 2] = 1;
          N2 = (H2 >>> 31) + 2147483647 | 0;
        } else
          N2 = I2;
        H2 = (Z(G2, p2) | 0) >> 16;
        I2 = Z(_2, H2) | 0;
        if ((I2 | 0) == 1073741824) {
          c[x2 >> 2] = 1;
          G2 = 2147483647;
        } else
          G2 = I2 << 1;
        L2 = (Z($2, H2) | 0) >> 15;
        I2 = G2 + (L2 << 1) | 0;
        if ((G2 ^ L2 | 0) > 0 & (I2 ^ G2 | 0) < 0) {
          c[x2 >> 2] = 1;
          I2 = (G2 >>> 31) + 2147483647 | 0;
        }
        H2 = b[C2 + 4 >> 1] | 0;
        G2 = b[C2 + 6 >> 1] | 0;
        C2 = C2 + 8 | 0;
        if ((M2 - aa2 & 65535) << 16 >> 16 < 1 ? (ba2 = H2 << 16 >> 16, H2 << 16 >> 16 <= s2 << 16 >> 16) : 0) {
          E2 = (Z(G2 << 16 >> 16, q2) | 0) >>> 15 << 16;
          M2 = E2 >> 16;
          D2 = ba2 << 1;
          G2 = (Z(D2, ba2) | 0) >> 16;
          H2 = Z(j2, G2) | 0;
          if ((H2 | 0) == 1073741824) {
            c[x2 >> 2] = 1;
            F2 = 2147483647;
          } else
            F2 = H2 << 1;
          L2 = (Z(A2, G2) | 0) >> 15;
          H2 = F2 + (L2 << 1) | 0;
          if ((F2 ^ L2 | 0) > 0 & (H2 ^ F2 | 0) < 0) {
            c[x2 >> 2] = 1;
            H2 = (F2 >>> 31) + 2147483647 | 0;
          }
          G2 = Z(z2, ba2) | 0;
          if ((G2 | 0) == 1073741824) {
            c[x2 >> 2] = 1;
            F2 = 2147483647;
          } else
            F2 = G2 << 1;
          L2 = (Z(h2, ba2) | 0) >> 15;
          G2 = F2 + (L2 << 1) | 0;
          if ((F2 ^ L2 | 0) > 0 & (G2 ^ F2 | 0) < 0) {
            c[x2 >> 2] = 1;
            L2 = (F2 >>> 31) + 2147483647 | 0;
          } else
            L2 = G2;
          F2 = (Z(E2 >> 15, M2) | 0) >> 16;
          G2 = Z(f2, F2) | 0;
          if ((G2 | 0) == 1073741824) {
            c[x2 >> 2] = 1;
            E2 = 2147483647;
          } else
            E2 = G2 << 1;
          p2 = (Z(n2, F2) | 0) >> 15;
          G2 = E2 + (p2 << 1) | 0;
          if ((E2 ^ p2 | 0) > 0 & (G2 ^ E2 | 0) < 0) {
            c[x2 >> 2] = 1;
            p2 = (E2 >>> 31) + 2147483647 | 0;
          } else
            p2 = G2;
          G2 = Z(g2, M2) | 0;
          if ((G2 | 0) == 1073741824) {
            c[x2 >> 2] = 1;
            F2 = 2147483647;
          } else
            F2 = G2 << 1;
          E2 = (Z(y2, M2) | 0) >> 15;
          G2 = F2 + (E2 << 1) | 0;
          if ((F2 ^ E2 | 0) > 0 & (G2 ^ F2 | 0) < 0) {
            c[x2 >> 2] = 1;
            k2 = (F2 >>> 31) + 2147483647 | 0;
          } else
            k2 = G2;
          F2 = (Z(D2, M2) | 0) >> 16;
          G2 = Z(B2, F2) | 0;
          if ((G2 | 0) == 1073741824) {
            c[x2 >> 2] = 1;
            E2 = 2147483647;
          } else
            E2 = G2 << 1;
          M2 = (Z(P2, F2) | 0) >> 15;
          G2 = E2 + (M2 << 1) | 0;
          if ((E2 ^ M2 | 0) > 0 & (G2 ^ E2 | 0) < 0) {
            c[x2 >> 2] = 1;
            G2 = (E2 >>> 31) + 2147483647 | 0;
          }
          M2 = K2 + r2 + J2 + N2 + I2 + H2 + L2 + p2 + k2 + G2 | 0;
          N2 = (M2 | 0) < (m2 | 0);
          m2 = N2 ? M2 : m2;
          o2 = N2 ? O2 : o2;
        }
        O2 = O2 + 1 << 16 >> 16;
      } while (O2 << 16 >> 16 < 256);
      s2 = (o2 & 65535) << 18 >> 16;
      kd(a2, 782 + (s2 << 1) | 0, ca2, d2, t2, u2, x2);
      Vd(a2, 0, l2, ea2, fa2, da2, ga2, x2);
      l2 = (re(14, b[fa2 >> 1] | 0, x2) | 0) & 65535;
      kd(a2, 782 + ((s2 | 2) << 1) | 0, l2, b[ea2 >> 1] | 0, v2, w2, x2);
      i2 = ha2;
      return o2 | 0;
    }
    function kd(a2, d2, f2, g2, h2, j2, k2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      j2 = j2 | 0;
      k2 = k2 | 0;
      var l2 = 0, m2 = 0, n2 = 0, o2 = 0;
      o2 = i2;
      i2 = i2 + 16 | 0;
      m2 = o2 + 2 | 0;
      n2 = o2;
      b[h2 >> 1] = b[d2 >> 1] | 0;
      l2 = b[d2 + 2 >> 1] | 0;
      f2 = Z(f2 << 16 >> 16 << 1, l2) | 0;
      h2 = 10 - (g2 & 65535) | 0;
      d2 = h2 & 65535;
      h2 = h2 << 16 >> 16;
      if (d2 << 16 >> 16 > 0)
        d2 = d2 << 16 >> 16 < 31 ? f2 >> h2 : 0;
      else {
        h2 = 0 - h2 << 16 >> 16;
        d2 = f2 << h2;
        d2 = (d2 >> h2 | 0) == (f2 | 0) ? d2 : f2 >> 31 ^ 2147483647;
      }
      b[j2 >> 1] = d2 >>> 16;
      de(l2, m2, n2, k2);
      b[m2 >> 1] = (e[m2 >> 1] | 0) + 65524;
      h2 = Ee(b[n2 >> 1] | 0, 5, k2) | 0;
      g2 = b[m2 >> 1] | 0;
      h2 = ((g2 & 65535) << 10) + (h2 & 65535) & 65535;
      f2 = b[n2 >> 1] | 0;
      g2 = g2 << 16 >> 16;
      if ((g2 * 24660 | 0) == 1073741824) {
        c[k2 >> 2] = 1;
        d2 = 2147483647;
      } else
        d2 = g2 * 49320 | 0;
      n2 = (f2 << 16 >> 16) * 24660 >> 15;
      g2 = d2 + (n2 << 1) | 0;
      if (!((d2 ^ n2 | 0) > 0 & (g2 ^ d2 | 0) < 0)) {
        k2 = g2;
        k2 = k2 << 13;
        k2 = k2 + 32768 | 0;
        k2 = k2 >>> 16;
        k2 = k2 & 65535;
        Wd(a2, h2, k2);
        i2 = o2;
        return;
      }
      c[k2 >> 2] = 1;
      k2 = (d2 >>> 31) + 2147483647 | 0;
      k2 = k2 << 13;
      k2 = k2 + 32768 | 0;
      k2 = k2 >>> 16;
      k2 = k2 & 65535;
      Wd(a2, h2, k2);
      i2 = o2;
      return;
    }
    function ld(a2, d2, f2, g2, h2, j2, k2, l2, m2, n2, o2, p2, q2, r2, s2, t2, u2, v2, w2, x2, y2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      j2 = j2 | 0;
      k2 = k2 | 0;
      l2 = l2 | 0;
      m2 = m2 | 0;
      n2 = n2 | 0;
      o2 = o2 | 0;
      p2 = p2 | 0;
      q2 = q2 | 0;
      r2 = r2 | 0;
      s2 = s2 | 0;
      t2 = t2 | 0;
      u2 = u2 | 0;
      v2 = v2 | 0;
      w2 = w2 | 0;
      x2 = x2 | 0;
      y2 = y2 | 0;
      var z2 = 0, A2 = 0, B2 = 0, C2 = 0, D2 = 0, E2 = 0, F2 = 0, G2 = 0, H2 = 0, I2 = 0, J2 = 0, K2 = 0, L2 = 0, M2 = 0, N2 = 0, O2 = 0, P2 = 0, Q2 = 0, R2 = 0, S2 = 0, T2 = 0, U2 = 0, V2 = 0, W2 = 0, X2 = 0, Y2 = 0, _2 = 0, $2 = 0, aa2 = 0, ba2 = 0, ca2 = 0, da2 = 0, ea2 = 0, fa2 = 0, ga2 = 0, ha2 = 0, ia2 = 0, ja2 = 0, ka2 = 0, la2 = 0;
      la2 = i2;
      i2 = i2 + 80 | 0;
      ia2 = la2 + 72 | 0;
      ja2 = la2 + 70 | 0;
      ka2 = la2 + 68 | 0;
      ga2 = la2 + 66 | 0;
      ha2 = la2 + 56 | 0;
      _2 = la2 + 24 | 0;
      Y2 = la2 + 12 | 0;
      W2 = la2 + 48 | 0;
      X2 = la2 + 40 | 0;
      R2 = la2 + 34 | 0;
      T2 = la2 + 22 | 0;
      P2 = la2 + 6 | 0;
      Q2 = la2;
      nd(5, r2, s2, P2, Q2, c[x2 + 72 >> 2] | 0, y2) | 0;
      B2 = re(14, n2, y2) | 0;
      S2 = x2 + 68 | 0;
      O2 = c[S2 >> 2] | 0;
      V2 = m2 << 16 >> 16;
      U2 = V2 + 65526 | 0;
      r2 = (e[j2 >> 1] | 0) + 65523 & 65535;
      b[ha2 >> 1] = r2;
      x2 = (e[j2 + 2 >> 1] | 0) + 65522 & 65535;
      b[ha2 + 2 >> 1] = x2;
      da2 = U2 << 16 >> 16;
      ea2 = ((U2 << 17 >> 17 | 0) == (da2 | 0) ? U2 << 1 : da2 >>> 15 ^ 32767) + 15 + (e[j2 + 4 >> 1] | 0) & 65535;
      b[ha2 + 4 >> 1] = ea2;
      fa2 = (e[j2 + 6 >> 1] | 0) + da2 & 65535;
      b[ha2 + 6 >> 1] = fa2;
      j2 = da2 + 1 + (e[j2 + 8 >> 1] | 0) & 65535;
      b[ha2 + 8 >> 1] = j2;
      x2 = x2 << 16 >> 16 > r2 << 16 >> 16 ? x2 : r2;
      x2 = ea2 << 16 >> 16 > x2 << 16 >> 16 ? ea2 : x2;
      x2 = fa2 << 16 >> 16 > x2 << 16 >> 16 ? fa2 : x2;
      x2 = (Rd(j2 << 16 >> 16 > x2 << 16 >> 16 ? j2 : x2, 1, y2) | 0) & 65535;
      j2 = r2;
      r2 = 0;
      while (1) {
        n2 = x2 - (j2 & 65535) | 0;
        j2 = n2 & 65535;
        A2 = e[h2 + (r2 << 1) >> 1] << 16;
        n2 = n2 << 16 >> 16;
        if (j2 << 16 >> 16 > 0)
          n2 = j2 << 16 >> 16 < 31 ? A2 >> n2 : 0;
        else {
          fa2 = 0 - n2 << 16 >> 16;
          n2 = A2 << fa2;
          n2 = (n2 >> fa2 | 0) == (A2 | 0) ? n2 : A2 >> 31 ^ 2147483647;
        }
        Nc(n2, _2 + (r2 << 1) | 0, Y2 + (r2 << 1) | 0, y2);
        n2 = r2 + 1 | 0;
        if ((n2 | 0) == 5)
          break;
        j2 = b[ha2 + (n2 << 1) >> 1] | 0;
        r2 = n2;
      }
      M2 = _2 + 2 | 0;
      N2 = Y2 + 2 | 0;
      fa2 = B2 << 16 >> 16;
      $2 = _2 + 4 | 0;
      aa2 = Y2 + 4 | 0;
      ba2 = _2 + 6 | 0;
      ca2 = Y2 + 6 | 0;
      da2 = _2 + 8 | 0;
      ea2 = Y2 + 8 | 0;
      E2 = 0;
      j2 = 2147483647;
      h2 = 0;
      n2 = 0;
      while (1) {
        L2 = b[P2 + (h2 << 1) >> 1] | 0;
        B2 = Z(L2, L2) | 0;
        if (B2 >>> 0 > 1073741823) {
          c[y2 >> 2] = 1;
          B2 = 32767;
        } else
          B2 = B2 >>> 15;
        x2 = b[Y2 >> 1] | 0;
        A2 = B2 << 16 >> 16;
        B2 = Z(A2, b[_2 >> 1] | 0) | 0;
        if ((B2 | 0) == 1073741824) {
          c[y2 >> 2] = 1;
          r2 = 2147483647;
        } else
          r2 = B2 << 1;
        K2 = (Z(x2 << 16 >> 16, A2) | 0) >> 15;
        B2 = r2 + (K2 << 1) | 0;
        if ((r2 ^ K2 | 0) > 0 & (B2 ^ r2 | 0) < 0) {
          c[y2 >> 2] = 1;
          B2 = (r2 >>> 31) + 2147483647 | 0;
        }
        x2 = b[N2 >> 1] | 0;
        A2 = Z(b[M2 >> 1] | 0, L2) | 0;
        if ((A2 | 0) != 1073741824) {
          r2 = (A2 << 1) + B2 | 0;
          if ((A2 ^ B2 | 0) > 0 & (r2 ^ B2 | 0) < 0) {
            c[y2 >> 2] = 1;
            r2 = (B2 >>> 31) + 2147483647 | 0;
          }
        } else {
          c[y2 >> 2] = 1;
          r2 = 2147483647;
        }
        B2 = (Z(x2 << 16 >> 16, L2) | 0) >> 15;
        if ((B2 | 0) > 32767) {
          c[y2 >> 2] = 1;
          B2 = 32767;
        }
        K2 = B2 << 16;
        B2 = (K2 >> 15) + r2 | 0;
        if ((K2 >> 16 ^ r2 | 0) > 0 & (B2 ^ r2 | 0) < 0) {
          c[y2 >> 2] = 1;
          K2 = (r2 >>> 31) + 2147483647 | 0;
        } else
          K2 = B2;
        I2 = (K2 >>> 31) + 2147483647 | 0;
        J2 = h2 & 65535;
        B2 = E2;
        G2 = 0;
        H2 = O2;
        do {
          A2 = (Z(b[H2 >> 1] | 0, fa2) | 0) >> 15;
          H2 = H2 + 6 | 0;
          if ((A2 | 0) > 32767) {
            c[y2 >> 2] = 1;
            A2 = 32767;
          }
          F2 = A2 << 16 >> 16;
          A2 = Z(F2, F2) | 0;
          if ((A2 | 0) == 1073741824) {
            c[y2 >> 2] = 1;
            D2 = 2147483647;
          } else
            D2 = A2 << 1;
          Nc(D2, ia2, ja2, y2);
          A2 = Z(F2, L2) | 0;
          if ((A2 | 0) == 1073741824) {
            c[y2 >> 2] = 1;
            D2 = 2147483647;
          } else
            D2 = A2 << 1;
          Nc(D2, ka2, ga2, y2);
          r2 = b[aa2 >> 1] | 0;
          C2 = b[ja2 >> 1] | 0;
          A2 = b[$2 >> 1] | 0;
          x2 = b[ia2 >> 1] | 0;
          E2 = Z(x2, A2) | 0;
          if ((E2 | 0) != 1073741824) {
            D2 = (E2 << 1) + K2 | 0;
            if ((E2 ^ K2 | 0) > 0 & (D2 ^ K2 | 0) < 0) {
              c[y2 >> 2] = 1;
              D2 = I2;
            }
          } else {
            c[y2 >> 2] = 1;
            D2 = 2147483647;
          }
          E2 = (Z(C2 << 16 >> 16, A2) | 0) >> 15;
          if ((E2 | 0) > 32767) {
            c[y2 >> 2] = 1;
            E2 = 32767;
          }
          C2 = E2 << 16;
          E2 = (C2 >> 15) + D2 | 0;
          if ((C2 >> 16 ^ D2 | 0) > 0 & (E2 ^ D2 | 0) < 0) {
            c[y2 >> 2] = 1;
            E2 = (D2 >>> 31) + 2147483647 | 0;
          }
          D2 = (Z(x2, r2 << 16 >> 16) | 0) >> 15;
          if ((D2 | 0) > 32767) {
            c[y2 >> 2] = 1;
            D2 = 32767;
          }
          C2 = D2 << 16;
          D2 = (C2 >> 15) + E2 | 0;
          if ((C2 >> 16 ^ E2 | 0) > 0 & (D2 ^ E2 | 0) < 0) {
            c[y2 >> 2] = 1;
            D2 = (E2 >>> 31) + 2147483647 | 0;
          }
          A2 = b[ca2 >> 1] | 0;
          E2 = Z(b[ba2 >> 1] | 0, F2) | 0;
          if ((E2 | 0) != 1073741824) {
            C2 = (E2 << 1) + D2 | 0;
            if ((E2 ^ D2 | 0) > 0 & (C2 ^ D2 | 0) < 0) {
              c[y2 >> 2] = 1;
              C2 = (D2 >>> 31) + 2147483647 | 0;
            }
          } else {
            c[y2 >> 2] = 1;
            C2 = 2147483647;
          }
          A2 = (Z(A2 << 16 >> 16, F2) | 0) >> 15;
          if ((A2 | 0) > 32767) {
            c[y2 >> 2] = 1;
            A2 = 32767;
          }
          F2 = A2 << 16;
          A2 = (F2 >> 15) + C2 | 0;
          if ((F2 >> 16 ^ C2 | 0) > 0 & (A2 ^ C2 | 0) < 0) {
            c[y2 >> 2] = 1;
            A2 = (C2 >>> 31) + 2147483647 | 0;
          }
          x2 = b[ea2 >> 1] | 0;
          C2 = b[ga2 >> 1] | 0;
          r2 = b[da2 >> 1] | 0;
          z2 = b[ka2 >> 1] | 0;
          E2 = Z(z2, r2) | 0;
          do
            if ((E2 | 0) == 1073741824) {
              c[y2 >> 2] = 1;
              E2 = 2147483647;
            } else {
              D2 = (E2 << 1) + A2 | 0;
              if (!((E2 ^ A2 | 0) > 0 & (D2 ^ A2 | 0) < 0)) {
                E2 = D2;
                break;
              }
              c[y2 >> 2] = 1;
              E2 = (A2 >>> 31) + 2147483647 | 0;
            }
          while (0);
          D2 = (Z(C2 << 16 >> 16, r2) | 0) >> 15;
          if ((D2 | 0) > 32767) {
            c[y2 >> 2] = 1;
            D2 = 32767;
          }
          F2 = D2 << 16;
          D2 = (F2 >> 15) + E2 | 0;
          if ((F2 >> 16 ^ E2 | 0) > 0 & (D2 ^ E2 | 0) < 0) {
            c[y2 >> 2] = 1;
            D2 = (E2 >>> 31) + 2147483647 | 0;
          }
          A2 = (Z(z2, x2 << 16 >> 16) | 0) >> 15;
          if ((A2 | 0) > 32767) {
            c[y2 >> 2] = 1;
            A2 = 32767;
          }
          F2 = A2 << 16;
          A2 = (F2 >> 15) + D2 | 0;
          if ((F2 >> 16 ^ D2 | 0) > 0 & (A2 ^ D2 | 0) < 0) {
            c[y2 >> 2] = 1;
            A2 = (D2 >>> 31) + 2147483647 | 0;
          }
          F2 = (A2 | 0) < (j2 | 0);
          B2 = F2 ? G2 : B2;
          n2 = F2 ? J2 : n2;
          j2 = F2 ? A2 : j2;
          G2 = G2 + 1 << 16 >> 16;
        } while (G2 << 16 >> 16 < 32);
        h2 = h2 + 1 | 0;
        if ((h2 | 0) == 3) {
          A2 = B2;
          h2 = n2;
          break;
        } else
          E2 = B2;
      }
      N2 = (A2 << 16 >> 16) * 3 | 0;
      j2 = b[O2 + (N2 << 1) >> 1] | 0;
      b[u2 >> 1] = b[O2 + (N2 + 1 << 1) >> 1] | 0;
      b[v2 >> 1] = b[O2 + (N2 + 2 << 1) >> 1] | 0;
      j2 = Z(j2 << 16 >> 16, fa2) | 0;
      if ((j2 | 0) == 1073741824) {
        c[y2 >> 2] = 1;
        B2 = 2147483647;
      } else
        B2 = j2 << 1;
      N2 = 9 - V2 | 0;
      O2 = N2 & 65535;
      N2 = N2 << 16 >> 16;
      M2 = O2 << 16 >> 16 > 0;
      if (M2)
        B2 = O2 << 16 >> 16 < 31 ? B2 >> N2 : 0;
      else {
        K2 = 0 - N2 << 16 >> 16;
        L2 = B2 << K2;
        B2 = (L2 >> K2 | 0) == (B2 | 0) ? L2 : B2 >> 31 ^ 2147483647;
      }
      b[t2 >> 1] = B2 >>> 16;
      L2 = h2 << 16 >> 16;
      P2 = b[P2 + (L2 << 1) >> 1] | 0;
      b[s2 >> 1] = P2;
      Q2 = b[Q2 + (L2 << 1) >> 1] | 0;
      Ub(d2, f2, g2, P2, o2, W2, X2, R2, y2);
      xc(a2, b[R2 >> 1] | 0, b[t2 >> 1] | 0, T2, y2);
      if (!((b[W2 >> 1] | 0) != 0 & (b[T2 >> 1] | 0) > 0)) {
        y2 = A2;
        u2 = c[w2 >> 2] | 0;
        t2 = u2 + 2 | 0;
        b[u2 >> 1] = Q2;
        u2 = u2 + 4 | 0;
        c[w2 >> 2] = u2;
        b[t2 >> 1] = y2;
        i2 = la2;
        return;
      }
      F2 = W2 + 6 | 0;
      b[F2 >> 1] = l2;
      D2 = X2 + 6 | 0;
      b[D2 >> 1] = k2;
      m2 = ((Ge(q2, m2, y2) | 0) & 65535) + 10 | 0;
      x2 = m2 << 16 >> 16;
      if ((m2 & 65535) << 16 >> 16 < 0) {
        n2 = 0 - x2 << 16;
        if ((n2 | 0) < 983040)
          p2 = p2 << 16 >> 16 >> (n2 >> 16) & 65535;
        else
          p2 = 0;
      } else {
        n2 = p2 << 16 >> 16;
        r2 = n2 << x2;
        if ((r2 << 16 >> 16 >> x2 | 0) == (n2 | 0))
          p2 = r2 & 65535;
        else
          p2 = (n2 >>> 15 ^ 32767) & 65535;
      }
      j2 = b[s2 >> 1] | 0;
      B2 = b[T2 >> 1] | 0;
      S2 = c[S2 >> 2] | 0;
      r2 = b[t2 >> 1] | 0;
      T2 = 10 - V2 | 0;
      x2 = T2 << 16 >> 16;
      if ((T2 & 65535) << 16 >> 16 < 0) {
        n2 = 0 - x2 << 16;
        if ((n2 | 0) < 983040)
          l2 = r2 << 16 >> 16 >> (n2 >> 16) & 65535;
        else
          l2 = 0;
      } else {
        n2 = r2 << 16 >> 16;
        r2 = n2 << x2;
        if ((r2 << 16 >> 16 >> x2 | 0) == (n2 | 0))
          l2 = r2 & 65535;
        else
          l2 = (n2 >>> 15 ^ 32767) & 65535;
      }
      h2 = j2 << 16 >> 16;
      n2 = Z(h2, h2) | 0;
      if (n2 >>> 0 > 1073741823) {
        c[y2 >> 2] = 1;
        j2 = 32767;
      } else
        j2 = n2 >>> 15;
      A2 = Rd(32767 - (B2 & 65535) & 65535, 1, y2) | 0;
      B2 = B2 << 16 >> 16;
      n2 = Z(b[W2 + 2 >> 1] | 0, B2) | 0;
      if ((n2 | 0) == 1073741824) {
        c[y2 >> 2] = 1;
        n2 = 2147483647;
      } else
        n2 = n2 << 1;
      T2 = n2 << 1;
      n2 = Z(((T2 >> 1 | 0) == (n2 | 0) ? T2 : n2 >> 31 ^ 2147418112) >> 16, j2 << 16 >> 16) | 0;
      if ((n2 | 0) == 1073741824) {
        c[y2 >> 2] = 1;
        E2 = 2147483647;
      } else
        E2 = n2 << 1;
      C2 = (e[X2 + 2 >> 1] | 0) + 65521 | 0;
      x2 = C2 & 65535;
      n2 = Z(b[W2 + 4 >> 1] | 0, B2) | 0;
      if ((n2 | 0) == 1073741824) {
        c[y2 >> 2] = 1;
        j2 = 2147483647;
      } else
        j2 = n2 << 1;
      n2 = j2 << 1;
      n2 = (Z(((n2 >> 1 | 0) == (j2 | 0) ? n2 : j2 >> 31 ^ 2147418112) >> 16, h2) | 0) >> 15;
      if ((n2 | 0) > 32767) {
        c[y2 >> 2] = 1;
        n2 = 32767;
      }
      b[$2 >> 1] = n2;
      j2 = U2 & 65535;
      b[ia2 >> 1] = j2;
      j2 = Rd(b[X2 + 4 >> 1] | 0, j2, y2) | 0;
      n2 = Z(b[F2 >> 1] | 0, B2) | 0;
      if ((n2 | 0) == 1073741824) {
        c[y2 >> 2] = 1;
        n2 = 2147483647;
      } else
        n2 = n2 << 1;
      z2 = n2 << 1;
      b[ba2 >> 1] = ((z2 >> 1 | 0) == (n2 | 0) ? z2 : n2 >> 31 ^ 2147418112) >>> 16;
      z2 = ((V2 << 17 >> 17 | 0) == (V2 | 0) ? V2 << 1 : V2 >>> 15 ^ 32767) + 65529 & 65535;
      b[ia2 >> 1] = z2;
      z2 = Rd(b[D2 >> 1] | 0, z2, y2) | 0;
      n2 = (Z(b[F2 >> 1] | 0, A2 << 16 >> 16) | 0) >> 15;
      if ((n2 | 0) > 32767) {
        c[y2 >> 2] = 1;
        n2 = 32767;
      }
      b[da2 >> 1] = n2;
      A2 = Rd(z2, 1, y2) | 0;
      r2 = Z(b[W2 >> 1] | 0, B2) | 0;
      if ((r2 | 0) == 1073741824) {
        c[y2 >> 2] = 1;
        n2 = 2147483647;
      } else
        n2 = r2 << 1;
      D2 = Fe(n2, ia2, y2) | 0;
      h2 = (e[ia2 >> 1] | 0) + 47 | 0;
      b[ia2 >> 1] = h2;
      h2 = (e[X2 >> 1] | 0) - (h2 & 65535) | 0;
      B2 = h2 + 31 & 65535;
      B2 = x2 << 16 >> 16 > B2 << 16 >> 16 ? x2 : B2;
      B2 = j2 << 16 >> 16 > B2 << 16 >> 16 ? j2 : B2;
      B2 = z2 << 16 >> 16 > B2 << 16 >> 16 ? z2 : B2;
      B2 = (A2 << 16 >> 16 > B2 << 16 >> 16 ? A2 : B2) << 16 >> 16;
      r2 = B2 - (C2 & 65535) | 0;
      n2 = r2 & 65535;
      r2 = r2 << 16 >> 16;
      if (n2 << 16 >> 16 > 0)
        K2 = n2 << 16 >> 16 < 31 ? E2 >> r2 : 0;
      else {
        X2 = 0 - r2 << 16 >> 16;
        K2 = E2 << X2;
        K2 = (K2 >> X2 | 0) == (E2 | 0) ? K2 : E2 >> 31 ^ 2147483647;
      }
      x2 = B2 - (j2 & 65535) | 0;
      n2 = x2 & 65535;
      r2 = e[$2 >> 1] << 16;
      x2 = x2 << 16 >> 16;
      if (n2 << 16 >> 16 > 0)
        r2 = n2 << 16 >> 16 < 31 ? r2 >> x2 : 0;
      else {
        W2 = 0 - x2 << 16 >> 16;
        X2 = r2 << W2;
        r2 = (X2 >> W2 | 0) == (r2 | 0) ? X2 : r2 >> 31 ^ 2147483647;
      }
      Nc(r2, $2, aa2, y2);
      z2 = B2 - (z2 & 65535) | 0;
      r2 = z2 & 65535;
      x2 = e[ba2 >> 1] << 16;
      z2 = z2 << 16 >> 16;
      if (r2 << 16 >> 16 > 0)
        r2 = r2 << 16 >> 16 < 31 ? x2 >> z2 : 0;
      else {
        X2 = 0 - z2 << 16 >> 16;
        r2 = x2 << X2;
        r2 = (r2 >> X2 | 0) == (x2 | 0) ? r2 : x2 >> 31 ^ 2147483647;
      }
      Nc(r2, ba2, ca2, y2);
      z2 = B2 - (A2 & 65535) | 0;
      r2 = z2 & 65535;
      x2 = e[da2 >> 1] << 16;
      z2 = z2 << 16 >> 16;
      if (r2 << 16 >> 16 > 0)
        r2 = r2 << 16 >> 16 < 31 ? x2 >> z2 : 0;
      else {
        X2 = 0 - z2 << 16 >> 16;
        r2 = x2 << X2;
        r2 = (r2 >> X2 | 0) == (x2 | 0) ? r2 : x2 >> 31 ^ 2147483647;
      }
      Nc(r2, da2, ea2, y2);
      z2 = B2 + 65505 | 0;
      b[ia2 >> 1] = z2;
      z2 = z2 - (h2 & 65535) | 0;
      r2 = De(z2 & 65535, 1, y2) | 0;
      x2 = r2 << 16 >> 16;
      if (r2 << 16 >> 16 > 0)
        x2 = r2 << 16 >> 16 < 31 ? D2 >> x2 : 0;
      else {
        X2 = 0 - x2 << 16 >> 16;
        x2 = D2 << X2;
        x2 = (x2 >> X2 | 0) == (D2 | 0) ? x2 : D2 >> 31 ^ 2147483647;
      }
      do
        if (!(z2 & 1))
          E2 = x2;
        else {
          Nc(x2, _2, Y2, y2);
          r2 = b[Y2 >> 1] | 0;
          x2 = b[_2 >> 1] | 0;
          if ((x2 * 23170 | 0) == 1073741824) {
            c[y2 >> 2] = 1;
            z2 = 2147483647;
          } else
            z2 = x2 * 46340 | 0;
          _2 = (r2 << 16 >> 16) * 23170 >> 15;
          x2 = z2 + (_2 << 1) | 0;
          if (!((z2 ^ _2 | 0) > 0 & (x2 ^ z2 | 0) < 0)) {
            E2 = x2;
            break;
          }
          c[y2 >> 2] = 1;
          E2 = (z2 >>> 31) + 2147483647 | 0;
        }
      while (0);
      F2 = (K2 >>> 31) + 2147483647 | 0;
      D2 = 2147483647;
      C2 = 0;
      x2 = 0;
      G2 = S2;
      while (1) {
        r2 = (Z(b[G2 >> 1] | 0, fa2) | 0) >> 15;
        G2 = G2 + 6 | 0;
        if ((r2 | 0) > 32767) {
          c[y2 >> 2] = 1;
          r2 = 32767;
        }
        z2 = r2 & 65535;
        if (z2 << 16 >> 16 >= l2 << 16 >> 16)
          break;
        j2 = r2 << 16 >> 16;
        r2 = Z(j2, j2) | 0;
        if ((r2 | 0) == 1073741824) {
          c[y2 >> 2] = 1;
          n2 = 2147483647;
        } else
          n2 = r2 << 1;
        Nc(n2, ja2, ka2, y2);
        r2 = (Ge(z2, p2, y2) | 0) << 16 >> 16;
        r2 = Z(r2, r2) | 0;
        if ((r2 | 0) == 1073741824) {
          c[y2 >> 2] = 1;
          r2 = 2147483647;
        } else
          r2 = r2 << 1;
        Nc(r2, ga2, ha2, y2);
        z2 = b[aa2 >> 1] | 0;
        n2 = Z(b[$2 >> 1] | 0, j2) | 0;
        do
          if ((n2 | 0) == 1073741824) {
            c[y2 >> 2] = 1;
            n2 = 2147483647;
          } else {
            r2 = (n2 << 1) + K2 | 0;
            if (!((n2 ^ K2 | 0) > 0 & (r2 ^ K2 | 0) < 0)) {
              n2 = r2;
              break;
            }
            c[y2 >> 2] = 1;
            n2 = F2;
          }
        while (0);
        r2 = (Z(z2 << 16 >> 16, j2) | 0) >> 15;
        if ((r2 | 0) > 32767) {
          c[y2 >> 2] = 1;
          r2 = 32767;
        }
        _2 = r2 << 16;
        r2 = (_2 >> 15) + n2 | 0;
        if ((_2 >> 16 ^ n2 | 0) > 0 & (r2 ^ n2 | 0) < 0) {
          c[y2 >> 2] = 1;
          r2 = (n2 >>> 31) + 2147483647 | 0;
        }
        h2 = b[ca2 >> 1] | 0;
        A2 = b[ka2 >> 1] | 0;
        j2 = b[ba2 >> 1] | 0;
        B2 = b[ja2 >> 1] | 0;
        n2 = Z(B2, j2) | 0;
        do
          if ((n2 | 0) == 1073741824) {
            c[y2 >> 2] = 1;
            z2 = 2147483647;
          } else {
            z2 = (n2 << 1) + r2 | 0;
            if (!((n2 ^ r2 | 0) > 0 & (z2 ^ r2 | 0) < 0))
              break;
            c[y2 >> 2] = 1;
            z2 = (r2 >>> 31) + 2147483647 | 0;
          }
        while (0);
        n2 = (Z(A2 << 16 >> 16, j2) | 0) >> 15;
        if ((n2 | 0) > 32767) {
          c[y2 >> 2] = 1;
          n2 = 32767;
        }
        _2 = n2 << 16;
        n2 = (_2 >> 15) + z2 | 0;
        if ((_2 >> 16 ^ z2 | 0) > 0 & (n2 ^ z2 | 0) < 0) {
          c[y2 >> 2] = 1;
          n2 = (z2 >>> 31) + 2147483647 | 0;
        }
        r2 = (Z(B2, h2 << 16 >> 16) | 0) >> 15;
        if ((r2 | 0) > 32767) {
          c[y2 >> 2] = 1;
          r2 = 32767;
        }
        _2 = r2 << 16;
        r2 = (_2 >> 15) + n2 | 0;
        if ((_2 >> 16 ^ n2 | 0) > 0 & (r2 ^ n2 | 0) < 0) {
          c[y2 >> 2] = 1;
          r2 = (n2 >>> 31) + 2147483647 | 0;
        }
        r2 = Fe(r2, ia2, y2) | 0;
        z2 = De(b[ia2 >> 1] | 0, 1, y2) | 0;
        n2 = z2 << 16 >> 16;
        if (z2 << 16 >> 16 > 0)
          z2 = z2 << 16 >> 16 < 31 ? r2 >> n2 : 0;
        else {
          _2 = 0 - n2 << 16 >> 16;
          z2 = r2 << _2;
          z2 = (z2 >> _2 | 0) == (r2 | 0) ? z2 : r2 >> 31 ^ 2147483647;
        }
        r2 = z2 - E2 | 0;
        if (((r2 ^ z2) & (z2 ^ E2) | 0) < 0) {
          c[y2 >> 2] = 1;
          r2 = (z2 >>> 31) + 2147483647 | 0;
        }
        r2 = (Ce(r2, y2) | 0) << 16 >> 16;
        r2 = Z(r2, r2) | 0;
        if ((r2 | 0) == 1073741824) {
          c[y2 >> 2] = 1;
          z2 = 2147483647;
        } else
          z2 = r2 << 1;
        B2 = b[ea2 >> 1] | 0;
        j2 = b[ha2 >> 1] | 0;
        A2 = b[da2 >> 1] | 0;
        h2 = b[ga2 >> 1] | 0;
        n2 = Z(h2, A2) | 0;
        do
          if ((n2 | 0) == 1073741824) {
            c[y2 >> 2] = 1;
            r2 = 2147483647;
          } else {
            r2 = (n2 << 1) + z2 | 0;
            if (!((n2 ^ z2 | 0) > 0 & (r2 ^ z2 | 0) < 0))
              break;
            c[y2 >> 2] = 1;
            r2 = (z2 >>> 31) + 2147483647 | 0;
          }
        while (0);
        n2 = (Z(j2 << 16 >> 16, A2) | 0) >> 15;
        if ((n2 | 0) > 32767) {
          c[y2 >> 2] = 1;
          n2 = 32767;
        }
        _2 = n2 << 16;
        n2 = (_2 >> 15) + r2 | 0;
        if ((_2 >> 16 ^ r2 | 0) > 0 & (n2 ^ r2 | 0) < 0) {
          c[y2 >> 2] = 1;
          n2 = (r2 >>> 31) + 2147483647 | 0;
        }
        r2 = (Z(h2, B2 << 16 >> 16) | 0) >> 15;
        if ((r2 | 0) > 32767) {
          c[y2 >> 2] = 1;
          r2 = 32767;
        }
        _2 = r2 << 16;
        r2 = (_2 >> 15) + n2 | 0;
        if ((_2 >> 16 ^ n2 | 0) > 0 & (r2 ^ n2 | 0) < 0) {
          c[y2 >> 2] = 1;
          r2 = (n2 >>> 31) + 2147483647 | 0;
        }
        n2 = (r2 | 0) < (D2 | 0);
        x2 = n2 ? C2 : x2;
        C2 = C2 + 1 << 16 >> 16;
        if (C2 << 16 >> 16 >= 32)
          break;
        else
          D2 = n2 ? r2 : D2;
      }
      ka2 = (x2 << 16 >> 16) * 3 | 0;
      z2 = b[S2 + (ka2 << 1) >> 1] | 0;
      b[u2 >> 1] = b[S2 + (ka2 + 1 << 1) >> 1] | 0;
      b[v2 >> 1] = b[S2 + (ka2 + 2 << 1) >> 1] | 0;
      z2 = Z(z2 << 16 >> 16, fa2) | 0;
      if ((z2 | 0) == 1073741824) {
        c[y2 >> 2] = 1;
        z2 = 2147483647;
      } else
        z2 = z2 << 1;
      if (M2)
        z2 = O2 << 16 >> 16 < 31 ? z2 >> N2 : 0;
      else {
        u2 = 0 - N2 << 16 >> 16;
        y2 = z2 << u2;
        z2 = (y2 >> u2 | 0) == (z2 | 0) ? y2 : z2 >> 31 ^ 2147483647;
      }
      b[t2 >> 1] = z2 >>> 16;
      y2 = x2;
      u2 = c[w2 >> 2] | 0;
      t2 = u2 + 2 | 0;
      b[u2 >> 1] = Q2;
      u2 = u2 + 4 | 0;
      c[w2 >> 2] = u2;
      b[t2 >> 1] = y2;
      i2 = la2;
      return;
    }
    function md(a2, c2, d2, e2, f2, g2, h2, i3) {
      a2 = a2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      i3 = i3 | 0;
      var j2 = 0, k2 = 0, l2 = 0, m2 = 0, n2 = 0;
      n2 = (a2 | 0) == 7;
      j2 = b[e2 >> 1] | 0;
      if (n2) {
        j2 = j2 << 16 >> 16 >>> 1 & 65535;
        m2 = re(c2, d2, i3) | 0;
        c2 = m2 << 16;
        a2 = c2 >> 16;
        if ((m2 << 20 >> 20 | 0) == (a2 | 0))
          a2 = c2 >> 12;
        else
          a2 = a2 >>> 15 ^ 32767;
      } else {
        m2 = re(c2, d2, i3) | 0;
        c2 = m2 << 16;
        a2 = c2 >> 16;
        if ((m2 << 21 >> 21 | 0) == (a2 | 0))
          a2 = c2 >> 11;
        else
          a2 = a2 >>> 15 ^ 32767;
      }
      m2 = a2 << 16 >> 16;
      i3 = j2 << 16 >> 16;
      c2 = i3 - ((Z(m2, b[h2 >> 1] | 0) | 0) >>> 15 & 65535) | 0;
      c2 = ((c2 & 32768 | 0) != 0 ? 0 - c2 | 0 : c2) & 65535;
      k2 = 1;
      a2 = 0;
      l2 = h2;
      while (1) {
        l2 = l2 + 6 | 0;
        j2 = i3 - ((Z(b[l2 >> 1] | 0, m2) | 0) >>> 15 & 65535) | 0;
        d2 = j2 << 16;
        j2 = (d2 | 0) < 0 ? 0 - (d2 >> 16) | 0 : j2;
        d2 = (j2 << 16 >> 16 | 0) < (c2 << 16 >> 16 | 0);
        a2 = d2 ? k2 : a2;
        k2 = k2 + 1 << 16 >> 16;
        if (k2 << 16 >> 16 >= 32)
          break;
        else
          c2 = d2 ? j2 & 65535 : c2;
      }
      l2 = (a2 << 16 >> 16) * 196608 >> 16;
      b[e2 >> 1] = (Z(b[h2 + (l2 << 1) >> 1] | 0, m2) | 0) >>> 15 << (n2 & 1);
      b[f2 >> 1] = b[h2 + (l2 + 1 << 1) >> 1] | 0;
      b[g2 >> 1] = b[h2 + (l2 + 2 << 1) >> 1] | 0;
      return a2 | 0;
    }
    function nd(a2, c2, d2, e2, f2, g2, h2) {
      a2 = a2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      var i3 = 0, j2 = 0, k2 = 0, l2 = 0, m2 = 0, n2 = 0;
      i3 = Ge(b[d2 >> 1] | 0, b[g2 >> 1] | 0, h2) | 0;
      i3 = (i3 & 65535) - ((i3 & 65535) >>> 15 & 65535) | 0;
      i3 = (i3 << 16 >> 31 ^ i3) & 65535;
      k2 = 0;
      l2 = 1;
      while (1) {
        j2 = b[g2 + (l2 << 1) >> 1] | 0;
        if (j2 << 16 >> 16 > c2 << 16 >> 16)
          j2 = i3;
        else {
          j2 = Ge(b[d2 >> 1] | 0, j2, h2) | 0;
          j2 = (j2 & 65535) - ((j2 & 65535) >>> 15 & 65535) | 0;
          j2 = (j2 << 16 >> 31 ^ j2) & 65535;
          n2 = j2 << 16 >> 16 < i3 << 16 >> 16;
          j2 = n2 ? j2 : i3;
          k2 = n2 ? l2 & 65535 : k2;
        }
        l2 = l2 + 1 | 0;
        if ((l2 | 0) == 16)
          break;
        else
          i3 = j2;
      }
      if ((a2 | 0) != 5) {
        i3 = b[g2 + (k2 << 16 >> 16 << 1) >> 1] | 0;
        if ((a2 | 0) == 7) {
          b[d2 >> 1] = i3 & 65532;
          return k2 | 0;
        } else {
          b[d2 >> 1] = i3;
          return k2 | 0;
        }
      }
      j2 = k2 << 16 >> 16;
      switch (k2 << 16 >> 16) {
        case 0: {
          i3 = 0;
          break;
        }
        case 15: {
          m2 = 8;
          break;
        }
        default:
          if ((b[g2 + (j2 + 1 << 1) >> 1] | 0) > c2 << 16 >> 16)
            m2 = 8;
          else
            i3 = j2 + 65535 & 65535;
      }
      if ((m2 | 0) == 8)
        i3 = j2 + 65534 & 65535;
      b[f2 >> 1] = i3;
      n2 = i3 << 16 >> 16;
      b[e2 >> 1] = b[g2 + (n2 << 1) >> 1] | 0;
      n2 = n2 + 1 | 0;
      b[f2 + 2 >> 1] = n2;
      n2 = n2 << 16 >> 16;
      b[e2 + 2 >> 1] = b[g2 + (n2 << 1) >> 1] | 0;
      n2 = n2 + 1 | 0;
      b[f2 + 4 >> 1] = n2;
      b[e2 + 4 >> 1] = b[g2 + (n2 << 16 >> 16 << 1) >> 1] | 0;
      b[d2 >> 1] = b[g2 + (j2 << 1) >> 1] | 0;
      return k2 | 0;
    }
    function od(a2, d2, f2, g2, h2, j2, k2, l2, m2, n2, o2, p2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      j2 = j2 | 0;
      k2 = k2 | 0;
      l2 = l2 | 0;
      m2 = m2 | 0;
      n2 = n2 | 0;
      o2 = o2 | 0;
      p2 = p2 | 0;
      var q2 = 0, r2 = 0, s2 = 0, t2 = 0, u2 = 0, v2 = 0, w2 = 0, x2 = 0, y2 = 0, z2 = 0, A2 = 0, B2 = 0, C2 = 0, D2 = 0, E2 = 0, F2 = 0, G2 = 0, H2 = 0, I2 = 0, J2 = 0, K2 = 0;
      K2 = i2;
      i2 = i2 + 32 | 0;
      s2 = K2 + 20 | 0;
      t2 = K2 + 10 | 0;
      r2 = K2;
      switch (a2 | 0) {
        case 3:
        case 4:
        case 6: {
          o2 = o2 + 84 | 0;
          J2 = 128;
          break;
        }
        default: {
          o2 = o2 + 80 | 0;
          J2 = 64;
        }
      }
      I2 = c[o2 >> 2] | 0;
      q2 = re(14, f2, p2) | 0;
      H2 = d2 << 16 >> 16;
      G2 = H2 + 65525 | 0;
      a2 = (e[h2 >> 1] | 0) + 65523 & 65535;
      b[r2 >> 1] = a2;
      d2 = (e[h2 + 2 >> 1] | 0) + 65522 & 65535;
      b[r2 + 2 >> 1] = d2;
      F2 = G2 << 16 >> 16;
      F2 = Rd(b[h2 + 4 >> 1] | 0, ((G2 << 17 >> 17 | 0) == (F2 | 0) ? G2 << 1 : F2 >>> 15 ^ 32767) + 15 & 65535, p2) | 0;
      b[r2 + 4 >> 1] = F2;
      G2 = Rd(b[h2 + 6 >> 1] | 0, G2 & 65535, p2) | 0;
      b[r2 + 6 >> 1] = G2;
      h2 = Rd(b[h2 + 8 >> 1] | 0, H2 + 65526 & 65535, p2) | 0;
      b[r2 + 8 >> 1] = h2;
      d2 = d2 << 16 >> 16 > a2 << 16 >> 16 ? d2 : a2;
      d2 = F2 << 16 >> 16 > d2 << 16 >> 16 ? F2 : d2;
      d2 = G2 << 16 >> 16 > d2 << 16 >> 16 ? G2 : d2;
      d2 = (h2 << 16 >> 16 > d2 << 16 >> 16 ? h2 : d2) + 1 & 65535;
      h2 = 0;
      while (1) {
        f2 = d2 - (a2 & 65535) | 0;
        o2 = f2 & 65535;
        a2 = e[g2 + (h2 << 1) >> 1] << 16;
        f2 = f2 << 16 >> 16;
        if (o2 << 16 >> 16 > 0)
          o2 = o2 << 16 >> 16 < 31 ? a2 >> f2 : 0;
        else {
          G2 = 0 - f2 << 16 >> 16;
          o2 = a2 << G2;
          o2 = (o2 >> G2 | 0) == (a2 | 0) ? o2 : a2 >> 31 ^ 2147483647;
        }
        Nc(o2, s2 + (h2 << 1) | 0, t2 + (h2 << 1) | 0, p2);
        o2 = h2 + 1 | 0;
        if ((o2 | 0) == 5)
          break;
        a2 = b[r2 + (o2 << 1) >> 1] | 0;
        h2 = o2;
      }
      G2 = q2 << 16 >> 16;
      y2 = b[s2 >> 1] | 0;
      z2 = b[t2 >> 1] | 0;
      A2 = b[s2 + 2 >> 1] | 0;
      B2 = b[t2 + 2 >> 1] | 0;
      C2 = b[s2 + 4 >> 1] | 0;
      D2 = b[t2 + 4 >> 1] | 0;
      E2 = b[s2 + 6 >> 1] | 0;
      F2 = b[t2 + 6 >> 1] | 0;
      x2 = b[s2 + 8 >> 1] | 0;
      u2 = b[t2 + 8 >> 1] | 0;
      d2 = 2147483647;
      v2 = 0;
      o2 = 0;
      w2 = I2;
      while (1) {
        h2 = b[w2 >> 1] | 0;
        if (h2 << 16 >> 16 > j2 << 16 >> 16)
          q2 = d2;
        else {
          q2 = (Z(b[w2 + 2 >> 1] | 0, G2) | 0) >> 15;
          if ((q2 | 0) > 32767) {
            c[p2 >> 2] = 1;
            q2 = 32767;
          }
          t2 = h2 << 16 >> 16;
          h2 = Z(t2, t2) | 0;
          if (h2 >>> 0 > 1073741823) {
            c[p2 >> 2] = 1;
            r2 = 32767;
          } else
            r2 = h2 >>> 15;
          f2 = q2 << 16 >> 16;
          q2 = Z(f2, f2) | 0;
          if (q2 >>> 0 > 1073741823) {
            c[p2 >> 2] = 1;
            s2 = 32767;
          } else
            s2 = q2 >>> 15;
          g2 = (Z(f2, t2) | 0) >> 15;
          if ((g2 | 0) > 32767) {
            c[p2 >> 2] = 1;
            g2 = 32767;
          }
          q2 = r2 << 16 >> 16;
          r2 = Z(y2, q2) | 0;
          if ((r2 | 0) == 1073741824) {
            c[p2 >> 2] = 1;
            h2 = 2147483647;
          } else
            h2 = r2 << 1;
          q2 = (Z(z2, q2) | 0) >> 15;
          r2 = h2 + (q2 << 1) | 0;
          if ((h2 ^ q2 | 0) > 0 & (r2 ^ h2 | 0) < 0) {
            c[p2 >> 2] = 1;
            r2 = (h2 >>> 31) + 2147483647 | 0;
          }
          q2 = Z(A2, t2) | 0;
          if ((q2 | 0) == 1073741824) {
            c[p2 >> 2] = 1;
            h2 = 2147483647;
          } else
            h2 = q2 << 1;
          t2 = (Z(B2, t2) | 0) >> 15;
          q2 = h2 + (t2 << 1) | 0;
          if ((h2 ^ t2 | 0) > 0 & (q2 ^ h2 | 0) < 0) {
            c[p2 >> 2] = 1;
            q2 = (h2 >>> 31) + 2147483647 | 0;
          }
          h2 = q2 + r2 | 0;
          if ((q2 ^ r2 | 0) > -1 & (h2 ^ r2 | 0) < 0) {
            c[p2 >> 2] = 1;
            h2 = (r2 >>> 31) + 2147483647 | 0;
          }
          q2 = s2 << 16 >> 16;
          r2 = Z(C2, q2) | 0;
          if ((r2 | 0) == 1073741824) {
            c[p2 >> 2] = 1;
            a2 = 2147483647;
          } else
            a2 = r2 << 1;
          t2 = (Z(D2, q2) | 0) >> 15;
          r2 = a2 + (t2 << 1) | 0;
          if ((a2 ^ t2 | 0) > 0 & (r2 ^ a2 | 0) < 0) {
            c[p2 >> 2] = 1;
            r2 = (a2 >>> 31) + 2147483647 | 0;
          }
          q2 = r2 + h2 | 0;
          if ((r2 ^ h2 | 0) > -1 & (q2 ^ h2 | 0) < 0) {
            c[p2 >> 2] = 1;
            a2 = (h2 >>> 31) + 2147483647 | 0;
          } else
            a2 = q2;
          q2 = Z(E2, f2) | 0;
          if ((q2 | 0) == 1073741824) {
            c[p2 >> 2] = 1;
            r2 = 2147483647;
          } else
            r2 = q2 << 1;
          t2 = (Z(F2, f2) | 0) >> 15;
          q2 = r2 + (t2 << 1) | 0;
          if ((r2 ^ t2 | 0) > 0 & (q2 ^ r2 | 0) < 0) {
            c[p2 >> 2] = 1;
            q2 = (r2 >>> 31) + 2147483647 | 0;
          }
          h2 = q2 + a2 | 0;
          if ((q2 ^ a2 | 0) > -1 & (h2 ^ a2 | 0) < 0) {
            c[p2 >> 2] = 1;
            r2 = (a2 >>> 31) + 2147483647 | 0;
          } else
            r2 = h2;
          h2 = g2 << 16 >> 16;
          q2 = Z(x2, h2) | 0;
          if ((q2 | 0) == 1073741824) {
            c[p2 >> 2] = 1;
            a2 = 2147483647;
          } else
            a2 = q2 << 1;
          t2 = (Z(u2, h2) | 0) >> 15;
          q2 = a2 + (t2 << 1) | 0;
          if ((a2 ^ t2 | 0) > 0 & (q2 ^ a2 | 0) < 0) {
            c[p2 >> 2] = 1;
            h2 = (a2 >>> 31) + 2147483647 | 0;
          } else
            h2 = q2;
          q2 = h2 + r2 | 0;
          if ((h2 ^ r2 | 0) > -1 & (q2 ^ r2 | 0) < 0) {
            c[p2 >> 2] = 1;
            q2 = (r2 >>> 31) + 2147483647 | 0;
          }
          t2 = (q2 | 0) < (d2 | 0);
          q2 = t2 ? q2 : d2;
          o2 = t2 ? v2 : o2;
        }
        w2 = w2 + 8 | 0;
        v2 = v2 + 1 << 16 >> 16;
        if ((v2 << 16 >> 16 | 0) >= (J2 | 0))
          break;
        else
          d2 = q2;
      }
      j2 = o2 << 16 >> 16;
      j2 = ((j2 << 18 >> 18 | 0) == (j2 | 0) ? j2 << 2 : j2 >>> 15 ^ 32767) << 16 >> 16;
      b[k2 >> 1] = b[I2 + (j2 << 1) >> 1] | 0;
      d2 = b[I2 + (j2 + 1 << 1) >> 1] | 0;
      b[m2 >> 1] = b[I2 + (j2 + 2 << 1) >> 1] | 0;
      b[n2 >> 1] = b[I2 + (j2 + 3 << 1) >> 1] | 0;
      d2 = Z(d2 << 16 >> 16, G2) | 0;
      if ((d2 | 0) == 1073741824) {
        c[p2 >> 2] = 1;
        a2 = 2147483647;
      } else
        a2 = d2 << 1;
      f2 = 10 - H2 | 0;
      d2 = f2 & 65535;
      f2 = f2 << 16 >> 16;
      if (d2 << 16 >> 16 > 0) {
        p2 = d2 << 16 >> 16 < 31 ? a2 >> f2 : 0;
        p2 = p2 >>> 16;
        p2 = p2 & 65535;
        b[l2 >> 1] = p2;
        i2 = K2;
        return o2 | 0;
      } else {
        m2 = 0 - f2 << 16 >> 16;
        p2 = a2 << m2;
        p2 = (p2 >> m2 | 0) == (a2 | 0) ? p2 : a2 >> 31 ^ 2147483647;
        p2 = p2 >>> 16;
        p2 = p2 & 65535;
        b[l2 >> 1] = p2;
        i2 = K2;
        return o2 | 0;
      }
    }
    function pd(a2, c2, d2, f2, g2, h2, j2, k2, l2) {
      a2 = a2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      j2 = j2 | 0;
      k2 = k2 | 0;
      l2 = l2 | 0;
      var m2 = 0, n2 = 0, o2 = 0, p2 = 0, q2 = 0, r2 = 0, s2 = 0, t2 = 0, u2 = 0, v2 = 0, w2 = 0, x2 = 0, y2 = 0, z2 = 0, A2 = 0, B2 = 0, C2 = 0, D2 = 0, E2 = 0, F2 = 0, G2 = 0, H2 = 0, I2 = 0, J2 = 0, K2 = 0, L2 = 0, M2 = 0, N2 = 0, O2 = 0, P2 = 0, Q2 = 0, R2 = 0, S2 = 0, T2 = 0, U2 = 0, V2 = 0, W2 = 0, X2 = 0, Y2 = 0, _2 = 0, $2 = 0, aa2 = 0, ba2 = 0, ca2 = 0, da2 = 0, ea2 = 0, fa2 = 0, ga2 = 0, ha2 = 0, ia2 = 0, ja2 = 0, ka2 = 0, la2 = 0, ma2 = 0, na2 = 0, oa2 = 0, pa2 = 0, qa2 = 0, ra2 = 0, sa2 = 0, ta2 = 0, ua2 = 0, va2 = 0, wa2 = 0;
      wa2 = i2;
      i2 = i2 + 160 | 0;
      va2 = wa2;
      n2 = a2 << 16 >> 16;
      ta2 = a2 << 16 >> 16 == 10;
      ua2 = b[j2 + (b[h2 >> 1] << 1) >> 1] | 0;
      if (a2 << 16 >> 16 > 0) {
        l2 = 0;
        m2 = k2;
        while (1) {
          b[m2 >> 1] = l2;
          l2 = l2 + 1 << 16 >> 16;
          if (l2 << 16 >> 16 >= a2 << 16 >> 16)
            break;
          else
            m2 = m2 + 2 | 0;
        }
      }
      if (d2 << 16 >> 16 <= 1) {
        i2 = wa2;
        return;
      }
      ra2 = h2 + 2 | 0;
      sa2 = ua2 << 16 >> 16;
      oa2 = f2 + (sa2 << 1) | 0;
      pa2 = g2 + (sa2 * 80 | 0) + (sa2 << 1) | 0;
      qa2 = h2 + 6 | 0;
      X2 = c2 & 65535;
      Y2 = h2 + 4 | 0;
      _2 = h2 + 10 | 0;
      $2 = h2 + 8 | 0;
      aa2 = h2 + 14 | 0;
      ba2 = h2 + 12 | 0;
      ca2 = h2 + 18 | 0;
      da2 = h2 + 16 | 0;
      ea2 = k2 + 2 | 0;
      fa2 = k2 + 4 | 0;
      ga2 = k2 + 6 | 0;
      ha2 = k2 + 8 | 0;
      ia2 = k2 + 10 | 0;
      ja2 = k2 + 12 | 0;
      ka2 = k2 + 14 | 0;
      la2 = k2 + 16 | 0;
      ma2 = k2 + 18 | 0;
      na2 = a2 << 16 >> 16 > 2;
      V2 = h2 + (n2 + -1 << 1) | 0;
      T2 = 1;
      W2 = 1;
      N2 = 0;
      O2 = 0;
      U2 = -1;
      while (1) {
        S2 = b[j2 + (b[ra2 >> 1] << 1) >> 1] | 0;
        R2 = S2 << 16 >> 16;
        c2 = (e[f2 + (R2 << 1) >> 1] | 0) + (e[oa2 >> 1] | 0) | 0;
        m2 = (b[g2 + (sa2 * 80 | 0) + (R2 << 1) >> 1] << 13) + 32768 + ((b[g2 + (R2 * 80 | 0) + (R2 << 1) >> 1] | 0) + (b[pa2 >> 1] | 0) << 12) | 0;
        n2 = b[qa2 >> 1] | 0;
        if (n2 << 16 >> 16 < 40) {
          n2 = n2 << 16 >> 16;
          o2 = va2;
          while (1) {
            P2 = (b[g2 + (n2 * 80 | 0) + (n2 << 1) >> 1] | 0) >>> 1;
            M2 = b[g2 + (n2 * 80 | 0) + (sa2 << 1) >> 1] | 0;
            Q2 = b[g2 + (n2 * 80 | 0) + (R2 << 1) >> 1] | 0;
            b[o2 >> 1] = c2 + (e[f2 + (n2 << 1) >> 1] | 0);
            b[o2 + 2 >> 1] = (M2 + 2 + P2 + Q2 | 0) >>> 2;
            n2 = n2 + X2 | 0;
            if ((n2 & 65535) << 16 >> 16 < 40) {
              n2 = n2 << 16 >> 16;
              o2 = o2 + 4 | 0;
            } else
              break;
          }
          B2 = b[qa2 >> 1] | 0;
        } else
          B2 = n2;
        c2 = b[Y2 >> 1] | 0;
        A2 = m2 >> 12;
        n2 = c2 << 16 >> 16;
        a:
          do
            if (c2 << 16 >> 16 < 40) {
              z2 = B2 << 16 >> 16;
              if (B2 << 16 >> 16 < 40) {
                o2 = 1;
                q2 = c2;
                s2 = B2;
                r2 = 0;
                p2 = -1;
              } else
                while (1) {
                  n2 = n2 + X2 | 0;
                  if ((n2 & 65535) << 16 >> 16 < 40)
                    n2 = n2 << 16 >> 16;
                  else {
                    o2 = 1;
                    Q2 = c2;
                    P2 = B2;
                    n2 = 0;
                    break a;
                  }
                }
              while (1) {
                y2 = ((b[g2 + (n2 * 80 | 0) + (n2 << 1) >> 1] | 0) + A2 >> 1) + (b[g2 + (n2 * 80 | 0) + (sa2 << 1) >> 1] | 0) + (b[g2 + (n2 * 80 | 0) + (R2 << 1) >> 1] | 0) | 0;
                x2 = e[f2 + (n2 << 1) >> 1] | 0;
                v2 = z2;
                w2 = B2;
                u2 = va2;
                t2 = r2;
                while (1) {
                  m2 = (e[u2 >> 1] | 0) + x2 | 0;
                  l2 = m2 << 16 >> 16;
                  l2 = (Z(l2, l2) | 0) >>> 15;
                  r2 = (y2 + (b[g2 + (n2 * 80 | 0) + (v2 << 1) >> 1] | 0) >> 2) + (b[u2 + 2 >> 1] | 0) >> 1;
                  if ((Z(l2 << 16 >> 16, o2 << 16 >> 16) | 0) > (Z(r2, p2 << 16 >> 16) | 0)) {
                    o2 = r2 & 65535;
                    q2 = c2;
                    s2 = w2;
                    r2 = m2 & 65535;
                    p2 = l2 & 65535;
                  } else
                    r2 = t2;
                  m2 = v2 + X2 | 0;
                  w2 = m2 & 65535;
                  if (w2 << 16 >> 16 >= 40)
                    break;
                  else {
                    v2 = m2 << 16 >> 16;
                    u2 = u2 + 4 | 0;
                    t2 = r2;
                  }
                }
                n2 = n2 + X2 | 0;
                c2 = n2 & 65535;
                if (c2 << 16 >> 16 < 40)
                  n2 = n2 << 16 >> 16;
                else {
                  Q2 = q2;
                  P2 = s2;
                  n2 = r2;
                  break;
                }
              }
            } else {
              o2 = 1;
              Q2 = c2;
              P2 = B2;
              n2 = 0;
            }
          while (0);
        q2 = o2 << 16 >> 16 << 15;
        o2 = b[_2 >> 1] | 0;
        if (o2 << 16 >> 16 < 40) {
          m2 = Q2 << 16 >> 16;
          l2 = P2 << 16 >> 16;
          c2 = n2 & 65535;
          o2 = o2 << 16 >> 16;
          n2 = va2;
          while (1) {
            J2 = b[g2 + (o2 * 80 | 0) + (o2 << 1) >> 1] >> 1;
            I2 = b[g2 + (o2 * 80 | 0) + (sa2 << 1) >> 1] | 0;
            K2 = b[g2 + (o2 * 80 | 0) + (R2 << 1) >> 1] | 0;
            L2 = b[g2 + (o2 * 80 | 0) + (m2 << 1) >> 1] | 0;
            M2 = b[g2 + (o2 * 80 | 0) + (l2 << 1) >> 1] | 0;
            b[n2 >> 1] = (e[f2 + (o2 << 1) >> 1] | 0) + c2;
            b[n2 + 2 >> 1] = (I2 + 2 + J2 + K2 + L2 + M2 | 0) >>> 2;
            o2 = o2 + X2 | 0;
            if ((o2 & 65535) << 16 >> 16 < 40) {
              o2 = o2 << 16 >> 16;
              n2 = n2 + 4 | 0;
            } else
              break;
          }
          J2 = b[_2 >> 1] | 0;
        } else
          J2 = o2;
        p2 = b[$2 >> 1] | 0;
        o2 = p2 << 16 >> 16;
        b:
          do
            if (p2 << 16 >> 16 < 40) {
              C2 = Q2 << 16 >> 16;
              D2 = P2 << 16 >> 16;
              E2 = J2 << 16 >> 16;
              B2 = q2 + 32768 | 0;
              if (J2 << 16 >> 16 < 40) {
                r2 = 1;
                q2 = p2;
                c2 = J2;
                s2 = p2;
                n2 = 0;
                p2 = -1;
              } else
                while (1) {
                  o2 = o2 + X2 | 0;
                  if ((o2 & 65535) << 16 >> 16 < 40)
                    o2 = o2 << 16 >> 16;
                  else {
                    o2 = 1;
                    M2 = p2;
                    L2 = J2;
                    n2 = 0;
                    break b;
                  }
                }
              while (1) {
                l2 = e[f2 + (o2 << 1) >> 1] | 0;
                A2 = (b[g2 + (o2 * 80 | 0) + (R2 << 1) >> 1] | 0) + (b[g2 + (o2 * 80 | 0) + (sa2 << 1) >> 1] | 0) + (b[g2 + (o2 * 80 | 0) + (C2 << 1) >> 1] | 0) + (b[g2 + (o2 * 80 | 0) + (D2 << 1) >> 1] | 0) | 0;
                z2 = B2 + (b[g2 + (o2 * 80 | 0) + (o2 << 1) >> 1] << 11) | 0;
                x2 = E2;
                v2 = J2;
                y2 = va2;
                while (1) {
                  t2 = (e[y2 >> 1] | 0) + l2 | 0;
                  m2 = z2 + (b[y2 + 2 >> 1] << 14) + (A2 + (b[g2 + (o2 * 80 | 0) + (x2 << 1) >> 1] | 0) << 12) | 0;
                  u2 = t2 << 16 >> 16;
                  u2 = (Z(u2, u2) | 0) >>> 15;
                  if ((Z(u2 << 16 >> 16, r2 << 16 >> 16) | 0) > (Z(m2 >> 16, p2 << 16 >> 16) | 0)) {
                    r2 = m2 >>> 16 & 65535;
                    w2 = s2;
                    c2 = v2;
                    n2 = t2 & 65535;
                    p2 = u2 & 65535;
                  } else
                    w2 = q2;
                  q2 = x2 + X2 | 0;
                  v2 = q2 & 65535;
                  if (v2 << 16 >> 16 >= 40) {
                    q2 = w2;
                    break;
                  } else {
                    x2 = q2 << 16 >> 16;
                    q2 = w2;
                    y2 = y2 + 4 | 0;
                  }
                }
                o2 = o2 + X2 | 0;
                s2 = o2 & 65535;
                if (s2 << 16 >> 16 < 40)
                  o2 = o2 << 16 >> 16;
                else {
                  o2 = r2;
                  M2 = q2;
                  L2 = c2;
                  break;
                }
              }
            } else {
              o2 = 1;
              M2 = p2;
              L2 = J2;
              n2 = 0;
            }
          while (0);
        r2 = o2 << 16 >> 16 << 15;
        o2 = b[aa2 >> 1] | 0;
        if (o2 << 16 >> 16 < 40) {
          m2 = Q2 << 16 >> 16;
          l2 = P2 << 16 >> 16;
          p2 = M2 << 16 >> 16;
          q2 = L2 << 16 >> 16;
          c2 = n2 & 65535;
          o2 = o2 << 16 >> 16;
          n2 = va2;
          while (1) {
            F2 = b[g2 + (o2 * 80 | 0) + (o2 << 1) >> 1] >> 1;
            E2 = b[g2 + (sa2 * 80 | 0) + (o2 << 1) >> 1] | 0;
            G2 = b[g2 + (R2 * 80 | 0) + (o2 << 1) >> 1] | 0;
            H2 = b[g2 + (m2 * 80 | 0) + (o2 << 1) >> 1] | 0;
            I2 = b[g2 + (l2 * 80 | 0) + (o2 << 1) >> 1] | 0;
            J2 = b[g2 + (p2 * 80 | 0) + (o2 << 1) >> 1] | 0;
            K2 = b[g2 + (q2 * 80 | 0) + (o2 << 1) >> 1] | 0;
            b[n2 >> 1] = (e[f2 + (o2 << 1) >> 1] | 0) + c2;
            b[n2 + 2 >> 1] = (E2 + 4 + F2 + G2 + H2 + I2 + J2 + K2 | 0) >>> 3;
            o2 = o2 + X2 | 0;
            if ((o2 & 65535) << 16 >> 16 < 40) {
              o2 = o2 << 16 >> 16;
              n2 = n2 + 4 | 0;
            } else
              break;
          }
          c2 = b[aa2 >> 1] | 0;
        } else
          c2 = o2;
        s2 = b[ba2 >> 1] | 0;
        if (s2 << 16 >> 16 < 40) {
          J2 = Q2 << 16 >> 16;
          F2 = P2 << 16 >> 16;
          E2 = M2 << 16 >> 16;
          D2 = L2 << 16 >> 16;
          C2 = c2 << 16 >> 16;
          B2 = c2 << 16 >> 16 < 40;
          G2 = r2 + 32768 | 0;
          I2 = s2 << 16 >> 16;
          l2 = 1;
          w2 = s2;
          v2 = c2;
          H2 = s2;
          q2 = 0;
          o2 = -1;
          while (1) {
            if (B2) {
              r2 = e[f2 + (I2 << 1) >> 1] | 0;
              n2 = (b[g2 + (I2 * 80 | 0) + (R2 << 1) >> 1] | 0) + (b[g2 + (I2 * 80 | 0) + (sa2 << 1) >> 1] | 0) + (b[g2 + (I2 * 80 | 0) + (J2 << 1) >> 1] | 0) + (b[g2 + (I2 * 80 | 0) + (F2 << 1) >> 1] | 0) + (b[g2 + (I2 * 80 | 0) + (E2 << 1) >> 1] | 0) + (b[g2 + (I2 * 80 | 0) + (D2 << 1) >> 1] | 0) | 0;
              p2 = G2 + (b[g2 + (I2 * 80 | 0) + (I2 << 1) >> 1] << 10) | 0;
              u2 = C2;
              s2 = c2;
              z2 = v2;
              A2 = va2;
              while (1) {
                y2 = (e[A2 >> 1] | 0) + r2 | 0;
                v2 = p2 + (b[A2 + 2 >> 1] << 14) + (n2 + (b[g2 + (I2 * 80 | 0) + (u2 << 1) >> 1] | 0) << 11) | 0;
                x2 = y2 << 16 >> 16;
                x2 = (Z(x2, x2) | 0) >>> 15;
                if ((Z(x2 << 16 >> 16, l2 << 16 >> 16) | 0) > (Z(v2 >> 16, o2 << 16 >> 16) | 0)) {
                  l2 = v2 >>> 16 & 65535;
                  w2 = H2;
                  v2 = s2;
                  q2 = y2 & 65535;
                  o2 = x2 & 65535;
                } else
                  v2 = z2;
                t2 = u2 + X2 | 0;
                s2 = t2 & 65535;
                if (s2 << 16 >> 16 >= 40)
                  break;
                else {
                  u2 = t2 << 16 >> 16;
                  z2 = v2;
                  A2 = A2 + 4 | 0;
                }
              }
            }
            s2 = I2 + X2 | 0;
            H2 = s2 & 65535;
            if (H2 << 16 >> 16 >= 40) {
              K2 = v2;
              break;
            } else
              I2 = s2 << 16 >> 16;
          }
        } else {
          l2 = 1;
          w2 = s2;
          K2 = c2;
          q2 = 0;
          o2 = -1;
        }
        if (ta2) {
          u2 = l2 << 16 >> 16 << 15;
          o2 = b[ca2 >> 1] | 0;
          if (o2 << 16 >> 16 < 40) {
            n2 = Q2 << 16 >> 16;
            c2 = P2 << 16 >> 16;
            m2 = M2 << 16 >> 16;
            l2 = L2 << 16 >> 16;
            r2 = w2 << 16 >> 16;
            s2 = K2 << 16 >> 16;
            p2 = q2 & 65535;
            o2 = o2 << 16 >> 16;
            q2 = va2;
            while (1) {
              E2 = b[g2 + (o2 * 80 | 0) + (o2 << 1) >> 1] >> 1;
              D2 = b[g2 + (sa2 * 80 | 0) + (o2 << 1) >> 1] | 0;
              F2 = b[g2 + (R2 * 80 | 0) + (o2 << 1) >> 1] | 0;
              G2 = b[g2 + (n2 * 80 | 0) + (o2 << 1) >> 1] | 0;
              H2 = b[g2 + (c2 * 80 | 0) + (o2 << 1) >> 1] | 0;
              I2 = b[g2 + (m2 * 80 | 0) + (o2 << 1) >> 1] | 0;
              J2 = b[g2 + (l2 * 80 | 0) + (o2 << 1) >> 1] | 0;
              N2 = b[g2 + (r2 * 80 | 0) + (o2 << 1) >> 1] | 0;
              O2 = b[g2 + (s2 * 80 | 0) + (o2 << 1) >> 1] | 0;
              b[q2 >> 1] = (e[f2 + (o2 << 1) >> 1] | 0) + p2;
              b[q2 + 2 >> 1] = (D2 + 4 + E2 + F2 + G2 + H2 + I2 + J2 + N2 + O2 | 0) >>> 3;
              o2 = o2 + X2 | 0;
              if ((o2 & 65535) << 16 >> 16 < 40) {
                o2 = o2 << 16 >> 16;
                q2 = q2 + 4 | 0;
              } else
                break;
            }
            J2 = b[ca2 >> 1] | 0;
          } else
            J2 = o2;
          r2 = b[da2 >> 1] | 0;
          if (r2 << 16 >> 16 < 40) {
            E2 = Q2 << 16 >> 16;
            D2 = P2 << 16 >> 16;
            C2 = M2 << 16 >> 16;
            m2 = L2 << 16 >> 16;
            F2 = w2 << 16 >> 16;
            G2 = K2 << 16 >> 16;
            H2 = J2 << 16 >> 16;
            I2 = J2 << 16 >> 16 < 40;
            B2 = u2 + 32768 | 0;
            n2 = r2 << 16 >> 16;
            l2 = 1;
            s2 = r2;
            q2 = J2;
            c2 = r2;
            o2 = -1;
            while (1) {
              if (I2) {
                u2 = e[f2 + (n2 << 1) >> 1] | 0;
                p2 = (b[g2 + (R2 * 80 | 0) + (n2 << 1) >> 1] | 0) + (b[g2 + (sa2 * 80 | 0) + (n2 << 1) >> 1] | 0) + (b[g2 + (E2 * 80 | 0) + (n2 << 1) >> 1] | 0) + (b[g2 + (D2 * 80 | 0) + (n2 << 1) >> 1] | 0) + (b[g2 + (C2 * 80 | 0) + (n2 << 1) >> 1] | 0) + (b[g2 + (m2 * 80 | 0) + (n2 << 1) >> 1] | 0) + (b[g2 + (F2 * 80 | 0) + (n2 << 1) >> 1] | 0) + (b[g2 + (G2 * 80 | 0) + (n2 << 1) >> 1] | 0) | 0;
                r2 = B2 + (b[g2 + (n2 * 80 | 0) + (n2 << 1) >> 1] << 9) | 0;
                A2 = H2;
                x2 = J2;
                z2 = va2;
                while (1) {
                  y2 = (e[z2 >> 1] | 0) + u2 << 16 >> 16;
                  y2 = (Z(y2, y2) | 0) >>> 15;
                  v2 = r2 + (b[z2 + 2 >> 1] << 13) + (p2 + (b[g2 + (n2 * 80 | 0) + (A2 << 1) >> 1] | 0) << 10) | 0;
                  if ((Z(y2 << 16 >> 16, l2 << 16 >> 16) | 0) > (Z(v2 >> 16, o2 << 16 >> 16) | 0)) {
                    l2 = v2 >>> 16 & 65535;
                    s2 = c2;
                    q2 = x2;
                    o2 = y2 & 65535;
                  }
                  t2 = A2 + X2 | 0;
                  x2 = t2 & 65535;
                  if (x2 << 16 >> 16 >= 40)
                    break;
                  else {
                    A2 = t2 << 16 >> 16;
                    z2 = z2 + 4 | 0;
                  }
                }
              }
              r2 = n2 + X2 | 0;
              c2 = r2 & 65535;
              if (c2 << 16 >> 16 >= 40)
                break;
              else
                n2 = r2 << 16 >> 16;
            }
          } else {
            l2 = 1;
            s2 = r2;
            q2 = J2;
            o2 = -1;
          }
        } else {
          s2 = N2;
          q2 = O2;
        }
        if ((Z(o2 << 16 >> 16, T2 << 16 >> 16) | 0) > (Z(l2 << 16 >> 16, U2 << 16 >> 16) | 0)) {
          b[k2 >> 1] = ua2;
          b[ea2 >> 1] = S2;
          b[fa2 >> 1] = Q2;
          b[ga2 >> 1] = P2;
          b[ha2 >> 1] = M2;
          b[ia2 >> 1] = L2;
          b[ja2 >> 1] = w2;
          b[ka2 >> 1] = K2;
          if (ta2) {
            b[la2 >> 1] = s2;
            b[ma2 >> 1] = q2;
          }
        } else {
          l2 = T2;
          o2 = U2;
        }
        n2 = b[ra2 >> 1] | 0;
        if (na2) {
          c2 = 1;
          m2 = 2;
          while (1) {
            b[h2 + (c2 << 1) >> 1] = b[h2 + (m2 << 1) >> 1] | 0;
            m2 = m2 + 1 | 0;
            if ((m2 & 65535) << 16 >> 16 == a2 << 16 >> 16)
              break;
            else
              c2 = c2 + 1 | 0;
          }
        }
        b[V2 >> 1] = n2;
        W2 = W2 + 1 << 16 >> 16;
        if (W2 << 16 >> 16 >= d2 << 16 >> 16)
          break;
        else {
          T2 = l2;
          N2 = s2;
          O2 = q2;
          U2 = o2;
        }
      }
      i2 = wa2;
      return;
    }
    function qd(a2, c2, d2, e2) {
      a2 = a2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      var f2 = 0, g2 = 0, h2 = 0, i3 = 0, j2 = 0, k2 = 0;
      i3 = 39;
      while (1) {
        h2 = a2 + (i3 << 1) | 0;
        g2 = b[h2 >> 1] | 0;
        f2 = c2 + (i3 << 1) | 0;
        if (g2 << 16 >> 16 > -1)
          b[f2 >> 1] = 32767;
        else {
          b[f2 >> 1] = -32767;
          if (g2 << 16 >> 16 == -32768)
            g2 = 32767;
          else
            g2 = 0 - (g2 & 65535) & 65535;
          b[h2 >> 1] = g2;
        }
        b[d2 + (i3 << 1) >> 1] = g2;
        if ((i3 | 0) > 0)
          i3 = i3 + -1 | 0;
        else
          break;
      }
      k2 = 8 - (e2 << 16 >> 16) | 0;
      if ((k2 | 0) > 0) {
        j2 = 0;
        f2 = 0;
      } else
        return;
      do {
        e2 = 0;
        a2 = 0;
        h2 = 32767;
        while (1) {
          c2 = b[d2 + (e2 << 1) >> 1] | 0;
          i3 = c2 << 16 >> 16 > -1 ? c2 << 16 >> 16 < h2 << 16 >> 16 : 0;
          f2 = i3 ? a2 : f2;
          g2 = e2 + 5 | 0;
          a2 = g2 & 65535;
          if (a2 << 16 >> 16 >= 40)
            break;
          else {
            e2 = g2 << 16 >> 16;
            h2 = i3 ? c2 : h2;
          }
        }
        b[d2 + (f2 << 16 >> 16 << 1) >> 1] = -1;
        j2 = j2 + 1 << 16 >> 16;
      } while ((j2 << 16 >> 16 | 0) < (k2 | 0));
      j2 = 0;
      do {
        c2 = 1;
        a2 = 1;
        g2 = 32767;
        while (1) {
          e2 = b[d2 + (c2 << 1) >> 1] | 0;
          i3 = e2 << 16 >> 16 > -1 ? e2 << 16 >> 16 < g2 << 16 >> 16 : 0;
          f2 = i3 ? a2 : f2;
          h2 = c2 + 5 | 0;
          a2 = h2 & 65535;
          if (a2 << 16 >> 16 >= 40)
            break;
          else {
            c2 = h2 << 16 >> 16;
            g2 = i3 ? e2 : g2;
          }
        }
        b[d2 + (f2 << 16 >> 16 << 1) >> 1] = -1;
        j2 = j2 + 1 << 16 >> 16;
      } while ((j2 << 16 >> 16 | 0) < (k2 | 0));
      j2 = 0;
      do {
        c2 = 2;
        a2 = 2;
        g2 = 32767;
        while (1) {
          e2 = b[d2 + (c2 << 1) >> 1] | 0;
          i3 = e2 << 16 >> 16 > -1 ? e2 << 16 >> 16 < g2 << 16 >> 16 : 0;
          f2 = i3 ? a2 : f2;
          h2 = c2 + 5 | 0;
          a2 = h2 & 65535;
          if (a2 << 16 >> 16 >= 40)
            break;
          else {
            c2 = h2 << 16 >> 16;
            g2 = i3 ? e2 : g2;
          }
        }
        b[d2 + (f2 << 16 >> 16 << 1) >> 1] = -1;
        j2 = j2 + 1 << 16 >> 16;
      } while ((j2 << 16 >> 16 | 0) < (k2 | 0));
      j2 = 0;
      while (1) {
        c2 = 3;
        a2 = 3;
        g2 = 32767;
        while (1) {
          e2 = b[d2 + (c2 << 1) >> 1] | 0;
          i3 = e2 << 16 >> 16 > -1 ? e2 << 16 >> 16 < g2 << 16 >> 16 : 0;
          f2 = i3 ? a2 : f2;
          h2 = c2 + 5 | 0;
          a2 = h2 & 65535;
          if (a2 << 16 >> 16 >= 40) {
            g2 = f2;
            break;
          } else {
            c2 = h2 << 16 >> 16;
            g2 = i3 ? e2 : g2;
          }
        }
        b[d2 + (g2 << 16 >> 16 << 1) >> 1] = -1;
        j2 = j2 + 1 << 16 >> 16;
        if ((j2 << 16 >> 16 | 0) >= (k2 | 0)) {
          f2 = 0;
          break;
        } else
          f2 = g2;
      }
      do {
        c2 = 4;
        a2 = 4;
        j2 = 32767;
        while (1) {
          e2 = b[d2 + (c2 << 1) >> 1] | 0;
          i3 = e2 << 16 >> 16 > -1 ? e2 << 16 >> 16 < j2 << 16 >> 16 : 0;
          g2 = i3 ? a2 : g2;
          h2 = c2 + 5 | 0;
          a2 = h2 & 65535;
          if (a2 << 16 >> 16 >= 40)
            break;
          else {
            c2 = h2 << 16 >> 16;
            j2 = i3 ? e2 : j2;
          }
        }
        b[d2 + (g2 << 16 >> 16 << 1) >> 1] = -1;
        f2 = f2 + 1 << 16 >> 16;
      } while ((f2 << 16 >> 16 | 0) < (k2 | 0));
      return;
    }
    function rd(a2, d2, e2, f2, g2, h2, j2, k2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      j2 = j2 | 0;
      k2 = k2 | 0;
      var l2 = 0, m2 = 0, n2 = 0, o2 = 0, p2 = 0, q2 = 0, r2 = 0, s2 = 0, t2 = 0, u2 = 0, v2 = 0, w2 = 0, x2 = 0, y2 = 0;
      y2 = i2;
      i2 = i2 + 80 | 0;
      x2 = y2;
      p2 = 40;
      q2 = d2;
      r2 = a2;
      m2 = 256;
      n2 = 256;
      while (1) {
        l2 = b[q2 >> 1] | 0;
        q2 = q2 + 2 | 0;
        l2 = Z(l2, l2) | 0;
        if ((l2 | 0) != 1073741824) {
          o2 = (l2 << 1) + m2 | 0;
          if ((l2 ^ m2 | 0) > 0 & (o2 ^ m2 | 0) < 0) {
            c[k2 >> 2] = 1;
            m2 = (m2 >>> 31) + 2147483647 | 0;
          } else
            m2 = o2;
        } else {
          c[k2 >> 2] = 1;
          m2 = 2147483647;
        }
        w2 = b[r2 >> 1] | 0;
        n2 = (Z(w2 << 1, w2) | 0) + n2 | 0;
        p2 = p2 + -1 << 16 >> 16;
        if (!(p2 << 16 >> 16))
          break;
        else
          r2 = r2 + 2 | 0;
      }
      w2 = ce(m2, k2) | 0;
      u2 = w2 << 5;
      w2 = ((u2 >> 5 | 0) == (w2 | 0) ? u2 : w2 >> 31 ^ 2147418112) >> 16;
      u2 = (ce(n2, k2) | 0) << 5 >> 16;
      v2 = 39;
      s2 = d2 + 78 | 0;
      t2 = x2 + 78 | 0;
      l2 = e2 + 78 | 0;
      while (1) {
        r2 = Z(b[s2 >> 1] | 0, w2) | 0;
        s2 = s2 + -2 | 0;
        q2 = r2 << 1;
        d2 = a2 + (v2 << 1) | 0;
        m2 = b[d2 >> 1] | 0;
        p2 = Z(m2 << 16 >> 16, u2) | 0;
        if ((p2 | 0) != 1073741824) {
          o2 = (p2 << 1) + q2 | 0;
          if ((p2 ^ q2 | 0) > 0 & (o2 ^ q2 | 0) < 0) {
            c[k2 >> 2] = 1;
            o2 = (r2 >>> 30 & 1) + 2147483647 | 0;
          }
        } else {
          c[k2 >> 2] = 1;
          o2 = 2147483647;
        }
        n2 = o2 << 10;
        n2 = Ce((n2 >> 10 | 0) == (o2 | 0) ? n2 : o2 >> 31 ^ 2147483647, k2) | 0;
        if (n2 << 16 >> 16 > -1)
          b[l2 >> 1] = 32767;
        else {
          b[l2 >> 1] = -32767;
          if (n2 << 16 >> 16 == -32768)
            n2 = 32767;
          else
            n2 = 0 - (n2 & 65535) & 65535;
          if (m2 << 16 >> 16 == -32768)
            o2 = 32767;
          else
            o2 = 0 - (m2 & 65535) & 65535;
          b[d2 >> 1] = o2;
        }
        l2 = l2 + -2 | 0;
        b[t2 >> 1] = n2;
        if ((v2 | 0) <= 0)
          break;
        else {
          v2 = v2 + -1 | 0;
          t2 = t2 + -2 | 0;
        }
      }
      d2 = g2 << 16 >> 16;
      if (g2 << 16 >> 16 <= 0) {
        b[h2 + (d2 << 1) >> 1] = b[h2 >> 1] | 0;
        i2 = y2;
        return;
      }
      r2 = j2 & 65535;
      q2 = 0;
      p2 = -1;
      l2 = 0;
      while (1) {
        if ((q2 | 0) < 40) {
          n2 = q2;
          o2 = q2 & 65535;
          m2 = -1;
          while (1) {
            k2 = b[x2 + (n2 << 1) >> 1] | 0;
            j2 = k2 << 16 >> 16 > m2 << 16 >> 16;
            m2 = j2 ? k2 : m2;
            l2 = j2 ? o2 : l2;
            n2 = n2 + r2 | 0;
            o2 = n2 & 65535;
            if (o2 << 16 >> 16 >= 40)
              break;
            else
              n2 = n2 << 16 >> 16;
          }
        } else
          m2 = -1;
        b[f2 + (q2 << 1) >> 1] = l2;
        if (m2 << 16 >> 16 > p2 << 16 >> 16)
          b[h2 >> 1] = q2;
        else
          m2 = p2;
        q2 = q2 + 1 | 0;
        if ((q2 & 65535) << 16 >> 16 == g2 << 16 >> 16)
          break;
        else
          p2 = m2;
      }
      l2 = b[h2 >> 1] | 0;
      b[h2 + (d2 << 1) >> 1] = l2;
      if (g2 << 16 >> 16 > 1)
        m2 = 1;
      else {
        i2 = y2;
        return;
      }
      do {
        f2 = l2 + 1 << 16 >> 16;
        l2 = f2 << 16 >> 16 >= g2 << 16 >> 16 ? 0 : f2;
        b[h2 + (m2 << 1) >> 1] = l2;
        b[h2 + (m2 + d2 << 1) >> 1] = l2;
        m2 = m2 + 1 | 0;
      } while ((m2 & 65535) << 16 >> 16 != g2 << 16 >> 16);
      i2 = y2;
      return;
    }
    function sd(a2) {
      a2 = a2 | 0;
      var d2 = 0;
      if (!a2) {
        a2 = -1;
        return a2 | 0;
      }
      c[a2 >> 2] = 0;
      d2 = Je(12) | 0;
      if (!d2) {
        a2 = -1;
        return a2 | 0;
      }
      b[d2 >> 1] = 8;
      c[a2 >> 2] = d2;
      b[d2 + 2 >> 1] = 3;
      b[d2 + 4 >> 1] = 0;
      c[d2 + 8 >> 2] = 0;
      a2 = 0;
      return a2 | 0;
    }
    function td(a2) {
      a2 = a2 | 0;
      var b2 = 0;
      if (!a2)
        return;
      b2 = c[a2 >> 2] | 0;
      if (!b2)
        return;
      Ke(b2);
      c[a2 >> 2] = 0;
      return;
    }
    function ud(a2, d2, e2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      var f2 = 0, g2 = 0, h2 = 0;
      do
        if ((d2 | 0) == 8) {
          f2 = a2 + 2 | 0;
          g2 = (b[f2 >> 1] | 0) + -1 << 16 >> 16;
          b[f2 >> 1] = g2;
          d2 = a2 + 8 | 0;
          if (!(c[d2 >> 2] | 0)) {
            c[e2 >> 2] = 1;
            b[f2 >> 1] = 3;
            break;
          }
          h2 = a2 + 4 | 0;
          if (g2 << 16 >> 16 > 2 & (b[h2 >> 1] | 0) > 0) {
            c[e2 >> 2] = 2;
            b[h2 >> 1] = (b[h2 >> 1] | 0) + -1 << 16 >> 16;
            break;
          }
          if (!(g2 << 16 >> 16)) {
            c[e2 >> 2] = 2;
            b[f2 >> 1] = b[a2 >> 1] | 0;
            break;
          } else {
            c[e2 >> 2] = 3;
            break;
          }
        } else {
          b[a2 + 2 >> 1] = b[a2 >> 1] | 0;
          c[e2 >> 2] = 0;
          d2 = a2 + 8 | 0;
        }
      while (0);
      c[d2 >> 2] = c[e2 >> 2];
      return;
    }
    function vd(a2, b2, d2) {
      a2 = a2 | 0;
      b2 = b2 | 0;
      d2 = d2 | 0;
      var e2 = 0, f2 = 0, g2 = 0;
      if (!a2) {
        a2 = -1;
        return a2 | 0;
      }
      c[a2 >> 2] = 0;
      d2 = Je(12) | 0;
      e2 = d2;
      if (!d2) {
        a2 = -1;
        return a2 | 0;
      }
      c[d2 >> 2] = 0;
      f2 = d2 + 4 | 0;
      c[f2 >> 2] = 0;
      g2 = d2 + 8 | 0;
      c[g2 >> 2] = b2;
      if ((dd(d2) | 0) << 16 >> 16 == 0 ? (ac(f2, c[g2 >> 2] | 0) | 0) << 16 >> 16 == 0 : 0) {
        ed(c[d2 >> 2] | 0) | 0;
        cc(c[f2 >> 2] | 0) | 0;
        c[a2 >> 2] = e2;
        a2 = 0;
        return a2 | 0;
      }
      fd(d2);
      bc(f2);
      Ke(d2);
      a2 = -1;
      return a2 | 0;
    }
    function wd(a2) {
      a2 = a2 | 0;
      var b2 = 0;
      if (!a2)
        return;
      b2 = c[a2 >> 2] | 0;
      if (!b2)
        return;
      fd(b2);
      bc((c[a2 >> 2] | 0) + 4 | 0);
      Ke(c[a2 >> 2] | 0);
      c[a2 >> 2] = 0;
      return;
    }
    function xd(a2, d2, f2, g2, h2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      var j2 = 0, k2 = 0, l2 = 0, m2 = 0, n2 = 0;
      m2 = i2;
      i2 = i2 + 448 | 0;
      k2 = m2 + 320 | 0;
      l2 = m2;
      Qe(g2 | 0, 0, 488) | 0;
      j2 = 0;
      do {
        n2 = f2 + (j2 << 1) | 0;
        b[n2 >> 1] = (e[n2 >> 1] | 0) & 65528;
        j2 = j2 + 1 | 0;
      } while ((j2 | 0) != 160);
      gd(c[a2 >> 2] | 0, f2, 160);
      n2 = a2 + 4 | 0;
      dc(c[n2 >> 2] | 0, d2, f2, k2, h2, l2) | 0;
      hd(c[h2 >> 2] | 0, k2, g2, (c[n2 >> 2] | 0) + 2392 | 0);
      i2 = m2;
      return;
    }
    function yd(a2, c2, d2, e2, f2, g2, h2, j2, k2, l2, m2, n2, o2, p2, q2, r2) {
      a2 = a2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      j2 = j2 | 0;
      k2 = k2 | 0;
      l2 = l2 | 0;
      m2 = m2 | 0;
      n2 = n2 | 0;
      o2 = o2 | 0;
      p2 = p2 | 0;
      q2 = q2 | 0;
      r2 = r2 | 0;
      var s2 = 0, t2 = 0, u2 = 0;
      u2 = i2;
      i2 = i2 + 48 | 0;
      s2 = u2 + 22 | 0;
      t2 = u2;
      Ie(f2, (a2 & -2 | 0) == 6 ? d2 : c2, s2);
      Ie(f2, e2, t2);
      d2 = m2;
      c2 = s2;
      f2 = d2 + 22 | 0;
      do {
        b[d2 >> 1] = b[c2 >> 1] | 0;
        d2 = d2 + 2 | 0;
        c2 = c2 + 2 | 0;
      } while ((d2 | 0) < (f2 | 0));
      He(g2, m2, o2, 40, l2, 0);
      He(t2, o2, o2, 40, l2, 0);
      Be(g2, h2, q2, 40);
      d2 = n2;
      c2 = q2;
      f2 = d2 + 80 | 0;
      do {
        b[d2 >> 1] = b[c2 >> 1] | 0;
        d2 = d2 + 2 | 0;
        c2 = c2 + 2 | 0;
      } while ((d2 | 0) < (f2 | 0));
      He(g2, n2, r2, 40, j2, 0);
      Be(s2, r2, p2, 40);
      He(t2, p2, p2, 40, k2, 0);
      i2 = u2;
      return;
    }
    function zd(a2, c2, d2, f2, g2, h2, i3, j2, k2, l2, m2, n2, o2, p2, q2, r2, s2) {
      a2 = a2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      i3 = i3 | 0;
      j2 = j2 | 0;
      k2 = k2 | 0;
      l2 = l2 | 0;
      m2 = m2 | 0;
      n2 = n2 | 0;
      o2 = o2 | 0;
      p2 = p2 | 0;
      q2 = q2 | 0;
      r2 = r2 | 0;
      s2 = s2 | 0;
      var t2 = 0, u2 = 0, v2 = 0, w2 = 0, x2 = 0;
      if ((c2 | 0) == 7) {
        v2 = 11;
        c2 = f2 << 16 >> 16 >>> 1 & 65535;
        t2 = 2;
      } else {
        v2 = 13;
        c2 = f2;
        t2 = 1;
      }
      b[r2 >> 1] = f2 << 16 >> 16 < 13017 ? f2 : 13017;
      u2 = d2 << 16 >> 16;
      q2 = q2 + (u2 << 1) | 0;
      r2 = c2 << 16 >> 16;
      g2 = g2 << 16 >> 16;
      d2 = 20;
      c2 = k2;
      s2 = q2;
      while (1) {
        k2 = s2 + 2 | 0;
        x2 = Z(b[s2 >> 1] | 0, r2) | 0;
        w2 = Z(b[k2 >> 1] | 0, r2) | 0;
        x2 = (Z(b[c2 >> 1] | 0, g2) | 0) + x2 << 1;
        w2 = (Z(b[c2 + 2 >> 1] | 0, g2) | 0) + w2 << 1 << t2;
        b[s2 >> 1] = ((x2 << t2) + 32768 | 0) >>> 16;
        b[k2 >> 1] = (w2 + 32768 | 0) >>> 16;
        d2 = d2 + -1 << 16 >> 16;
        if (!(d2 << 16 >> 16))
          break;
        else {
          c2 = c2 + 4 | 0;
          s2 = s2 + 4 | 0;
        }
      }
      c2 = f2 << 16 >> 16;
      He(h2, q2, i3 + (u2 << 1) | 0, 40, n2, 1);
      d2 = 30;
      s2 = 0;
      while (1) {
        w2 = d2 + u2 | 0;
        b[o2 + (s2 << 1) >> 1] = (e[a2 + (w2 << 1) >> 1] | 0) - (e[i3 + (w2 << 1) >> 1] | 0);
        w2 = Z(b[l2 + (d2 << 1) >> 1] | 0, c2) | 0;
        x2 = (Z(b[m2 + (d2 << 1) >> 1] | 0, g2) | 0) >> v2;
        b[p2 + (s2 << 1) >> 1] = (e[j2 + (d2 << 1) >> 1] | 0) - (w2 >>> 14) - x2;
        s2 = s2 + 1 | 0;
        if ((s2 | 0) == 10)
          break;
        else
          d2 = d2 + 1 | 0;
      }
      return;
    }
    function Ad(a2) {
      a2 = a2 | 0;
      var d2 = 0;
      if (!a2) {
        a2 = -1;
        return a2 | 0;
      }
      c[a2 >> 2] = 0;
      d2 = Je(16) | 0;
      if (!d2) {
        a2 = -1;
        return a2 | 0;
      }
      b[d2 >> 1] = 0;
      b[d2 + 2 >> 1] = 0;
      b[d2 + 4 >> 1] = 0;
      b[d2 + 6 >> 1] = 0;
      b[d2 + 8 >> 1] = 0;
      b[d2 + 10 >> 1] = 0;
      b[d2 + 12 >> 1] = 0;
      b[d2 + 14 >> 1] = 0;
      c[a2 >> 2] = d2;
      a2 = 0;
      return a2 | 0;
    }
    function Bd(a2) {
      a2 = a2 | 0;
      if (!a2) {
        a2 = -1;
        return a2 | 0;
      }
      b[a2 >> 1] = 0;
      b[a2 + 2 >> 1] = 0;
      b[a2 + 4 >> 1] = 0;
      b[a2 + 6 >> 1] = 0;
      b[a2 + 8 >> 1] = 0;
      b[a2 + 10 >> 1] = 0;
      b[a2 + 12 >> 1] = 0;
      b[a2 + 14 >> 1] = 0;
      a2 = 0;
      return a2 | 0;
    }
    function Cd(a2) {
      a2 = a2 | 0;
      var b2 = 0;
      if (!a2)
        return;
      b2 = c[a2 >> 2] | 0;
      if (!b2)
        return;
      Ke(b2);
      c[a2 >> 2] = 0;
      return;
    }
    function Dd(a2, c2, d2) {
      a2 = a2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      var f2 = 0, g2 = 0, h2 = 0, i3 = 0;
      f2 = e[c2 + 6 >> 1] | 0;
      d2 = e[c2 + 8 >> 1] | 0;
      g2 = f2 - d2 | 0;
      g2 = (g2 & 65535 | 0) != 32767 ? g2 & 65535 : 32767;
      h2 = e[c2 + 10 >> 1] | 0;
      d2 = d2 - h2 | 0;
      g2 = (d2 << 16 >> 16 | 0) < (g2 << 16 >> 16 | 0) ? d2 & 65535 : g2;
      d2 = e[c2 + 12 >> 1] | 0;
      h2 = h2 - d2 | 0;
      g2 = (h2 << 16 >> 16 | 0) < (g2 << 16 >> 16 | 0) ? h2 & 65535 : g2;
      h2 = e[c2 + 14 >> 1] | 0;
      d2 = d2 - h2 | 0;
      g2 = (d2 << 16 >> 16 | 0) < (g2 << 16 >> 16 | 0) ? d2 & 65535 : g2;
      h2 = h2 - (e[c2 + 16 >> 1] | 0) | 0;
      d2 = b[c2 + 2 >> 1] | 0;
      i3 = e[c2 + 4 >> 1] | 0;
      c2 = (d2 & 65535) - i3 | 0;
      c2 = (c2 & 65535 | 0) != 32767 ? c2 & 65535 : 32767;
      f2 = i3 - f2 | 0;
      if (((h2 << 16 >> 16 | 0) < (g2 << 16 >> 16 | 0) ? h2 & 65535 : g2) << 16 >> 16 < 1500 ? 1 : (((f2 << 16 >> 16 | 0) < (c2 << 16 >> 16 | 0) ? f2 & 65535 : c2) << 16 >> 16 | 0) < ((d2 << 16 >> 16 > 32e3 ? 600 : d2 << 16 >> 16 > 30500 ? 800 : 1100) | 0)) {
        h2 = (b[a2 >> 1] | 0) + 1 << 16 >> 16;
        i3 = h2 << 16 >> 16 > 11;
        b[a2 >> 1] = i3 ? 12 : h2;
        return i3 & 1 | 0;
      } else {
        b[a2 >> 1] = 0;
        return 0;
      }
    }
    function Ed(a2, c2, d2) {
      a2 = a2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      c2 = De(c2, 3, d2) | 0;
      c2 = Rd(c2, b[a2 + 2 >> 1] | 0, d2) | 0;
      c2 = Rd(c2, b[a2 + 4 >> 1] | 0, d2) | 0;
      c2 = Rd(c2, b[a2 + 6 >> 1] | 0, d2) | 0;
      c2 = Rd(c2, b[a2 + 8 >> 1] | 0, d2) | 0;
      c2 = Rd(c2, b[a2 + 10 >> 1] | 0, d2) | 0;
      c2 = Rd(c2, b[a2 + 12 >> 1] | 0, d2) | 0;
      return (Rd(c2, b[a2 + 14 >> 1] | 0, d2) | 0) << 16 >> 16 > 15565 | 0;
    }
    function Fd(a2, c2, d2) {
      a2 = a2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      var e2 = 0;
      d2 = a2 + 4 | 0;
      b[a2 + 2 >> 1] = b[d2 >> 1] | 0;
      e2 = a2 + 6 | 0;
      b[d2 >> 1] = b[e2 >> 1] | 0;
      d2 = a2 + 8 | 0;
      b[e2 >> 1] = b[d2 >> 1] | 0;
      e2 = a2 + 10 | 0;
      b[d2 >> 1] = b[e2 >> 1] | 0;
      d2 = a2 + 12 | 0;
      b[e2 >> 1] = b[d2 >> 1] | 0;
      a2 = a2 + 14 | 0;
      b[d2 >> 1] = b[a2 >> 1] | 0;
      b[a2 >> 1] = c2 << 16 >> 16 >>> 3;
      return;
    }
    function Gd(a2) {
      a2 = a2 | 0;
      var d2 = 0, e2 = 0, f2 = 0;
      if (!a2) {
        f2 = -1;
        return f2 | 0;
      }
      c[a2 >> 2] = 0;
      d2 = Je(128) | 0;
      if (!d2) {
        f2 = -1;
        return f2 | 0;
      }
      e2 = d2 + 72 | 0;
      f2 = e2 + 46 | 0;
      do {
        b[e2 >> 1] = 0;
        e2 = e2 + 2 | 0;
      } while ((e2 | 0) < (f2 | 0));
      b[d2 >> 1] = 150;
      b[d2 + 36 >> 1] = 150;
      b[d2 + 18 >> 1] = 150;
      b[d2 + 54 >> 1] = 0;
      b[d2 + 2 >> 1] = 150;
      b[d2 + 38 >> 1] = 150;
      b[d2 + 20 >> 1] = 150;
      b[d2 + 56 >> 1] = 0;
      b[d2 + 4 >> 1] = 150;
      b[d2 + 40 >> 1] = 150;
      b[d2 + 22 >> 1] = 150;
      b[d2 + 58 >> 1] = 0;
      b[d2 + 6 >> 1] = 150;
      b[d2 + 42 >> 1] = 150;
      b[d2 + 24 >> 1] = 150;
      b[d2 + 60 >> 1] = 0;
      b[d2 + 8 >> 1] = 150;
      b[d2 + 44 >> 1] = 150;
      b[d2 + 26 >> 1] = 150;
      b[d2 + 62 >> 1] = 0;
      b[d2 + 10 >> 1] = 150;
      b[d2 + 46 >> 1] = 150;
      b[d2 + 28 >> 1] = 150;
      b[d2 + 64 >> 1] = 0;
      b[d2 + 12 >> 1] = 150;
      b[d2 + 48 >> 1] = 150;
      b[d2 + 30 >> 1] = 150;
      b[d2 + 66 >> 1] = 0;
      b[d2 + 14 >> 1] = 150;
      b[d2 + 50 >> 1] = 150;
      b[d2 + 32 >> 1] = 150;
      b[d2 + 68 >> 1] = 0;
      b[d2 + 16 >> 1] = 150;
      b[d2 + 52 >> 1] = 150;
      b[d2 + 34 >> 1] = 150;
      b[d2 + 70 >> 1] = 0;
      b[d2 + 118 >> 1] = 13106;
      b[d2 + 120 >> 1] = 0;
      b[d2 + 122 >> 1] = 0;
      b[d2 + 124 >> 1] = 0;
      b[d2 + 126 >> 1] = 13106;
      c[a2 >> 2] = d2;
      f2 = 0;
      return f2 | 0;
    }
    function Hd(a2) {
      a2 = a2 | 0;
      var c2 = 0, d2 = 0;
      if (!a2) {
        d2 = -1;
        return d2 | 0;
      }
      c2 = a2 + 72 | 0;
      d2 = c2 + 46 | 0;
      do {
        b[c2 >> 1] = 0;
        c2 = c2 + 2 | 0;
      } while ((c2 | 0) < (d2 | 0));
      b[a2 >> 1] = 150;
      b[a2 + 36 >> 1] = 150;
      b[a2 + 18 >> 1] = 150;
      b[a2 + 54 >> 1] = 0;
      b[a2 + 2 >> 1] = 150;
      b[a2 + 38 >> 1] = 150;
      b[a2 + 20 >> 1] = 150;
      b[a2 + 56 >> 1] = 0;
      b[a2 + 4 >> 1] = 150;
      b[a2 + 40 >> 1] = 150;
      b[a2 + 22 >> 1] = 150;
      b[a2 + 58 >> 1] = 0;
      b[a2 + 6 >> 1] = 150;
      b[a2 + 42 >> 1] = 150;
      b[a2 + 24 >> 1] = 150;
      b[a2 + 60 >> 1] = 0;
      b[a2 + 8 >> 1] = 150;
      b[a2 + 44 >> 1] = 150;
      b[a2 + 26 >> 1] = 150;
      b[a2 + 62 >> 1] = 0;
      b[a2 + 10 >> 1] = 150;
      b[a2 + 46 >> 1] = 150;
      b[a2 + 28 >> 1] = 150;
      b[a2 + 64 >> 1] = 0;
      b[a2 + 12 >> 1] = 150;
      b[a2 + 48 >> 1] = 150;
      b[a2 + 30 >> 1] = 150;
      b[a2 + 66 >> 1] = 0;
      b[a2 + 14 >> 1] = 150;
      b[a2 + 50 >> 1] = 150;
      b[a2 + 32 >> 1] = 150;
      b[a2 + 68 >> 1] = 0;
      b[a2 + 16 >> 1] = 150;
      b[a2 + 52 >> 1] = 150;
      b[a2 + 34 >> 1] = 150;
      b[a2 + 70 >> 1] = 0;
      b[a2 + 118 >> 1] = 13106;
      b[a2 + 120 >> 1] = 0;
      b[a2 + 122 >> 1] = 0;
      b[a2 + 124 >> 1] = 0;
      b[a2 + 126 >> 1] = 13106;
      d2 = 0;
      return d2 | 0;
    }
    function Id(a2) {
      a2 = a2 | 0;
      var b2 = 0;
      if (!a2)
        return;
      b2 = c[a2 >> 2] | 0;
      if (!b2)
        return;
      Ke(b2);
      c[a2 >> 2] = 0;
      return;
    }
    function Jd(a2, c2) {
      a2 = a2 | 0;
      c2 = c2 | 0;
      b[a2 + 118 >> 1] = c2;
      return;
    }
    function Kd(a2, d2, f2, g2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      var h2 = 0;
      f2 = Ce(f2, g2) | 0;
      if (f2 << 16 >> 16 <= 0)
        return;
      f2 = f2 << 16 >> 16;
      if ((f2 * 21298 | 0) == 1073741824) {
        c[g2 >> 2] = 1;
        h2 = 2147483647;
      } else
        h2 = f2 * 42596 | 0;
      f2 = d2 - h2 | 0;
      if (((f2 ^ d2) & (h2 ^ d2) | 0) < 0) {
        c[g2 >> 2] = 1;
        f2 = (d2 >>> 31) + 2147483647 | 0;
      }
      if ((f2 | 0) <= 0)
        return;
      a2 = a2 + 104 | 0;
      b[a2 >> 1] = e[a2 >> 1] | 0 | 16384;
      return;
    }
    function Ld(a2, c2, d2) {
      a2 = a2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      var e2 = 0;
      a2 = a2 + 104 | 0;
      e2 = De(b[a2 >> 1] | 0, 1, d2) | 0;
      b[a2 >> 1] = e2;
      if (!(c2 << 16 >> 16))
        return;
      b[a2 >> 1] = (De(e2, 1, d2) | 0) & 65535 | 8192;
      return;
    }
    function Md(a2, c2, d2) {
      a2 = a2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      var f2 = 0, g2 = 0, h2 = 0;
      g2 = a2 + 112 | 0;
      f2 = Ge(b[g2 >> 1] | 0, b[c2 >> 1] | 0, d2) | 0;
      f2 = (f2 & 65535) - ((f2 & 65535) >>> 15 & 65535) | 0;
      f2 = ((f2 << 16 >> 31 ^ f2) & 65535) << 16 >> 16 < 4;
      h2 = b[c2 >> 1] | 0;
      b[g2 >> 1] = h2;
      c2 = c2 + 2 | 0;
      h2 = Ge(h2, b[c2 >> 1] | 0, d2) | 0;
      h2 = (h2 & 65535) - ((h2 & 65535) >>> 15 & 65535) | 0;
      f2 = ((h2 << 16 >> 31 ^ h2) & 65535) << 16 >> 16 < 4 ? f2 ? 2 : 1 : f2 & 1;
      b[g2 >> 1] = b[c2 >> 1] | 0;
      g2 = a2 + 102 | 0;
      b[g2 >> 1] = De(b[g2 >> 1] | 0, 1, d2) | 0;
      c2 = a2 + 110 | 0;
      if ((Rd(b[c2 >> 1] | 0, f2, d2) | 0) << 16 >> 16 <= 3) {
        b[c2 >> 1] = f2;
        return;
      }
      b[g2 >> 1] = e[g2 >> 1] | 0 | 16384;
      b[c2 >> 1] = f2;
      return;
    }
    function Nd(a2, d2, f2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      f2 = f2 | 0;
      var g2 = 0, h2 = 0, j2 = 0, k2 = 0, l2 = 0, m2 = 0, n2 = 0, o2 = 0, p2 = 0, q2 = 0, r2 = 0, s2 = 0, t2 = 0, u2 = 0, v2 = 0, w2 = 0, x2 = 0, y2 = 0, z2 = 0, A2 = 0, B2 = 0, C2 = 0, D2 = 0;
      D2 = i2;
      i2 = i2 + 352 | 0;
      n2 = D2 + 24 | 0;
      B2 = D2;
      k2 = 0;
      h2 = 0;
      do {
        g2 = b[d2 + (k2 + -40 << 1) >> 1] | 0;
        g2 = Z(g2, g2) | 0;
        if ((g2 | 0) != 1073741824) {
          j2 = (g2 << 1) + h2 | 0;
          if ((g2 ^ h2 | 0) > 0 & (j2 ^ h2 | 0) < 0) {
            c[f2 >> 2] = 1;
            h2 = (h2 >>> 31) + 2147483647 | 0;
          } else
            h2 = j2;
        } else {
          c[f2 >> 2] = 1;
          h2 = 2147483647;
        }
        k2 = k2 + 1 | 0;
      } while ((k2 | 0) != 160);
      o2 = h2;
      if ((343039 - o2 & o2 | 0) < 0) {
        c[f2 >> 2] = 1;
        h2 = (o2 >>> 31) + 2147483647 | 0;
      } else
        h2 = o2 + -343040 | 0;
      if ((h2 | 0) < 0) {
        A2 = a2 + 102 | 0;
        b[A2 >> 1] = e[A2 >> 1] & 16383;
      }
      m2 = o2 + -15e3 | 0;
      p2 = (14999 - o2 & o2 | 0) < 0;
      if (p2) {
        c[f2 >> 2] = 1;
        j2 = (o2 >>> 31) + 2147483647 | 0;
      } else
        j2 = m2;
      if ((j2 | 0) < 0) {
        A2 = a2 + 108 | 0;
        b[A2 >> 1] = e[A2 >> 1] & 16383;
      }
      g2 = a2 + 72 | 0;
      l2 = a2 + 74 | 0;
      j2 = b[g2 >> 1] | 0;
      k2 = b[l2 >> 1] | 0;
      h2 = 0;
      do {
        A2 = h2 << 2;
        y2 = Ge((b[d2 + (A2 << 1) >> 1] | 0) >>> 2 & 65535, ((j2 << 16 >> 16) * 21955 | 0) >>> 15 & 65535, f2) | 0;
        v2 = ((y2 << 16 >> 16) * 21955 | 0) >>> 15 & 65535;
        u2 = Rd(j2, v2, f2) | 0;
        x2 = A2 | 1;
        z2 = Ge((b[d2 + (x2 << 1) >> 1] | 0) >>> 2 & 65535, ((k2 << 16 >> 16) * 6390 | 0) >>> 15 & 65535, f2) | 0;
        w2 = ((z2 << 16 >> 16) * 6390 | 0) >>> 15 & 65535;
        j2 = Rd(k2, w2, f2) | 0;
        b[n2 + (A2 << 1) >> 1] = Rd(u2, j2, f2) | 0;
        b[n2 + (x2 << 1) >> 1] = Ge(u2, j2, f2) | 0;
        x2 = A2 | 2;
        j2 = Ge((b[d2 + (x2 << 1) >> 1] | 0) >>> 2 & 65535, v2, f2) | 0;
        y2 = Rd(y2, ((j2 << 16 >> 16) * 21955 | 0) >>> 15 & 65535, f2) | 0;
        A2 = A2 | 3;
        k2 = Ge((b[d2 + (A2 << 1) >> 1] | 0) >>> 2 & 65535, w2, f2) | 0;
        z2 = Rd(z2, ((k2 << 16 >> 16) * 6390 | 0) >>> 15 & 65535, f2) | 0;
        b[n2 + (x2 << 1) >> 1] = Rd(y2, z2, f2) | 0;
        b[n2 + (A2 << 1) >> 1] = Ge(y2, z2, f2) | 0;
        h2 = h2 + 1 | 0;
      } while ((h2 | 0) != 40);
      b[g2 >> 1] = j2;
      b[l2 >> 1] = k2;
      k2 = a2 + 76 | 0;
      j2 = a2 + 80 | 0;
      h2 = 0;
      do {
        A2 = h2 << 2;
        Od(n2 + (A2 << 1) | 0, n2 + ((A2 | 2) << 1) | 0, k2, f2);
        Od(n2 + ((A2 | 1) << 1) | 0, n2 + ((A2 | 3) << 1) | 0, j2, f2);
        h2 = h2 + 1 | 0;
      } while ((h2 | 0) != 40);
      k2 = a2 + 84 | 0;
      j2 = a2 + 86 | 0;
      h2 = a2 + 92 | 0;
      g2 = 0;
      do {
        A2 = g2 << 3;
        Pd(n2 + (A2 << 1) | 0, n2 + ((A2 | 4) << 1) | 0, k2, f2);
        Pd(n2 + ((A2 | 2) << 1) | 0, n2 + ((A2 | 6) << 1) | 0, j2, f2);
        Pd(n2 + ((A2 | 3) << 1) | 0, n2 + ((A2 | 7) << 1) | 0, h2, f2);
        g2 = g2 + 1 | 0;
      } while ((g2 | 0) != 20);
      k2 = a2 + 88 | 0;
      j2 = a2 + 90 | 0;
      h2 = 0;
      do {
        A2 = h2 << 4;
        Pd(n2 + (A2 << 1) | 0, n2 + ((A2 | 8) << 1) | 0, k2, f2);
        Pd(n2 + ((A2 | 4) << 1) | 0, n2 + ((A2 | 12) << 1) | 0, j2, f2);
        h2 = h2 + 1 | 0;
      } while ((h2 | 0) != 10);
      t2 = Qd(n2, a2 + 70 | 0, 32, 40, 4, 1, 15, f2) | 0;
      b[B2 + 16 >> 1] = t2;
      u2 = Qd(n2, a2 + 68 | 0, 16, 20, 8, 7, 16, f2) | 0;
      b[B2 + 14 >> 1] = u2;
      v2 = Qd(n2, a2 + 66 | 0, 16, 20, 8, 3, 16, f2) | 0;
      b[B2 + 12 >> 1] = v2;
      w2 = Qd(n2, a2 + 64 | 0, 16, 20, 8, 2, 16, f2) | 0;
      b[B2 + 10 >> 1] = w2;
      x2 = Qd(n2, a2 + 62 | 0, 16, 20, 8, 6, 16, f2) | 0;
      b[B2 + 8 >> 1] = x2;
      y2 = Qd(n2, a2 + 60 | 0, 8, 10, 16, 4, 16, f2) | 0;
      b[B2 + 6 >> 1] = y2;
      z2 = Qd(n2, a2 + 58 | 0, 8, 10, 16, 12, 16, f2) | 0;
      b[B2 + 4 >> 1] = z2;
      A2 = Qd(n2, a2 + 56 | 0, 8, 10, 16, 8, 16, f2) | 0;
      b[B2 + 2 >> 1] = A2;
      s2 = Qd(n2, a2 + 54 | 0, 8, 10, 16, 0, 16, f2) | 0;
      b[B2 >> 1] = s2;
      k2 = 0;
      g2 = 0;
      do {
        j2 = a2 + (g2 << 1) | 0;
        d2 = qe(b[j2 >> 1] | 0) | 0;
        j2 = b[j2 >> 1] | 0;
        h2 = d2 << 16 >> 16;
        if (d2 << 16 >> 16 < 0) {
          l2 = 0 - h2 << 16;
          if ((l2 | 0) < 983040)
            l2 = j2 << 16 >> 16 >> (l2 >> 16) & 65535;
          else
            l2 = 0;
        } else {
          l2 = j2 << 16 >> 16;
          j2 = l2 << h2;
          if ((j2 << 16 >> 16 >> h2 | 0) == (l2 | 0))
            l2 = j2 & 65535;
          else
            l2 = (l2 >>> 15 ^ 32767) & 65535;
        }
        j2 = Td(De(b[B2 + (g2 << 1) >> 1] | 0, 1, f2) | 0, l2) | 0;
        r2 = Ge(d2, 5, f2) | 0;
        h2 = r2 << 16 >> 16;
        if (r2 << 16 >> 16 < 0) {
          l2 = 0 - h2 << 16;
          if ((l2 | 0) < 983040)
            l2 = j2 << 16 >> 16 >> (l2 >> 16);
          else
            l2 = 0;
        } else {
          j2 = j2 << 16 >> 16;
          l2 = j2 << h2;
          if ((l2 << 16 >> 16 >> h2 | 0) != (j2 | 0))
            l2 = j2 >>> 15 ^ 32767;
        }
        l2 = l2 << 16 >> 16;
        l2 = Z(l2, l2) | 0;
        if ((l2 | 0) != 1073741824) {
          j2 = (l2 << 1) + k2 | 0;
          if ((l2 ^ k2 | 0) > 0 & (j2 ^ k2 | 0) < 0) {
            c[f2 >> 2] = 1;
            k2 = (k2 >>> 31) + 2147483647 | 0;
          } else
            k2 = j2;
        } else {
          c[f2 >> 2] = 1;
          k2 = 2147483647;
        }
        g2 = g2 + 1 | 0;
      } while ((g2 | 0) != 9);
      r2 = k2 << 6;
      k2 = (((r2 >> 6 | 0) == (k2 | 0) ? r2 : k2 >> 31 ^ 2147418112) >> 16) * 3641 >> 15;
      if ((k2 | 0) > 32767) {
        c[f2 >> 2] = 1;
        k2 = 32767;
      }
      r2 = b[a2 >> 1] | 0;
      l2 = r2 << 16 >> 16;
      q2 = b[a2 + 2 >> 1] | 0;
      j2 = (q2 << 16 >> 16) + l2 | 0;
      if ((q2 ^ r2) << 16 >> 16 > -1 & (j2 ^ l2 | 0) < 0) {
        c[f2 >> 2] = 1;
        j2 = (l2 >>> 31) + 2147483647 | 0;
      }
      r2 = b[a2 + 4 >> 1] | 0;
      l2 = r2 + j2 | 0;
      if ((r2 ^ j2 | 0) > -1 & (l2 ^ j2 | 0) < 0) {
        c[f2 >> 2] = 1;
        l2 = (j2 >>> 31) + 2147483647 | 0;
      }
      r2 = b[a2 + 6 >> 1] | 0;
      j2 = r2 + l2 | 0;
      if ((r2 ^ l2 | 0) > -1 & (j2 ^ l2 | 0) < 0) {
        c[f2 >> 2] = 1;
        j2 = (l2 >>> 31) + 2147483647 | 0;
      }
      r2 = b[a2 + 8 >> 1] | 0;
      l2 = r2 + j2 | 0;
      if ((r2 ^ j2 | 0) > -1 & (l2 ^ j2 | 0) < 0) {
        c[f2 >> 2] = 1;
        l2 = (j2 >>> 31) + 2147483647 | 0;
      }
      r2 = b[a2 + 10 >> 1] | 0;
      j2 = r2 + l2 | 0;
      if ((r2 ^ l2 | 0) > -1 & (j2 ^ l2 | 0) < 0) {
        c[f2 >> 2] = 1;
        j2 = (l2 >>> 31) + 2147483647 | 0;
      }
      r2 = b[a2 + 12 >> 1] | 0;
      l2 = r2 + j2 | 0;
      if ((r2 ^ j2 | 0) > -1 & (l2 ^ j2 | 0) < 0) {
        c[f2 >> 2] = 1;
        l2 = (j2 >>> 31) + 2147483647 | 0;
      }
      r2 = b[a2 + 14 >> 1] | 0;
      j2 = r2 + l2 | 0;
      if ((r2 ^ l2 | 0) > -1 & (j2 ^ l2 | 0) < 0) {
        c[f2 >> 2] = 1;
        j2 = (l2 >>> 31) + 2147483647 | 0;
      }
      r2 = b[a2 + 16 >> 1] | 0;
      l2 = r2 + j2 | 0;
      if ((r2 ^ j2 | 0) > -1 & (l2 ^ j2 | 0) < 0) {
        c[f2 >> 2] = 1;
        l2 = (j2 >>> 31) + 2147483647 | 0;
      }
      q2 = l2 << 13;
      q2 = ((q2 >> 13 | 0) == (l2 | 0) ? q2 : l2 >> 31 ^ 2147418112) >>> 16 & 65535;
      l2 = (Z((Ge(q2, 0, f2) | 0) << 16 >> 16, -2808) | 0) >> 15;
      if ((l2 | 0) > 32767) {
        c[f2 >> 2] = 1;
        l2 = 32767;
      }
      n2 = Rd(l2 & 65535, 1260, f2) | 0;
      r2 = a2 + 100 | 0;
      l2 = De(b[r2 >> 1] | 0, 1, f2) | 0;
      if ((k2 << 16 >> 16 | 0) > ((n2 << 16 >> 16 < 720 ? 720 : n2 << 16 >> 16) | 0))
        l2 = (l2 & 65535 | 16384) & 65535;
      b[r2 >> 1] = l2;
      if (p2) {
        c[f2 >> 2] = 1;
        m2 = (o2 >>> 31) + 2147483647 | 0;
      }
      h2 = b[a2 + 118 >> 1] | 0;
      p2 = a2 + 126 | 0;
      l2 = b[p2 >> 1] | 0;
      g2 = l2 << 16 >> 16 < 19660;
      g2 = h2 << 16 >> 16 < l2 << 16 >> 16 ? g2 ? 2621 : 6553 : g2 ? 2621 : 655;
      d2 = l2 & 65535;
      k2 = d2 << 16;
      l2 = Z(g2, l2 << 16 >> 16) | 0;
      if ((l2 | 0) == 1073741824) {
        c[f2 >> 2] = 1;
        l2 = 2147483647;
      } else
        l2 = l2 << 1;
      j2 = k2 - l2 | 0;
      if (((j2 ^ k2) & (l2 ^ k2) | 0) < 0) {
        c[f2 >> 2] = 1;
        j2 = (d2 >>> 15) + 2147483647 | 0;
      }
      k2 = Z(g2, h2 << 16 >> 16) | 0;
      do
        if ((k2 | 0) == 1073741824) {
          c[f2 >> 2] = 1;
          l2 = 2147483647;
        } else {
          l2 = j2 + (k2 << 1) | 0;
          if (!((j2 ^ k2 | 0) > 0 & (l2 ^ j2 | 0) < 0))
            break;
          c[f2 >> 2] = 1;
          l2 = (j2 >>> 31) + 2147483647 | 0;
        }
      while (0);
      d2 = Ce(l2, f2) | 0;
      o2 = (m2 | 0) > -1;
      b[p2 >> 1] = o2 ? d2 << 16 >> 16 < 13106 ? 13106 : d2 : 13106;
      d2 = a2 + 106 | 0;
      b[d2 >> 1] = De(b[d2 >> 1] | 0, 1, f2) | 0;
      j2 = a2 + 108 | 0;
      l2 = De(b[j2 >> 1] | 0, 1, f2) | 0;
      b[j2 >> 1] = l2;
      k2 = b[p2 >> 1] | 0;
      a:
        do
          if (o2) {
            do
              if (k2 << 16 >> 16 > 19660)
                b[d2 >> 1] = e[d2 >> 1] | 16384;
              else {
                if (k2 << 16 >> 16 > 16383)
                  break;
                k2 = a2 + 116 | 0;
                l2 = 0;
                break a;
              }
            while (0);
            b[j2 >> 1] = l2 & 65535 | 16384;
            C2 = 62;
          } else
            C2 = 62;
        while (0);
      do
        if ((C2 | 0) == 62) {
          l2 = a2 + 116 | 0;
          if (k2 << 16 >> 16 <= 22936) {
            k2 = l2;
            l2 = 0;
            break;
          }
          k2 = l2;
          l2 = Rd(b[l2 >> 1] | 0, 1, f2) | 0;
        }
      while (0);
      b[k2 >> 1] = l2;
      if ((b[d2 >> 1] & 32640) != 32640) {
        n2 = (b[j2 >> 1] & 32767) == 32767;
        b[a2 + 122 >> 1] = n2 & 1;
        if (n2)
          C2 = 67;
      } else {
        b[a2 + 122 >> 1] = 1;
        C2 = 67;
      }
      do
        if ((C2 | 0) == 67) {
          k2 = a2 + 98 | 0;
          if ((b[k2 >> 1] | 0) >= 5)
            break;
          b[k2 >> 1] = 5;
        }
      while (0);
      n2 = a2 + 102 | 0;
      do
        if ((b[n2 >> 1] & 24576) == 24576)
          C2 = 71;
        else {
          if ((b[a2 + 104 >> 1] & 31744) == 31744) {
            C2 = 71;
            break;
          }
          if (!(b[r2 >> 1] & 32640)) {
            b[a2 + 98 >> 1] = 20;
            j2 = 32767;
            break;
          } else {
            j2 = s2;
            k2 = 0;
            l2 = 0;
          }
          while (1) {
            g2 = b[a2 + 18 + (k2 << 1) >> 1] | 0;
            h2 = j2 << 16 >> 16 > g2 << 16 >> 16;
            m2 = h2 ? j2 : g2;
            j2 = h2 ? g2 : j2;
            m2 = m2 << 16 >> 16 < 184 ? 184 : m2;
            j2 = j2 << 16 >> 16 < 184 ? 184 : j2;
            g2 = qe(j2) | 0;
            h2 = g2 << 16 >> 16;
            do
              if (g2 << 16 >> 16 < 0) {
                d2 = 0 - h2 << 16;
                if ((d2 | 0) >= 983040) {
                  d2 = 0;
                  break;
                }
                d2 = j2 << 16 >> 16 >> (d2 >> 16) & 65535;
              } else {
                d2 = j2 << 16 >> 16;
                j2 = d2 << h2;
                if ((j2 << 16 >> 16 >> h2 | 0) == (d2 | 0)) {
                  d2 = j2 & 65535;
                  break;
                }
                d2 = (d2 >>> 15 ^ 32767) & 65535;
              }
            while (0);
            m2 = Td(De(m2, 1, f2) | 0, d2) | 0;
            l2 = Rd(l2, De(m2, Ge(8, g2, f2) | 0, f2) | 0, f2) | 0;
            k2 = k2 + 1 | 0;
            if ((k2 | 0) == 9)
              break;
            j2 = b[B2 + (k2 << 1) >> 1] | 0;
          }
          if (l2 << 16 >> 16 > 1e3) {
            b[a2 + 98 >> 1] = 20;
            j2 = 32767;
            break;
          }
          j2 = b[r2 >> 1] | 0;
          k2 = a2 + 98 | 0;
          l2 = b[k2 >> 1] | 0;
          do
            if (!(j2 & 16384))
              C2 = 86;
            else {
              if (!(l2 << 16 >> 16)) {
                l2 = j2;
                break;
              }
              l2 = Ge(l2, 1, f2) | 0;
              b[k2 >> 1] = l2;
              C2 = 86;
            }
          while (0);
          if ((C2 | 0) == 86) {
            if (l2 << 16 >> 16 == 20) {
              j2 = 32767;
              break;
            }
            l2 = b[r2 >> 1] | 0;
          }
          j2 = (l2 & 16384) == 0 ? 16383 : 3276;
        }
      while (0);
      if ((C2 | 0) == 71) {
        b[a2 + 98 >> 1] = 20;
        j2 = 32767;
      }
      k2 = s2;
      l2 = 0;
      while (1) {
        m2 = a2 + 18 + (l2 << 1) | 0;
        d2 = oe(j2, Ge(k2, b[m2 >> 1] | 0, f2) | 0, f2) | 0;
        b[m2 >> 1] = Rd(b[m2 >> 1] | 0, d2, f2) | 0;
        l2 = l2 + 1 | 0;
        if ((l2 | 0) == 9)
          break;
        k2 = b[B2 + (l2 << 1) >> 1] | 0;
      }
      do
        if (!(b[r2 >> 1] & 30720)) {
          if (b[n2 >> 1] & 30720) {
            C2 = 95;
            break;
          }
          if (!(b[a2 + 114 >> 1] | 0)) {
            h2 = 2097;
            g2 = 1638;
            d2 = 2;
          } else
            C2 = 95;
        } else
          C2 = 95;
      while (0);
      do
        if ((C2 | 0) == 95) {
          if ((b[a2 + 98 >> 1] | 0) == 0 ? (b[a2 + 114 >> 1] | 0) == 0 : 0) {
            h2 = 1867;
            g2 = 491;
            d2 = 2;
            break;
          }
          h2 = 1638;
          g2 = 0;
          d2 = 0;
        }
      while (0);
      j2 = 0;
      do {
        k2 = a2 + (j2 << 1) | 0;
        l2 = Ge(b[a2 + 36 + (j2 << 1) >> 1] | 0, b[k2 >> 1] | 0, f2) | 0;
        if (l2 << 16 >> 16 < 0) {
          l2 = oe(h2, l2, f2) | 0;
          l2 = Rd(-2, Rd(b[k2 >> 1] | 0, l2, f2) | 0, f2) | 0;
          l2 = l2 << 16 >> 16 < 40 ? 40 : l2;
        } else {
          l2 = oe(g2, l2, f2) | 0;
          l2 = Rd(d2, Rd(b[k2 >> 1] | 0, l2, f2) | 0, f2) | 0;
          l2 = l2 << 16 >> 16 > 16e3 ? 16e3 : l2;
        }
        b[k2 >> 1] = l2;
        j2 = j2 + 1 | 0;
      } while ((j2 | 0) != 9);
      b[a2 + 36 >> 1] = s2;
      b[a2 + 38 >> 1] = A2;
      b[a2 + 40 >> 1] = z2;
      b[a2 + 42 >> 1] = y2;
      b[a2 + 44 >> 1] = x2;
      b[a2 + 46 >> 1] = w2;
      b[a2 + 48 >> 1] = v2;
      b[a2 + 50 >> 1] = u2;
      b[a2 + 52 >> 1] = t2;
      k2 = q2 << 16 >> 16 > 100;
      j2 = k2 ? 7 : 4;
      k2 = k2 ? 4 : 5;
      if (!o2) {
        b[a2 + 94 >> 1] = 0;
        b[a2 + 96 >> 1] = 0;
        b[a2 + 114 >> 1] = 0;
        b[a2 + 116 >> 1] = 0;
        f2 = 0;
        a2 = a2 + 120 | 0;
        b[a2 >> 1] = f2;
        i2 = D2;
        return f2 | 0;
      }
      h2 = a2 + 114 | 0;
      g2 = b[h2 >> 1] | 0;
      do
        if ((b[a2 + 116 >> 1] | 0) <= 100) {
          if (g2 << 16 >> 16)
            break;
          g2 = b[r2 >> 1] | 0;
          do
            if (!(g2 & 16368)) {
              if ((b[p2 >> 1] | 0) > 21298)
                g2 = 1;
              else
                break;
              a2 = a2 + 120 | 0;
              b[a2 >> 1] = g2;
              i2 = D2;
              return g2 | 0;
            }
          while (0);
          h2 = a2 + 94 | 0;
          if (!(g2 & 16384)) {
            b[h2 >> 1] = 0;
            g2 = a2 + 96 | 0;
            h2 = b[g2 >> 1] | 0;
            if (h2 << 16 >> 16 <= 0) {
              f2 = 0;
              a2 = a2 + 120 | 0;
              b[a2 >> 1] = f2;
              i2 = D2;
              return f2 | 0;
            }
            b[g2 >> 1] = Ge(h2, 1, f2) | 0;
            f2 = 1;
            a2 = a2 + 120 | 0;
            b[a2 >> 1] = f2;
            i2 = D2;
            return f2 | 0;
          } else {
            f2 = Rd(b[h2 >> 1] | 0, 1, f2) | 0;
            b[h2 >> 1] = f2;
            if ((f2 << 16 >> 16 | 0) < (k2 | 0)) {
              f2 = 1;
              a2 = a2 + 120 | 0;
              b[a2 >> 1] = f2;
              i2 = D2;
              return f2 | 0;
            }
            b[a2 + 96 >> 1] = j2;
            f2 = 1;
            a2 = a2 + 120 | 0;
            b[a2 >> 1] = f2;
            i2 = D2;
            return f2 | 0;
          }
        } else {
          if (g2 << 16 >> 16 >= 250)
            break;
          b[h2 >> 1] = 250;
          g2 = 250;
        }
      while (0);
      b[a2 + 94 >> 1] = 4;
      b[h2 >> 1] = Ge(g2, 1, f2) | 0;
      f2 = 1;
      a2 = a2 + 120 | 0;
      b[a2 >> 1] = f2;
      i2 = D2;
      return f2 | 0;
    }
    function Od(a2, d2, e2, f2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      var g2 = 0, h2 = 0, i3 = 0;
      g2 = (b[e2 >> 1] | 0) * 21955 >> 15;
      if ((g2 | 0) > 32767) {
        c[f2 >> 2] = 1;
        g2 = 32767;
      }
      h2 = Ge(b[a2 >> 1] | 0, g2 & 65535, f2) | 0;
      g2 = (h2 << 16 >> 16) * 21955 >> 15;
      if ((g2 | 0) > 32767) {
        c[f2 >> 2] = 1;
        g2 = 32767;
      }
      i3 = Rd(b[e2 >> 1] | 0, g2 & 65535, f2) | 0;
      b[e2 >> 1] = h2;
      e2 = e2 + 2 | 0;
      g2 = (b[e2 >> 1] | 0) * 6390 >> 15;
      if ((g2 | 0) > 32767) {
        c[f2 >> 2] = 1;
        g2 = 32767;
      }
      h2 = Ge(b[d2 >> 1] | 0, g2 & 65535, f2) | 0;
      g2 = (h2 << 16 >> 16) * 6390 >> 15;
      if ((g2 | 0) > 32767) {
        c[f2 >> 2] = 1;
        g2 = 32767;
      }
      g2 = Rd(b[e2 >> 1] | 0, g2 & 65535, f2) | 0;
      b[e2 >> 1] = h2;
      b[a2 >> 1] = De(Rd(i3, g2, f2) | 0, 1, f2) | 0;
      b[d2 >> 1] = De(Ge(i3, g2, f2) | 0, 1, f2) | 0;
      return;
    }
    function Pd(a2, d2, e2, f2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      var g2 = 0, h2 = 0;
      g2 = (b[e2 >> 1] | 0) * 13363 >> 15;
      if ((g2 | 0) > 32767) {
        c[f2 >> 2] = 1;
        g2 = 32767;
      }
      h2 = Ge(b[d2 >> 1] | 0, g2 & 65535, f2) | 0;
      g2 = (h2 << 16 >> 16) * 13363 >> 15;
      if ((g2 | 0) > 32767) {
        c[f2 >> 2] = 1;
        g2 = 32767;
      }
      g2 = Rd(b[e2 >> 1] | 0, g2 & 65535, f2) | 0;
      b[e2 >> 1] = h2;
      b[d2 >> 1] = De(Ge(b[a2 >> 1] | 0, g2, f2) | 0, 1, f2) | 0;
      b[a2 >> 1] = De(Rd(b[a2 >> 1] | 0, g2, f2) | 0, 1, f2) | 0;
      return;
    }
    function Qd(a2, d2, e2, f2, g2, h2, i3, j2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      i3 = i3 | 0;
      j2 = j2 | 0;
      var k2 = 0, l2 = 0, m2 = 0, n2 = 0, o2 = 0, p2 = 0;
      if (e2 << 16 >> 16 < f2 << 16 >> 16) {
        n2 = g2 << 16 >> 16;
        k2 = h2 << 16 >> 16;
        o2 = e2 << 16 >> 16;
        l2 = 0;
        do {
          p2 = b[a2 + ((Z(o2, n2) | 0) + k2 << 1) >> 1] | 0;
          p2 = (p2 & 65535) - ((p2 & 65535) >>> 15 & 65535) | 0;
          p2 = (p2 << 16 >> 31 ^ p2) << 16;
          m2 = (p2 >> 15) + l2 | 0;
          if ((p2 >> 16 ^ l2 | 0) > 0 & (m2 ^ l2 | 0) < 0) {
            c[j2 >> 2] = 1;
            l2 = (l2 >>> 31) + 2147483647 | 0;
          } else
            l2 = m2;
          o2 = o2 + 1 | 0;
        } while ((o2 & 65535) << 16 >> 16 != f2 << 16 >> 16);
        o2 = l2;
      } else
        o2 = 0;
      l2 = b[d2 >> 1] | 0;
      p2 = Ge(16, i3, j2) | 0;
      k2 = p2 << 16 >> 16;
      if (p2 << 16 >> 16 > 0) {
        f2 = l2 << k2;
        if ((f2 >> k2 | 0) != (l2 | 0))
          f2 = l2 >> 31 ^ 2147483647;
      } else {
        k2 = 0 - k2 << 16;
        if ((k2 | 0) < 2031616)
          f2 = l2 >> (k2 >> 16);
        else
          f2 = 0;
      }
      k2 = f2 + o2 | 0;
      if ((f2 ^ o2 | 0) > -1 & (k2 ^ o2 | 0) < 0) {
        c[j2 >> 2] = 1;
        k2 = (o2 >>> 31) + 2147483647 | 0;
      }
      p2 = i3 << 16 >> 16;
      i3 = i3 << 16 >> 16 > 0;
      if (i3) {
        f2 = o2 << p2;
        if ((f2 >> p2 | 0) != (o2 | 0))
          f2 = o2 >> 31 ^ 2147483647;
      } else {
        f2 = 0 - p2 << 16;
        if ((f2 | 0) < 2031616)
          f2 = o2 >> (f2 >> 16);
        else
          f2 = 0;
      }
      b[d2 >> 1] = f2 >>> 16;
      if (e2 << 16 >> 16 > 0) {
        n2 = g2 << 16 >> 16;
        l2 = h2 << 16 >> 16;
        m2 = 0;
        do {
          h2 = b[a2 + ((Z(m2, n2) | 0) + l2 << 1) >> 1] | 0;
          h2 = (h2 & 65535) - ((h2 & 65535) >>> 15 & 65535) | 0;
          h2 = (h2 << 16 >> 31 ^ h2) << 16;
          f2 = (h2 >> 15) + k2 | 0;
          if ((h2 >> 16 ^ k2 | 0) > 0 & (f2 ^ k2 | 0) < 0) {
            c[j2 >> 2] = 1;
            k2 = (k2 >>> 31) + 2147483647 | 0;
          } else
            k2 = f2;
          m2 = m2 + 1 | 0;
        } while ((m2 & 65535) << 16 >> 16 != e2 << 16 >> 16);
      }
      if (i3) {
        f2 = k2 << p2;
        if ((f2 >> p2 | 0) == (k2 | 0)) {
          j2 = f2;
          j2 = j2 >>> 16;
          j2 = j2 & 65535;
          return j2 | 0;
        }
        j2 = k2 >> 31 ^ 2147483647;
        j2 = j2 >>> 16;
        j2 = j2 & 65535;
        return j2 | 0;
      } else {
        f2 = 0 - p2 << 16;
        if ((f2 | 0) >= 2031616) {
          j2 = 0;
          j2 = j2 >>> 16;
          j2 = j2 & 65535;
          return j2 | 0;
        }
        j2 = k2 >> (f2 >> 16);
        j2 = j2 >>> 16;
        j2 = j2 & 65535;
        return j2 | 0;
      }
    }
    function Rd(a2, b2, d2) {
      a2 = a2 | 0;
      b2 = b2 | 0;
      d2 = d2 | 0;
      a2 = (b2 << 16 >> 16) + (a2 << 16 >> 16) | 0;
      if ((a2 | 0) <= 32767) {
        if ((a2 | 0) < -32768) {
          c[d2 >> 2] = 1;
          a2 = -32768;
        }
      } else {
        c[d2 >> 2] = 1;
        a2 = 32767;
      }
      return a2 & 65535 | 0;
    }
    function Sd(a2, c2, d2, e2) {
      a2 = a2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      var f2 = 0, g2 = 0, h2 = 0, j2 = 0, k2 = 0, l2 = 0, m2 = 0, n2 = 0, o2 = 0, p2 = 0, q2 = 0, r2 = 0, s2 = 0, t2 = 0, u2 = 0, v2 = 0, w2 = 0, x2 = 0, y2 = 0, z2 = 0, A2 = 0, B2 = 0;
      y2 = i2;
      i2 = i2 + 32 | 0;
      w2 = y2 + 12 | 0;
      x2 = y2;
      b[w2 >> 1] = 1024;
      b[x2 >> 1] = 1024;
      k2 = b[a2 + 2 >> 1] | 0;
      h2 = b[a2 + 20 >> 1] | 0;
      e2 = ((h2 + k2 | 0) >>> 2) + 64512 | 0;
      b[w2 + 2 >> 1] = e2;
      h2 = ((k2 - h2 | 0) >>> 2) + 1024 | 0;
      b[x2 + 2 >> 1] = h2;
      k2 = b[a2 + 4 >> 1] | 0;
      f2 = b[a2 + 18 >> 1] | 0;
      e2 = ((f2 + k2 | 0) >>> 2) - e2 | 0;
      b[w2 + 4 >> 1] = e2;
      h2 = ((k2 - f2 | 0) >>> 2) + h2 | 0;
      b[x2 + 4 >> 1] = h2;
      f2 = b[a2 + 6 >> 1] | 0;
      k2 = b[a2 + 16 >> 1] | 0;
      e2 = ((k2 + f2 | 0) >>> 2) - e2 | 0;
      b[w2 + 6 >> 1] = e2;
      h2 = ((f2 - k2 | 0) >>> 2) + h2 | 0;
      b[x2 + 6 >> 1] = h2;
      k2 = b[a2 + 8 >> 1] | 0;
      f2 = b[a2 + 14 >> 1] | 0;
      e2 = ((f2 + k2 | 0) >>> 2) - e2 | 0;
      b[w2 + 8 >> 1] = e2;
      h2 = ((k2 - f2 | 0) >>> 2) + h2 | 0;
      b[x2 + 8 >> 1] = h2;
      f2 = b[a2 + 10 >> 1] | 0;
      k2 = b[a2 + 12 >> 1] | 0;
      e2 = ((k2 + f2 | 0) >>> 2) - e2 | 0;
      b[w2 + 10 >> 1] = e2;
      b[x2 + 10 >> 1] = ((f2 - k2 | 0) >>> 2) + h2;
      h2 = b[3454] | 0;
      k2 = h2 << 16 >> 16;
      a2 = b[w2 + 2 >> 1] | 0;
      f2 = (a2 << 16 >> 16 << 14) + (k2 << 10) | 0;
      s2 = f2 & -65536;
      f2 = (f2 >>> 1) - (f2 >> 16 << 15) << 16;
      v2 = (((Z(f2 >> 16, k2) | 0) >> 15) + (Z(s2 >> 16, k2) | 0) << 2) + -16777216 | 0;
      v2 = (b[w2 + 4 >> 1] << 14) + v2 | 0;
      j2 = v2 >> 16;
      v2 = (v2 >>> 1) - (j2 << 15) << 16;
      s2 = (((Z(v2 >> 16, k2) | 0) >> 15) + (Z(j2, k2) | 0) << 2) - ((f2 >> 15) + s2) | 0;
      s2 = (b[w2 + 6 >> 1] << 14) + s2 | 0;
      f2 = s2 >> 16;
      s2 = (s2 >>> 1) - (f2 << 15) << 16;
      j2 = (((Z(s2 >> 16, k2) | 0) >> 15) + (Z(f2, k2) | 0) << 2) - ((v2 >> 15) + (j2 << 16)) | 0;
      j2 = (b[w2 + 8 >> 1] << 14) + j2 | 0;
      v2 = j2 >> 16;
      f2 = (e2 << 16 >> 3) + ((((Z((j2 >>> 1) - (v2 << 15) << 16 >> 16, k2) | 0) >> 15) + (Z(v2, k2) | 0) << 1) - ((s2 >> 15) + (f2 << 16))) | 0;
      s2 = w2 + 4 | 0;
      k2 = w2;
      v2 = 0;
      j2 = 0;
      e2 = 0;
      r2 = w2 + 10 | 0;
      f2 = (f2 + 33554432 | 0) >>> 0 < 67108863 ? f2 >>> 10 & 65535 : (f2 | 0) > 33554431 ? 32767 : -32768;
      a:
        while (1) {
          t2 = a2 << 16 >> 16 << 14;
          q2 = k2 + 6 | 0;
          p2 = k2 + 8 | 0;
          o2 = j2 << 16 >> 16;
          while (1) {
            if ((o2 | 0) >= 60)
              break a;
            k2 = (o2 & 65535) + 1 << 16 >> 16;
            l2 = b[6908 + (k2 << 16 >> 16 << 1) >> 1] | 0;
            u2 = l2 << 16 >> 16;
            j2 = t2 + (u2 << 10) | 0;
            g2 = j2 & -65536;
            j2 = (j2 >>> 1) - (j2 >> 16 << 15) << 16;
            m2 = (((Z(j2 >> 16, u2) | 0) >> 15) + (Z(g2 >> 16, u2) | 0) << 2) + -16777216 | 0;
            n2 = b[s2 >> 1] | 0;
            m2 = (n2 << 16 >> 16 << 14) + m2 | 0;
            B2 = m2 >> 16;
            m2 = (m2 >>> 1) - (B2 << 15) << 16;
            g2 = (((Z(m2 >> 16, u2) | 0) >> 15) + (Z(B2, u2) | 0) << 2) - ((j2 >> 15) + g2) | 0;
            j2 = b[q2 >> 1] | 0;
            g2 = (j2 << 16 >> 16 << 14) + g2 | 0;
            a2 = g2 >> 16;
            g2 = (g2 >>> 1) - (a2 << 15) << 16;
            B2 = (((Z(g2 >> 16, u2) | 0) >> 15) + (Z(a2, u2) | 0) << 2) - ((m2 >> 15) + (B2 << 16)) | 0;
            m2 = b[p2 >> 1] | 0;
            B2 = (m2 << 16 >> 16 << 14) + B2 | 0;
            A2 = B2 >> 16;
            a2 = (((Z((B2 >>> 1) - (A2 << 15) << 16 >> 16, u2) | 0) >> 15) + (Z(A2, u2) | 0) << 1) - ((g2 >> 15) + (a2 << 16)) | 0;
            g2 = b[r2 >> 1] | 0;
            a2 = (g2 << 16 >> 16 << 13) + a2 | 0;
            a2 = (a2 + 33554432 | 0) >>> 0 < 67108863 ? a2 >>> 10 & 65535 : (a2 | 0) > 33554431 ? 32767 : -32768;
            if ((Z(a2 << 16 >> 16, f2 << 16 >> 16) | 0) < 1) {
              u2 = k2;
              k2 = n2;
              break;
            } else {
              o2 = o2 + 1 | 0;
              h2 = l2;
              f2 = a2;
            }
          }
          s2 = g2 << 16 >> 16 << 13;
          r2 = k2 << 16 >> 16 << 14;
          n2 = j2 << 16 >> 16 << 14;
          p2 = m2 << 16 >> 16 << 14;
          g2 = l2 << 16 >> 16;
          o2 = 4;
          while (1) {
            A2 = (h2 << 16 >> 16 >>> 1) + (g2 >>> 1) | 0;
            g2 = A2 << 16;
            q2 = g2 >> 16;
            g2 = t2 + (g2 >> 6) | 0;
            B2 = g2 & -65536;
            g2 = (g2 >>> 1) - (g2 >> 16 << 15) << 16;
            m2 = r2 + ((((Z(g2 >> 16, q2) | 0) >> 15) + (Z(B2 >> 16, q2) | 0) << 2) + -16777216) | 0;
            k2 = m2 >> 16;
            m2 = (m2 >>> 1) - (k2 << 15) << 16;
            B2 = n2 + ((((Z(m2 >> 16, q2) | 0) >> 15) + (Z(k2, q2) | 0) << 2) - ((g2 >> 15) + B2)) | 0;
            g2 = B2 >> 16;
            B2 = (B2 >>> 1) - (g2 << 15) << 16;
            k2 = p2 + ((((Z(B2 >> 16, q2) | 0) >> 15) + (Z(g2, q2) | 0) << 2) - ((m2 >> 15) + (k2 << 16))) | 0;
            m2 = k2 >> 16;
            A2 = A2 & 65535;
            g2 = s2 + ((((Z((k2 >>> 1) - (m2 << 15) << 16 >> 16, q2) | 0) >> 15) + (Z(m2, q2) | 0) << 1) - ((B2 >> 15) + (g2 << 16))) | 0;
            g2 = (g2 + 33554432 | 0) >>> 0 < 67108863 ? g2 >>> 10 & 65535 : (g2 | 0) > 33554431 ? 32767 : -32768;
            B2 = (Z(g2 << 16 >> 16, a2 << 16 >> 16) | 0) < 1;
            q2 = B2 ? l2 : A2;
            a2 = B2 ? a2 : g2;
            h2 = B2 ? A2 : h2;
            f2 = B2 ? g2 : f2;
            o2 = o2 + -1 << 16 >> 16;
            g2 = q2 << 16 >> 16;
            if (!(o2 << 16 >> 16)) {
              l2 = g2;
              j2 = h2;
              h2 = q2;
              break;
            } else
              l2 = q2;
          }
          k2 = e2 << 16 >> 16;
          g2 = a2 << 16 >> 16;
          a2 = (f2 & 65535) - g2 | 0;
          f2 = a2 << 16;
          if (f2) {
            B2 = (a2 & 65535) - (a2 >>> 15 & 1) | 0;
            B2 = B2 << 16 >> 31 ^ B2;
            a2 = (qe(B2 & 65535) | 0) << 16 >> 16;
            a2 = (Z((Td(16383, B2 << 16 >> 16 << a2 & 65535) | 0) << 16 >> 16, (j2 & 65535) - l2 << 16 >> 16) | 0) >> 19 - a2;
            if ((f2 | 0) < 0)
              a2 = 0 - (a2 << 16 >> 16) | 0;
            h2 = l2 - ((Z(a2 << 16 >> 16, g2) | 0) >>> 10) & 65535;
          }
          b[c2 + (k2 << 1) >> 1] = h2;
          f2 = v2 << 16 >> 16 == 0 ? x2 : w2;
          A2 = h2 << 16 >> 16;
          a2 = b[f2 + 2 >> 1] | 0;
          g2 = (a2 << 16 >> 16 << 14) + (A2 << 10) | 0;
          B2 = g2 & -65536;
          g2 = (g2 >>> 1) - (g2 >> 16 << 15) << 16;
          t2 = (((Z(g2 >> 16, A2) | 0) >> 15) + (Z(B2 >> 16, A2) | 0) << 2) + -16777216 | 0;
          t2 = (b[f2 + 4 >> 1] << 14) + t2 | 0;
          s2 = t2 >> 16;
          t2 = (t2 >>> 1) - (s2 << 15) << 16;
          B2 = (((Z(t2 >> 16, A2) | 0) >> 15) + (Z(s2, A2) | 0) << 2) - ((g2 >> 15) + B2) | 0;
          B2 = (b[f2 + 6 >> 1] << 14) + B2 | 0;
          g2 = B2 >> 16;
          B2 = (B2 >>> 1) - (g2 << 15) << 16;
          s2 = (((Z(B2 >> 16, A2) | 0) >> 15) + (Z(g2, A2) | 0) << 2) - ((t2 >> 15) + (s2 << 16)) | 0;
          s2 = (b[f2 + 8 >> 1] << 14) + s2 | 0;
          t2 = s2 >> 16;
          e2 = e2 + 1 << 16 >> 16;
          g2 = (((Z((s2 >>> 1) - (t2 << 15) << 16 >> 16, A2) | 0) >> 15) + (Z(t2, A2) | 0) << 1) - ((B2 >> 15) + (g2 << 16)) | 0;
          g2 = (b[f2 + 10 >> 1] << 13) + g2 | 0;
          if (e2 << 16 >> 16 < 10) {
            s2 = f2 + 4 | 0;
            k2 = f2;
            v2 = v2 ^ 1;
            j2 = u2;
            r2 = f2 + 10 | 0;
            f2 = (g2 + 33554432 | 0) >>> 0 < 67108863 ? g2 >>> 10 & 65535 : (g2 | 0) > 33554431 ? 32767 : -32768;
          } else {
            z2 = 13;
            break;
          }
        }
      if ((z2 | 0) == 13) {
        i2 = y2;
        return;
      }
      b[c2 >> 1] = b[d2 >> 1] | 0;
      b[c2 + 2 >> 1] = b[d2 + 2 >> 1] | 0;
      b[c2 + 4 >> 1] = b[d2 + 4 >> 1] | 0;
      b[c2 + 6 >> 1] = b[d2 + 6 >> 1] | 0;
      b[c2 + 8 >> 1] = b[d2 + 8 >> 1] | 0;
      b[c2 + 10 >> 1] = b[d2 + 10 >> 1] | 0;
      b[c2 + 12 >> 1] = b[d2 + 12 >> 1] | 0;
      b[c2 + 14 >> 1] = b[d2 + 14 >> 1] | 0;
      b[c2 + 16 >> 1] = b[d2 + 16 >> 1] | 0;
      b[c2 + 18 >> 1] = b[d2 + 18 >> 1] | 0;
      i2 = y2;
      return;
    }
    function Td(a2, b2) {
      a2 = a2 | 0;
      b2 = b2 | 0;
      var c2 = 0, d2 = 0, e2 = 0, f2 = 0, g2 = 0, h2 = 0;
      e2 = b2 << 16 >> 16;
      if (a2 << 16 >> 16 < 1 ? 1 : a2 << 16 >> 16 > b2 << 16 >> 16) {
        e2 = 0;
        return e2 | 0;
      }
      if (a2 << 16 >> 16 == b2 << 16 >> 16) {
        e2 = 32767;
        return e2 | 0;
      }
      d2 = e2 << 1;
      c2 = e2 << 2;
      f2 = a2 << 16 >> 16 << 3;
      a2 = (f2 | 0) < (c2 | 0);
      f2 = f2 - (a2 ? 0 : c2) | 0;
      a2 = a2 ? 0 : 4;
      g2 = (f2 | 0) < (d2 | 0);
      f2 = f2 - (g2 ? 0 : d2) | 0;
      b2 = (f2 | 0) < (e2 | 0);
      a2 = (b2 & 1 | (g2 ? a2 : a2 | 2)) << 3 ^ 8;
      b2 = f2 - (b2 ? 0 : e2) << 3;
      if ((b2 | 0) >= (c2 | 0)) {
        b2 = b2 - c2 | 0;
        a2 = a2 & 65528 | 4;
      }
      f2 = (b2 | 0) < (d2 | 0);
      g2 = b2 - (f2 ? 0 : d2) | 0;
      b2 = (g2 | 0) < (e2 | 0);
      a2 = (b2 & 1 ^ 1 | (f2 ? a2 : a2 | 2)) << 16 >> 13;
      b2 = g2 - (b2 ? 0 : e2) << 3;
      if ((b2 | 0) >= (c2 | 0)) {
        b2 = b2 - c2 | 0;
        a2 = a2 & 65528 | 4;
      }
      f2 = (b2 | 0) < (d2 | 0);
      g2 = b2 - (f2 ? 0 : d2) | 0;
      b2 = (g2 | 0) < (e2 | 0);
      a2 = (b2 & 1 ^ 1 | (f2 ? a2 : a2 | 2)) << 16 >> 13;
      b2 = g2 - (b2 ? 0 : e2) << 3;
      if ((b2 | 0) >= (c2 | 0)) {
        b2 = b2 - c2 | 0;
        a2 = a2 & 65528 | 4;
      }
      h2 = (b2 | 0) < (d2 | 0);
      f2 = b2 - (h2 ? 0 : d2) | 0;
      g2 = (f2 | 0) < (e2 | 0);
      b2 = (g2 & 1 ^ 1 | (h2 ? a2 : a2 | 2)) << 16 >> 13;
      a2 = f2 - (g2 ? 0 : e2) << 3;
      if ((a2 | 0) >= (c2 | 0)) {
        a2 = a2 - c2 | 0;
        b2 = b2 & 65528 | 4;
      }
      h2 = (a2 | 0) < (d2 | 0);
      h2 = ((a2 - (h2 ? 0 : d2) | 0) >= (e2 | 0) | (h2 ? b2 : b2 | 2)) & 65535;
      return h2 | 0;
    }
    function Ud(a2) {
      a2 = a2 | 0;
      if (!a2) {
        a2 = -1;
        return a2 | 0;
      }
      b[a2 >> 1] = -14336;
      b[a2 + 8 >> 1] = -2381;
      b[a2 + 2 >> 1] = -14336;
      b[a2 + 10 >> 1] = -2381;
      b[a2 + 4 >> 1] = -14336;
      b[a2 + 12 >> 1] = -2381;
      b[a2 + 6 >> 1] = -14336;
      b[a2 + 14 >> 1] = -2381;
      a2 = 0;
      return a2 | 0;
    }
    function Vd(a2, d2, f2, g2, h2, j2, k2, l2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      j2 = j2 | 0;
      k2 = k2 | 0;
      l2 = l2 | 0;
      var m2 = 0, n2 = 0, o2 = 0, p2 = 0, q2 = 0, r2 = 0;
      r2 = i2;
      i2 = i2 + 16 | 0;
      p2 = r2 + 2 | 0;
      q2 = r2;
      m2 = 0;
      n2 = 10;
      while (1) {
        o2 = b[f2 >> 1] | 0;
        o2 = ((Z(o2, o2) | 0) >>> 3) + m2 | 0;
        m2 = b[f2 + 2 >> 1] | 0;
        m2 = o2 + ((Z(m2, m2) | 0) >>> 3) | 0;
        o2 = b[f2 + 4 >> 1] | 0;
        o2 = m2 + ((Z(o2, o2) | 0) >>> 3) | 0;
        m2 = b[f2 + 6 >> 1] | 0;
        m2 = o2 + ((Z(m2, m2) | 0) >>> 3) | 0;
        n2 = n2 + -1 << 16 >> 16;
        if (!(n2 << 16 >> 16))
          break;
        else
          f2 = f2 + 8 | 0;
      }
      n2 = m2 << 4;
      n2 = (n2 | 0) < 0 ? 2147483647 : n2;
      if ((d2 | 0) == 7) {
        de(((Ce(n2, l2) | 0) << 16 >> 16) * 52428 | 0, p2, q2, l2);
        o2 = e[p2 >> 1] << 16;
        n2 = b[q2 >> 1] << 1;
        d2 = b[a2 + 8 >> 1] | 0;
        m2 = (d2 << 16 >> 16) * 88 | 0;
        if (d2 << 16 >> 16 > -1 & (m2 | 0) < -783741) {
          c[l2 >> 2] = 1;
          f2 = 2147483647;
        } else
          f2 = m2 + 783741 | 0;
        d2 = (b[a2 + 10 >> 1] | 0) * 74 | 0;
        m2 = d2 + f2 | 0;
        if ((d2 ^ f2 | 0) > -1 & (m2 ^ f2 | 0) < 0) {
          c[l2 >> 2] = 1;
          f2 = (f2 >>> 31) + 2147483647 | 0;
        } else
          f2 = m2;
        d2 = (b[a2 + 12 >> 1] | 0) * 44 | 0;
        m2 = d2 + f2 | 0;
        if ((d2 ^ f2 | 0) > -1 & (m2 ^ f2 | 0) < 0) {
          c[l2 >> 2] = 1;
          f2 = (f2 >>> 31) + 2147483647 | 0;
        } else
          f2 = m2;
        a2 = (b[a2 + 14 >> 1] | 0) * 24 | 0;
        m2 = a2 + f2 | 0;
        if ((a2 ^ f2 | 0) > -1 & (m2 ^ f2 | 0) < 0) {
          c[l2 >> 2] = 1;
          m2 = (f2 >>> 31) + 2147483647 | 0;
        }
        a2 = o2 + -1966080 + n2 | 0;
        f2 = m2 - a2 | 0;
        if (((f2 ^ m2) & (m2 ^ a2) | 0) < 0) {
          c[l2 >> 2] = 1;
          f2 = (m2 >>> 31) + 2147483647 | 0;
        }
        l2 = f2 >> 17;
        b[g2 >> 1] = l2;
        l2 = (f2 >> 2) - (l2 << 15) | 0;
        l2 = l2 & 65535;
        b[h2 >> 1] = l2;
        i2 = r2;
        return;
      }
      o2 = pe(n2) | 0;
      m2 = o2 << 16 >> 16;
      if (o2 << 16 >> 16 > 0) {
        f2 = n2 << m2;
        if ((f2 >> m2 | 0) == (n2 | 0))
          n2 = f2;
        else
          n2 = n2 >> 31 ^ 2147483647;
      } else {
        m2 = 0 - m2 << 16;
        if ((m2 | 0) < 2031616)
          n2 = n2 >> (m2 >> 16);
        else
          n2 = 0;
      }
      ee(n2, o2, p2, q2);
      p2 = Z(b[p2 >> 1] | 0, -49320) | 0;
      m2 = (Z(b[q2 >> 1] | 0, -24660) | 0) >> 15;
      m2 = (m2 & 65536 | 0) == 0 ? m2 : m2 | -65536;
      q2 = m2 << 1;
      f2 = q2 + p2 | 0;
      if ((q2 ^ p2 | 0) > -1 & (f2 ^ q2 | 0) < 0) {
        c[l2 >> 2] = 1;
        f2 = (m2 >>> 30 & 1) + 2147483647 | 0;
      }
      switch (d2 | 0) {
        case 6: {
          m2 = f2 + 2134784 | 0;
          if ((f2 | 0) > -1 & (m2 ^ f2 | 0) < 0) {
            c[l2 >> 2] = 1;
            m2 = (f2 >>> 31) + 2147483647 | 0;
          }
          break;
        }
        case 5: {
          b[k2 >> 1] = n2 >>> 16;
          b[j2 >> 1] = -11 - (o2 & 65535);
          m2 = f2 + 2183936 | 0;
          if ((f2 | 0) > -1 & (m2 ^ f2 | 0) < 0) {
            c[l2 >> 2] = 1;
            m2 = (f2 >>> 31) + 2147483647 | 0;
          }
          break;
        }
        case 4: {
          m2 = f2 + 2085632 | 0;
          if ((f2 | 0) > -1 & (m2 ^ f2 | 0) < 0) {
            c[l2 >> 2] = 1;
            m2 = (f2 >>> 31) + 2147483647 | 0;
          }
          break;
        }
        case 3: {
          m2 = f2 + 2065152 | 0;
          if ((f2 | 0) > -1 & (m2 ^ f2 | 0) < 0) {
            c[l2 >> 2] = 1;
            m2 = (f2 >>> 31) + 2147483647 | 0;
          }
          break;
        }
        default: {
          m2 = f2 + 2134784 | 0;
          if ((f2 | 0) > -1 & (m2 ^ f2 | 0) < 0) {
            c[l2 >> 2] = 1;
            m2 = (f2 >>> 31) + 2147483647 | 0;
          }
        }
      }
      do
        if ((m2 | 0) <= 2097151)
          if ((m2 | 0) < -2097152) {
            c[l2 >> 2] = 1;
            f2 = -2147483648;
            break;
          } else {
            f2 = m2 << 10;
            break;
          }
        else {
          c[l2 >> 2] = 1;
          f2 = 2147483647;
        }
      while (0);
      k2 = (b[a2 >> 1] | 0) * 11142 | 0;
      m2 = k2 + f2 | 0;
      if ((k2 ^ f2 | 0) > -1 & (m2 ^ f2 | 0) < 0) {
        c[l2 >> 2] = 1;
        m2 = (f2 >>> 31) + 2147483647 | 0;
      }
      k2 = (b[a2 + 2 >> 1] | 0) * 9502 | 0;
      f2 = k2 + m2 | 0;
      if ((k2 ^ m2 | 0) > -1 & (f2 ^ m2 | 0) < 0) {
        c[l2 >> 2] = 1;
        f2 = (m2 >>> 31) + 2147483647 | 0;
      }
      k2 = (b[a2 + 4 >> 1] | 0) * 5570 | 0;
      m2 = k2 + f2 | 0;
      if ((k2 ^ f2 | 0) > -1 & (m2 ^ f2 | 0) < 0) {
        c[l2 >> 2] = 1;
        m2 = (f2 >>> 31) + 2147483647 | 0;
      }
      a2 = (b[a2 + 6 >> 1] | 0) * 3112 | 0;
      f2 = a2 + m2 | 0;
      if ((a2 ^ m2 | 0) > -1 & (f2 ^ m2 | 0) < 0) {
        c[l2 >> 2] = 1;
        f2 = (m2 >>> 31) + 2147483647 | 0;
      }
      f2 = Z(f2 >> 16, (d2 | 0) == 4 ? 10878 : 10886) | 0;
      if ((f2 | 0) < 0)
        f2 = ~((f2 ^ -256) >> 8);
      else
        f2 = f2 >> 8;
      b[g2 >> 1] = f2 >>> 16;
      if ((f2 | 0) < 0)
        m2 = ~((f2 ^ -2) >> 1);
      else
        m2 = f2 >> 1;
      g2 = f2 >> 16 << 15;
      f2 = m2 - g2 | 0;
      if (((f2 ^ m2) & (g2 ^ m2) | 0) >= 0) {
        l2 = f2;
        l2 = l2 & 65535;
        b[h2 >> 1] = l2;
        i2 = r2;
        return;
      }
      c[l2 >> 2] = 1;
      l2 = (m2 >>> 31) + 2147483647 | 0;
      l2 = l2 & 65535;
      b[h2 >> 1] = l2;
      i2 = r2;
      return;
    }
    function Wd(a2, c2, d2) {
      a2 = a2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      var e2 = 0, f2 = 0, g2 = 0;
      f2 = a2 + 4 | 0;
      b[a2 + 6 >> 1] = b[f2 >> 1] | 0;
      g2 = a2 + 12 | 0;
      b[a2 + 14 >> 1] = b[g2 >> 1] | 0;
      e2 = a2 + 2 | 0;
      b[f2 >> 1] = b[e2 >> 1] | 0;
      f2 = a2 + 10 | 0;
      b[g2 >> 1] = b[f2 >> 1] | 0;
      b[e2 >> 1] = b[a2 >> 1] | 0;
      e2 = a2 + 8 | 0;
      b[f2 >> 1] = b[e2 >> 1] | 0;
      b[e2 >> 1] = c2;
      b[a2 >> 1] = d2;
      return;
    }
    function Xd(a2, c2, d2, e2) {
      a2 = a2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      var f2 = 0, g2 = 0;
      g2 = Rd(0, b[a2 + 8 >> 1] | 0, e2) | 0;
      g2 = Rd(g2, b[a2 + 10 >> 1] | 0, e2) | 0;
      g2 = Rd(g2, b[a2 + 12 >> 1] | 0, e2) | 0;
      g2 = Rd(g2, b[a2 + 14 >> 1] | 0, e2) | 0;
      f2 = g2 << 16 >> 16 >> 2;
      f2 = (g2 << 16 >> 16 < 0 ? f2 | 49152 : f2) & 65535;
      b[c2 >> 1] = f2 << 16 >> 16 < -2381 ? -2381 : f2;
      c2 = Rd(0, b[a2 >> 1] | 0, e2) | 0;
      c2 = Rd(c2, b[a2 + 2 >> 1] | 0, e2) | 0;
      c2 = Rd(c2, b[a2 + 4 >> 1] | 0, e2) | 0;
      e2 = Rd(c2, b[a2 + 6 >> 1] | 0, e2) | 0;
      a2 = e2 << 16 >> 16 >> 2;
      a2 = (e2 << 16 >> 16 < 0 ? a2 | 49152 : a2) & 65535;
      b[d2 >> 1] = a2 << 16 >> 16 < -14336 ? -14336 : a2;
      return;
    }
    function Yd(a2) {
      a2 = a2 | 0;
      c[a2 >> 2] = 6892;
      c[a2 + 4 >> 2] = 8180;
      c[a2 + 8 >> 2] = 21e3;
      c[a2 + 12 >> 2] = 9716;
      c[a2 + 16 >> 2] = 22024;
      c[a2 + 20 >> 2] = 12788;
      c[a2 + 24 >> 2] = 24072;
      c[a2 + 28 >> 2] = 26120;
      c[a2 + 32 >> 2] = 28168;
      c[a2 + 36 >> 2] = 6876;
      c[a2 + 40 >> 2] = 7452;
      c[a2 + 44 >> 2] = 8140;
      c[a2 + 48 >> 2] = 20980;
      c[a2 + 52 >> 2] = 16884;
      c[a2 + 56 >> 2] = 17908;
      c[a2 + 60 >> 2] = 7980;
      c[a2 + 64 >> 2] = 8160;
      c[a2 + 68 >> 2] = 6678;
      c[a2 + 72 >> 2] = 6646;
      c[a2 + 76 >> 2] = 6614;
      c[a2 + 80 >> 2] = 29704;
      c[a2 + 84 >> 2] = 28680;
      c[a2 + 88 >> 2] = 3720;
      c[a2 + 92 >> 2] = 8;
      c[a2 + 96 >> 2] = 4172;
      c[a2 + 100 >> 2] = 44;
      c[a2 + 104 >> 2] = 3436;
      c[a2 + 108 >> 2] = 30316;
      c[a2 + 112 >> 2] = 30796;
      c[a2 + 116 >> 2] = 31276;
      c[a2 + 120 >> 2] = 7472;
      c[a2 + 124 >> 2] = 7552;
      c[a2 + 128 >> 2] = 7632;
      c[a2 + 132 >> 2] = 7712;
      return;
    }
    function Zd(a2, c2) {
      a2 = a2 | 0;
      c2 = c2 | 0;
      var d2 = 0, e2 = 0, f2 = 0, g2 = 0, h2 = 0, j2 = 0, k2 = 0, l2 = 0, m2 = 0, n2 = 0;
      n2 = i2;
      i2 = i2 + 48 | 0;
      l2 = n2 + 18 | 0;
      m2 = n2;
      k2 = c2 << 16 >> 16;
      Oe(m2 | 0, a2 | 0, k2 << 1 | 0) | 0;
      if (c2 << 16 >> 16 > 0) {
        d2 = 0;
        e2 = 0;
      } else {
        m2 = k2 >> 1;
        m2 = l2 + (m2 << 1) | 0;
        m2 = b[m2 >> 1] | 0;
        m2 = m2 << 16 >> 16;
        m2 = a2 + (m2 << 1) | 0;
        m2 = b[m2 >> 1] | 0;
        i2 = n2;
        return m2 | 0;
      }
      do {
        j2 = 0;
        h2 = -32767;
        while (1) {
          f2 = b[m2 + (j2 << 1) >> 1] | 0;
          g2 = f2 << 16 >> 16 < h2 << 16 >> 16;
          e2 = g2 ? e2 : j2 & 65535;
          j2 = j2 + 1 | 0;
          if ((j2 & 65535) << 16 >> 16 == c2 << 16 >> 16)
            break;
          else
            h2 = g2 ? h2 : f2;
        }
        b[m2 + (e2 << 16 >> 16 << 1) >> 1] = -32768;
        b[l2 + (d2 << 1) >> 1] = e2;
        d2 = d2 + 1 | 0;
      } while ((d2 & 65535) << 16 >> 16 != c2 << 16 >> 16);
      m2 = k2 >> 1;
      m2 = l2 + (m2 << 1) | 0;
      m2 = b[m2 >> 1] | 0;
      m2 = m2 << 16 >> 16;
      m2 = a2 + (m2 << 1) | 0;
      m2 = b[m2 >> 1] | 0;
      i2 = n2;
      return m2 | 0;
    }
    function _d(a2, c2, d2, e2, f2) {
      a2 = a2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      var g2 = 0, h2 = 0, j2 = 0, k2 = 0, l2 = 0, m2 = 0, n2 = 0, o2 = 0, p2 = 0, q2 = 0, r2 = 0, s2 = 0, t2 = 0, u2 = 0, v2 = 0, w2 = 0, x2 = 0, y2 = 0, z2 = 0, A2 = 0;
      g2 = i2;
      i2 = i2 + 32 | 0;
      h2 = g2;
      A2 = c2 + 2 | 0;
      z2 = h2 + 2 | 0;
      b[h2 >> 1] = ((b[c2 >> 1] | 0) >>> 1) + ((b[a2 >> 1] | 0) >>> 1);
      y2 = c2 + 4 | 0;
      x2 = h2 + 4 | 0;
      b[z2 >> 1] = ((b[A2 >> 1] | 0) >>> 1) + ((b[a2 + 2 >> 1] | 0) >>> 1);
      w2 = c2 + 6 | 0;
      v2 = h2 + 6 | 0;
      b[x2 >> 1] = ((b[y2 >> 1] | 0) >>> 1) + ((b[a2 + 4 >> 1] | 0) >>> 1);
      u2 = c2 + 8 | 0;
      t2 = h2 + 8 | 0;
      b[v2 >> 1] = ((b[w2 >> 1] | 0) >>> 1) + ((b[a2 + 6 >> 1] | 0) >>> 1);
      s2 = c2 + 10 | 0;
      r2 = h2 + 10 | 0;
      b[t2 >> 1] = ((b[u2 >> 1] | 0) >>> 1) + ((b[a2 + 8 >> 1] | 0) >>> 1);
      q2 = c2 + 12 | 0;
      p2 = h2 + 12 | 0;
      b[r2 >> 1] = ((b[s2 >> 1] | 0) >>> 1) + ((b[a2 + 10 >> 1] | 0) >>> 1);
      o2 = c2 + 14 | 0;
      n2 = h2 + 14 | 0;
      b[p2 >> 1] = ((b[q2 >> 1] | 0) >>> 1) + ((b[a2 + 12 >> 1] | 0) >>> 1);
      m2 = c2 + 16 | 0;
      l2 = h2 + 16 | 0;
      b[n2 >> 1] = ((b[o2 >> 1] | 0) >>> 1) + ((b[a2 + 14 >> 1] | 0) >>> 1);
      k2 = c2 + 18 | 0;
      j2 = h2 + 18 | 0;
      b[l2 >> 1] = ((b[m2 >> 1] | 0) >>> 1) + ((b[a2 + 16 >> 1] | 0) >>> 1);
      b[j2 >> 1] = ((b[k2 >> 1] | 0) >>> 1) + ((b[a2 + 18 >> 1] | 0) >>> 1);
      he(h2, e2, f2);
      he(c2, e2 + 22 | 0, f2);
      b[h2 >> 1] = ((b[d2 >> 1] | 0) >>> 1) + ((b[c2 >> 1] | 0) >>> 1);
      b[z2 >> 1] = ((b[d2 + 2 >> 1] | 0) >>> 1) + ((b[A2 >> 1] | 0) >>> 1);
      b[x2 >> 1] = ((b[d2 + 4 >> 1] | 0) >>> 1) + ((b[y2 >> 1] | 0) >>> 1);
      b[v2 >> 1] = ((b[d2 + 6 >> 1] | 0) >>> 1) + ((b[w2 >> 1] | 0) >>> 1);
      b[t2 >> 1] = ((b[d2 + 8 >> 1] | 0) >>> 1) + ((b[u2 >> 1] | 0) >>> 1);
      b[r2 >> 1] = ((b[d2 + 10 >> 1] | 0) >>> 1) + ((b[s2 >> 1] | 0) >>> 1);
      b[p2 >> 1] = ((b[d2 + 12 >> 1] | 0) >>> 1) + ((b[q2 >> 1] | 0) >>> 1);
      b[n2 >> 1] = ((b[d2 + 14 >> 1] | 0) >>> 1) + ((b[o2 >> 1] | 0) >>> 1);
      b[l2 >> 1] = ((b[d2 + 16 >> 1] | 0) >>> 1) + ((b[m2 >> 1] | 0) >>> 1);
      b[j2 >> 1] = ((b[d2 + 18 >> 1] | 0) >>> 1) + ((b[k2 >> 1] | 0) >>> 1);
      he(h2, e2 + 44 | 0, f2);
      he(d2, e2 + 66 | 0, f2);
      i2 = g2;
      return;
    }
    function $d(a2, c2, d2, e2, f2) {
      a2 = a2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      var g2 = 0, h2 = 0, j2 = 0, k2 = 0, l2 = 0, m2 = 0, n2 = 0, o2 = 0, p2 = 0, q2 = 0, r2 = 0, s2 = 0, t2 = 0, u2 = 0, v2 = 0, w2 = 0, x2 = 0, y2 = 0, z2 = 0, A2 = 0;
      g2 = i2;
      i2 = i2 + 32 | 0;
      h2 = g2;
      A2 = c2 + 2 | 0;
      z2 = h2 + 2 | 0;
      b[h2 >> 1] = ((b[c2 >> 1] | 0) >>> 1) + ((b[a2 >> 1] | 0) >>> 1);
      y2 = c2 + 4 | 0;
      x2 = h2 + 4 | 0;
      b[z2 >> 1] = ((b[A2 >> 1] | 0) >>> 1) + ((b[a2 + 2 >> 1] | 0) >>> 1);
      w2 = c2 + 6 | 0;
      v2 = h2 + 6 | 0;
      b[x2 >> 1] = ((b[y2 >> 1] | 0) >>> 1) + ((b[a2 + 4 >> 1] | 0) >>> 1);
      u2 = c2 + 8 | 0;
      t2 = h2 + 8 | 0;
      b[v2 >> 1] = ((b[w2 >> 1] | 0) >>> 1) + ((b[a2 + 6 >> 1] | 0) >>> 1);
      s2 = c2 + 10 | 0;
      r2 = h2 + 10 | 0;
      b[t2 >> 1] = ((b[u2 >> 1] | 0) >>> 1) + ((b[a2 + 8 >> 1] | 0) >>> 1);
      q2 = c2 + 12 | 0;
      p2 = h2 + 12 | 0;
      b[r2 >> 1] = ((b[s2 >> 1] | 0) >>> 1) + ((b[a2 + 10 >> 1] | 0) >>> 1);
      o2 = c2 + 14 | 0;
      n2 = h2 + 14 | 0;
      b[p2 >> 1] = ((b[q2 >> 1] | 0) >>> 1) + ((b[a2 + 12 >> 1] | 0) >>> 1);
      m2 = c2 + 16 | 0;
      l2 = h2 + 16 | 0;
      b[n2 >> 1] = ((b[o2 >> 1] | 0) >>> 1) + ((b[a2 + 14 >> 1] | 0) >>> 1);
      k2 = c2 + 18 | 0;
      j2 = h2 + 18 | 0;
      b[l2 >> 1] = ((b[m2 >> 1] | 0) >>> 1) + ((b[a2 + 16 >> 1] | 0) >>> 1);
      b[j2 >> 1] = ((b[k2 >> 1] | 0) >>> 1) + ((b[a2 + 18 >> 1] | 0) >>> 1);
      he(h2, e2, f2);
      b[h2 >> 1] = ((b[d2 >> 1] | 0) >>> 1) + ((b[c2 >> 1] | 0) >>> 1);
      b[z2 >> 1] = ((b[d2 + 2 >> 1] | 0) >>> 1) + ((b[A2 >> 1] | 0) >>> 1);
      b[x2 >> 1] = ((b[d2 + 4 >> 1] | 0) >>> 1) + ((b[y2 >> 1] | 0) >>> 1);
      b[v2 >> 1] = ((b[d2 + 6 >> 1] | 0) >>> 1) + ((b[w2 >> 1] | 0) >>> 1);
      b[t2 >> 1] = ((b[d2 + 8 >> 1] | 0) >>> 1) + ((b[u2 >> 1] | 0) >>> 1);
      b[r2 >> 1] = ((b[d2 + 10 >> 1] | 0) >>> 1) + ((b[s2 >> 1] | 0) >>> 1);
      b[p2 >> 1] = ((b[d2 + 12 >> 1] | 0) >>> 1) + ((b[q2 >> 1] | 0) >>> 1);
      b[n2 >> 1] = ((b[d2 + 14 >> 1] | 0) >>> 1) + ((b[o2 >> 1] | 0) >>> 1);
      b[l2 >> 1] = ((b[d2 + 16 >> 1] | 0) >>> 1) + ((b[m2 >> 1] | 0) >>> 1);
      b[j2 >> 1] = ((b[d2 + 18 >> 1] | 0) >>> 1) + ((b[k2 >> 1] | 0) >>> 1);
      he(h2, e2 + 44 | 0, f2);
      i2 = g2;
      return;
    }
    function ae(a2, c2, d2, e2) {
      a2 = a2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      var f2 = 0, g2 = 0, h2 = 0, j2 = 0, k2 = 0, l2 = 0, m2 = 0, n2 = 0, o2 = 0, p2 = 0, q2 = 0, r2 = 0, s2 = 0, t2 = 0, u2 = 0, v2 = 0, w2 = 0, x2 = 0, y2 = 0, z2 = 0, A2 = 0, B2 = 0, C2 = 0, D2 = 0, E2 = 0, F2 = 0, G2 = 0, H2 = 0, I2 = 0, J2 = 0;
      f2 = i2;
      i2 = i2 + 32 | 0;
      g2 = f2;
      H2 = b[a2 >> 1] | 0;
      b[g2 >> 1] = H2 - (H2 >>> 2) + ((b[c2 >> 1] | 0) >>> 2);
      H2 = a2 + 2 | 0;
      E2 = b[H2 >> 1] | 0;
      I2 = c2 + 2 | 0;
      G2 = g2 + 2 | 0;
      b[G2 >> 1] = E2 - (E2 >>> 2) + ((b[I2 >> 1] | 0) >>> 2);
      E2 = a2 + 4 | 0;
      B2 = b[E2 >> 1] | 0;
      F2 = c2 + 4 | 0;
      D2 = g2 + 4 | 0;
      b[D2 >> 1] = B2 - (B2 >>> 2) + ((b[F2 >> 1] | 0) >>> 2);
      B2 = a2 + 6 | 0;
      y2 = b[B2 >> 1] | 0;
      C2 = c2 + 6 | 0;
      A2 = g2 + 6 | 0;
      b[A2 >> 1] = y2 - (y2 >>> 2) + ((b[C2 >> 1] | 0) >>> 2);
      y2 = a2 + 8 | 0;
      v2 = b[y2 >> 1] | 0;
      z2 = c2 + 8 | 0;
      x2 = g2 + 8 | 0;
      b[x2 >> 1] = v2 - (v2 >>> 2) + ((b[z2 >> 1] | 0) >>> 2);
      v2 = a2 + 10 | 0;
      s2 = b[v2 >> 1] | 0;
      w2 = c2 + 10 | 0;
      u2 = g2 + 10 | 0;
      b[u2 >> 1] = s2 - (s2 >>> 2) + ((b[w2 >> 1] | 0) >>> 2);
      s2 = a2 + 12 | 0;
      p2 = b[s2 >> 1] | 0;
      t2 = c2 + 12 | 0;
      r2 = g2 + 12 | 0;
      b[r2 >> 1] = p2 - (p2 >>> 2) + ((b[t2 >> 1] | 0) >>> 2);
      p2 = a2 + 14 | 0;
      m2 = b[p2 >> 1] | 0;
      q2 = c2 + 14 | 0;
      o2 = g2 + 14 | 0;
      b[o2 >> 1] = m2 - (m2 >>> 2) + ((b[q2 >> 1] | 0) >>> 2);
      m2 = a2 + 16 | 0;
      j2 = b[m2 >> 1] | 0;
      n2 = c2 + 16 | 0;
      l2 = g2 + 16 | 0;
      b[l2 >> 1] = j2 - (j2 >>> 2) + ((b[n2 >> 1] | 0) >>> 2);
      j2 = a2 + 18 | 0;
      J2 = b[j2 >> 1] | 0;
      k2 = c2 + 18 | 0;
      h2 = g2 + 18 | 0;
      b[h2 >> 1] = J2 - (J2 >>> 2) + ((b[k2 >> 1] | 0) >>> 2);
      he(g2, d2, e2);
      b[g2 >> 1] = ((b[a2 >> 1] | 0) >>> 1) + ((b[c2 >> 1] | 0) >>> 1);
      b[G2 >> 1] = ((b[H2 >> 1] | 0) >>> 1) + ((b[I2 >> 1] | 0) >>> 1);
      b[D2 >> 1] = ((b[E2 >> 1] | 0) >>> 1) + ((b[F2 >> 1] | 0) >>> 1);
      b[A2 >> 1] = ((b[B2 >> 1] | 0) >>> 1) + ((b[C2 >> 1] | 0) >>> 1);
      b[x2 >> 1] = ((b[y2 >> 1] | 0) >>> 1) + ((b[z2 >> 1] | 0) >>> 1);
      b[u2 >> 1] = ((b[v2 >> 1] | 0) >>> 1) + ((b[w2 >> 1] | 0) >>> 1);
      b[r2 >> 1] = ((b[s2 >> 1] | 0) >>> 1) + ((b[t2 >> 1] | 0) >>> 1);
      b[o2 >> 1] = ((b[p2 >> 1] | 0) >>> 1) + ((b[q2 >> 1] | 0) >>> 1);
      b[l2 >> 1] = ((b[m2 >> 1] | 0) >>> 1) + ((b[n2 >> 1] | 0) >>> 1);
      b[h2 >> 1] = ((b[j2 >> 1] | 0) >>> 1) + ((b[k2 >> 1] | 0) >>> 1);
      he(g2, d2 + 22 | 0, e2);
      J2 = b[c2 >> 1] | 0;
      b[g2 >> 1] = J2 - (J2 >>> 2) + ((b[a2 >> 1] | 0) >>> 2);
      a2 = b[I2 >> 1] | 0;
      b[G2 >> 1] = a2 - (a2 >>> 2) + ((b[H2 >> 1] | 0) >>> 2);
      a2 = b[F2 >> 1] | 0;
      b[D2 >> 1] = a2 - (a2 >>> 2) + ((b[E2 >> 1] | 0) >>> 2);
      a2 = b[C2 >> 1] | 0;
      b[A2 >> 1] = a2 - (a2 >>> 2) + ((b[B2 >> 1] | 0) >>> 2);
      a2 = b[z2 >> 1] | 0;
      b[x2 >> 1] = a2 - (a2 >>> 2) + ((b[y2 >> 1] | 0) >>> 2);
      a2 = b[w2 >> 1] | 0;
      b[u2 >> 1] = a2 - (a2 >>> 2) + ((b[v2 >> 1] | 0) >>> 2);
      a2 = b[t2 >> 1] | 0;
      b[r2 >> 1] = a2 - (a2 >>> 2) + ((b[s2 >> 1] | 0) >>> 2);
      a2 = b[q2 >> 1] | 0;
      b[o2 >> 1] = a2 - (a2 >>> 2) + ((b[p2 >> 1] | 0) >>> 2);
      a2 = b[n2 >> 1] | 0;
      b[l2 >> 1] = a2 - (a2 >>> 2) + ((b[m2 >> 1] | 0) >>> 2);
      a2 = b[k2 >> 1] | 0;
      b[h2 >> 1] = a2 - (a2 >>> 2) + ((b[j2 >> 1] | 0) >>> 2);
      he(g2, d2 + 44 | 0, e2);
      he(c2, d2 + 66 | 0, e2);
      i2 = f2;
      return;
    }
    function be(a2, c2, d2, e2) {
      a2 = a2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      var f2 = 0, g2 = 0, h2 = 0, j2 = 0, k2 = 0, l2 = 0, m2 = 0, n2 = 0, o2 = 0, p2 = 0, q2 = 0, r2 = 0, s2 = 0, t2 = 0, u2 = 0, v2 = 0, w2 = 0, x2 = 0, y2 = 0, z2 = 0, A2 = 0, B2 = 0, C2 = 0, D2 = 0, E2 = 0, F2 = 0, G2 = 0, H2 = 0, I2 = 0, J2 = 0;
      f2 = i2;
      i2 = i2 + 32 | 0;
      g2 = f2;
      H2 = b[a2 >> 1] | 0;
      b[g2 >> 1] = H2 - (H2 >>> 2) + ((b[c2 >> 1] | 0) >>> 2);
      H2 = a2 + 2 | 0;
      E2 = b[H2 >> 1] | 0;
      I2 = c2 + 2 | 0;
      G2 = g2 + 2 | 0;
      b[G2 >> 1] = E2 - (E2 >>> 2) + ((b[I2 >> 1] | 0) >>> 2);
      E2 = a2 + 4 | 0;
      B2 = b[E2 >> 1] | 0;
      F2 = c2 + 4 | 0;
      D2 = g2 + 4 | 0;
      b[D2 >> 1] = B2 - (B2 >>> 2) + ((b[F2 >> 1] | 0) >>> 2);
      B2 = a2 + 6 | 0;
      y2 = b[B2 >> 1] | 0;
      C2 = c2 + 6 | 0;
      A2 = g2 + 6 | 0;
      b[A2 >> 1] = y2 - (y2 >>> 2) + ((b[C2 >> 1] | 0) >>> 2);
      y2 = a2 + 8 | 0;
      v2 = b[y2 >> 1] | 0;
      z2 = c2 + 8 | 0;
      x2 = g2 + 8 | 0;
      b[x2 >> 1] = v2 - (v2 >>> 2) + ((b[z2 >> 1] | 0) >>> 2);
      v2 = a2 + 10 | 0;
      s2 = b[v2 >> 1] | 0;
      w2 = c2 + 10 | 0;
      u2 = g2 + 10 | 0;
      b[u2 >> 1] = s2 - (s2 >>> 2) + ((b[w2 >> 1] | 0) >>> 2);
      s2 = a2 + 12 | 0;
      p2 = b[s2 >> 1] | 0;
      t2 = c2 + 12 | 0;
      r2 = g2 + 12 | 0;
      b[r2 >> 1] = p2 - (p2 >>> 2) + ((b[t2 >> 1] | 0) >>> 2);
      p2 = a2 + 14 | 0;
      m2 = b[p2 >> 1] | 0;
      q2 = c2 + 14 | 0;
      o2 = g2 + 14 | 0;
      b[o2 >> 1] = m2 - (m2 >>> 2) + ((b[q2 >> 1] | 0) >>> 2);
      m2 = a2 + 16 | 0;
      j2 = b[m2 >> 1] | 0;
      n2 = c2 + 16 | 0;
      l2 = g2 + 16 | 0;
      b[l2 >> 1] = j2 - (j2 >>> 2) + ((b[n2 >> 1] | 0) >>> 2);
      j2 = a2 + 18 | 0;
      J2 = b[j2 >> 1] | 0;
      k2 = c2 + 18 | 0;
      h2 = g2 + 18 | 0;
      b[h2 >> 1] = J2 - (J2 >>> 2) + ((b[k2 >> 1] | 0) >>> 2);
      he(g2, d2, e2);
      b[g2 >> 1] = ((b[a2 >> 1] | 0) >>> 1) + ((b[c2 >> 1] | 0) >>> 1);
      b[G2 >> 1] = ((b[H2 >> 1] | 0) >>> 1) + ((b[I2 >> 1] | 0) >>> 1);
      b[D2 >> 1] = ((b[E2 >> 1] | 0) >>> 1) + ((b[F2 >> 1] | 0) >>> 1);
      b[A2 >> 1] = ((b[B2 >> 1] | 0) >>> 1) + ((b[C2 >> 1] | 0) >>> 1);
      b[x2 >> 1] = ((b[y2 >> 1] | 0) >>> 1) + ((b[z2 >> 1] | 0) >>> 1);
      b[u2 >> 1] = ((b[v2 >> 1] | 0) >>> 1) + ((b[w2 >> 1] | 0) >>> 1);
      b[r2 >> 1] = ((b[s2 >> 1] | 0) >>> 1) + ((b[t2 >> 1] | 0) >>> 1);
      b[o2 >> 1] = ((b[p2 >> 1] | 0) >>> 1) + ((b[q2 >> 1] | 0) >>> 1);
      b[l2 >> 1] = ((b[m2 >> 1] | 0) >>> 1) + ((b[n2 >> 1] | 0) >>> 1);
      b[h2 >> 1] = ((b[j2 >> 1] | 0) >>> 1) + ((b[k2 >> 1] | 0) >>> 1);
      he(g2, d2 + 22 | 0, e2);
      c2 = b[c2 >> 1] | 0;
      b[g2 >> 1] = c2 - (c2 >>> 2) + ((b[a2 >> 1] | 0) >>> 2);
      a2 = b[I2 >> 1] | 0;
      b[G2 >> 1] = a2 - (a2 >>> 2) + ((b[H2 >> 1] | 0) >>> 2);
      a2 = b[F2 >> 1] | 0;
      b[D2 >> 1] = a2 - (a2 >>> 2) + ((b[E2 >> 1] | 0) >>> 2);
      a2 = b[C2 >> 1] | 0;
      b[A2 >> 1] = a2 - (a2 >>> 2) + ((b[B2 >> 1] | 0) >>> 2);
      a2 = b[z2 >> 1] | 0;
      b[x2 >> 1] = a2 - (a2 >>> 2) + ((b[y2 >> 1] | 0) >>> 2);
      a2 = b[w2 >> 1] | 0;
      b[u2 >> 1] = a2 - (a2 >>> 2) + ((b[v2 >> 1] | 0) >>> 2);
      a2 = b[t2 >> 1] | 0;
      b[r2 >> 1] = a2 - (a2 >>> 2) + ((b[s2 >> 1] | 0) >>> 2);
      a2 = b[q2 >> 1] | 0;
      b[o2 >> 1] = a2 - (a2 >>> 2) + ((b[p2 >> 1] | 0) >>> 2);
      a2 = b[n2 >> 1] | 0;
      b[l2 >> 1] = a2 - (a2 >>> 2) + ((b[m2 >> 1] | 0) >>> 2);
      a2 = b[k2 >> 1] | 0;
      b[h2 >> 1] = a2 - (a2 >>> 2) + ((b[j2 >> 1] | 0) >>> 2);
      he(g2, d2 + 44 | 0, e2);
      i2 = f2;
      return;
    }
    function ce(a2, c2) {
      a2 = a2 | 0;
      c2 = c2 | 0;
      var d2 = 0, f2 = 0;
      if ((a2 | 0) < 1) {
        c2 = 1073741823;
        return c2 | 0;
      }
      d2 = (pe(a2) | 0) << 16 >> 16;
      c2 = 30 - d2 | 0;
      a2 = a2 << d2 >> (c2 & 1 ^ 1);
      d2 = (a2 >> 25 << 16) + -1048576 >> 16;
      f2 = b[7030 + (d2 << 1) >> 1] | 0;
      c2 = (f2 << 16) - (Z(f2 - (e[7030 + (d2 + 1 << 1) >> 1] | 0) << 16 >> 15, a2 >>> 10 & 32767) | 0) >> (c2 << 16 >> 17) + 1;
      return c2 | 0;
    }
    function de(a2, b2, c2, d2) {
      a2 = a2 | 0;
      b2 = b2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      d2 = pe(a2) | 0;
      ee(a2 << (d2 << 16 >> 16), d2, b2, c2);
      return;
    }
    function ee(a2, c2, d2, f2) {
      a2 = a2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      f2 = f2 | 0;
      if ((a2 | 0) < 1) {
        b[d2 >> 1] = 0;
        d2 = 0;
        b[f2 >> 1] = d2;
        return;
      } else {
        b[d2 >> 1] = 30 - (c2 & 65535);
        d2 = (a2 >> 25 << 16) + -2097152 >> 16;
        c2 = b[7128 + (d2 << 1) >> 1] | 0;
        d2 = ((c2 << 16) - (Z(a2 >>> 9 & 65534, c2 - (e[7128 + (d2 + 1 << 1) >> 1] | 0) << 16 >> 16) | 0) | 0) >>> 16 & 65535;
        b[f2 >> 1] = d2;
        return;
      }
    }
    function fe(a2, c2, d2) {
      a2 = a2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      var f2 = 0, g2 = 0;
      f2 = a2 + 2 | 0;
      d2 = b[f2 >> 1] | 0;
      b[c2 >> 1] = d2;
      g2 = a2 + 4 | 0;
      b[c2 + 2 >> 1] = (e[g2 >> 1] | 0) - (e[a2 >> 1] | 0);
      b[c2 + 4 >> 1] = (e[a2 + 6 >> 1] | 0) - (e[f2 >> 1] | 0);
      f2 = a2 + 8 | 0;
      b[c2 + 6 >> 1] = (e[f2 >> 1] | 0) - (e[g2 >> 1] | 0);
      b[c2 + 8 >> 1] = (e[a2 + 10 >> 1] | 0) - (e[a2 + 6 >> 1] | 0);
      g2 = a2 + 12 | 0;
      b[c2 + 10 >> 1] = (e[g2 >> 1] | 0) - (e[f2 >> 1] | 0);
      b[c2 + 12 >> 1] = (e[a2 + 14 >> 1] | 0) - (e[a2 + 10 >> 1] | 0);
      b[c2 + 14 >> 1] = (e[a2 + 16 >> 1] | 0) - (e[g2 >> 1] | 0);
      b[c2 + 16 >> 1] = (e[a2 + 18 >> 1] | 0) - (e[a2 + 14 >> 1] | 0);
      b[c2 + 18 >> 1] = 16384 - (e[a2 + 16 >> 1] | 0);
      a2 = 10;
      g2 = c2;
      while (1) {
        d2 = d2 << 16 >> 16;
        c2 = (d2 << 16) + -120782848 | 0;
        if ((c2 | 0) > 0)
          c2 = 1843 - ((c2 >> 16) * 12484 >> 16) | 0;
        else
          c2 = 3427 - ((d2 * 56320 | 0) >>> 16) | 0;
        f2 = g2 + 2 | 0;
        b[g2 >> 1] = c2 << 3;
        a2 = a2 + -1 << 16 >> 16;
        if (!(a2 << 16 >> 16))
          break;
        d2 = b[f2 >> 1] | 0;
        g2 = f2;
      }
      return;
    }
    function ge(a2, b2, c2) {
      a2 = a2 | 0;
      b2 = b2 | 0;
      c2 = c2 | 0;
      c2 = b2 << 16 >> 16;
      if (b2 << 16 >> 16 > 31) {
        b2 = 0;
        return b2 | 0;
      }
      if (b2 << 16 >> 16 > 0)
        return ((1 << c2 + -1 & a2 | 0) != 0 & 1) + (b2 << 16 >> 16 < 31 ? a2 >> c2 : 0) | 0;
      c2 = 0 - c2 << 16 >> 16;
      b2 = a2 << c2;
      b2 = (b2 >> c2 | 0) == (a2 | 0) ? b2 : a2 >> 31 ^ 2147483647;
      return b2 | 0;
    }
    function he(a2, d2, e2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      var f2 = 0, g2 = 0, h2 = 0, j2 = 0, k2 = 0, l2 = 0, m2 = 0, n2 = 0, o2 = 0, p2 = 0, q2 = 0, r2 = 0, s2 = 0, t2 = 0;
      s2 = i2;
      i2 = i2 + 48 | 0;
      q2 = s2 + 24 | 0;
      r2 = s2;
      o2 = q2 + 4 | 0;
      c[q2 >> 2] = 16777216;
      f2 = 0 - (b[a2 >> 1] | 0) | 0;
      p2 = q2 + 8 | 0;
      c[o2 >> 2] = f2 << 10;
      g2 = b[a2 + 4 >> 1] | 0;
      l2 = f2 >> 6;
      c[p2 >> 2] = 33554432 - (((Z((f2 << 9) - (l2 << 15) << 16 >> 16, g2) | 0) >> 15) + (Z(l2, g2) | 0) << 2);
      l2 = q2 + 4 | 0;
      g2 = (c[l2 >> 2] | 0) - (g2 << 10) | 0;
      c[l2 >> 2] = g2;
      l2 = q2 + 12 | 0;
      f2 = q2 + 4 | 0;
      c[l2 >> 2] = g2;
      e2 = b[a2 + 8 >> 1] | 0;
      h2 = g2;
      m2 = 1;
      while (1) {
        k2 = l2 + -4 | 0;
        j2 = c[k2 >> 2] | 0;
        n2 = j2 >> 16;
        c[l2 >> 2] = h2 + g2 - (((Z((j2 >>> 1) - (n2 << 15) << 16 >> 16, e2) | 0) >> 15) + (Z(n2, e2) | 0) << 2);
        if ((m2 | 0) == 2)
          break;
        h2 = c[l2 + -12 >> 2] | 0;
        l2 = k2;
        g2 = j2;
        m2 = m2 + 1 | 0;
      }
      c[f2 >> 2] = (c[f2 >> 2] | 0) - (e2 << 10);
      e2 = q2 + 16 | 0;
      f2 = c[q2 + 8 >> 2] | 0;
      c[e2 >> 2] = f2;
      k2 = b[a2 + 12 >> 1] | 0;
      g2 = f2;
      l2 = 1;
      while (1) {
        j2 = e2 + -4 | 0;
        h2 = c[j2 >> 2] | 0;
        n2 = h2 >> 16;
        c[e2 >> 2] = g2 + f2 - (((Z((h2 >>> 1) - (n2 << 15) << 16 >> 16, k2) | 0) >> 15) + (Z(n2, k2) | 0) << 2);
        if ((l2 | 0) == 3)
          break;
        g2 = c[e2 + -12 >> 2] | 0;
        e2 = j2;
        f2 = h2;
        l2 = l2 + 1 | 0;
      }
      e2 = q2 + 4 | 0;
      c[e2 >> 2] = (c[e2 >> 2] | 0) - (k2 << 10);
      e2 = q2 + 20 | 0;
      g2 = c[q2 + 12 >> 2] | 0;
      c[e2 >> 2] = g2;
      f2 = b[a2 + 16 >> 1] | 0;
      h2 = g2;
      l2 = 1;
      while (1) {
        k2 = e2 + -4 | 0;
        j2 = c[k2 >> 2] | 0;
        n2 = j2 >> 16;
        c[e2 >> 2] = h2 + g2 - (((Z((j2 >>> 1) - (n2 << 15) << 16 >> 16, f2) | 0) >> 15) + (Z(n2, f2) | 0) << 2);
        if ((l2 | 0) == 4)
          break;
        h2 = c[e2 + -12 >> 2] | 0;
        e2 = k2;
        g2 = j2;
        l2 = l2 + 1 | 0;
      }
      l2 = q2 + 4 | 0;
      c[l2 >> 2] = (c[l2 >> 2] | 0) - (f2 << 10);
      c[r2 >> 2] = 16777216;
      l2 = 0 - (b[a2 + 2 >> 1] | 0) | 0;
      n2 = r2 + 8 | 0;
      c[r2 + 4 >> 2] = l2 << 10;
      f2 = b[a2 + 6 >> 1] | 0;
      m2 = l2 >> 6;
      c[n2 >> 2] = 33554432 - (((Z((l2 << 9) - (m2 << 15) << 16 >> 16, f2) | 0) >> 15) + (Z(m2, f2) | 0) << 2);
      m2 = r2 + 4 | 0;
      f2 = (c[m2 >> 2] | 0) - (f2 << 10) | 0;
      c[m2 >> 2] = f2;
      m2 = r2 + 12 | 0;
      l2 = r2 + 4 | 0;
      c[m2 >> 2] = f2;
      k2 = b[a2 + 10 >> 1] | 0;
      g2 = f2;
      e2 = 1;
      while (1) {
        j2 = m2 + -4 | 0;
        h2 = c[j2 >> 2] | 0;
        t2 = h2 >> 16;
        c[m2 >> 2] = g2 + f2 - (((Z((h2 >>> 1) - (t2 << 15) << 16 >> 16, k2) | 0) >> 15) + (Z(t2, k2) | 0) << 2);
        if ((e2 | 0) == 2)
          break;
        g2 = c[m2 + -12 >> 2] | 0;
        m2 = j2;
        f2 = h2;
        e2 = e2 + 1 | 0;
      }
      c[l2 >> 2] = (c[l2 >> 2] | 0) - (k2 << 10);
      l2 = r2 + 16 | 0;
      f2 = c[r2 + 8 >> 2] | 0;
      c[l2 >> 2] = f2;
      k2 = b[a2 + 14 >> 1] | 0;
      g2 = f2;
      e2 = 1;
      while (1) {
        j2 = l2 + -4 | 0;
        h2 = c[j2 >> 2] | 0;
        t2 = h2 >> 16;
        c[l2 >> 2] = g2 + f2 - (((Z((h2 >>> 1) - (t2 << 15) << 16 >> 16, k2) | 0) >> 15) + (Z(t2, k2) | 0) << 2);
        if ((e2 | 0) == 3)
          break;
        g2 = c[l2 + -12 >> 2] | 0;
        l2 = j2;
        f2 = h2;
        e2 = e2 + 1 | 0;
      }
      e2 = r2 + 4 | 0;
      c[e2 >> 2] = (c[e2 >> 2] | 0) - (k2 << 10);
      e2 = r2 + 20 | 0;
      k2 = c[r2 + 12 >> 2] | 0;
      c[e2 >> 2] = k2;
      f2 = b[a2 + 18 >> 1] | 0;
      j2 = k2;
      l2 = 1;
      while (1) {
        g2 = e2 + -4 | 0;
        h2 = c[g2 >> 2] | 0;
        t2 = h2 >> 16;
        c[e2 >> 2] = j2 + k2 - (((Z((h2 >>> 1) - (t2 << 15) << 16 >> 16, f2) | 0) >> 15) + (Z(t2, f2) | 0) << 2);
        if ((l2 | 0) == 4)
          break;
        j2 = c[e2 + -12 >> 2] | 0;
        e2 = g2;
        k2 = h2;
        l2 = l2 + 1 | 0;
      }
      j2 = (c[r2 + 4 >> 2] | 0) - (f2 << 10) | 0;
      m2 = q2 + 20 | 0;
      k2 = r2 + 20 | 0;
      l2 = c[q2 + 16 >> 2] | 0;
      a2 = (c[m2 >> 2] | 0) + l2 | 0;
      c[m2 >> 2] = a2;
      m2 = c[r2 + 16 >> 2] | 0;
      t2 = (c[k2 >> 2] | 0) - m2 | 0;
      c[k2 >> 2] = t2;
      k2 = c[q2 + 12 >> 2] | 0;
      l2 = l2 + k2 | 0;
      c[q2 + 16 >> 2] = l2;
      h2 = c[r2 + 12 >> 2] | 0;
      m2 = m2 - h2 | 0;
      c[r2 + 16 >> 2] = m2;
      f2 = c[p2 >> 2] | 0;
      k2 = k2 + f2 | 0;
      c[q2 + 12 >> 2] = k2;
      g2 = c[n2 >> 2] | 0;
      p2 = h2 - g2 | 0;
      c[r2 + 12 >> 2] = p2;
      h2 = c[o2 >> 2] | 0;
      n2 = f2 + h2 | 0;
      c[q2 + 8 >> 2] = n2;
      o2 = g2 - j2 | 0;
      c[r2 + 8 >> 2] = o2;
      q2 = h2 + (c[q2 >> 2] | 0) | 0;
      r2 = j2 - (c[r2 >> 2] | 0) | 0;
      b[d2 >> 1] = 4096;
      q2 = q2 + 4096 | 0;
      b[d2 + 2 >> 1] = (q2 + r2 | 0) >>> 13;
      b[d2 + 20 >> 1] = (q2 - r2 | 0) >>> 13;
      r2 = n2 + 4096 | 0;
      b[d2 + 4 >> 1] = (r2 + o2 | 0) >>> 13;
      b[d2 + 18 >> 1] = (r2 - o2 | 0) >>> 13;
      r2 = k2 + 4096 | 0;
      b[d2 + 6 >> 1] = (r2 + p2 | 0) >>> 13;
      b[d2 + 16 >> 1] = (r2 - p2 | 0) >>> 13;
      r2 = l2 + 4096 | 0;
      b[d2 + 8 >> 1] = (r2 + m2 | 0) >>> 13;
      b[d2 + 14 >> 1] = (r2 - m2 | 0) >>> 13;
      r2 = a2 + 4096 | 0;
      b[d2 + 10 >> 1] = (r2 + t2 | 0) >>> 13;
      b[d2 + 12 >> 1] = (r2 - t2 | 0) >>> 13;
      i2 = s2;
      return;
    }
    function ie(a2) {
      a2 = a2 | 0;
      var d2 = 0, e2 = 0, f2 = 0, g2 = 0, h2 = 0;
      if (!a2) {
        h2 = -1;
        return h2 | 0;
      }
      c[a2 >> 2] = 0;
      d2 = Je(44) | 0;
      if (!d2) {
        h2 = -1;
        return h2 | 0;
      }
      e2 = d2 + 40 | 0;
      if ((xe(e2) | 0) << 16 >> 16) {
        h2 = -1;
        return h2 | 0;
      }
      f2 = d2;
      g2 = 7452;
      h2 = f2 + 20 | 0;
      do {
        b[f2 >> 1] = b[g2 >> 1] | 0;
        f2 = f2 + 2 | 0;
        g2 = g2 + 2 | 0;
      } while ((f2 | 0) < (h2 | 0));
      f2 = d2 + 20 | 0;
      g2 = 7452;
      h2 = f2 + 20 | 0;
      do {
        b[f2 >> 1] = b[g2 >> 1] | 0;
        f2 = f2 + 2 | 0;
        g2 = g2 + 2 | 0;
      } while ((f2 | 0) < (h2 | 0));
      ye(c[e2 >> 2] | 0) | 0;
      c[a2 >> 2] = d2;
      h2 = 0;
      return h2 | 0;
    }
    function je(a2) {
      a2 = a2 | 0;
      var d2 = 0, e2 = 0, f2 = 0;
      if (!a2) {
        f2 = -1;
        return f2 | 0;
      }
      d2 = a2;
      e2 = 7452;
      f2 = d2 + 20 | 0;
      do {
        b[d2 >> 1] = b[e2 >> 1] | 0;
        d2 = d2 + 2 | 0;
        e2 = e2 + 2 | 0;
      } while ((d2 | 0) < (f2 | 0));
      d2 = a2 + 20 | 0;
      e2 = 7452;
      f2 = d2 + 20 | 0;
      do {
        b[d2 >> 1] = b[e2 >> 1] | 0;
        d2 = d2 + 2 | 0;
        e2 = e2 + 2 | 0;
      } while ((d2 | 0) < (f2 | 0));
      ye(c[a2 + 40 >> 2] | 0) | 0;
      f2 = 0;
      return f2 | 0;
    }
    function ke(a2) {
      a2 = a2 | 0;
      var b2 = 0;
      if (!a2)
        return;
      b2 = c[a2 >> 2] | 0;
      if (!b2)
        return;
      ze(b2 + 40 | 0);
      Ke(c[a2 >> 2] | 0);
      c[a2 >> 2] = 0;
      return;
    }
    function le(a2, d2, e2, f2, g2, h2, j2, k2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      j2 = j2 | 0;
      k2 = k2 | 0;
      var l2 = 0, m2 = 0, n2 = 0, o2 = 0, p2 = 0;
      p2 = i2;
      i2 = i2 + 64 | 0;
      o2 = p2 + 44 | 0;
      l2 = p2 + 24 | 0;
      m2 = p2 + 4 | 0;
      n2 = p2;
      if ((d2 | 0) == 7) {
        Sd(f2 + 22 | 0, l2, a2, k2);
        Sd(f2 + 66 | 0, h2, l2, k2);
        $d(a2, l2, h2, f2, k2);
        if ((e2 | 0) == 8)
          f2 = 6;
        else {
          ve(c[a2 + 40 >> 2] | 0, l2, h2, m2, o2, c[j2 >> 2] | 0, k2);
          _d(a2 + 20 | 0, m2, o2, g2, k2);
          g2 = (c[j2 >> 2] | 0) + 10 | 0;
          f2 = 7;
        }
      } else {
        Sd(f2 + 66 | 0, h2, a2, k2);
        be(a2, h2, f2, k2);
        if ((e2 | 0) == 8)
          f2 = 6;
        else {
          te(c[a2 + 40 >> 2] | 0, d2, h2, o2, c[j2 >> 2] | 0, n2, k2);
          ae(a2 + 20 | 0, o2, g2, k2);
          g2 = (c[j2 >> 2] | 0) + 6 | 0;
          f2 = 7;
        }
      }
      if ((f2 | 0) == 6) {
        f2 = a2;
        g2 = f2 + 20 | 0;
        do {
          b[f2 >> 1] = b[h2 >> 1] | 0;
          f2 = f2 + 2 | 0;
          h2 = h2 + 2 | 0;
        } while ((f2 | 0) < (g2 | 0));
        i2 = p2;
        return;
      } else if ((f2 | 0) == 7) {
        c[j2 >> 2] = g2;
        f2 = a2;
        g2 = f2 + 20 | 0;
        do {
          b[f2 >> 1] = b[h2 >> 1] | 0;
          f2 = f2 + 2 | 0;
          h2 = h2 + 2 | 0;
        } while ((f2 | 0) < (g2 | 0));
        f2 = a2 + 20 | 0;
        h2 = o2;
        g2 = f2 + 20 | 0;
        do {
          b[f2 >> 1] = b[h2 >> 1] | 0;
          f2 = f2 + 2 | 0;
          h2 = h2 + 2 | 0;
        } while ((f2 | 0) < (g2 | 0));
        i2 = p2;
        return;
      }
    }
    function me(a2, c2, d2, e2) {
      a2 = a2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      var f2 = 0, g2 = 0, h2 = 0;
      if (d2 << 16 >> 16 > 0)
        e2 = 0;
      else
        return;
      do {
        g2 = b[a2 + (e2 << 1) >> 1] | 0;
        h2 = g2 >> 8;
        f2 = b[7194 + (h2 << 1) >> 1] | 0;
        b[c2 + (e2 << 1) >> 1] = ((Z((b[7194 + (h2 + 1 << 1) >> 1] | 0) - f2 | 0, g2 & 255) | 0) >>> 8) + f2;
        e2 = e2 + 1 | 0;
      } while ((e2 & 65535) << 16 >> 16 != d2 << 16 >> 16);
      return;
    }
    function ne(a2, c2, d2, e2) {
      a2 = a2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      var f2 = 0, g2 = 0, h2 = 0;
      e2 = (d2 << 16 >> 16) + -1 | 0;
      d2 = e2 & 65535;
      if (d2 << 16 >> 16 <= -1)
        return;
      f2 = 63;
      h2 = c2 + (e2 << 1) | 0;
      g2 = a2 + (e2 << 1) | 0;
      while (1) {
        a2 = b[g2 >> 1] | 0;
        c2 = f2;
        while (1) {
          e2 = c2 << 16 >> 16;
          f2 = b[7194 + (e2 << 1) >> 1] | 0;
          if (a2 << 16 >> 16 > f2 << 16 >> 16)
            c2 = c2 + -1 << 16 >> 16;
          else
            break;
        }
        b[h2 >> 1] = (((Z(b[7324 + (e2 << 1) >> 1] | 0, (a2 << 16 >> 16) - (f2 << 16 >> 16) | 0) | 0) + 2048 | 0) >>> 12) + (e2 << 8);
        d2 = d2 + -1 << 16 >> 16;
        if (d2 << 16 >> 16 > -1) {
          f2 = c2;
          h2 = h2 + -2 | 0;
          g2 = g2 + -2 | 0;
        } else
          break;
      }
      return;
    }
    function oe(a2, b2, d2) {
      a2 = a2 | 0;
      b2 = b2 | 0;
      d2 = d2 | 0;
      a2 = (Z(b2 << 16 >> 16, a2 << 16 >> 16) | 0) + 16384 >> 15;
      a2 = a2 | 0 - (a2 & 65536);
      if ((a2 | 0) <= 32767) {
        if ((a2 | 0) < -32768) {
          c[d2 >> 2] = 1;
          a2 = -32768;
        }
      } else {
        c[d2 >> 2] = 1;
        a2 = 32767;
      }
      return a2 & 65535 | 0;
    }
    function pe(a2) {
      a2 = a2 | 0;
      var b2 = 0;
      a:
        do
          if ((a2 | 0) != 0 ? (b2 = a2 - (a2 >>> 31) | 0, b2 = b2 >> 31 ^ b2, (b2 & 1073741824 | 0) == 0) : 0) {
            a2 = b2;
            b2 = 0;
            while (1) {
              if (a2 & 536870912) {
                a2 = 7;
                break;
              }
              if (a2 & 268435456) {
                a2 = 8;
                break;
              }
              if (a2 & 134217728) {
                a2 = 9;
                break;
              }
              b2 = b2 + 4 << 16 >> 16;
              a2 = a2 << 4;
              if (a2 & 1073741824)
                break a;
            }
            if ((a2 | 0) == 7) {
              b2 = b2 | 1;
              break;
            } else if ((a2 | 0) == 8) {
              b2 = b2 | 2;
              break;
            } else if ((a2 | 0) == 9) {
              b2 = b2 | 3;
              break;
            }
          } else
            b2 = 0;
        while (0);
      return b2 | 0;
    }
    function qe(a2) {
      a2 = a2 | 0;
      var b2 = 0, c2 = 0;
      if (!(a2 << 16 >> 16)) {
        c2 = 0;
        return c2 | 0;
      }
      b2 = (a2 & 65535) - ((a2 & 65535) >>> 15 & 65535) | 0;
      b2 = (b2 << 16 >> 31 ^ b2) << 16;
      a2 = b2 >> 16;
      if (!(a2 & 16384)) {
        c2 = b2;
        b2 = 0;
      } else {
        c2 = 0;
        return c2 | 0;
      }
      while (1) {
        if (a2 & 8192) {
          a2 = b2;
          c2 = 7;
          break;
        }
        if (a2 & 4096) {
          a2 = b2;
          c2 = 8;
          break;
        }
        if (a2 & 2048) {
          a2 = b2;
          c2 = 9;
          break;
        }
        b2 = b2 + 4 << 16 >> 16;
        c2 = c2 << 4;
        a2 = c2 >> 16;
        if (a2 & 16384) {
          a2 = b2;
          c2 = 10;
          break;
        }
      }
      if ((c2 | 0) == 7) {
        c2 = a2 | 1;
        return c2 | 0;
      } else if ((c2 | 0) == 8) {
        c2 = a2 | 2;
        return c2 | 0;
      } else if ((c2 | 0) == 9) {
        c2 = a2 | 3;
        return c2 | 0;
      } else if ((c2 | 0) == 10)
        return a2 | 0;
      return 0;
    }
    function re(a2, d2, f2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      f2 = f2 | 0;
      var g2 = 0, h2 = 0, i3 = 0;
      d2 = d2 << 16 >> 16;
      if ((d2 & 134217727 | 0) == 33554432) {
        c[f2 >> 2] = 1;
        d2 = 2147483647;
      } else
        d2 = d2 << 6;
      g2 = d2 >>> 16 & 31;
      i3 = b[7792 + (g2 << 1) >> 1] | 0;
      h2 = i3 << 16;
      d2 = Z(i3 - (e[7792 + (g2 + 1 << 1) >> 1] | 0) << 16 >> 16, d2 >>> 1 & 32767) | 0;
      if ((d2 | 0) == 1073741824) {
        c[f2 >> 2] = 1;
        g2 = 2147483647;
      } else
        g2 = d2 << 1;
      d2 = h2 - g2 | 0;
      if (((d2 ^ h2) & (g2 ^ h2) | 0) >= 0) {
        i3 = d2;
        a2 = a2 & 65535;
        a2 = 30 - a2 | 0;
        a2 = a2 & 65535;
        f2 = ge(i3, a2, f2) | 0;
        return f2 | 0;
      }
      c[f2 >> 2] = 1;
      i3 = (i3 >>> 15 & 1) + 2147483647 | 0;
      a2 = a2 & 65535;
      a2 = 30 - a2 | 0;
      a2 = a2 & 65535;
      f2 = ge(i3, a2, f2) | 0;
      return f2 | 0;
    }
    function se(a2, c2, d2, e2, f2, g2) {
      a2 = a2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      var h2 = 0, j2 = 0, k2 = 0, l2 = 0, m2 = 0, n2 = 0, o2 = 0, p2 = 0, q2 = 0, r2 = 0, s2 = 0;
      o2 = i2;
      i2 = i2 + 48 | 0;
      n2 = o2;
      m2 = 0 - (d2 & 65535) | 0;
      m2 = f2 << 16 >> 16 == 0 ? m2 : m2 << 1 & 131070;
      d2 = m2 & 65535;
      m2 = (d2 << 16 >> 16 < 0 ? m2 + 6 | 0 : m2) << 16 >> 16;
      g2 = 6 - m2 | 0;
      b[n2 >> 1] = b[7858 + (m2 << 1) >> 1] | 0;
      b[n2 + 2 >> 1] = b[7858 + (g2 << 1) >> 1] | 0;
      b[n2 + 4 >> 1] = b[7858 + (m2 + 6 << 1) >> 1] | 0;
      b[n2 + 6 >> 1] = b[7858 + (g2 + 6 << 1) >> 1] | 0;
      b[n2 + 8 >> 1] = b[7858 + (m2 + 12 << 1) >> 1] | 0;
      b[n2 + 10 >> 1] = b[7858 + (g2 + 12 << 1) >> 1] | 0;
      b[n2 + 12 >> 1] = b[7858 + (m2 + 18 << 1) >> 1] | 0;
      b[n2 + 14 >> 1] = b[7858 + (g2 + 18 << 1) >> 1] | 0;
      b[n2 + 16 >> 1] = b[7858 + (m2 + 24 << 1) >> 1] | 0;
      b[n2 + 18 >> 1] = b[7858 + (g2 + 24 << 1) >> 1] | 0;
      b[n2 + 20 >> 1] = b[7858 + (m2 + 30 << 1) >> 1] | 0;
      b[n2 + 22 >> 1] = b[7858 + (g2 + 30 << 1) >> 1] | 0;
      b[n2 + 24 >> 1] = b[7858 + (m2 + 36 << 1) >> 1] | 0;
      b[n2 + 26 >> 1] = b[7858 + (g2 + 36 << 1) >> 1] | 0;
      b[n2 + 28 >> 1] = b[7858 + (m2 + 42 << 1) >> 1] | 0;
      b[n2 + 30 >> 1] = b[7858 + (g2 + 42 << 1) >> 1] | 0;
      b[n2 + 32 >> 1] = b[7858 + (m2 + 48 << 1) >> 1] | 0;
      b[n2 + 34 >> 1] = b[7858 + (g2 + 48 << 1) >> 1] | 0;
      b[n2 + 36 >> 1] = b[7858 + (m2 + 54 << 1) >> 1] | 0;
      b[n2 + 38 >> 1] = b[7858 + (g2 + 54 << 1) >> 1] | 0;
      g2 = e2 << 16 >> 16 >>> 1 & 65535;
      if (!(g2 << 16 >> 16)) {
        i2 = o2;
        return;
      }
      m2 = a2 + ((d2 << 16 >> 16 >> 15 << 16 >> 16) - (c2 << 16 >> 16) << 1) | 0;
      while (1) {
        l2 = m2 + 2 | 0;
        h2 = b[l2 >> 1] | 0;
        c2 = h2;
        e2 = m2;
        j2 = 5;
        k2 = n2;
        f2 = 16384;
        d2 = 16384;
        while (1) {
          q2 = b[k2 >> 1] | 0;
          r2 = (Z(q2, c2 << 16 >> 16) | 0) + d2 | 0;
          p2 = b[l2 + -2 >> 1] | 0;
          d2 = (Z(p2, q2) | 0) + f2 | 0;
          q2 = e2;
          e2 = e2 + 4 | 0;
          s2 = b[k2 + 2 >> 1] | 0;
          d2 = d2 + (Z(s2, h2 << 16 >> 16) | 0) | 0;
          f2 = b[e2 >> 1] | 0;
          s2 = r2 + (Z(f2, s2) | 0) | 0;
          l2 = l2 + -4 | 0;
          r2 = b[k2 + 4 >> 1] | 0;
          p2 = s2 + (Z(r2, p2) | 0) | 0;
          c2 = b[l2 >> 1] | 0;
          r2 = d2 + (Z(c2 << 16 >> 16, r2) | 0) | 0;
          d2 = b[k2 + 6 >> 1] | 0;
          f2 = r2 + (Z(d2, f2) | 0) | 0;
          h2 = b[q2 + 6 >> 1] | 0;
          d2 = p2 + (Z(h2 << 16 >> 16, d2) | 0) | 0;
          if (j2 << 16 >> 16 <= 1)
            break;
          else {
            j2 = j2 + -1 << 16 >> 16;
            k2 = k2 + 8 | 0;
          }
        }
        b[a2 >> 1] = f2 >>> 15;
        b[a2 + 2 >> 1] = d2 >>> 15;
        g2 = g2 + -1 << 16 >> 16;
        if (!(g2 << 16 >> 16))
          break;
        else {
          m2 = m2 + 4 | 0;
          a2 = a2 + 4 | 0;
        }
      }
      i2 = o2;
      return;
    }
    function te(a2, c2, d2, f2, g2, h2, j2) {
      a2 = a2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      j2 = j2 | 0;
      var k2 = 0, l2 = 0, m2 = 0, n2 = 0, o2 = 0, p2 = 0, q2 = 0, r2 = 0, s2 = 0, t2 = 0, u2 = 0, v2 = 0, w2 = 0, x2 = 0, y2 = 0, z2 = 0, A2 = 0, B2 = 0, C2 = 0;
      C2 = i2;
      i2 = i2 + 144 | 0;
      t2 = C2 + 120 | 0;
      y2 = C2 + 100 | 0;
      A2 = C2 + 80 | 0;
      B2 = C2 + 60 | 0;
      z2 = C2 + 40 | 0;
      q2 = C2 + 20 | 0;
      r2 = C2;
      ne(d2, t2, 10, j2);
      fe(t2, y2, j2);
      if ((c2 | 0) == 8) {
        b[h2 >> 1] = 0;
        l2 = 2147483647;
        s2 = 0;
        while (1) {
          n2 = s2 * 10 | 0;
          d2 = 0;
          m2 = 0;
          do {
            x2 = (e[7980 + (m2 + n2 << 1) >> 1] | 0) + (e[8140 + (m2 << 1) >> 1] | 0) | 0;
            b[r2 + (m2 << 1) >> 1] = x2;
            x2 = (e[t2 + (m2 << 1) >> 1] | 0) - (x2 & 65535) | 0;
            b[q2 + (m2 << 1) >> 1] = x2;
            x2 = x2 << 16;
            d2 = (Z(x2 >> 15, x2 >> 16) | 0) + d2 | 0;
            m2 = m2 + 1 | 0;
          } while ((m2 | 0) != 10);
          if ((d2 | 0) < (l2 | 0)) {
            u2 = B2;
            p2 = q2;
            o2 = u2 + 20 | 0;
            do {
              b[u2 >> 1] = b[p2 >> 1] | 0;
              u2 = u2 + 2 | 0;
              p2 = p2 + 2 | 0;
            } while ((u2 | 0) < (o2 | 0));
            u2 = A2;
            p2 = r2;
            o2 = u2 + 20 | 0;
            do {
              b[u2 >> 1] = b[p2 >> 1] | 0;
              u2 = u2 + 2 | 0;
              p2 = p2 + 2 | 0;
            } while ((u2 | 0) < (o2 | 0));
            u2 = a2;
            p2 = 7980 + (n2 << 1) | 0;
            o2 = u2 + 20 | 0;
            do {
              b[u2 >> 1] = b[p2 >> 1] | 0;
              u2 = u2 + 2 | 0;
              p2 = p2 + 2 | 0;
            } while ((u2 | 0) < (o2 | 0));
            b[h2 >> 1] = s2;
          } else
            d2 = l2;
          s2 = s2 + 1 | 0;
          if ((s2 | 0) == 8)
            break;
          else
            l2 = d2;
        }
      } else {
        d2 = 0;
        do {
          x2 = Z(b[8160 + (d2 << 1) >> 1] | 0, b[a2 + (d2 << 1) >> 1] | 0) | 0;
          x2 = (x2 >>> 15) + (e[8140 + (d2 << 1) >> 1] | 0) | 0;
          b[A2 + (d2 << 1) >> 1] = x2;
          b[B2 + (d2 << 1) >> 1] = (e[t2 + (d2 << 1) >> 1] | 0) - x2;
          d2 = d2 + 1 | 0;
        } while ((d2 | 0) != 10);
      }
      do
        if (c2 >>> 0 >= 2) {
          x2 = B2 + 2 | 0;
          w2 = B2 + 4 | 0;
          v2 = e[B2 >> 1] | 0;
          u2 = b[y2 >> 1] << 1;
          t2 = e[x2 >> 1] | 0;
          q2 = b[y2 + 2 >> 1] << 1;
          p2 = e[w2 >> 1] | 0;
          o2 = b[y2 + 4 >> 1] << 1;
          if ((c2 | 0) == 5) {
            r2 = 2147483647;
            h2 = 0;
            d2 = 0;
            s2 = 17908;
            while (1) {
              m2 = (Z(v2 - (e[s2 >> 1] | 0) << 16 >> 16, u2) | 0) >> 16;
              m2 = Z(m2, m2) | 0;
              n2 = (Z(t2 - (e[s2 + 2 >> 1] | 0) << 16 >> 16, q2) | 0) >> 16;
              m2 = (Z(n2, n2) | 0) + m2 | 0;
              n2 = (Z(p2 - (e[s2 + 4 >> 1] | 0) << 16 >> 16, o2) | 0) >> 16;
              n2 = m2 + (Z(n2, n2) | 0) | 0;
              m2 = (n2 | 0) < (r2 | 0);
              d2 = m2 ? h2 : d2;
              h2 = h2 + 1 << 16 >> 16;
              if (h2 << 16 >> 16 >= 512)
                break;
              else {
                r2 = m2 ? n2 : r2;
                s2 = s2 + 6 | 0;
              }
            }
            n2 = (d2 << 16 >> 16) * 3 | 0;
            b[B2 >> 1] = b[17908 + (n2 << 1) >> 1] | 0;
            b[x2 >> 1] = b[17908 + (n2 + 1 << 1) >> 1] | 0;
            b[w2 >> 1] = b[17908 + (n2 + 2 << 1) >> 1] | 0;
            b[g2 >> 1] = d2;
            n2 = B2 + 6 | 0;
            m2 = B2 + 8 | 0;
            v2 = B2 + 10 | 0;
            s2 = e[n2 >> 1] | 0;
            h2 = b[y2 + 6 >> 1] << 1;
            r2 = e[m2 >> 1] | 0;
            q2 = b[y2 + 8 >> 1] << 1;
            p2 = e[v2 >> 1] | 0;
            o2 = b[y2 + 10 >> 1] << 1;
            k2 = 2147483647;
            t2 = 0;
            d2 = 0;
            u2 = 9716;
            while (1) {
              l2 = (Z(h2, s2 - (e[u2 >> 1] | 0) << 16 >> 16) | 0) >> 16;
              l2 = Z(l2, l2) | 0;
              c2 = (Z(q2, r2 - (e[u2 + 2 >> 1] | 0) << 16 >> 16) | 0) >> 16;
              l2 = (Z(c2, c2) | 0) + l2 | 0;
              c2 = (Z(o2, p2 - (e[u2 + 4 >> 1] | 0) << 16 >> 16) | 0) >> 16;
              c2 = l2 + (Z(c2, c2) | 0) | 0;
              l2 = (c2 | 0) < (k2 | 0);
              d2 = l2 ? t2 : d2;
              t2 = t2 + 1 << 16 >> 16;
              if (t2 << 16 >> 16 >= 512)
                break;
              else {
                k2 = l2 ? c2 : k2;
                u2 = u2 + 6 | 0;
              }
            }
            k2 = (d2 << 16 >> 16) * 3 | 0;
            b[n2 >> 1] = b[9716 + (k2 << 1) >> 1] | 0;
            b[m2 >> 1] = b[9716 + (k2 + 1 << 1) >> 1] | 0;
            b[v2 >> 1] = b[9716 + (k2 + 2 << 1) >> 1] | 0;
            b[g2 + 2 >> 1] = d2;
            k2 = B2 + 12 | 0;
            b[g2 + 4 >> 1] = ue(k2, 12788, y2 + 12 | 0, 512) | 0;
            t2 = x2;
            s2 = w2;
            d2 = v2;
            l2 = B2;
            break;
          } else {
            r2 = 2147483647;
            h2 = 0;
            d2 = 0;
            s2 = 8180;
            while (1) {
              m2 = (Z(v2 - (e[s2 >> 1] | 0) << 16 >> 16, u2) | 0) >> 16;
              m2 = Z(m2, m2) | 0;
              n2 = (Z(t2 - (e[s2 + 2 >> 1] | 0) << 16 >> 16, q2) | 0) >> 16;
              m2 = (Z(n2, n2) | 0) + m2 | 0;
              n2 = (Z(p2 - (e[s2 + 4 >> 1] | 0) << 16 >> 16, o2) | 0) >> 16;
              n2 = m2 + (Z(n2, n2) | 0) | 0;
              m2 = (n2 | 0) < (r2 | 0);
              d2 = m2 ? h2 : d2;
              h2 = h2 + 1 << 16 >> 16;
              if (h2 << 16 >> 16 >= 256)
                break;
              else {
                r2 = m2 ? n2 : r2;
                s2 = s2 + 6 | 0;
              }
            }
            n2 = (d2 << 16 >> 16) * 3 | 0;
            b[B2 >> 1] = b[8180 + (n2 << 1) >> 1] | 0;
            b[x2 >> 1] = b[8180 + (n2 + 1 << 1) >> 1] | 0;
            b[w2 >> 1] = b[8180 + (n2 + 2 << 1) >> 1] | 0;
            b[g2 >> 1] = d2;
            n2 = B2 + 6 | 0;
            m2 = B2 + 8 | 0;
            v2 = B2 + 10 | 0;
            s2 = e[n2 >> 1] | 0;
            h2 = b[y2 + 6 >> 1] << 1;
            r2 = e[m2 >> 1] | 0;
            q2 = b[y2 + 8 >> 1] << 1;
            p2 = e[v2 >> 1] | 0;
            o2 = b[y2 + 10 >> 1] << 1;
            k2 = 2147483647;
            t2 = 0;
            d2 = 0;
            u2 = 9716;
            while (1) {
              l2 = (Z(h2, s2 - (e[u2 >> 1] | 0) << 16 >> 16) | 0) >> 16;
              l2 = Z(l2, l2) | 0;
              c2 = (Z(q2, r2 - (e[u2 + 2 >> 1] | 0) << 16 >> 16) | 0) >> 16;
              l2 = (Z(c2, c2) | 0) + l2 | 0;
              c2 = (Z(o2, p2 - (e[u2 + 4 >> 1] | 0) << 16 >> 16) | 0) >> 16;
              c2 = l2 + (Z(c2, c2) | 0) | 0;
              l2 = (c2 | 0) < (k2 | 0);
              d2 = l2 ? t2 : d2;
              t2 = t2 + 1 << 16 >> 16;
              if (t2 << 16 >> 16 >= 512)
                break;
              else {
                k2 = l2 ? c2 : k2;
                u2 = u2 + 6 | 0;
              }
            }
            k2 = (d2 << 16 >> 16) * 3 | 0;
            b[n2 >> 1] = b[9716 + (k2 << 1) >> 1] | 0;
            b[m2 >> 1] = b[9716 + (k2 + 1 << 1) >> 1] | 0;
            b[v2 >> 1] = b[9716 + (k2 + 2 << 1) >> 1] | 0;
            b[g2 + 2 >> 1] = d2;
            k2 = B2 + 12 | 0;
            b[g2 + 4 >> 1] = ue(k2, 12788, y2 + 12 | 0, 512) | 0;
            t2 = x2;
            s2 = w2;
            d2 = v2;
            l2 = B2;
            break;
          }
        } else {
          w2 = B2 + 2 | 0;
          x2 = B2 + 4 | 0;
          n2 = e[B2 >> 1] | 0;
          m2 = b[y2 >> 1] << 1;
          l2 = e[w2 >> 1] | 0;
          k2 = b[y2 + 2 >> 1] << 1;
          c2 = e[x2 >> 1] | 0;
          o2 = b[y2 + 4 >> 1] << 1;
          r2 = 2147483647;
          h2 = 0;
          d2 = 0;
          s2 = 8180;
          while (1) {
            q2 = (Z(m2, n2 - (e[s2 >> 1] | 0) << 16 >> 16) | 0) >> 16;
            q2 = Z(q2, q2) | 0;
            p2 = (Z(k2, l2 - (e[s2 + 2 >> 1] | 0) << 16 >> 16) | 0) >> 16;
            q2 = (Z(p2, p2) | 0) + q2 | 0;
            p2 = (Z(o2, c2 - (e[s2 + 4 >> 1] | 0) << 16 >> 16) | 0) >> 16;
            p2 = q2 + (Z(p2, p2) | 0) | 0;
            q2 = (p2 | 0) < (r2 | 0);
            d2 = q2 ? h2 : d2;
            h2 = h2 + 1 << 16 >> 16;
            if (h2 << 16 >> 16 >= 256)
              break;
            else {
              r2 = q2 ? p2 : r2;
              s2 = s2 + 6 | 0;
            }
          }
          n2 = (d2 << 16 >> 16) * 3 | 0;
          b[B2 >> 1] = b[8180 + (n2 << 1) >> 1] | 0;
          b[w2 >> 1] = b[8180 + (n2 + 1 << 1) >> 1] | 0;
          b[x2 >> 1] = b[8180 + (n2 + 2 << 1) >> 1] | 0;
          b[g2 >> 1] = d2;
          n2 = B2 + 6 | 0;
          m2 = B2 + 8 | 0;
          v2 = B2 + 10 | 0;
          s2 = e[n2 >> 1] | 0;
          h2 = b[y2 + 6 >> 1] << 1;
          r2 = e[m2 >> 1] | 0;
          q2 = b[y2 + 8 >> 1] << 1;
          p2 = e[v2 >> 1] | 0;
          o2 = b[y2 + 10 >> 1] << 1;
          k2 = 2147483647;
          t2 = 0;
          d2 = 0;
          u2 = 9716;
          while (1) {
            l2 = (Z(h2, s2 - (e[u2 >> 1] | 0) << 16 >> 16) | 0) >> 16;
            l2 = Z(l2, l2) | 0;
            c2 = (Z(q2, r2 - (e[u2 + 2 >> 1] | 0) << 16 >> 16) | 0) >> 16;
            l2 = (Z(c2, c2) | 0) + l2 | 0;
            c2 = (Z(o2, p2 - (e[u2 + 4 >> 1] | 0) << 16 >> 16) | 0) >> 16;
            c2 = l2 + (Z(c2, c2) | 0) | 0;
            l2 = (c2 | 0) < (k2 | 0);
            d2 = l2 ? t2 : d2;
            t2 = t2 + 1 << 16 >> 16;
            if (t2 << 16 >> 16 >= 256)
              break;
            else {
              k2 = l2 ? c2 : k2;
              u2 = u2 + 12 | 0;
            }
          }
          k2 = (d2 << 16 >> 16) * 6 | 0;
          b[n2 >> 1] = b[9716 + (k2 << 1) >> 1] | 0;
          b[m2 >> 1] = b[9716 + ((k2 | 1) << 1) >> 1] | 0;
          b[v2 >> 1] = b[9716 + (k2 + 2 << 1) >> 1] | 0;
          b[g2 + 2 >> 1] = d2;
          k2 = B2 + 12 | 0;
          b[g2 + 4 >> 1] = ue(k2, 16884, y2 + 12 | 0, 128) | 0;
          t2 = w2;
          s2 = x2;
          d2 = v2;
          l2 = B2;
        }
      while (0);
      u2 = a2;
      p2 = B2;
      o2 = u2 + 20 | 0;
      do {
        b[u2 >> 1] = b[p2 >> 1] | 0;
        u2 = u2 + 2 | 0;
        p2 = p2 + 2 | 0;
      } while ((u2 | 0) < (o2 | 0));
      b[z2 >> 1] = (e[A2 >> 1] | 0) + (e[l2 >> 1] | 0);
      b[z2 + 2 >> 1] = (e[A2 + 2 >> 1] | 0) + (e[t2 >> 1] | 0);
      b[z2 + 4 >> 1] = (e[A2 + 4 >> 1] | 0) + (e[s2 >> 1] | 0);
      b[z2 + 6 >> 1] = (e[A2 + 6 >> 1] | 0) + (e[n2 >> 1] | 0);
      b[z2 + 8 >> 1] = (e[A2 + 8 >> 1] | 0) + (e[m2 >> 1] | 0);
      b[z2 + 10 >> 1] = (e[A2 + 10 >> 1] | 0) + (e[d2 >> 1] | 0);
      b[z2 + 12 >> 1] = (e[A2 + 12 >> 1] | 0) + (e[k2 >> 1] | 0);
      b[z2 + 14 >> 1] = (e[A2 + 14 >> 1] | 0) + (e[B2 + 14 >> 1] | 0);
      b[z2 + 16 >> 1] = (e[A2 + 16 >> 1] | 0) + (e[B2 + 16 >> 1] | 0);
      b[z2 + 18 >> 1] = (e[A2 + 18 >> 1] | 0) + (e[B2 + 18 >> 1] | 0);
      Ae(z2, 205, 10, j2);
      me(z2, f2, 10, j2);
      i2 = C2;
      return;
    }
    function ue(a2, c2, d2, f2) {
      a2 = a2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      f2 = f2 | 0;
      var g2 = 0, h2 = 0, i3 = 0, j2 = 0, k2 = 0, l2 = 0, m2 = 0, n2 = 0, o2 = 0, p2 = 0, q2 = 0, r2 = 0, s2 = 0, t2 = 0, u2 = 0, v2 = 0;
      t2 = a2 + 2 | 0;
      u2 = a2 + 4 | 0;
      v2 = a2 + 6 | 0;
      if (f2 << 16 >> 16 > 0) {
        m2 = e[a2 >> 1] | 0;
        n2 = b[d2 >> 1] << 1;
        o2 = e[t2 >> 1] | 0;
        p2 = b[d2 + 2 >> 1] << 1;
        q2 = e[u2 >> 1] | 0;
        r2 = b[d2 + 4 >> 1] << 1;
        s2 = e[v2 >> 1] | 0;
        g2 = b[d2 + 6 >> 1] << 1;
        j2 = 2147483647;
        k2 = 0;
        d2 = 0;
        l2 = c2;
        while (1) {
          h2 = (Z(n2, m2 - (e[l2 >> 1] | 0) << 16 >> 16) | 0) >> 16;
          h2 = Z(h2, h2) | 0;
          i3 = (Z(p2, o2 - (e[l2 + 2 >> 1] | 0) << 16 >> 16) | 0) >> 16;
          h2 = (Z(i3, i3) | 0) + h2 | 0;
          i3 = (Z(r2, q2 - (e[l2 + 4 >> 1] | 0) << 16 >> 16) | 0) >> 16;
          i3 = h2 + (Z(i3, i3) | 0) | 0;
          h2 = (Z(g2, s2 - (e[l2 + 6 >> 1] | 0) << 16 >> 16) | 0) >> 16;
          h2 = i3 + (Z(h2, h2) | 0) | 0;
          i3 = (h2 | 0) < (j2 | 0);
          d2 = i3 ? k2 : d2;
          k2 = k2 + 1 << 16 >> 16;
          if (k2 << 16 >> 16 >= f2 << 16 >> 16)
            break;
          else {
            j2 = i3 ? h2 : j2;
            l2 = l2 + 8 | 0;
          }
        }
      } else
        d2 = 0;
      f2 = d2 << 16 >> 16 << 2;
      s2 = f2 | 1;
      b[a2 >> 1] = b[c2 + (f2 << 1) >> 1] | 0;
      b[t2 >> 1] = b[c2 + (s2 << 1) >> 1] | 0;
      b[u2 >> 1] = b[c2 + (s2 + 1 << 1) >> 1] | 0;
      b[v2 >> 1] = b[c2 + ((f2 | 3) << 1) >> 1] | 0;
      return d2 | 0;
    }
    function ve(a2, c2, d2, f2, g2, h2, j2) {
      a2 = a2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      j2 = j2 | 0;
      var k2 = 0, l2 = 0, m2 = 0, n2 = 0, o2 = 0, p2 = 0, q2 = 0, r2 = 0, s2 = 0, t2 = 0, u2 = 0, v2 = 0, w2 = 0, x2 = 0, y2 = 0, z2 = 0, A2 = 0, B2 = 0, C2 = 0, D2 = 0, E2 = 0, F2 = 0, G2 = 0, H2 = 0, I2 = 0, J2 = 0, K2 = 0;
      I2 = i2;
      i2 = i2 + 192 | 0;
      m2 = I2 + 160 | 0;
      l2 = I2 + 140 | 0;
      C2 = I2 + 120 | 0;
      D2 = I2 + 100 | 0;
      E2 = I2 + 80 | 0;
      F2 = I2 + 60 | 0;
      k2 = I2 + 40 | 0;
      G2 = I2 + 20 | 0;
      H2 = I2;
      ne(c2, m2, 10, j2);
      ne(d2, l2, 10, j2);
      fe(m2, C2, j2);
      fe(l2, D2, j2);
      n2 = 0;
      d2 = E2;
      c2 = F2;
      o2 = k2;
      while (1) {
        B2 = (((b[a2 + (n2 << 1) >> 1] | 0) * 21299 | 0) >>> 15) + (e[20980 + (n2 << 1) >> 1] | 0) | 0;
        b[d2 >> 1] = B2;
        b[c2 >> 1] = (e[m2 >> 1] | 0) - B2;
        b[o2 >> 1] = (e[l2 >> 1] | 0) - B2;
        n2 = n2 + 1 | 0;
        if ((n2 | 0) == 10)
          break;
        else {
          m2 = m2 + 2 | 0;
          l2 = l2 + 2 | 0;
          d2 = d2 + 2 | 0;
          c2 = c2 + 2 | 0;
          o2 = o2 + 2 | 0;
        }
      }
      b[h2 >> 1] = we(F2, k2, 21e3, b[C2 >> 1] | 0, b[C2 + 2 >> 1] | 0, b[D2 >> 1] | 0, b[D2 + 2 >> 1] | 0, 128) | 0;
      b[h2 + 2 >> 1] = we(F2 + 4 | 0, k2 + 4 | 0, 22024, b[C2 + 4 >> 1] | 0, b[C2 + 6 >> 1] | 0, b[D2 + 4 >> 1] | 0, b[D2 + 6 >> 1] | 0, 256) | 0;
      y2 = F2 + 8 | 0;
      z2 = k2 + 8 | 0;
      A2 = F2 + 10 | 0;
      B2 = k2 + 10 | 0;
      d2 = b[y2 >> 1] | 0;
      p2 = b[C2 + 8 >> 1] << 1;
      q2 = b[A2 >> 1] | 0;
      r2 = b[C2 + 10 >> 1] << 1;
      s2 = b[z2 >> 1] | 0;
      t2 = b[D2 + 8 >> 1] << 1;
      u2 = b[B2 >> 1] | 0;
      v2 = b[D2 + 10 >> 1] << 1;
      l2 = 2147483647;
      w2 = 0;
      o2 = 0;
      x2 = 24072;
      c2 = 0;
      while (1) {
        m2 = b[x2 >> 1] | 0;
        n2 = (Z(d2 - m2 << 16 >> 16, p2) | 0) >> 16;
        n2 = Z(n2, n2) | 0;
        m2 = (Z(m2 + d2 << 16 >> 16, p2) | 0) >> 16;
        m2 = Z(m2, m2) | 0;
        J2 = b[x2 + 2 >> 1] | 0;
        K2 = (Z(q2 - J2 << 16 >> 16, r2) | 0) >> 16;
        n2 = (Z(K2, K2) | 0) + n2 | 0;
        J2 = (Z(J2 + q2 << 16 >> 16, r2) | 0) >> 16;
        m2 = (Z(J2, J2) | 0) + m2 | 0;
        if ((n2 | 0) < (l2 | 0) | (m2 | 0) < (l2 | 0)) {
          K2 = b[x2 + 4 >> 1] | 0;
          J2 = (Z(s2 - K2 << 16 >> 16, t2) | 0) >> 16;
          J2 = (Z(J2, J2) | 0) + n2 | 0;
          K2 = (Z(K2 + s2 << 16 >> 16, t2) | 0) >> 16;
          K2 = (Z(K2, K2) | 0) + m2 | 0;
          m2 = b[x2 + 6 >> 1] | 0;
          n2 = (Z(u2 - m2 << 16 >> 16, v2) | 0) >> 16;
          n2 = J2 + (Z(n2, n2) | 0) | 0;
          m2 = (Z(m2 + u2 << 16 >> 16, v2) | 0) >> 16;
          m2 = K2 + (Z(m2, m2) | 0) | 0;
          K2 = (n2 | 0) < (l2 | 0);
          n2 = K2 ? n2 : l2;
          J2 = (m2 | 0) < (n2 | 0);
          n2 = J2 ? m2 : n2;
          o2 = K2 | J2 ? w2 : o2;
          c2 = J2 ? 1 : K2 ? 0 : c2;
        } else
          n2 = l2;
        w2 = w2 + 1 << 16 >> 16;
        if (w2 << 16 >> 16 >= 256)
          break;
        else {
          l2 = n2;
          x2 = x2 + 8 | 0;
        }
      }
      n2 = o2 << 16 >> 16;
      m2 = n2 << 2;
      o2 = m2 | 1;
      l2 = 24072 + (o2 << 1) | 0;
      d2 = b[24072 + (m2 << 1) >> 1] | 0;
      if (!(c2 << 16 >> 16)) {
        b[y2 >> 1] = d2;
        b[A2 >> 1] = b[l2 >> 1] | 0;
        b[z2 >> 1] = b[24072 + (o2 + 1 << 1) >> 1] | 0;
        b[B2 >> 1] = b[24072 + ((m2 | 3) << 1) >> 1] | 0;
        c2 = n2 << 1;
      } else {
        b[y2 >> 1] = 0 - (d2 & 65535);
        b[A2 >> 1] = 0 - (e[l2 >> 1] | 0);
        b[z2 >> 1] = 0 - (e[24072 + (o2 + 1 << 1) >> 1] | 0);
        b[B2 >> 1] = 0 - (e[24072 + ((m2 | 3) << 1) >> 1] | 0);
        c2 = n2 << 1 & 65534 | 1;
      }
      b[h2 + 4 >> 1] = c2;
      b[h2 + 6 >> 1] = we(F2 + 12 | 0, k2 + 12 | 0, 26120, b[C2 + 12 >> 1] | 0, b[C2 + 14 >> 1] | 0, b[D2 + 12 >> 1] | 0, b[D2 + 14 >> 1] | 0, 256) | 0;
      b[h2 + 8 >> 1] = we(F2 + 16 | 0, k2 + 16 | 0, 28168, b[C2 + 16 >> 1] | 0, b[C2 + 18 >> 1] | 0, b[D2 + 16 >> 1] | 0, b[D2 + 18 >> 1] | 0, 64) | 0;
      l2 = 0;
      m2 = G2;
      n2 = H2;
      d2 = E2;
      c2 = F2;
      while (1) {
        J2 = e[d2 >> 1] | 0;
        b[m2 >> 1] = J2 + (e[c2 >> 1] | 0);
        K2 = b[k2 >> 1] | 0;
        b[n2 >> 1] = J2 + (K2 & 65535);
        b[a2 + (l2 << 1) >> 1] = K2;
        l2 = l2 + 1 | 0;
        if ((l2 | 0) == 10)
          break;
        else {
          m2 = m2 + 2 | 0;
          n2 = n2 + 2 | 0;
          d2 = d2 + 2 | 0;
          c2 = c2 + 2 | 0;
          k2 = k2 + 2 | 0;
        }
      }
      Ae(G2, 205, 10, j2);
      Ae(H2, 205, 10, j2);
      me(G2, f2, 10, j2);
      me(H2, g2, 10, j2);
      i2 = I2;
      return;
    }
    function we(a2, c2, d2, e2, f2, g2, h2, i3) {
      a2 = a2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h2 = h2 | 0;
      i3 = i3 | 0;
      var j2 = 0, k2 = 0, l2 = 0, m2 = 0, n2 = 0, o2 = 0, p2 = 0, q2 = 0, r2 = 0, s2 = 0, t2 = 0, u2 = 0, v2 = 0, w2 = 0;
      o2 = b[a2 >> 1] | 0;
      u2 = a2 + 2 | 0;
      q2 = b[u2 >> 1] | 0;
      s2 = b[c2 >> 1] | 0;
      v2 = c2 + 2 | 0;
      t2 = b[v2 >> 1] | 0;
      if (i3 << 16 >> 16 > 0) {
        n2 = e2 << 16 >> 16 << 1;
        m2 = f2 << 16 >> 16 << 1;
        l2 = g2 << 16 >> 16 << 1;
        f2 = h2 << 16 >> 16 << 1;
        g2 = 2147483647;
        j2 = 0;
        e2 = 0;
        k2 = d2;
        while (1) {
          h2 = (Z(n2, o2 - (b[k2 >> 1] | 0) | 0) | 0) >> 16;
          h2 = Z(h2, h2) | 0;
          if (((h2 | 0) < (g2 | 0) ? (p2 = (Z(m2, q2 - (b[k2 + 2 >> 1] | 0) | 0) | 0) >> 16, p2 = (Z(p2, p2) | 0) + h2 | 0, (p2 | 0) < (g2 | 0)) : 0) ? (r2 = (Z(l2, s2 - (b[k2 + 4 >> 1] | 0) | 0) | 0) >> 16, r2 = (Z(r2, r2) | 0) + p2 | 0, (r2 | 0) < (g2 | 0)) : 0) {
            h2 = (Z(f2, t2 - (b[k2 + 6 >> 1] | 0) | 0) | 0) >> 16;
            h2 = (Z(h2, h2) | 0) + r2 | 0;
            w2 = (h2 | 0) < (g2 | 0);
            h2 = w2 ? h2 : g2;
            e2 = w2 ? j2 : e2;
          } else
            h2 = g2;
          j2 = j2 + 1 << 16 >> 16;
          if (j2 << 16 >> 16 >= i3 << 16 >> 16)
            break;
          else {
            g2 = h2;
            k2 = k2 + 8 | 0;
          }
        }
      } else
        e2 = 0;
      w2 = e2 << 16 >> 16 << 2;
      i3 = w2 | 1;
      b[a2 >> 1] = b[d2 + (w2 << 1) >> 1] | 0;
      b[u2 >> 1] = b[d2 + (i3 << 1) >> 1] | 0;
      b[c2 >> 1] = b[d2 + (i3 + 1 << 1) >> 1] | 0;
      b[v2 >> 1] = b[d2 + ((w2 | 3) << 1) >> 1] | 0;
      return e2 | 0;
    }
    function xe(a2) {
      a2 = a2 | 0;
      var d2 = 0, e2 = 0, f2 = 0;
      if (!a2) {
        f2 = -1;
        return f2 | 0;
      }
      c[a2 >> 2] = 0;
      d2 = Je(20) | 0;
      if (!d2) {
        f2 = -1;
        return f2 | 0;
      }
      e2 = d2;
      f2 = e2 + 20 | 0;
      do {
        b[e2 >> 1] = 0;
        e2 = e2 + 2 | 0;
      } while ((e2 | 0) < (f2 | 0));
      c[a2 >> 2] = d2;
      f2 = 0;
      return f2 | 0;
    }
    function ye(a2) {
      a2 = a2 | 0;
      var c2 = 0;
      if (!a2) {
        c2 = -1;
        return c2 | 0;
      }
      c2 = a2 + 20 | 0;
      do {
        b[a2 >> 1] = 0;
        a2 = a2 + 2 | 0;
      } while ((a2 | 0) < (c2 | 0));
      c2 = 0;
      return c2 | 0;
    }
    function ze(a2) {
      a2 = a2 | 0;
      var b2 = 0;
      if (!a2)
        return;
      b2 = c[a2 >> 2] | 0;
      if (!b2)
        return;
      Ke(b2);
      c[a2 >> 2] = 0;
      return;
    }
    function Ae(a2, c2, d2, e2) {
      a2 = a2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      var f2 = 0, g2 = 0, h2 = 0;
      if (d2 << 16 >> 16 <= 0)
        return;
      f2 = c2 << 16 >> 16;
      g2 = c2 & 65535;
      h2 = 0;
      while (1) {
        e2 = b[a2 >> 1] | 0;
        if (e2 << 16 >> 16 < c2 << 16 >> 16) {
          b[a2 >> 1] = c2;
          e2 = (c2 << 16 >> 16) + f2 | 0;
        } else
          e2 = (e2 & 65535) + g2 | 0;
        h2 = h2 + 1 << 16 >> 16;
        if (h2 << 16 >> 16 >= d2 << 16 >> 16)
          break;
        else {
          c2 = e2 & 65535;
          a2 = a2 + 2 | 0;
        }
      }
      return;
    }
    function Be(a2, c2, d2, e2) {
      a2 = a2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      var f2 = 0, g2 = 0, h2 = 0, i3 = 0, j2 = 0, k2 = 0, l2 = 0, m2 = 0, n2 = 0, o2 = 0, p2 = 0, q2 = 0, r2 = 0, s2 = 0, t2 = 0;
      f2 = e2 << 16 >> 16;
      e2 = f2 >>> 2 & 65535;
      if (!(e2 << 16 >> 16))
        return;
      n2 = f2 + -1 | 0;
      t2 = a2 + 20 | 0;
      p2 = c2 + (f2 + -4 << 1) | 0;
      q2 = c2 + (f2 + -3 << 1) | 0;
      r2 = c2 + (f2 + -2 << 1) | 0;
      s2 = c2 + (n2 << 1) | 0;
      o2 = c2 + (f2 + -11 << 1) | 0;
      n2 = d2 + (n2 << 1) | 0;
      while (1) {
        c2 = b[t2 >> 1] | 0;
        h2 = 5;
        i3 = t2;
        j2 = o2;
        k2 = o2 + -2 | 0;
        l2 = o2 + -4 | 0;
        m2 = o2 + -6 | 0;
        g2 = 2048;
        a2 = 2048;
        f2 = 2048;
        d2 = 2048;
        while (1) {
          g2 = (Z(b[j2 >> 1] | 0, c2) | 0) + g2 | 0;
          a2 = (Z(b[k2 >> 1] | 0, c2) | 0) + a2 | 0;
          f2 = (Z(b[l2 >> 1] | 0, c2) | 0) + f2 | 0;
          c2 = (Z(b[m2 >> 1] | 0, c2) | 0) + d2 | 0;
          d2 = b[i3 + -2 >> 1] | 0;
          g2 = g2 + (Z(b[j2 + 2 >> 1] | 0, d2) | 0) | 0;
          a2 = a2 + (Z(b[k2 + 2 >> 1] | 0, d2) | 0) | 0;
          f2 = f2 + (Z(b[l2 + 2 >> 1] | 0, d2) | 0) | 0;
          i3 = i3 + -4 | 0;
          d2 = c2 + (Z(b[m2 + 2 >> 1] | 0, d2) | 0) | 0;
          h2 = h2 + -1 << 16 >> 16;
          c2 = b[i3 >> 1] | 0;
          if (!(h2 << 16 >> 16))
            break;
          else {
            j2 = j2 + 4 | 0;
            k2 = k2 + 4 | 0;
            l2 = l2 + 4 | 0;
            m2 = m2 + 4 | 0;
          }
        }
        j2 = (Z(b[s2 >> 1] | 0, c2) | 0) + g2 | 0;
        k2 = (Z(b[r2 >> 1] | 0, c2) | 0) + a2 | 0;
        l2 = (Z(b[q2 >> 1] | 0, c2) | 0) + f2 | 0;
        m2 = (Z(b[p2 >> 1] | 0, c2) | 0) + d2 | 0;
        b[n2 >> 1] = j2 >>> 12;
        b[n2 + -2 >> 1] = k2 >>> 12;
        b[n2 + -4 >> 1] = l2 >>> 12;
        b[n2 + -6 >> 1] = m2 >>> 12;
        e2 = e2 + -1 << 16 >> 16;
        if (!(e2 << 16 >> 16))
          break;
        else {
          p2 = p2 + -8 | 0;
          q2 = q2 + -8 | 0;
          r2 = r2 + -8 | 0;
          s2 = s2 + -8 | 0;
          o2 = o2 + -8 | 0;
          n2 = n2 + -8 | 0;
        }
      }
      return;
    }
    function Ce(a2, b2) {
      a2 = a2 | 0;
      b2 = b2 | 0;
      var d2 = 0;
      d2 = a2 + 32768 | 0;
      if ((a2 | 0) > -1 & (d2 ^ a2 | 0) < 0) {
        c[b2 >> 2] = 1;
        d2 = (a2 >>> 31) + 2147483647 | 0;
      }
      return d2 >>> 16 & 65535 | 0;
    }
    function De(a2, b2, d2) {
      a2 = a2 | 0;
      b2 = b2 | 0;
      d2 = d2 | 0;
      var e2 = 0, f2 = 0;
      e2 = b2 << 16 >> 16;
      if (!(b2 << 16 >> 16))
        return a2 | 0;
      if (b2 << 16 >> 16 > 0) {
        a2 = a2 << 16 >> 16 >> (b2 << 16 >> 16 > 15 ? 15 : e2) & 65535;
        return a2 | 0;
      }
      f2 = 0 - e2 | 0;
      b2 = a2 << 16 >> 16;
      f2 = (f2 & 65535) << 16 >> 16 > 15 ? 15 : f2 << 16 >> 16;
      e2 = b2 << f2;
      if ((e2 << 16 >> 16 >> f2 | 0) == (b2 | 0)) {
        f2 = e2 & 65535;
        return f2 | 0;
      }
      c[d2 >> 2] = 1;
      f2 = a2 << 16 >> 16 > 0 ? 32767 : -32768;
      return f2 | 0;
    }
    function Ee(a2, b2, c2) {
      a2 = a2 | 0;
      b2 = b2 | 0;
      c2 = c2 | 0;
      if (b2 << 16 >> 16 > 15) {
        b2 = 0;
        return b2 | 0;
      }
      c2 = De(a2, b2, c2) | 0;
      if (b2 << 16 >> 16 > 0)
        return c2 + ((1 << (b2 << 16 >> 16) + -1 & a2 << 16 >> 16 | 0) != 0 & 1) << 16 >> 16 | 0;
      else {
        b2 = c2;
        return b2 | 0;
      }
    }
    function Fe(a2, d2, f2) {
      a2 = a2 | 0;
      d2 = d2 | 0;
      f2 = f2 | 0;
      var g2 = 0, h2 = 0, i3 = 0;
      if ((a2 | 0) < 1) {
        b[d2 >> 1] = 0;
        f2 = 0;
        return f2 | 0;
      }
      h2 = (pe(a2) | 0) & 65534;
      i3 = h2 & 65535;
      h2 = h2 << 16 >> 16;
      if (i3 << 16 >> 16 > 0) {
        g2 = a2 << h2;
        if ((g2 >> h2 | 0) != (a2 | 0))
          g2 = a2 >> 31 ^ 2147483647;
      } else {
        h2 = 0 - h2 << 16;
        if ((h2 | 0) < 2031616)
          g2 = a2 >> (h2 >> 16);
        else
          g2 = 0;
      }
      b[d2 >> 1] = i3;
      d2 = g2 >>> 25 & 63;
      d2 = d2 >>> 0 > 15 ? d2 + -16 | 0 : d2;
      i3 = b[30216 + (d2 << 1) >> 1] | 0;
      a2 = i3 << 16;
      g2 = Z(i3 - (e[30216 + (d2 + 1 << 1) >> 1] | 0) << 16 >> 16, g2 >>> 10 & 32767) | 0;
      if ((g2 | 0) == 1073741824) {
        c[f2 >> 2] = 1;
        h2 = 2147483647;
      } else
        h2 = g2 << 1;
      g2 = a2 - h2 | 0;
      if (((g2 ^ a2) & (h2 ^ a2) | 0) >= 0) {
        f2 = g2;
        return f2 | 0;
      }
      c[f2 >> 2] = 1;
      f2 = (i3 >>> 15 & 1) + 2147483647 | 0;
      return f2 | 0;
    }
    function Ge(a2, b2, d2) {
      a2 = a2 | 0;
      b2 = b2 | 0;
      d2 = d2 | 0;
      a2 = (a2 << 16 >> 16) - (b2 << 16 >> 16) | 0;
      if ((a2 + 32768 | 0) >>> 0 <= 65535) {
        d2 = a2;
        d2 = d2 & 65535;
        return d2 | 0;
      }
      c[d2 >> 2] = 1;
      d2 = (a2 | 0) > 32767 ? 32767 : -32768;
      d2 = d2 & 65535;
      return d2 | 0;
    }
    function He(a2, c2, d2, e2, f2, g2) {
      a2 = a2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      var h2 = 0, j2 = 0, k2 = 0, l2 = 0, m2 = 0, n2 = 0, o2 = 0, p2 = 0, q2 = 0, r2 = 0, s2 = 0, t2 = 0, u2 = 0, v2 = 0, w2 = 0, x2 = 0, y2 = 0, z2 = 0, A2 = 0, B2 = 0, C2 = 0, D2 = 0;
      A2 = i2;
      i2 = i2 + 48 | 0;
      o2 = A2;
      k2 = o2;
      h2 = f2;
      j2 = k2 + 20 | 0;
      do {
        b[k2 >> 1] = b[h2 >> 1] | 0;
        k2 = k2 + 2 | 0;
        h2 = h2 + 2 | 0;
      } while ((k2 | 0) < (j2 | 0));
      n2 = o2 + 18 | 0;
      s2 = a2 + 2 | 0;
      t2 = a2 + 4 | 0;
      p2 = c2 + 20 | 0;
      u2 = a2 + 6 | 0;
      v2 = a2 + 8 | 0;
      w2 = a2 + 10 | 0;
      x2 = a2 + 12 | 0;
      y2 = a2 + 14 | 0;
      z2 = a2 + 16 | 0;
      q2 = a2 + 18 | 0;
      r2 = a2 + 20 | 0;
      j2 = b[n2 >> 1] | 0;
      h2 = 5;
      l2 = c2;
      m2 = d2;
      k2 = o2 + 20 | 0;
      while (1) {
        D2 = b[a2 >> 1] | 0;
        C2 = (Z(D2, b[l2 >> 1] | 0) | 0) + 2048 | 0;
        D2 = (Z(b[l2 + 2 >> 1] | 0, D2) | 0) + 2048 | 0;
        o2 = j2 << 16 >> 16;
        C2 = C2 - (Z(o2, b[s2 >> 1] | 0) | 0) | 0;
        B2 = b[t2 >> 1] | 0;
        o2 = D2 - (Z(o2, B2) | 0) | 0;
        D2 = b[n2 + -2 >> 1] | 0;
        B2 = C2 - (Z(D2, B2) | 0) | 0;
        C2 = b[u2 >> 1] | 0;
        D2 = o2 - (Z(C2, D2) | 0) | 0;
        o2 = b[n2 + -4 >> 1] | 0;
        C2 = B2 - (Z(o2, C2) | 0) | 0;
        B2 = b[v2 >> 1] | 0;
        o2 = D2 - (Z(B2, o2) | 0) | 0;
        D2 = b[n2 + -6 >> 1] | 0;
        B2 = C2 - (Z(D2, B2) | 0) | 0;
        C2 = b[w2 >> 1] | 0;
        D2 = o2 - (Z(D2, C2) | 0) | 0;
        o2 = b[n2 + -8 >> 1] | 0;
        C2 = B2 - (Z(o2, C2) | 0) | 0;
        B2 = b[x2 >> 1] | 0;
        o2 = D2 - (Z(B2, o2) | 0) | 0;
        D2 = b[n2 + -10 >> 1] | 0;
        B2 = C2 - (Z(D2, B2) | 0) | 0;
        C2 = b[y2 >> 1] | 0;
        D2 = o2 - (Z(C2, D2) | 0) | 0;
        o2 = b[n2 + -12 >> 1] | 0;
        C2 = B2 - (Z(o2, C2) | 0) | 0;
        B2 = b[z2 >> 1] | 0;
        o2 = D2 - (Z(o2, B2) | 0) | 0;
        D2 = b[n2 + -14 >> 1] | 0;
        B2 = C2 - (Z(D2, B2) | 0) | 0;
        C2 = b[q2 >> 1] | 0;
        D2 = o2 - (Z(C2, D2) | 0) | 0;
        o2 = b[n2 + -16 >> 1] | 0;
        C2 = B2 - (Z(o2, C2) | 0) | 0;
        B2 = b[r2 >> 1] | 0;
        o2 = D2 - (Z(B2, o2) | 0) | 0;
        B2 = C2 - (Z(b[n2 + -18 >> 1] | 0, B2) | 0) | 0;
        B2 = (B2 + 134217728 | 0) >>> 0 < 268435455 ? B2 >>> 12 & 65535 : (B2 | 0) > 134217727 ? 32767 : -32768;
        o2 = o2 - (Z(b[s2 >> 1] | 0, B2 << 16 >> 16) | 0) | 0;
        n2 = k2 + 2 | 0;
        b[k2 >> 1] = B2;
        b[m2 >> 1] = B2;
        j2 = (o2 + 134217728 | 0) >>> 0 < 268435455 ? o2 >>> 12 & 65535 : (o2 | 0) > 134217727 ? 32767 : -32768;
        b[n2 >> 1] = j2;
        b[m2 + 2 >> 1] = j2;
        h2 = h2 + -1 << 16 >> 16;
        if (!(h2 << 16 >> 16))
          break;
        else {
          l2 = l2 + 4 | 0;
          m2 = m2 + 4 | 0;
          k2 = k2 + 4 | 0;
        }
      }
      e2 = (e2 << 16 >> 16) + -10 | 0;
      k2 = e2 >>> 1 & 65535;
      if (k2 << 16 >> 16) {
        o2 = d2 + 18 | 0;
        j2 = c2 + 16 | 0;
        n2 = b[o2 >> 1] | 0;
        l2 = p2;
        h2 = d2 + 20 | 0;
        while (1) {
          B2 = b[a2 >> 1] | 0;
          m2 = (Z(B2, b[l2 >> 1] | 0) | 0) + 2048 | 0;
          B2 = (Z(b[j2 + 6 >> 1] | 0, B2) | 0) + 2048 | 0;
          j2 = b[s2 >> 1] | 0;
          C2 = n2 << 16 >> 16;
          m2 = m2 - (Z(C2, j2) | 0) | 0;
          D2 = b[t2 >> 1] | 0;
          C2 = B2 - (Z(C2, D2) | 0) | 0;
          B2 = b[o2 + -2 >> 1] | 0;
          D2 = m2 - (Z(B2, D2) | 0) | 0;
          m2 = b[u2 >> 1] | 0;
          B2 = C2 - (Z(m2, B2) | 0) | 0;
          C2 = b[o2 + -4 >> 1] | 0;
          m2 = D2 - (Z(C2, m2) | 0) | 0;
          D2 = b[v2 >> 1] | 0;
          C2 = B2 - (Z(D2, C2) | 0) | 0;
          B2 = b[o2 + -6 >> 1] | 0;
          D2 = m2 - (Z(B2, D2) | 0) | 0;
          m2 = b[w2 >> 1] | 0;
          B2 = C2 - (Z(B2, m2) | 0) | 0;
          C2 = b[o2 + -8 >> 1] | 0;
          m2 = D2 - (Z(C2, m2) | 0) | 0;
          D2 = b[x2 >> 1] | 0;
          C2 = B2 - (Z(D2, C2) | 0) | 0;
          B2 = b[o2 + -10 >> 1] | 0;
          D2 = m2 - (Z(B2, D2) | 0) | 0;
          m2 = b[y2 >> 1] | 0;
          B2 = C2 - (Z(m2, B2) | 0) | 0;
          C2 = b[o2 + -12 >> 1] | 0;
          m2 = D2 - (Z(C2, m2) | 0) | 0;
          D2 = b[z2 >> 1] | 0;
          C2 = B2 - (Z(C2, D2) | 0) | 0;
          B2 = b[o2 + -14 >> 1] | 0;
          D2 = m2 - (Z(B2, D2) | 0) | 0;
          m2 = b[q2 >> 1] | 0;
          B2 = C2 - (Z(m2, B2) | 0) | 0;
          C2 = b[o2 + -16 >> 1] | 0;
          m2 = D2 - (Z(C2, m2) | 0) | 0;
          D2 = b[r2 >> 1] | 0;
          C2 = B2 - (Z(D2, C2) | 0) | 0;
          D2 = m2 - (Z(b[o2 + -18 >> 1] | 0, D2) | 0) | 0;
          m2 = l2 + 4 | 0;
          D2 = (D2 + 134217728 | 0) >>> 0 < 268435455 ? D2 >>> 12 & 65535 : (D2 | 0) > 134217727 ? 32767 : -32768;
          j2 = C2 - (Z(j2, D2 << 16 >> 16) | 0) | 0;
          o2 = h2 + 2 | 0;
          b[h2 >> 1] = D2;
          do
            if ((j2 + 134217728 | 0) >>> 0 >= 268435455) {
              h2 = h2 + 4 | 0;
              if ((j2 | 0) > 134217727) {
                b[o2 >> 1] = 32767;
                j2 = 32767;
                break;
              } else {
                b[o2 >> 1] = -32768;
                j2 = -32768;
                break;
              }
            } else {
              j2 = j2 >>> 12 & 65535;
              b[o2 >> 1] = j2;
              h2 = h2 + 4 | 0;
            }
          while (0);
          k2 = k2 + -1 << 16 >> 16;
          if (!(k2 << 16 >> 16))
            break;
          else {
            D2 = l2;
            n2 = j2;
            l2 = m2;
            j2 = D2;
          }
        }
      }
      if (!(g2 << 16 >> 16)) {
        i2 = A2;
        return;
      }
      k2 = f2;
      h2 = d2 + (e2 << 1) | 0;
      j2 = k2 + 20 | 0;
      do {
        b[k2 >> 1] = b[h2 >> 1] | 0;
        k2 = k2 + 2 | 0;
        h2 = h2 + 2 | 0;
      } while ((k2 | 0) < (j2 | 0));
      i2 = A2;
      return;
    }
    function Ie(a2, c2, d2) {
      a2 = a2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      b[d2 >> 1] = b[a2 >> 1] | 0;
      b[d2 + 2 >> 1] = ((Z(b[c2 >> 1] | 0, b[a2 + 2 >> 1] | 0) | 0) + 16384 | 0) >>> 15;
      b[d2 + 4 >> 1] = ((Z(b[c2 + 2 >> 1] | 0, b[a2 + 4 >> 1] | 0) | 0) + 16384 | 0) >>> 15;
      b[d2 + 6 >> 1] = ((Z(b[c2 + 4 >> 1] | 0, b[a2 + 6 >> 1] | 0) | 0) + 16384 | 0) >>> 15;
      b[d2 + 8 >> 1] = ((Z(b[c2 + 6 >> 1] | 0, b[a2 + 8 >> 1] | 0) | 0) + 16384 | 0) >>> 15;
      b[d2 + 10 >> 1] = ((Z(b[c2 + 8 >> 1] | 0, b[a2 + 10 >> 1] | 0) | 0) + 16384 | 0) >>> 15;
      b[d2 + 12 >> 1] = ((Z(b[c2 + 10 >> 1] | 0, b[a2 + 12 >> 1] | 0) | 0) + 16384 | 0) >>> 15;
      b[d2 + 14 >> 1] = ((Z(b[c2 + 12 >> 1] | 0, b[a2 + 14 >> 1] | 0) | 0) + 16384 | 0) >>> 15;
      b[d2 + 16 >> 1] = ((Z(b[c2 + 14 >> 1] | 0, b[a2 + 16 >> 1] | 0) | 0) + 16384 | 0) >>> 15;
      b[d2 + 18 >> 1] = ((Z(b[c2 + 16 >> 1] | 0, b[a2 + 18 >> 1] | 0) | 0) + 16384 | 0) >>> 15;
      b[d2 + 20 >> 1] = ((Z(b[c2 + 18 >> 1] | 0, b[a2 + 20 >> 1] | 0) | 0) + 16384 | 0) >>> 15;
      return;
    }
    function Je(a2) {
      a2 = a2 | 0;
      var b2 = 0, d2 = 0, e2 = 0, f2 = 0, g2 = 0, h2 = 0, i3 = 0, j2 = 0, k2 = 0, l2 = 0, m2 = 0, n2 = 0, o2 = 0, p2 = 0, q2 = 0, r2 = 0, s2 = 0, t2 = 0, u2 = 0, v2 = 0, w2 = 0, x2 = 0, y2 = 0, z2 = 0, A2 = 0, B2 = 0, C2 = 0, D2 = 0, E2 = 0, F2 = 0, G2 = 0, H2 = 0, I2 = 0, J2 = 0, K2 = 0, L2 = 0, M2 = 0, N2 = 0, O2 = 0, P2 = 0, Q2 = 0, R2 = 0, S2 = 0, T2 = 0, U2 = 0, V2 = 0;
      do
        if (a2 >>> 0 < 245) {
          s2 = a2 >>> 0 < 11 ? 16 : a2 + 11 & -8;
          a2 = s2 >>> 3;
          m2 = c[26] | 0;
          j2 = m2 >>> a2;
          if (j2 & 3) {
            e2 = (j2 & 1 ^ 1) + a2 | 0;
            b2 = e2 << 1;
            d2 = 144 + (b2 << 2) | 0;
            b2 = 144 + (b2 + 2 << 2) | 0;
            f2 = c[b2 >> 2] | 0;
            g2 = f2 + 8 | 0;
            h2 = c[g2 >> 2] | 0;
            do
              if ((d2 | 0) == (h2 | 0))
                c[26] = m2 & ~(1 << e2);
              else {
                if (h2 >>> 0 >= (c[30] | 0) >>> 0 ? (l2 = h2 + 12 | 0, (c[l2 >> 2] | 0) == (f2 | 0)) : 0) {
                  c[l2 >> 2] = d2;
                  c[b2 >> 2] = h2;
                  break;
                }
                ea();
              }
            while (0);
            U2 = e2 << 3;
            c[f2 + 4 >> 2] = U2 | 3;
            U2 = f2 + (U2 | 4) | 0;
            c[U2 >> 2] = c[U2 >> 2] | 1;
            break;
          }
          b2 = c[28] | 0;
          if (s2 >>> 0 > b2 >>> 0) {
            if (j2) {
              f2 = 2 << a2;
              f2 = j2 << a2 & (f2 | 0 - f2);
              f2 = (f2 & 0 - f2) + -1 | 0;
              g2 = f2 >>> 12 & 16;
              f2 = f2 >>> g2;
              e2 = f2 >>> 5 & 8;
              f2 = f2 >>> e2;
              d2 = f2 >>> 2 & 4;
              f2 = f2 >>> d2;
              h2 = f2 >>> 1 & 2;
              f2 = f2 >>> h2;
              i3 = f2 >>> 1 & 1;
              i3 = (e2 | g2 | d2 | h2 | i3) + (f2 >>> i3) | 0;
              f2 = i3 << 1;
              h2 = 144 + (f2 << 2) | 0;
              f2 = 144 + (f2 + 2 << 2) | 0;
              d2 = c[f2 >> 2] | 0;
              g2 = d2 + 8 | 0;
              e2 = c[g2 >> 2] | 0;
              do
                if ((h2 | 0) == (e2 | 0)) {
                  c[26] = m2 & ~(1 << i3);
                  n2 = b2;
                } else {
                  if (e2 >>> 0 >= (c[30] | 0) >>> 0 ? (k2 = e2 + 12 | 0, (c[k2 >> 2] | 0) == (d2 | 0)) : 0) {
                    c[k2 >> 2] = h2;
                    c[f2 >> 2] = e2;
                    n2 = c[28] | 0;
                    break;
                  }
                  ea();
                }
              while (0);
              U2 = i3 << 3;
              b2 = U2 - s2 | 0;
              c[d2 + 4 >> 2] = s2 | 3;
              j2 = d2 + s2 | 0;
              c[d2 + (s2 | 4) >> 2] = b2 | 1;
              c[d2 + U2 >> 2] = b2;
              if (n2) {
                d2 = c[31] | 0;
                e2 = n2 >>> 3;
                h2 = e2 << 1;
                i3 = 144 + (h2 << 2) | 0;
                f2 = c[26] | 0;
                e2 = 1 << e2;
                if (f2 & e2) {
                  f2 = 144 + (h2 + 2 << 2) | 0;
                  h2 = c[f2 >> 2] | 0;
                  if (h2 >>> 0 < (c[30] | 0) >>> 0)
                    ea();
                  else {
                    p2 = f2;
                    q2 = h2;
                  }
                } else {
                  c[26] = f2 | e2;
                  p2 = 144 + (h2 + 2 << 2) | 0;
                  q2 = i3;
                }
                c[p2 >> 2] = d2;
                c[q2 + 12 >> 2] = d2;
                c[d2 + 8 >> 2] = q2;
                c[d2 + 12 >> 2] = i3;
              }
              c[28] = b2;
              c[31] = j2;
              break;
            }
            a2 = c[27] | 0;
            if (a2) {
              f2 = (a2 & 0 - a2) + -1 | 0;
              T2 = f2 >>> 12 & 16;
              f2 = f2 >>> T2;
              S2 = f2 >>> 5 & 8;
              f2 = f2 >>> S2;
              U2 = f2 >>> 2 & 4;
              f2 = f2 >>> U2;
              h2 = f2 >>> 1 & 2;
              f2 = f2 >>> h2;
              j2 = f2 >>> 1 & 1;
              j2 = c[408 + ((S2 | T2 | U2 | h2 | j2) + (f2 >>> j2) << 2) >> 2] | 0;
              f2 = (c[j2 + 4 >> 2] & -8) - s2 | 0;
              h2 = j2;
              while (1) {
                i3 = c[h2 + 16 >> 2] | 0;
                if (!i3) {
                  i3 = c[h2 + 20 >> 2] | 0;
                  if (!i3) {
                    b2 = f2;
                    break;
                  }
                }
                h2 = (c[i3 + 4 >> 2] & -8) - s2 | 0;
                U2 = h2 >>> 0 < f2 >>> 0;
                f2 = U2 ? h2 : f2;
                h2 = i3;
                j2 = U2 ? i3 : j2;
              }
              a2 = c[30] | 0;
              if (j2 >>> 0 >= a2 >>> 0 ? (v2 = j2 + s2 | 0, j2 >>> 0 < v2 >>> 0) : 0) {
                e2 = c[j2 + 24 >> 2] | 0;
                i3 = c[j2 + 12 >> 2] | 0;
                do
                  if ((i3 | 0) == (j2 | 0)) {
                    h2 = j2 + 20 | 0;
                    i3 = c[h2 >> 2] | 0;
                    if (!i3) {
                      h2 = j2 + 16 | 0;
                      i3 = c[h2 >> 2] | 0;
                      if (!i3) {
                        t2 = 0;
                        break;
                      }
                    }
                    while (1) {
                      g2 = i3 + 20 | 0;
                      f2 = c[g2 >> 2] | 0;
                      if (f2) {
                        i3 = f2;
                        h2 = g2;
                        continue;
                      }
                      g2 = i3 + 16 | 0;
                      f2 = c[g2 >> 2] | 0;
                      if (!f2)
                        break;
                      else {
                        i3 = f2;
                        h2 = g2;
                      }
                    }
                    if (h2 >>> 0 < a2 >>> 0)
                      ea();
                    else {
                      c[h2 >> 2] = 0;
                      t2 = i3;
                      break;
                    }
                  } else {
                    h2 = c[j2 + 8 >> 2] | 0;
                    if ((h2 >>> 0 >= a2 >>> 0 ? (d2 = h2 + 12 | 0, (c[d2 >> 2] | 0) == (j2 | 0)) : 0) ? (o2 = i3 + 8 | 0, (c[o2 >> 2] | 0) == (j2 | 0)) : 0) {
                      c[d2 >> 2] = i3;
                      c[o2 >> 2] = h2;
                      t2 = i3;
                      break;
                    }
                    ea();
                  }
                while (0);
                do
                  if (e2) {
                    h2 = c[j2 + 28 >> 2] | 0;
                    g2 = 408 + (h2 << 2) | 0;
                    if ((j2 | 0) == (c[g2 >> 2] | 0)) {
                      c[g2 >> 2] = t2;
                      if (!t2) {
                        c[27] = c[27] & ~(1 << h2);
                        break;
                      }
                    } else {
                      if (e2 >>> 0 < (c[30] | 0) >>> 0)
                        ea();
                      h2 = e2 + 16 | 0;
                      if ((c[h2 >> 2] | 0) == (j2 | 0))
                        c[h2 >> 2] = t2;
                      else
                        c[e2 + 20 >> 2] = t2;
                      if (!t2)
                        break;
                    }
                    g2 = c[30] | 0;
                    if (t2 >>> 0 < g2 >>> 0)
                      ea();
                    c[t2 + 24 >> 2] = e2;
                    h2 = c[j2 + 16 >> 2] | 0;
                    do
                      if (h2)
                        if (h2 >>> 0 < g2 >>> 0)
                          ea();
                        else {
                          c[t2 + 16 >> 2] = h2;
                          c[h2 + 24 >> 2] = t2;
                          break;
                        }
                    while (0);
                    h2 = c[j2 + 20 >> 2] | 0;
                    if (h2)
                      if (h2 >>> 0 < (c[30] | 0) >>> 0)
                        ea();
                      else {
                        c[t2 + 20 >> 2] = h2;
                        c[h2 + 24 >> 2] = t2;
                        break;
                      }
                  }
                while (0);
                if (b2 >>> 0 < 16) {
                  U2 = b2 + s2 | 0;
                  c[j2 + 4 >> 2] = U2 | 3;
                  U2 = j2 + (U2 + 4) | 0;
                  c[U2 >> 2] = c[U2 >> 2] | 1;
                } else {
                  c[j2 + 4 >> 2] = s2 | 3;
                  c[j2 + (s2 | 4) >> 2] = b2 | 1;
                  c[j2 + (b2 + s2) >> 2] = b2;
                  e2 = c[28] | 0;
                  if (e2) {
                    d2 = c[31] | 0;
                    f2 = e2 >>> 3;
                    h2 = f2 << 1;
                    i3 = 144 + (h2 << 2) | 0;
                    g2 = c[26] | 0;
                    f2 = 1 << f2;
                    if (g2 & f2) {
                      h2 = 144 + (h2 + 2 << 2) | 0;
                      g2 = c[h2 >> 2] | 0;
                      if (g2 >>> 0 < (c[30] | 0) >>> 0)
                        ea();
                      else {
                        u2 = h2;
                        w2 = g2;
                      }
                    } else {
                      c[26] = g2 | f2;
                      u2 = 144 + (h2 + 2 << 2) | 0;
                      w2 = i3;
                    }
                    c[u2 >> 2] = d2;
                    c[w2 + 12 >> 2] = d2;
                    c[d2 + 8 >> 2] = w2;
                    c[d2 + 12 >> 2] = i3;
                  }
                  c[28] = b2;
                  c[31] = v2;
                }
                g2 = j2 + 8 | 0;
                break;
              }
              ea();
            } else
              V2 = 154;
          } else
            V2 = 154;
        } else if (a2 >>> 0 <= 4294967231) {
          a2 = a2 + 11 | 0;
          w2 = a2 & -8;
          m2 = c[27] | 0;
          if (m2) {
            j2 = 0 - w2 | 0;
            a2 = a2 >>> 8;
            if (a2)
              if (w2 >>> 0 > 16777215)
                l2 = 31;
              else {
                v2 = (a2 + 1048320 | 0) >>> 16 & 8;
                V2 = a2 << v2;
                u2 = (V2 + 520192 | 0) >>> 16 & 4;
                V2 = V2 << u2;
                l2 = (V2 + 245760 | 0) >>> 16 & 2;
                l2 = 14 - (u2 | v2 | l2) + (V2 << l2 >>> 15) | 0;
                l2 = w2 >>> (l2 + 7 | 0) & 1 | l2 << 1;
              }
            else
              l2 = 0;
            a2 = c[408 + (l2 << 2) >> 2] | 0;
            a:
              do
                if (!a2) {
                  i3 = 0;
                  a2 = 0;
                  V2 = 86;
                } else {
                  d2 = j2;
                  i3 = 0;
                  b2 = w2 << ((l2 | 0) == 31 ? 0 : 25 - (l2 >>> 1) | 0);
                  k2 = a2;
                  a2 = 0;
                  while (1) {
                    e2 = c[k2 + 4 >> 2] & -8;
                    j2 = e2 - w2 | 0;
                    if (j2 >>> 0 < d2 >>> 0)
                      if ((e2 | 0) == (w2 | 0)) {
                        e2 = k2;
                        a2 = k2;
                        V2 = 90;
                        break a;
                      } else
                        a2 = k2;
                    else
                      j2 = d2;
                    V2 = c[k2 + 20 >> 2] | 0;
                    k2 = c[k2 + 16 + (b2 >>> 31 << 2) >> 2] | 0;
                    i3 = (V2 | 0) == 0 | (V2 | 0) == (k2 | 0) ? i3 : V2;
                    if (!k2) {
                      V2 = 86;
                      break;
                    } else {
                      d2 = j2;
                      b2 = b2 << 1;
                    }
                  }
                }
              while (0);
            if ((V2 | 0) == 86) {
              if ((i3 | 0) == 0 & (a2 | 0) == 0) {
                a2 = 2 << l2;
                a2 = m2 & (a2 | 0 - a2);
                if (!a2) {
                  s2 = w2;
                  V2 = 154;
                  break;
                }
                a2 = (a2 & 0 - a2) + -1 | 0;
                t2 = a2 >>> 12 & 16;
                a2 = a2 >>> t2;
                q2 = a2 >>> 5 & 8;
                a2 = a2 >>> q2;
                u2 = a2 >>> 2 & 4;
                a2 = a2 >>> u2;
                v2 = a2 >>> 1 & 2;
                a2 = a2 >>> v2;
                i3 = a2 >>> 1 & 1;
                i3 = c[408 + ((q2 | t2 | u2 | v2 | i3) + (a2 >>> i3) << 2) >> 2] | 0;
                a2 = 0;
              }
              if (!i3) {
                q2 = j2;
                p2 = a2;
              } else {
                e2 = i3;
                V2 = 90;
              }
            }
            if ((V2 | 0) == 90)
              while (1) {
                V2 = 0;
                v2 = (c[e2 + 4 >> 2] & -8) - w2 | 0;
                i3 = v2 >>> 0 < j2 >>> 0;
                j2 = i3 ? v2 : j2;
                a2 = i3 ? e2 : a2;
                i3 = c[e2 + 16 >> 2] | 0;
                if (i3) {
                  e2 = i3;
                  V2 = 90;
                  continue;
                }
                e2 = c[e2 + 20 >> 2] | 0;
                if (!e2) {
                  q2 = j2;
                  p2 = a2;
                  break;
                } else
                  V2 = 90;
              }
            if ((p2 | 0) != 0 ? q2 >>> 0 < ((c[28] | 0) - w2 | 0) >>> 0 : 0) {
              a2 = c[30] | 0;
              if (p2 >>> 0 >= a2 >>> 0 ? (H2 = p2 + w2 | 0, p2 >>> 0 < H2 >>> 0) : 0) {
                j2 = c[p2 + 24 >> 2] | 0;
                i3 = c[p2 + 12 >> 2] | 0;
                do
                  if ((i3 | 0) == (p2 | 0)) {
                    h2 = p2 + 20 | 0;
                    i3 = c[h2 >> 2] | 0;
                    if (!i3) {
                      h2 = p2 + 16 | 0;
                      i3 = c[h2 >> 2] | 0;
                      if (!i3) {
                        y2 = 0;
                        break;
                      }
                    }
                    while (1) {
                      g2 = i3 + 20 | 0;
                      f2 = c[g2 >> 2] | 0;
                      if (f2) {
                        i3 = f2;
                        h2 = g2;
                        continue;
                      }
                      g2 = i3 + 16 | 0;
                      f2 = c[g2 >> 2] | 0;
                      if (!f2)
                        break;
                      else {
                        i3 = f2;
                        h2 = g2;
                      }
                    }
                    if (h2 >>> 0 < a2 >>> 0)
                      ea();
                    else {
                      c[h2 >> 2] = 0;
                      y2 = i3;
                      break;
                    }
                  } else {
                    h2 = c[p2 + 8 >> 2] | 0;
                    if ((h2 >>> 0 >= a2 >>> 0 ? (r2 = h2 + 12 | 0, (c[r2 >> 2] | 0) == (p2 | 0)) : 0) ? (s2 = i3 + 8 | 0, (c[s2 >> 2] | 0) == (p2 | 0)) : 0) {
                      c[r2 >> 2] = i3;
                      c[s2 >> 2] = h2;
                      y2 = i3;
                      break;
                    }
                    ea();
                  }
                while (0);
                do
                  if (j2) {
                    i3 = c[p2 + 28 >> 2] | 0;
                    h2 = 408 + (i3 << 2) | 0;
                    if ((p2 | 0) == (c[h2 >> 2] | 0)) {
                      c[h2 >> 2] = y2;
                      if (!y2) {
                        c[27] = c[27] & ~(1 << i3);
                        break;
                      }
                    } else {
                      if (j2 >>> 0 < (c[30] | 0) >>> 0)
                        ea();
                      h2 = j2 + 16 | 0;
                      if ((c[h2 >> 2] | 0) == (p2 | 0))
                        c[h2 >> 2] = y2;
                      else
                        c[j2 + 20 >> 2] = y2;
                      if (!y2)
                        break;
                    }
                    i3 = c[30] | 0;
                    if (y2 >>> 0 < i3 >>> 0)
                      ea();
                    c[y2 + 24 >> 2] = j2;
                    h2 = c[p2 + 16 >> 2] | 0;
                    do
                      if (h2)
                        if (h2 >>> 0 < i3 >>> 0)
                          ea();
                        else {
                          c[y2 + 16 >> 2] = h2;
                          c[h2 + 24 >> 2] = y2;
                          break;
                        }
                    while (0);
                    h2 = c[p2 + 20 >> 2] | 0;
                    if (h2)
                      if (h2 >>> 0 < (c[30] | 0) >>> 0)
                        ea();
                      else {
                        c[y2 + 20 >> 2] = h2;
                        c[h2 + 24 >> 2] = y2;
                        break;
                      }
                  }
                while (0);
                b:
                  do
                    if (q2 >>> 0 >= 16) {
                      c[p2 + 4 >> 2] = w2 | 3;
                      c[p2 + (w2 | 4) >> 2] = q2 | 1;
                      c[p2 + (q2 + w2) >> 2] = q2;
                      i3 = q2 >>> 3;
                      if (q2 >>> 0 < 256) {
                        g2 = i3 << 1;
                        e2 = 144 + (g2 << 2) | 0;
                        f2 = c[26] | 0;
                        h2 = 1 << i3;
                        if (f2 & h2) {
                          h2 = 144 + (g2 + 2 << 2) | 0;
                          g2 = c[h2 >> 2] | 0;
                          if (g2 >>> 0 < (c[30] | 0) >>> 0)
                            ea();
                          else {
                            z2 = h2;
                            A2 = g2;
                          }
                        } else {
                          c[26] = f2 | h2;
                          z2 = 144 + (g2 + 2 << 2) | 0;
                          A2 = e2;
                        }
                        c[z2 >> 2] = H2;
                        c[A2 + 12 >> 2] = H2;
                        c[p2 + (w2 + 8) >> 2] = A2;
                        c[p2 + (w2 + 12) >> 2] = e2;
                        break;
                      }
                      d2 = q2 >>> 8;
                      if (d2)
                        if (q2 >>> 0 > 16777215)
                          i3 = 31;
                        else {
                          T2 = (d2 + 1048320 | 0) >>> 16 & 8;
                          U2 = d2 << T2;
                          S2 = (U2 + 520192 | 0) >>> 16 & 4;
                          U2 = U2 << S2;
                          i3 = (U2 + 245760 | 0) >>> 16 & 2;
                          i3 = 14 - (S2 | T2 | i3) + (U2 << i3 >>> 15) | 0;
                          i3 = q2 >>> (i3 + 7 | 0) & 1 | i3 << 1;
                        }
                      else
                        i3 = 0;
                      h2 = 408 + (i3 << 2) | 0;
                      c[p2 + (w2 + 28) >> 2] = i3;
                      c[p2 + (w2 + 20) >> 2] = 0;
                      c[p2 + (w2 + 16) >> 2] = 0;
                      g2 = c[27] | 0;
                      f2 = 1 << i3;
                      if (!(g2 & f2)) {
                        c[27] = g2 | f2;
                        c[h2 >> 2] = H2;
                        c[p2 + (w2 + 24) >> 2] = h2;
                        c[p2 + (w2 + 12) >> 2] = H2;
                        c[p2 + (w2 + 8) >> 2] = H2;
                        break;
                      }
                      d2 = c[h2 >> 2] | 0;
                      c:
                        do
                          if ((c[d2 + 4 >> 2] & -8 | 0) != (q2 | 0)) {
                            i3 = q2 << ((i3 | 0) == 31 ? 0 : 25 - (i3 >>> 1) | 0);
                            while (1) {
                              b2 = d2 + 16 + (i3 >>> 31 << 2) | 0;
                              h2 = c[b2 >> 2] | 0;
                              if (!h2)
                                break;
                              if ((c[h2 + 4 >> 2] & -8 | 0) == (q2 | 0)) {
                                C2 = h2;
                                break c;
                              } else {
                                i3 = i3 << 1;
                                d2 = h2;
                              }
                            }
                            if (b2 >>> 0 < (c[30] | 0) >>> 0)
                              ea();
                            else {
                              c[b2 >> 2] = H2;
                              c[p2 + (w2 + 24) >> 2] = d2;
                              c[p2 + (w2 + 12) >> 2] = H2;
                              c[p2 + (w2 + 8) >> 2] = H2;
                              break b;
                            }
                          } else
                            C2 = d2;
                        while (0);
                      d2 = C2 + 8 | 0;
                      b2 = c[d2 >> 2] | 0;
                      U2 = c[30] | 0;
                      if (b2 >>> 0 >= U2 >>> 0 & C2 >>> 0 >= U2 >>> 0) {
                        c[b2 + 12 >> 2] = H2;
                        c[d2 >> 2] = H2;
                        c[p2 + (w2 + 8) >> 2] = b2;
                        c[p2 + (w2 + 12) >> 2] = C2;
                        c[p2 + (w2 + 24) >> 2] = 0;
                        break;
                      } else
                        ea();
                    } else {
                      U2 = q2 + w2 | 0;
                      c[p2 + 4 >> 2] = U2 | 3;
                      U2 = p2 + (U2 + 4) | 0;
                      c[U2 >> 2] = c[U2 >> 2] | 1;
                    }
                  while (0);
                g2 = p2 + 8 | 0;
                break;
              }
              ea();
            } else {
              s2 = w2;
              V2 = 154;
            }
          } else {
            s2 = w2;
            V2 = 154;
          }
        } else {
          s2 = -1;
          V2 = 154;
        }
      while (0);
      d:
        do
          if ((V2 | 0) == 154) {
            a2 = c[28] | 0;
            if (a2 >>> 0 >= s2 >>> 0) {
              b2 = a2 - s2 | 0;
              d2 = c[31] | 0;
              if (b2 >>> 0 > 15) {
                c[31] = d2 + s2;
                c[28] = b2;
                c[d2 + (s2 + 4) >> 2] = b2 | 1;
                c[d2 + a2 >> 2] = b2;
                c[d2 + 4 >> 2] = s2 | 3;
              } else {
                c[28] = 0;
                c[31] = 0;
                c[d2 + 4 >> 2] = a2 | 3;
                V2 = d2 + (a2 + 4) | 0;
                c[V2 >> 2] = c[V2 >> 2] | 1;
              }
              g2 = d2 + 8 | 0;
              break;
            }
            a2 = c[29] | 0;
            if (a2 >>> 0 > s2 >>> 0) {
              V2 = a2 - s2 | 0;
              c[29] = V2;
              g2 = c[32] | 0;
              c[32] = g2 + s2;
              c[g2 + (s2 + 4) >> 2] = V2 | 1;
              c[g2 + 4 >> 2] = s2 | 3;
              g2 = g2 + 8 | 0;
              break;
            }
            if (!(c[144] | 0))
              Me();
            m2 = s2 + 48 | 0;
            d2 = c[146] | 0;
            l2 = s2 + 47 | 0;
            e2 = d2 + l2 | 0;
            d2 = 0 - d2 | 0;
            k2 = e2 & d2;
            if (k2 >>> 0 > s2 >>> 0) {
              a2 = c[136] | 0;
              if ((a2 | 0) != 0 ? (C2 = c[134] | 0, H2 = C2 + k2 | 0, H2 >>> 0 <= C2 >>> 0 | H2 >>> 0 > a2 >>> 0) : 0) {
                g2 = 0;
                break;
              }
              e:
                do
                  if (!(c[137] & 4)) {
                    a2 = c[32] | 0;
                    f:
                      do
                        if (a2) {
                          i3 = 552;
                          while (1) {
                            j2 = c[i3 >> 2] | 0;
                            if (j2 >>> 0 <= a2 >>> 0 ? (x2 = i3 + 4 | 0, (j2 + (c[x2 >> 2] | 0) | 0) >>> 0 > a2 >>> 0) : 0) {
                              g2 = i3;
                              a2 = x2;
                              break;
                            }
                            i3 = c[i3 + 8 >> 2] | 0;
                            if (!i3) {
                              V2 = 172;
                              break f;
                            }
                          }
                          j2 = e2 - (c[29] | 0) & d2;
                          if (j2 >>> 0 < 2147483647) {
                            i3 = ga(j2 | 0) | 0;
                            H2 = (i3 | 0) == ((c[g2 >> 2] | 0) + (c[a2 >> 2] | 0) | 0);
                            a2 = H2 ? j2 : 0;
                            if (H2) {
                              if ((i3 | 0) != (-1 | 0)) {
                                A2 = i3;
                                t2 = a2;
                                V2 = 192;
                                break e;
                              }
                            } else
                              V2 = 182;
                          } else
                            a2 = 0;
                        } else
                          V2 = 172;
                      while (0);
                    do
                      if ((V2 | 0) == 172) {
                        g2 = ga(0) | 0;
                        if ((g2 | 0) != (-1 | 0)) {
                          a2 = g2;
                          j2 = c[145] | 0;
                          i3 = j2 + -1 | 0;
                          if (!(i3 & a2))
                            j2 = k2;
                          else
                            j2 = k2 - a2 + (i3 + a2 & 0 - j2) | 0;
                          a2 = c[134] | 0;
                          i3 = a2 + j2 | 0;
                          if (j2 >>> 0 > s2 >>> 0 & j2 >>> 0 < 2147483647) {
                            H2 = c[136] | 0;
                            if ((H2 | 0) != 0 ? i3 >>> 0 <= a2 >>> 0 | i3 >>> 0 > H2 >>> 0 : 0) {
                              a2 = 0;
                              break;
                            }
                            i3 = ga(j2 | 0) | 0;
                            V2 = (i3 | 0) == (g2 | 0);
                            a2 = V2 ? j2 : 0;
                            if (V2) {
                              A2 = g2;
                              t2 = a2;
                              V2 = 192;
                              break e;
                            } else
                              V2 = 182;
                          } else
                            a2 = 0;
                        } else
                          a2 = 0;
                      }
                    while (0);
                    g:
                      do
                        if ((V2 | 0) == 182) {
                          g2 = 0 - j2 | 0;
                          do
                            if (m2 >>> 0 > j2 >>> 0 & (j2 >>> 0 < 2147483647 & (i3 | 0) != (-1 | 0)) ? (B2 = c[146] | 0, B2 = l2 - j2 + B2 & 0 - B2, B2 >>> 0 < 2147483647) : 0)
                              if ((ga(B2 | 0) | 0) == (-1 | 0)) {
                                ga(g2 | 0) | 0;
                                break g;
                              } else {
                                j2 = B2 + j2 | 0;
                                break;
                              }
                          while (0);
                          if ((i3 | 0) != (-1 | 0)) {
                            A2 = i3;
                            t2 = j2;
                            V2 = 192;
                            break e;
                          }
                        }
                      while (0);
                    c[137] = c[137] | 4;
                    V2 = 189;
                  } else {
                    a2 = 0;
                    V2 = 189;
                  }
                while (0);
              if ((((V2 | 0) == 189 ? k2 >>> 0 < 2147483647 : 0) ? (D2 = ga(k2 | 0) | 0, E2 = ga(0) | 0, D2 >>> 0 < E2 >>> 0 & ((D2 | 0) != (-1 | 0) & (E2 | 0) != (-1 | 0))) : 0) ? (F2 = E2 - D2 | 0, G2 = F2 >>> 0 > (s2 + 40 | 0) >>> 0, G2) : 0) {
                A2 = D2;
                t2 = G2 ? F2 : a2;
                V2 = 192;
              }
              if ((V2 | 0) == 192) {
                j2 = (c[134] | 0) + t2 | 0;
                c[134] = j2;
                if (j2 >>> 0 > (c[135] | 0) >>> 0)
                  c[135] = j2;
                q2 = c[32] | 0;
                h:
                  do
                    if (q2) {
                      g2 = 552;
                      do {
                        a2 = c[g2 >> 2] | 0;
                        j2 = g2 + 4 | 0;
                        i3 = c[j2 >> 2] | 0;
                        if ((A2 | 0) == (a2 + i3 | 0)) {
                          I2 = a2;
                          J2 = j2;
                          K2 = i3;
                          L2 = g2;
                          V2 = 202;
                          break;
                        }
                        g2 = c[g2 + 8 >> 2] | 0;
                      } while ((g2 | 0) != 0);
                      if (((V2 | 0) == 202 ? (c[L2 + 12 >> 2] & 8 | 0) == 0 : 0) ? q2 >>> 0 < A2 >>> 0 & q2 >>> 0 >= I2 >>> 0 : 0) {
                        c[J2 >> 2] = K2 + t2;
                        V2 = (c[29] | 0) + t2 | 0;
                        U2 = q2 + 8 | 0;
                        U2 = (U2 & 7 | 0) == 0 ? 0 : 0 - U2 & 7;
                        T2 = V2 - U2 | 0;
                        c[32] = q2 + U2;
                        c[29] = T2;
                        c[q2 + (U2 + 4) >> 2] = T2 | 1;
                        c[q2 + (V2 + 4) >> 2] = 40;
                        c[33] = c[148];
                        break;
                      }
                      j2 = c[30] | 0;
                      if (A2 >>> 0 < j2 >>> 0) {
                        c[30] = A2;
                        j2 = A2;
                      }
                      i3 = A2 + t2 | 0;
                      a2 = 552;
                      while (1) {
                        if ((c[a2 >> 2] | 0) == (i3 | 0)) {
                          g2 = a2;
                          i3 = a2;
                          V2 = 210;
                          break;
                        }
                        a2 = c[a2 + 8 >> 2] | 0;
                        if (!a2) {
                          i3 = 552;
                          break;
                        }
                      }
                      if ((V2 | 0) == 210)
                        if (!(c[i3 + 12 >> 2] & 8)) {
                          c[g2 >> 2] = A2;
                          o2 = i3 + 4 | 0;
                          c[o2 >> 2] = (c[o2 >> 2] | 0) + t2;
                          o2 = A2 + 8 | 0;
                          o2 = (o2 & 7 | 0) == 0 ? 0 : 0 - o2 & 7;
                          l2 = A2 + (t2 + 8) | 0;
                          l2 = (l2 & 7 | 0) == 0 ? 0 : 0 - l2 & 7;
                          i3 = A2 + (l2 + t2) | 0;
                          p2 = o2 + s2 | 0;
                          n2 = A2 + p2 | 0;
                          a2 = i3 - (A2 + o2) - s2 | 0;
                          c[A2 + (o2 + 4) >> 2] = s2 | 3;
                          i:
                            do
                              if ((i3 | 0) != (q2 | 0)) {
                                if ((i3 | 0) == (c[31] | 0)) {
                                  V2 = (c[28] | 0) + a2 | 0;
                                  c[28] = V2;
                                  c[31] = n2;
                                  c[A2 + (p2 + 4) >> 2] = V2 | 1;
                                  c[A2 + (V2 + p2) >> 2] = V2;
                                  break;
                                }
                                b2 = t2 + 4 | 0;
                                h2 = c[A2 + (b2 + l2) >> 2] | 0;
                                if ((h2 & 3 | 0) == 1) {
                                  k2 = h2 & -8;
                                  e2 = h2 >>> 3;
                                  j:
                                    do
                                      if (h2 >>> 0 >= 256) {
                                        d2 = c[A2 + ((l2 | 24) + t2) >> 2] | 0;
                                        g2 = c[A2 + (t2 + 12 + l2) >> 2] | 0;
                                        k:
                                          do
                                            if ((g2 | 0) == (i3 | 0)) {
                                              f2 = l2 | 16;
                                              g2 = A2 + (b2 + f2) | 0;
                                              h2 = c[g2 >> 2] | 0;
                                              if (!h2) {
                                                g2 = A2 + (f2 + t2) | 0;
                                                h2 = c[g2 >> 2] | 0;
                                                if (!h2) {
                                                  R2 = 0;
                                                  break;
                                                }
                                              }
                                              while (1) {
                                                f2 = h2 + 20 | 0;
                                                e2 = c[f2 >> 2] | 0;
                                                if (e2) {
                                                  h2 = e2;
                                                  g2 = f2;
                                                  continue;
                                                }
                                                f2 = h2 + 16 | 0;
                                                e2 = c[f2 >> 2] | 0;
                                                if (!e2)
                                                  break;
                                                else {
                                                  h2 = e2;
                                                  g2 = f2;
                                                }
                                              }
                                              if (g2 >>> 0 < j2 >>> 0)
                                                ea();
                                              else {
                                                c[g2 >> 2] = 0;
                                                R2 = h2;
                                                break;
                                              }
                                            } else {
                                              f2 = c[A2 + ((l2 | 8) + t2) >> 2] | 0;
                                              do
                                                if (f2 >>> 0 >= j2 >>> 0) {
                                                  j2 = f2 + 12 | 0;
                                                  if ((c[j2 >> 2] | 0) != (i3 | 0))
                                                    break;
                                                  h2 = g2 + 8 | 0;
                                                  if ((c[h2 >> 2] | 0) != (i3 | 0))
                                                    break;
                                                  c[j2 >> 2] = g2;
                                                  c[h2 >> 2] = f2;
                                                  R2 = g2;
                                                  break k;
                                                }
                                              while (0);
                                              ea();
                                            }
                                          while (0);
                                        if (!d2)
                                          break;
                                        j2 = c[A2 + (t2 + 28 + l2) >> 2] | 0;
                                        h2 = 408 + (j2 << 2) | 0;
                                        do
                                          if ((i3 | 0) != (c[h2 >> 2] | 0)) {
                                            if (d2 >>> 0 < (c[30] | 0) >>> 0)
                                              ea();
                                            h2 = d2 + 16 | 0;
                                            if ((c[h2 >> 2] | 0) == (i3 | 0))
                                              c[h2 >> 2] = R2;
                                            else
                                              c[d2 + 20 >> 2] = R2;
                                            if (!R2)
                                              break j;
                                          } else {
                                            c[h2 >> 2] = R2;
                                            if (R2)
                                              break;
                                            c[27] = c[27] & ~(1 << j2);
                                            break j;
                                          }
                                        while (0);
                                        j2 = c[30] | 0;
                                        if (R2 >>> 0 < j2 >>> 0)
                                          ea();
                                        c[R2 + 24 >> 2] = d2;
                                        i3 = l2 | 16;
                                        h2 = c[A2 + (i3 + t2) >> 2] | 0;
                                        do
                                          if (h2)
                                            if (h2 >>> 0 < j2 >>> 0)
                                              ea();
                                            else {
                                              c[R2 + 16 >> 2] = h2;
                                              c[h2 + 24 >> 2] = R2;
                                              break;
                                            }
                                        while (0);
                                        i3 = c[A2 + (b2 + i3) >> 2] | 0;
                                        if (!i3)
                                          break;
                                        if (i3 >>> 0 < (c[30] | 0) >>> 0)
                                          ea();
                                        else {
                                          c[R2 + 20 >> 2] = i3;
                                          c[i3 + 24 >> 2] = R2;
                                          break;
                                        }
                                      } else {
                                        h2 = c[A2 + ((l2 | 8) + t2) >> 2] | 0;
                                        g2 = c[A2 + (t2 + 12 + l2) >> 2] | 0;
                                        f2 = 144 + (e2 << 1 << 2) | 0;
                                        do
                                          if ((h2 | 0) != (f2 | 0)) {
                                            if (h2 >>> 0 >= j2 >>> 0 ? (c[h2 + 12 >> 2] | 0) == (i3 | 0) : 0)
                                              break;
                                            ea();
                                          }
                                        while (0);
                                        if ((g2 | 0) == (h2 | 0)) {
                                          c[26] = c[26] & ~(1 << e2);
                                          break;
                                        }
                                        do
                                          if ((g2 | 0) == (f2 | 0))
                                            M2 = g2 + 8 | 0;
                                          else {
                                            if (g2 >>> 0 >= j2 >>> 0 ? (N2 = g2 + 8 | 0, (c[N2 >> 2] | 0) == (i3 | 0)) : 0) {
                                              M2 = N2;
                                              break;
                                            }
                                            ea();
                                          }
                                        while (0);
                                        c[h2 + 12 >> 2] = g2;
                                        c[M2 >> 2] = h2;
                                      }
                                    while (0);
                                  i3 = A2 + ((k2 | l2) + t2) | 0;
                                  a2 = k2 + a2 | 0;
                                }
                                i3 = i3 + 4 | 0;
                                c[i3 >> 2] = c[i3 >> 2] & -2;
                                c[A2 + (p2 + 4) >> 2] = a2 | 1;
                                c[A2 + (a2 + p2) >> 2] = a2;
                                i3 = a2 >>> 3;
                                if (a2 >>> 0 < 256) {
                                  g2 = i3 << 1;
                                  e2 = 144 + (g2 << 2) | 0;
                                  f2 = c[26] | 0;
                                  h2 = 1 << i3;
                                  do
                                    if (!(f2 & h2)) {
                                      c[26] = f2 | h2;
                                      S2 = 144 + (g2 + 2 << 2) | 0;
                                      T2 = e2;
                                    } else {
                                      h2 = 144 + (g2 + 2 << 2) | 0;
                                      g2 = c[h2 >> 2] | 0;
                                      if (g2 >>> 0 >= (c[30] | 0) >>> 0) {
                                        S2 = h2;
                                        T2 = g2;
                                        break;
                                      }
                                      ea();
                                    }
                                  while (0);
                                  c[S2 >> 2] = n2;
                                  c[T2 + 12 >> 2] = n2;
                                  c[A2 + (p2 + 8) >> 2] = T2;
                                  c[A2 + (p2 + 12) >> 2] = e2;
                                  break;
                                }
                                d2 = a2 >>> 8;
                                do
                                  if (!d2)
                                    i3 = 0;
                                  else {
                                    if (a2 >>> 0 > 16777215) {
                                      i3 = 31;
                                      break;
                                    }
                                    T2 = (d2 + 1048320 | 0) >>> 16 & 8;
                                    V2 = d2 << T2;
                                    S2 = (V2 + 520192 | 0) >>> 16 & 4;
                                    V2 = V2 << S2;
                                    i3 = (V2 + 245760 | 0) >>> 16 & 2;
                                    i3 = 14 - (S2 | T2 | i3) + (V2 << i3 >>> 15) | 0;
                                    i3 = a2 >>> (i3 + 7 | 0) & 1 | i3 << 1;
                                  }
                                while (0);
                                h2 = 408 + (i3 << 2) | 0;
                                c[A2 + (p2 + 28) >> 2] = i3;
                                c[A2 + (p2 + 20) >> 2] = 0;
                                c[A2 + (p2 + 16) >> 2] = 0;
                                g2 = c[27] | 0;
                                f2 = 1 << i3;
                                if (!(g2 & f2)) {
                                  c[27] = g2 | f2;
                                  c[h2 >> 2] = n2;
                                  c[A2 + (p2 + 24) >> 2] = h2;
                                  c[A2 + (p2 + 12) >> 2] = n2;
                                  c[A2 + (p2 + 8) >> 2] = n2;
                                  break;
                                }
                                d2 = c[h2 >> 2] | 0;
                                l:
                                  do
                                    if ((c[d2 + 4 >> 2] & -8 | 0) != (a2 | 0)) {
                                      i3 = a2 << ((i3 | 0) == 31 ? 0 : 25 - (i3 >>> 1) | 0);
                                      while (1) {
                                        b2 = d2 + 16 + (i3 >>> 31 << 2) | 0;
                                        h2 = c[b2 >> 2] | 0;
                                        if (!h2)
                                          break;
                                        if ((c[h2 + 4 >> 2] & -8 | 0) == (a2 | 0)) {
                                          U2 = h2;
                                          break l;
                                        } else {
                                          i3 = i3 << 1;
                                          d2 = h2;
                                        }
                                      }
                                      if (b2 >>> 0 < (c[30] | 0) >>> 0)
                                        ea();
                                      else {
                                        c[b2 >> 2] = n2;
                                        c[A2 + (p2 + 24) >> 2] = d2;
                                        c[A2 + (p2 + 12) >> 2] = n2;
                                        c[A2 + (p2 + 8) >> 2] = n2;
                                        break i;
                                      }
                                    } else
                                      U2 = d2;
                                  while (0);
                                d2 = U2 + 8 | 0;
                                b2 = c[d2 >> 2] | 0;
                                V2 = c[30] | 0;
                                if (b2 >>> 0 >= V2 >>> 0 & U2 >>> 0 >= V2 >>> 0) {
                                  c[b2 + 12 >> 2] = n2;
                                  c[d2 >> 2] = n2;
                                  c[A2 + (p2 + 8) >> 2] = b2;
                                  c[A2 + (p2 + 12) >> 2] = U2;
                                  c[A2 + (p2 + 24) >> 2] = 0;
                                  break;
                                } else
                                  ea();
                              } else {
                                V2 = (c[29] | 0) + a2 | 0;
                                c[29] = V2;
                                c[32] = n2;
                                c[A2 + (p2 + 4) >> 2] = V2 | 1;
                              }
                            while (0);
                          g2 = A2 + (o2 | 8) | 0;
                          break d;
                        } else
                          i3 = 552;
                      while (1) {
                        g2 = c[i3 >> 2] | 0;
                        if (g2 >>> 0 <= q2 >>> 0 ? (h2 = c[i3 + 4 >> 2] | 0, f2 = g2 + h2 | 0, f2 >>> 0 > q2 >>> 0) : 0)
                          break;
                        i3 = c[i3 + 8 >> 2] | 0;
                      }
                      i3 = g2 + (h2 + -39) | 0;
                      i3 = g2 + (h2 + -47 + ((i3 & 7 | 0) == 0 ? 0 : 0 - i3 & 7)) | 0;
                      j2 = q2 + 16 | 0;
                      i3 = i3 >>> 0 < j2 >>> 0 ? q2 : i3;
                      h2 = i3 + 8 | 0;
                      g2 = A2 + 8 | 0;
                      g2 = (g2 & 7 | 0) == 0 ? 0 : 0 - g2 & 7;
                      V2 = t2 + -40 - g2 | 0;
                      c[32] = A2 + g2;
                      c[29] = V2;
                      c[A2 + (g2 + 4) >> 2] = V2 | 1;
                      c[A2 + (t2 + -36) >> 2] = 40;
                      c[33] = c[148];
                      g2 = i3 + 4 | 0;
                      c[g2 >> 2] = 27;
                      c[h2 >> 2] = c[138];
                      c[h2 + 4 >> 2] = c[139];
                      c[h2 + 8 >> 2] = c[140];
                      c[h2 + 12 >> 2] = c[141];
                      c[138] = A2;
                      c[139] = t2;
                      c[141] = 0;
                      c[140] = h2;
                      h2 = i3 + 28 | 0;
                      c[h2 >> 2] = 7;
                      if ((i3 + 32 | 0) >>> 0 < f2 >>> 0)
                        do {
                          V2 = h2;
                          h2 = h2 + 4 | 0;
                          c[h2 >> 2] = 7;
                        } while ((V2 + 8 | 0) >>> 0 < f2 >>> 0);
                      if ((i3 | 0) != (q2 | 0)) {
                        a2 = i3 - q2 | 0;
                        c[g2 >> 2] = c[g2 >> 2] & -2;
                        c[q2 + 4 >> 2] = a2 | 1;
                        c[i3 >> 2] = a2;
                        f2 = a2 >>> 3;
                        if (a2 >>> 0 < 256) {
                          h2 = f2 << 1;
                          i3 = 144 + (h2 << 2) | 0;
                          g2 = c[26] | 0;
                          e2 = 1 << f2;
                          if (g2 & e2) {
                            d2 = 144 + (h2 + 2 << 2) | 0;
                            b2 = c[d2 >> 2] | 0;
                            if (b2 >>> 0 < (c[30] | 0) >>> 0)
                              ea();
                            else {
                              O2 = d2;
                              P2 = b2;
                            }
                          } else {
                            c[26] = g2 | e2;
                            O2 = 144 + (h2 + 2 << 2) | 0;
                            P2 = i3;
                          }
                          c[O2 >> 2] = q2;
                          c[P2 + 12 >> 2] = q2;
                          c[q2 + 8 >> 2] = P2;
                          c[q2 + 12 >> 2] = i3;
                          break;
                        }
                        d2 = a2 >>> 8;
                        if (d2)
                          if (a2 >>> 0 > 16777215)
                            h2 = 31;
                          else {
                            U2 = (d2 + 1048320 | 0) >>> 16 & 8;
                            V2 = d2 << U2;
                            T2 = (V2 + 520192 | 0) >>> 16 & 4;
                            V2 = V2 << T2;
                            h2 = (V2 + 245760 | 0) >>> 16 & 2;
                            h2 = 14 - (T2 | U2 | h2) + (V2 << h2 >>> 15) | 0;
                            h2 = a2 >>> (h2 + 7 | 0) & 1 | h2 << 1;
                          }
                        else
                          h2 = 0;
                        e2 = 408 + (h2 << 2) | 0;
                        c[q2 + 28 >> 2] = h2;
                        c[q2 + 20 >> 2] = 0;
                        c[j2 >> 2] = 0;
                        d2 = c[27] | 0;
                        b2 = 1 << h2;
                        if (!(d2 & b2)) {
                          c[27] = d2 | b2;
                          c[e2 >> 2] = q2;
                          c[q2 + 24 >> 2] = e2;
                          c[q2 + 12 >> 2] = q2;
                          c[q2 + 8 >> 2] = q2;
                          break;
                        }
                        d2 = c[e2 >> 2] | 0;
                        m:
                          do
                            if ((c[d2 + 4 >> 2] & -8 | 0) != (a2 | 0)) {
                              h2 = a2 << ((h2 | 0) == 31 ? 0 : 25 - (h2 >>> 1) | 0);
                              while (1) {
                                b2 = d2 + 16 + (h2 >>> 31 << 2) | 0;
                                e2 = c[b2 >> 2] | 0;
                                if (!e2)
                                  break;
                                if ((c[e2 + 4 >> 2] & -8 | 0) == (a2 | 0)) {
                                  Q2 = e2;
                                  break m;
                                } else {
                                  h2 = h2 << 1;
                                  d2 = e2;
                                }
                              }
                              if (b2 >>> 0 < (c[30] | 0) >>> 0)
                                ea();
                              else {
                                c[b2 >> 2] = q2;
                                c[q2 + 24 >> 2] = d2;
                                c[q2 + 12 >> 2] = q2;
                                c[q2 + 8 >> 2] = q2;
                                break h;
                              }
                            } else
                              Q2 = d2;
                          while (0);
                        d2 = Q2 + 8 | 0;
                        b2 = c[d2 >> 2] | 0;
                        V2 = c[30] | 0;
                        if (b2 >>> 0 >= V2 >>> 0 & Q2 >>> 0 >= V2 >>> 0) {
                          c[b2 + 12 >> 2] = q2;
                          c[d2 >> 2] = q2;
                          c[q2 + 8 >> 2] = b2;
                          c[q2 + 12 >> 2] = Q2;
                          c[q2 + 24 >> 2] = 0;
                          break;
                        } else
                          ea();
                      }
                    } else {
                      V2 = c[30] | 0;
                      if ((V2 | 0) == 0 | A2 >>> 0 < V2 >>> 0)
                        c[30] = A2;
                      c[138] = A2;
                      c[139] = t2;
                      c[141] = 0;
                      c[35] = c[144];
                      c[34] = -1;
                      d2 = 0;
                      do {
                        V2 = d2 << 1;
                        U2 = 144 + (V2 << 2) | 0;
                        c[144 + (V2 + 3 << 2) >> 2] = U2;
                        c[144 + (V2 + 2 << 2) >> 2] = U2;
                        d2 = d2 + 1 | 0;
                      } while ((d2 | 0) != 32);
                      V2 = A2 + 8 | 0;
                      V2 = (V2 & 7 | 0) == 0 ? 0 : 0 - V2 & 7;
                      U2 = t2 + -40 - V2 | 0;
                      c[32] = A2 + V2;
                      c[29] = U2;
                      c[A2 + (V2 + 4) >> 2] = U2 | 1;
                      c[A2 + (t2 + -36) >> 2] = 40;
                      c[33] = c[148];
                    }
                  while (0);
                b2 = c[29] | 0;
                if (b2 >>> 0 > s2 >>> 0) {
                  V2 = b2 - s2 | 0;
                  c[29] = V2;
                  g2 = c[32] | 0;
                  c[32] = g2 + s2;
                  c[g2 + (s2 + 4) >> 2] = V2 | 1;
                  c[g2 + 4 >> 2] = s2 | 3;
                  g2 = g2 + 8 | 0;
                  break;
                }
              }
              c[(Le() | 0) >> 2] = 12;
              g2 = 0;
            } else
              g2 = 0;
          }
        while (0);
      return g2 | 0;
    }
    function Ke(a2) {
      a2 = a2 | 0;
      var b2 = 0, d2 = 0, e2 = 0, f2 = 0, g2 = 0, h2 = 0, i3 = 0, j2 = 0, k2 = 0, l2 = 0, m2 = 0, n2 = 0, o2 = 0, p2 = 0, q2 = 0, r2 = 0, s2 = 0, t2 = 0, u2 = 0, v2 = 0, w2 = 0, x2 = 0, y2 = 0, z2 = 0, A2 = 0, B2 = 0;
      a:
        do
          if (a2) {
            f2 = a2 + -8 | 0;
            k2 = c[30] | 0;
            b:
              do
                if (f2 >>> 0 >= k2 >>> 0 ? (e2 = c[a2 + -4 >> 2] | 0, d2 = e2 & 3, (d2 | 0) != 1) : 0) {
                  v2 = e2 & -8;
                  w2 = a2 + (v2 + -8) | 0;
                  do
                    if (!(e2 & 1)) {
                      f2 = c[f2 >> 2] | 0;
                      if (!d2)
                        break a;
                      l2 = -8 - f2 | 0;
                      n2 = a2 + l2 | 0;
                      o2 = f2 + v2 | 0;
                      if (n2 >>> 0 < k2 >>> 0)
                        break b;
                      if ((n2 | 0) == (c[31] | 0)) {
                        g2 = a2 + (v2 + -4) | 0;
                        f2 = c[g2 >> 2] | 0;
                        if ((f2 & 3 | 0) != 3) {
                          B2 = n2;
                          g2 = o2;
                          break;
                        }
                        c[28] = o2;
                        c[g2 >> 2] = f2 & -2;
                        c[a2 + (l2 + 4) >> 2] = o2 | 1;
                        c[w2 >> 2] = o2;
                        break a;
                      }
                      d2 = f2 >>> 3;
                      if (f2 >>> 0 < 256) {
                        e2 = c[a2 + (l2 + 8) >> 2] | 0;
                        g2 = c[a2 + (l2 + 12) >> 2] | 0;
                        f2 = 144 + (d2 << 1 << 2) | 0;
                        do
                          if ((e2 | 0) != (f2 | 0)) {
                            if (e2 >>> 0 >= k2 >>> 0 ? (c[e2 + 12 >> 2] | 0) == (n2 | 0) : 0)
                              break;
                            ea();
                          }
                        while (0);
                        if ((g2 | 0) == (e2 | 0)) {
                          c[26] = c[26] & ~(1 << d2);
                          B2 = n2;
                          g2 = o2;
                          break;
                        }
                        do
                          if ((g2 | 0) == (f2 | 0))
                            b2 = g2 + 8 | 0;
                          else {
                            if (g2 >>> 0 >= k2 >>> 0 ? (h2 = g2 + 8 | 0, (c[h2 >> 2] | 0) == (n2 | 0)) : 0) {
                              b2 = h2;
                              break;
                            }
                            ea();
                          }
                        while (0);
                        c[e2 + 12 >> 2] = g2;
                        c[b2 >> 2] = e2;
                        B2 = n2;
                        g2 = o2;
                        break;
                      }
                      h2 = c[a2 + (l2 + 24) >> 2] | 0;
                      f2 = c[a2 + (l2 + 12) >> 2] | 0;
                      do
                        if ((f2 | 0) == (n2 | 0)) {
                          e2 = a2 + (l2 + 20) | 0;
                          f2 = c[e2 >> 2] | 0;
                          if (!f2) {
                            e2 = a2 + (l2 + 16) | 0;
                            f2 = c[e2 >> 2] | 0;
                            if (!f2) {
                              m2 = 0;
                              break;
                            }
                          }
                          while (1) {
                            d2 = f2 + 20 | 0;
                            b2 = c[d2 >> 2] | 0;
                            if (b2) {
                              f2 = b2;
                              e2 = d2;
                              continue;
                            }
                            d2 = f2 + 16 | 0;
                            b2 = c[d2 >> 2] | 0;
                            if (!b2)
                              break;
                            else {
                              f2 = b2;
                              e2 = d2;
                            }
                          }
                          if (e2 >>> 0 < k2 >>> 0)
                            ea();
                          else {
                            c[e2 >> 2] = 0;
                            m2 = f2;
                            break;
                          }
                        } else {
                          e2 = c[a2 + (l2 + 8) >> 2] | 0;
                          if ((e2 >>> 0 >= k2 >>> 0 ? (i3 = e2 + 12 | 0, (c[i3 >> 2] | 0) == (n2 | 0)) : 0) ? (j2 = f2 + 8 | 0, (c[j2 >> 2] | 0) == (n2 | 0)) : 0) {
                            c[i3 >> 2] = f2;
                            c[j2 >> 2] = e2;
                            m2 = f2;
                            break;
                          }
                          ea();
                        }
                      while (0);
                      if (h2) {
                        f2 = c[a2 + (l2 + 28) >> 2] | 0;
                        e2 = 408 + (f2 << 2) | 0;
                        if ((n2 | 0) == (c[e2 >> 2] | 0)) {
                          c[e2 >> 2] = m2;
                          if (!m2) {
                            c[27] = c[27] & ~(1 << f2);
                            B2 = n2;
                            g2 = o2;
                            break;
                          }
                        } else {
                          if (h2 >>> 0 < (c[30] | 0) >>> 0)
                            ea();
                          f2 = h2 + 16 | 0;
                          if ((c[f2 >> 2] | 0) == (n2 | 0))
                            c[f2 >> 2] = m2;
                          else
                            c[h2 + 20 >> 2] = m2;
                          if (!m2) {
                            B2 = n2;
                            g2 = o2;
                            break;
                          }
                        }
                        e2 = c[30] | 0;
                        if (m2 >>> 0 < e2 >>> 0)
                          ea();
                        c[m2 + 24 >> 2] = h2;
                        f2 = c[a2 + (l2 + 16) >> 2] | 0;
                        do
                          if (f2)
                            if (f2 >>> 0 < e2 >>> 0)
                              ea();
                            else {
                              c[m2 + 16 >> 2] = f2;
                              c[f2 + 24 >> 2] = m2;
                              break;
                            }
                        while (0);
                        f2 = c[a2 + (l2 + 20) >> 2] | 0;
                        if (f2)
                          if (f2 >>> 0 < (c[30] | 0) >>> 0)
                            ea();
                          else {
                            c[m2 + 20 >> 2] = f2;
                            c[f2 + 24 >> 2] = m2;
                            B2 = n2;
                            g2 = o2;
                            break;
                          }
                        else {
                          B2 = n2;
                          g2 = o2;
                        }
                      } else {
                        B2 = n2;
                        g2 = o2;
                      }
                    } else {
                      B2 = f2;
                      g2 = v2;
                    }
                  while (0);
                  if (B2 >>> 0 < w2 >>> 0 ? (p2 = a2 + (v2 + -4) | 0, q2 = c[p2 >> 2] | 0, (q2 & 1 | 0) != 0) : 0) {
                    if (!(q2 & 2)) {
                      if ((w2 | 0) == (c[32] | 0)) {
                        A2 = (c[29] | 0) + g2 | 0;
                        c[29] = A2;
                        c[32] = B2;
                        c[B2 + 4 >> 2] = A2 | 1;
                        if ((B2 | 0) != (c[31] | 0))
                          break a;
                        c[31] = 0;
                        c[28] = 0;
                        break a;
                      }
                      if ((w2 | 0) == (c[31] | 0)) {
                        A2 = (c[28] | 0) + g2 | 0;
                        c[28] = A2;
                        c[31] = B2;
                        c[B2 + 4 >> 2] = A2 | 1;
                        c[B2 + A2 >> 2] = A2;
                        break a;
                      }
                      j2 = (q2 & -8) + g2 | 0;
                      d2 = q2 >>> 3;
                      do
                        if (q2 >>> 0 >= 256) {
                          b2 = c[a2 + (v2 + 16) >> 2] | 0;
                          g2 = c[a2 + (v2 | 4) >> 2] | 0;
                          do
                            if ((g2 | 0) == (w2 | 0)) {
                              f2 = a2 + (v2 + 12) | 0;
                              g2 = c[f2 >> 2] | 0;
                              if (!g2) {
                                f2 = a2 + (v2 + 8) | 0;
                                g2 = c[f2 >> 2] | 0;
                                if (!g2) {
                                  x2 = 0;
                                  break;
                                }
                              }
                              while (1) {
                                e2 = g2 + 20 | 0;
                                d2 = c[e2 >> 2] | 0;
                                if (d2) {
                                  g2 = d2;
                                  f2 = e2;
                                  continue;
                                }
                                e2 = g2 + 16 | 0;
                                d2 = c[e2 >> 2] | 0;
                                if (!d2)
                                  break;
                                else {
                                  g2 = d2;
                                  f2 = e2;
                                }
                              }
                              if (f2 >>> 0 < (c[30] | 0) >>> 0)
                                ea();
                              else {
                                c[f2 >> 2] = 0;
                                x2 = g2;
                                break;
                              }
                            } else {
                              f2 = c[a2 + v2 >> 2] | 0;
                              if ((f2 >>> 0 >= (c[30] | 0) >>> 0 ? (t2 = f2 + 12 | 0, (c[t2 >> 2] | 0) == (w2 | 0)) : 0) ? (u2 = g2 + 8 | 0, (c[u2 >> 2] | 0) == (w2 | 0)) : 0) {
                                c[t2 >> 2] = g2;
                                c[u2 >> 2] = f2;
                                x2 = g2;
                                break;
                              }
                              ea();
                            }
                          while (0);
                          if (b2) {
                            g2 = c[a2 + (v2 + 20) >> 2] | 0;
                            f2 = 408 + (g2 << 2) | 0;
                            if ((w2 | 0) == (c[f2 >> 2] | 0)) {
                              c[f2 >> 2] = x2;
                              if (!x2) {
                                c[27] = c[27] & ~(1 << g2);
                                break;
                              }
                            } else {
                              if (b2 >>> 0 < (c[30] | 0) >>> 0)
                                ea();
                              g2 = b2 + 16 | 0;
                              if ((c[g2 >> 2] | 0) == (w2 | 0))
                                c[g2 >> 2] = x2;
                              else
                                c[b2 + 20 >> 2] = x2;
                              if (!x2)
                                break;
                            }
                            g2 = c[30] | 0;
                            if (x2 >>> 0 < g2 >>> 0)
                              ea();
                            c[x2 + 24 >> 2] = b2;
                            f2 = c[a2 + (v2 + 8) >> 2] | 0;
                            do
                              if (f2)
                                if (f2 >>> 0 < g2 >>> 0)
                                  ea();
                                else {
                                  c[x2 + 16 >> 2] = f2;
                                  c[f2 + 24 >> 2] = x2;
                                  break;
                                }
                            while (0);
                            d2 = c[a2 + (v2 + 12) >> 2] | 0;
                            if (d2)
                              if (d2 >>> 0 < (c[30] | 0) >>> 0)
                                ea();
                              else {
                                c[x2 + 20 >> 2] = d2;
                                c[d2 + 24 >> 2] = x2;
                                break;
                              }
                          }
                        } else {
                          e2 = c[a2 + v2 >> 2] | 0;
                          g2 = c[a2 + (v2 | 4) >> 2] | 0;
                          f2 = 144 + (d2 << 1 << 2) | 0;
                          do
                            if ((e2 | 0) != (f2 | 0)) {
                              if (e2 >>> 0 >= (c[30] | 0) >>> 0 ? (c[e2 + 12 >> 2] | 0) == (w2 | 0) : 0)
                                break;
                              ea();
                            }
                          while (0);
                          if ((g2 | 0) == (e2 | 0)) {
                            c[26] = c[26] & ~(1 << d2);
                            break;
                          }
                          do
                            if ((g2 | 0) == (f2 | 0))
                              r2 = g2 + 8 | 0;
                            else {
                              if (g2 >>> 0 >= (c[30] | 0) >>> 0 ? (s2 = g2 + 8 | 0, (c[s2 >> 2] | 0) == (w2 | 0)) : 0) {
                                r2 = s2;
                                break;
                              }
                              ea();
                            }
                          while (0);
                          c[e2 + 12 >> 2] = g2;
                          c[r2 >> 2] = e2;
                        }
                      while (0);
                      c[B2 + 4 >> 2] = j2 | 1;
                      c[B2 + j2 >> 2] = j2;
                      if ((B2 | 0) == (c[31] | 0)) {
                        c[28] = j2;
                        break a;
                      } else
                        g2 = j2;
                    } else {
                      c[p2 >> 2] = q2 & -2;
                      c[B2 + 4 >> 2] = g2 | 1;
                      c[B2 + g2 >> 2] = g2;
                    }
                    f2 = g2 >>> 3;
                    if (g2 >>> 0 < 256) {
                      e2 = f2 << 1;
                      g2 = 144 + (e2 << 2) | 0;
                      b2 = c[26] | 0;
                      d2 = 1 << f2;
                      if (b2 & d2) {
                        d2 = 144 + (e2 + 2 << 2) | 0;
                        b2 = c[d2 >> 2] | 0;
                        if (b2 >>> 0 < (c[30] | 0) >>> 0)
                          ea();
                        else {
                          y2 = d2;
                          z2 = b2;
                        }
                      } else {
                        c[26] = b2 | d2;
                        y2 = 144 + (e2 + 2 << 2) | 0;
                        z2 = g2;
                      }
                      c[y2 >> 2] = B2;
                      c[z2 + 12 >> 2] = B2;
                      c[B2 + 8 >> 2] = z2;
                      c[B2 + 12 >> 2] = g2;
                      break a;
                    }
                    b2 = g2 >>> 8;
                    if (b2)
                      if (g2 >>> 0 > 16777215)
                        f2 = 31;
                      else {
                        y2 = (b2 + 1048320 | 0) >>> 16 & 8;
                        z2 = b2 << y2;
                        a2 = (z2 + 520192 | 0) >>> 16 & 4;
                        z2 = z2 << a2;
                        f2 = (z2 + 245760 | 0) >>> 16 & 2;
                        f2 = 14 - (a2 | y2 | f2) + (z2 << f2 >>> 15) | 0;
                        f2 = g2 >>> (f2 + 7 | 0) & 1 | f2 << 1;
                      }
                    else
                      f2 = 0;
                    d2 = 408 + (f2 << 2) | 0;
                    c[B2 + 28 >> 2] = f2;
                    c[B2 + 20 >> 2] = 0;
                    c[B2 + 16 >> 2] = 0;
                    b2 = c[27] | 0;
                    e2 = 1 << f2;
                    c:
                      do
                        if (b2 & e2) {
                          d2 = c[d2 >> 2] | 0;
                          d:
                            do
                              if ((c[d2 + 4 >> 2] & -8 | 0) != (g2 | 0)) {
                                f2 = g2 << ((f2 | 0) == 31 ? 0 : 25 - (f2 >>> 1) | 0);
                                while (1) {
                                  b2 = d2 + 16 + (f2 >>> 31 << 2) | 0;
                                  e2 = c[b2 >> 2] | 0;
                                  if (!e2)
                                    break;
                                  if ((c[e2 + 4 >> 2] & -8 | 0) == (g2 | 0)) {
                                    A2 = e2;
                                    break d;
                                  } else {
                                    f2 = f2 << 1;
                                    d2 = e2;
                                  }
                                }
                                if (b2 >>> 0 < (c[30] | 0) >>> 0)
                                  ea();
                                else {
                                  c[b2 >> 2] = B2;
                                  c[B2 + 24 >> 2] = d2;
                                  c[B2 + 12 >> 2] = B2;
                                  c[B2 + 8 >> 2] = B2;
                                  break c;
                                }
                              } else
                                A2 = d2;
                            while (0);
                          b2 = A2 + 8 | 0;
                          d2 = c[b2 >> 2] | 0;
                          z2 = c[30] | 0;
                          if (d2 >>> 0 >= z2 >>> 0 & A2 >>> 0 >= z2 >>> 0) {
                            c[d2 + 12 >> 2] = B2;
                            c[b2 >> 2] = B2;
                            c[B2 + 8 >> 2] = d2;
                            c[B2 + 12 >> 2] = A2;
                            c[B2 + 24 >> 2] = 0;
                            break;
                          } else
                            ea();
                        } else {
                          c[27] = b2 | e2;
                          c[d2 >> 2] = B2;
                          c[B2 + 24 >> 2] = d2;
                          c[B2 + 12 >> 2] = B2;
                          c[B2 + 8 >> 2] = B2;
                        }
                      while (0);
                    B2 = (c[34] | 0) + -1 | 0;
                    c[34] = B2;
                    if (!B2)
                      b2 = 560;
                    else
                      break a;
                    while (1) {
                      b2 = c[b2 >> 2] | 0;
                      if (!b2)
                        break;
                      else
                        b2 = b2 + 8 | 0;
                    }
                    c[34] = -1;
                    break a;
                  }
                }
              while (0);
            ea();
          }
        while (0);
      return;
    }
    function Le() {
      var a2 = 0;
      a2 = 600;
      return a2 | 0;
    }
    function Me() {
      var a2 = 0;
      do
        if (!(c[144] | 0)) {
          a2 = ca(30) | 0;
          if (!(a2 + -1 & a2)) {
            c[146] = a2;
            c[145] = a2;
            c[147] = -1;
            c[148] = -1;
            c[149] = 0;
            c[137] = 0;
            c[144] = (ha(0) | 0) & -16 ^ 1431655768;
            break;
          } else
            ea();
        }
      while (0);
      return;
    }
    function Ne() {
    }
    function Oe(b2, d2, e2) {
      b2 = b2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      var f2 = 0;
      if ((e2 | 0) >= 4096)
        return ja(b2 | 0, d2 | 0, e2 | 0) | 0;
      f2 = b2 | 0;
      if ((b2 & 3) == (d2 & 3)) {
        while (b2 & 3) {
          if (!e2)
            return f2 | 0;
          a[b2 >> 0] = a[d2 >> 0] | 0;
          b2 = b2 + 1 | 0;
          d2 = d2 + 1 | 0;
          e2 = e2 - 1 | 0;
        }
        while ((e2 | 0) >= 4) {
          c[b2 >> 2] = c[d2 >> 2];
          b2 = b2 + 4 | 0;
          d2 = d2 + 4 | 0;
          e2 = e2 - 4 | 0;
        }
      }
      while ((e2 | 0) > 0) {
        a[b2 >> 0] = a[d2 >> 0] | 0;
        b2 = b2 + 1 | 0;
        d2 = d2 + 1 | 0;
        e2 = e2 - 1 | 0;
      }
      return f2 | 0;
    }
    function Pe(b2, c2, d2) {
      b2 = b2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      var e2 = 0;
      if ((c2 | 0) < (b2 | 0) & (b2 | 0) < (c2 + d2 | 0)) {
        e2 = b2;
        c2 = c2 + d2 | 0;
        b2 = b2 + d2 | 0;
        while ((d2 | 0) > 0) {
          b2 = b2 - 1 | 0;
          c2 = c2 - 1 | 0;
          d2 = d2 - 1 | 0;
          a[b2 >> 0] = a[c2 >> 0] | 0;
        }
        b2 = e2;
      } else
        Oe(b2, c2, d2) | 0;
      return b2 | 0;
    }
    function Qe(b2, d2, e2) {
      b2 = b2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      var f2 = 0, g2 = 0, h2 = 0, i3 = 0;
      f2 = b2 + e2 | 0;
      if ((e2 | 0) >= 20) {
        d2 = d2 & 255;
        h2 = b2 & 3;
        i3 = d2 | d2 << 8 | d2 << 16 | d2 << 24;
        g2 = f2 & ~3;
        if (h2) {
          h2 = b2 + 4 - h2 | 0;
          while ((b2 | 0) < (h2 | 0)) {
            a[b2 >> 0] = d2;
            b2 = b2 + 1 | 0;
          }
        }
        while ((b2 | 0) < (g2 | 0)) {
          c[b2 >> 2] = i3;
          b2 = b2 + 4 | 0;
        }
      }
      while ((b2 | 0) < (f2 | 0)) {
        a[b2 >> 0] = d2;
        b2 = b2 + 1 | 0;
      }
      return b2 - e2 | 0;
    }
    return { _free: Ke, ___errno_location: Le, _memmove: Pe, _Decoder_Interface_Decode: xa, _Decoder_Interface_exit: wa, _Encoder_Interface_init: ya, _memset: Qe, _malloc: Je, _memcpy: Oe, _Encoder_Interface_exit: za, _Decoder_Interface_init: va, _Encoder_Interface_Encode: Aa, runPostSets: Ne, stackAlloc: ma, stackSave: na, stackRestore: oa, establishStackSpace: pa, setThrew: qa, setTempRet0: ta, getTempRet0: ua };
  }(Module.asmGlobalArg, Module.asmLibraryArg, buffer);
  Module["_Encoder_Interface_Encode"] = asm["_Encoder_Interface_Encode"];
  var _free = Module["_free"] = asm["_free"];
  Module["runPostSets"] = asm["runPostSets"];
  var _memmove = Module["_memmove"] = asm["_memmove"];
  Module["_Decoder_Interface_exit"] = asm["_Decoder_Interface_exit"];
  Module["_Encoder_Interface_init"] = asm["_Encoder_Interface_init"];
  var _memset = Module["_memset"] = asm["_memset"];
  var _malloc = Module["_malloc"] = asm["_malloc"];
  var _memcpy = Module["_memcpy"] = asm["_memcpy"];
  Module["_Decoder_Interface_Decode"] = asm["_Decoder_Interface_Decode"];
  Module["_Decoder_Interface_init"] = asm["_Decoder_Interface_init"];
  Module["_Encoder_Interface_exit"] = asm["_Encoder_Interface_exit"];
  Module["___errno_location"] = asm["___errno_location"];
  Runtime.stackAlloc = asm["stackAlloc"];
  Runtime.stackSave = asm["stackSave"];
  Runtime.stackRestore = asm["stackRestore"];
  Runtime.establishStackSpace = asm["establishStackSpace"];
  Runtime.setTempRet0 = asm["setTempRet0"];
  Runtime.getTempRet0 = asm["getTempRet0"];
  function ExitStatus(status) {
    this.name = "ExitStatus";
    this.message = "Program terminated with exit(" + status + ")";
    this.status = status;
  }
  ExitStatus.prototype = new Error();
  ExitStatus.prototype.constructor = ExitStatus;
  var initialStackTop;
  dependenciesFulfilled = function runCaller() {
    if (!Module["calledRun"])
      run();
    if (!Module["calledRun"])
      dependenciesFulfilled = runCaller;
  };
  Module["callMain"] = Module.callMain = function callMain(args) {
    assert(runDependencies == 0, "cannot call main when async dependencies remain! (listen on __ATMAIN__)");
    assert(__ATPRERUN__.length == 0, "cannot call main when preRun functions remain to be called");
    args = args || [];
    ensureInitRuntime();
    var argc = args.length + 1;
    function pad() {
      for (var i3 = 0; i3 < 4 - 1; i3++) {
        argv.push(0);
      }
    }
    var argv = [allocate(intArrayFromString(Module["thisProgram"]), "i8", ALLOC_NORMAL)];
    pad();
    for (var i2 = 0; i2 < argc - 1; i2 = i2 + 1) {
      argv.push(allocate(intArrayFromString(args[i2]), "i8", ALLOC_NORMAL));
      pad();
    }
    argv.push(0);
    argv = allocate(argv, "i32", ALLOC_NORMAL);
    initialStackTop = Runtime.stackSave();
    try {
      var ret = Module["_main"](argc, argv, 0);
      exit(ret, true);
    } catch (e) {
      if (e instanceof ExitStatus) {
        return;
      } else if (e == "SimulateInfiniteLoop") {
        Module["noExitRuntime"] = true;
        Runtime.stackRestore(initialStackTop);
        return;
      } else {
        if (e && typeof e === "object" && e.stack)
          Module.printErr("exception thrown: " + [e, e.stack]);
        throw e;
      }
    } finally {
    }
  };
  function run(args) {
    args = args || Module["arguments"];
    if (runDependencies > 0) {
      return;
    }
    preRun();
    if (runDependencies > 0)
      return;
    if (Module["calledRun"])
      return;
    function doRun() {
      if (Module["calledRun"])
        return;
      Module["calledRun"] = true;
      if (ABORT)
        return;
      ensureInitRuntime();
      preMain();
      if (Module["onRuntimeInitialized"])
        Module["onRuntimeInitialized"]();
      if (Module["_main"] && shouldRunNow)
        Module["callMain"](args);
      postRun();
    }
    if (Module["setStatus"]) {
      Module["setStatus"]("Running...");
      setTimeout(function() {
        setTimeout(function() {
          Module["setStatus"]("");
        }, 1);
        doRun();
      }, 1);
    } else {
      doRun();
    }
  }
  Module["run"] = Module.run = run;
  function exit(status, implicit) {
    if (implicit && Module["noExitRuntime"]) {
      return;
    }
    if (Module["noExitRuntime"]) ; else {
      ABORT = true;
      STACKTOP = initialStackTop;
      exitRuntime();
      if (Module["onExit"])
        Module["onExit"](status);
    }
    if (ENVIRONMENT_IS_NODE) {
      process["stdout"]["once"]("drain", function() {
        process["exit"](status);
      });
      console.log(" ");
      setTimeout(function() {
        process["exit"](status);
      }, 500);
    } else if (ENVIRONMENT_IS_SHELL && typeof quit === "function") {
      quit(status);
    }
    throw new ExitStatus(status);
  }
  Module["exit"] = Module.exit = exit;
  var abortDecorators = [];
  function abort(what) {
    if (what !== void 0) {
      Module.print(what);
      Module.printErr(what);
      what = JSON.stringify(what);
    } else {
      what = "";
    }
    ABORT = true;
    var extra = "\nIf this abort() is unexpected, build with -s ASSERTIONS=1 which can give more information.";
    var output = "abort(" + what + ") at " + stackTrace() + extra;
    if (abortDecorators) {
      abortDecorators.forEach(function(decorator) {
        output = decorator(output, what);
      });
    }
    throw output;
  }
  Module["abort"] = Module.abort = abort;
  if (Module["preInit"]) {
    if (typeof Module["preInit"] == "function")
      Module["preInit"] = [Module["preInit"]];
    while (Module["preInit"].length > 0) {
      Module["preInit"].pop()();
    }
  }
  var shouldRunNow = true;
  if (Module["noInitialRun"]) {
    shouldRunNow = false;
  }
  Module["noExitRuntime"] = true;
  run();
  return AMR;
}();

class ConvertPlayer {
  constructor(opt) {
    this.extName = null;
    this.playUrl = "";
    this.audio = null;
    if (!opt.url && !opt.file) {
      console.error("url\u548Cfile\u53C2\u6570\u81F3\u5C11\u9700\u8981\u4E00\u4E2A");
      return;
    }
    if (opt.file) {
      if (!isAudio(opt.file))
        console.error("\u6587\u4EF6\u7C7B\u578B\u53EA\u80FD\u662F\u97F3\u9891\u6587\u4EF6");
      this._file = opt.file;
    }
    if (opt.url)
      this.playUrl = opt.url;
    this.extName = opt.fileType ? opt.fileType : opt.file ? getExtName(opt.file.name) : getExtName(opt.url);
    this.createPlayer();
  }
  createPlayer() {
    this.audio = document.createElement("audio");
    this.audio.controls = true;
    if (this.extName === "amr") {
      if (this._file) {
        const fr = new FileReader();
        fr.onload = (e) => {
          const wavU8Array = AMR.toWAV(new Uint8Array(e.target.result));
          const url = URL.createObjectURL(new Blob([wavU8Array], { type: "audio/wav" }));
          if (this.audio)
            this.audio.src = url;
        };
        fr.readAsArrayBuffer(this._file);
      } else {
        fetch(this.playUrl).then((response) => {
          return response.arrayBuffer();
        }).then((buffer) => {
          const wavU8Array = AMR.toWAV(new Uint8Array(buffer));
          const url = URL.createObjectURL(new Blob([wavU8Array], { type: "audio/wav" }));
          if (this.audio)
            this.audio.src = url;
        });
      }
    } else {
      if (!this.playUrl && this._file)
        this.playUrl = URL.createObjectURL(this._file);
      this.audio.src = this.playUrl;
    }
  }
  mount(parent) {
    this.audio && parent.appendChild(this.audio);
  }
}

export { AudioPlayer, ConvertPlayer };
