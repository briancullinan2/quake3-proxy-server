
const fs = require('fs')
const path = require('path')
const {
  BUILD_DIRECTORY, repackedCache, WEB_DIRECTORY,
  ASSETS_DIRECTORY, FS_BASEPATH, FS_GAMEHOME, STEAMPATH,
  MODS_NAMES, MODS,
} = require('../utilities/env.js')


function gameDirectories(basegame) {
  const GAME_DIRECTORY = path.resolve(__dirname + '/../../' + basegame)
  const GAME_DIRECTORIES = [
    repackedCache(), // TODO: 
    path.join(GAME_DIRECTORY, 'build/linux'),
    path.join(GAME_DIRECTORY, 'build/win32-qvm'),
    path.join(GAME_DIRECTORY, 'assets'),
    GAME_DIRECTORY,
  ]
  if(fs.existsSync(path.join(FS_GAMEHOME, basegame))) {
    GAME_DIRECTORIES.push(path.join(FS_GAMEHOME, basegame))
  }
  if(fs.existsSync(path.join(FS_BASEPATH, basegame))) {
    GAME_DIRECTORIES.push(path.join(FS_BASEPATH, basegame))
  }
  if(fs.existsSync(path.join(STEAMPATH, basegame))) {
    GAME_DIRECTORIES.push(path.join(STEAMPATH, basegame))
  }
  if(fs.existsSync(path.join(FS_BASEPATH, basegame.toLocaleLowerCase()))) {
    GAME_DIRECTORIES.push(path.join(FS_BASEPATH, basegame.toLocaleLowerCase()))
  }
  if(fs.existsSync(path.join(STEAMPATH, basegame.toLocaleLowerCase()))) {
    GAME_DIRECTORIES.push(path.join(STEAMPATH, basegame.toLocaleLowerCase()))
  }
  return GAME_DIRECTORIES
}

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
      ASSETS_DIRECTORY, // last because least reliable
    ])
  return BUILD_ORDER
}

function findFile(filename) {
  if(filename.startsWith('/')) {
    filename = filename.substr(1)
  }

  let BUILD_ORDER = buildDirectories()
  for(let i = 0; i < BUILD_ORDER.length; i++) {
    let newPath = path.join(BUILD_ORDER[i], filename)
    if(fs.existsSync(newPath)) {
      return newPath
    }
  }

  let basename = MODS_NAMES.indexOf(filename.split('\/')[0].toLocaleLowerCase())
  if(basename == -1) {
    return
  }

  let GAME_ORDER = gameDirectories(MODS[basename])
  for(let i = 0; i < GAME_ORDER.length; i++) {
    let newPath = path.join(GAME_ORDER[i], filename.substr(MODS[basename].length))
    console.log(newPath)
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
  gameDirectories,
}
