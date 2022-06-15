
const path = require('path')
const fs = require('fs')
const WASM_RENDERER = path.join(__dirname, '/../utilities/quake3e_opengl2_js.wasm')
const {GL, EMGL} = require('../utilities/sys_emgl.js')
const {STD} = require('../utilities/sys_std.js')

async function loadRenderer() {
  let ENV = {
		GL: GL,
		EMGL: EMGL,
    STD: STD,
  }
  if(!ENV.table) {
		const importTable = new WebAssembly.Table({ 
			initial: 2000, 
			element: 'anyfunc', 
			maximum: 10000 
		})
		ENV.table = ENV.__indirect_function_table = importTable
	}
	if(!ENV.memory) {
		ENV.memory = new WebAssembly.Memory({ 
			initial: 2100, 
			maximum: 16000,
			/* 'shared': true */
		})
	}
  Object.assign(ENV, GL, EMGL, STD)
  ENV.env = ENV.wasi_snapshot_preview1 = ENV
  ENV.imports = ENV

  let wasmModule = await WebAssembly.instantiate(
      fs.readFileSync(WASM_RENDERER), ENV)
  return wasmModule.instance.exports
}


module.exports = {
  loadRenderer,

}

