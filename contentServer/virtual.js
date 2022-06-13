
const fs = require('fs')
const path = require('path')
const {gameDirectories} = require('../contentServer/content.js')
const {
  BUILD_DIRECTORY, repackedCache, WEB_DIRECTORY,
  ASSETS_DIRECTORY, getGame
} = require('../utilities/env.js')

// virtual file-system
function buildDirectories() {
  // This includes a game directory with build/release-os-arch/baseq3a/vm/ui.qvm
  const BUILD_OSES = [
    'wasm-js', 'darwin-x86_64', 'linux-x86_64', 
    'mingw-x86_64', 'msys-x86_64', 'qvms-x86_64',
    'qvms-bytecode'
  ]
  const BUILD_MODES = ['release-', 'debug-']
    .reduce(function (arr, item) {
      return arr.concat(BUILD_OSES.map(os => item + os))
    }, [])
  const BUILD_ORDER = BUILD_MODES
    .map(mode => path.join(BUILD_DIRECTORY, mode))
    .concat([
      repackedCache(), // TODO: 
      WEB_DIRECTORY,
      ASSETS_DIRECTORY,
    ])
  return BUILD_ORDER
}

function findFile(filename) {
  if(filename.startsWith('/')) {
    filename = filename.substr(1)
  }
  let basegame = getGame()
  let BUILD_ORDER = buildDirectories()
  for(let i = 0; i < BUILD_ORDER.length; i++) {
    let newPath = path.join(BUILD_ORDER[i], filename)
    if(fs.existsSync(newPath)) {
      return newPath
    }
  }

  if(!filename.startsWith(basegame)) {
    return
  }

  let GAME_ORDER = gameDirectories()
  for(let i = 0; i < GAME_ORDER.length; i++) {
    let newPath = path.join(GAME_ORDER[i], filename.substr(basegame.length))
    if(fs.existsSync(newPath)) {
      return newPath
    }
  }

  let pk3File = filename.replace(/\.pk3.*/gi, '.pk3')
  if(pk3File.length < filename.length) {
    return findFile(pk3File)
  }
}

module.exports = {
  findFile,
  buildDirectories,
}
