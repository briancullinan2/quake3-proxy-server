
const fs = require('fs')
const path = require('path')
const {
  BUILD_DIRECTORY, WEB_DIRECTORY, FS_GAMEHOME, MODS_NAMES, APPLICATIONS,
  ASSETS_DIRECTORY, getGames, 
} = require('../utilities/env.js')
const GAMEDIRS = {}

function gameDirectories(basegame, unexisting) {
  if(!unexisting && typeof GAMEDIRS[basegame] != 'undefined') {
    return GAMEDIRS[basegame]
  }

  const GAME_MODS = getGames() //.concat(Object.values(MODS_NAMES))
  const INCLUDE_DIRS = [
    'build/linux',
    'build/win32-qvm',
    'build/linux/build',
    'build/win32-qvm/build',
    'build',
    'assets',
  ]

  const BASE_DIRECTORIES = []
  for(let j = 0; j < GAME_MODS.length; j++) {
    if(GAME_MODS[j].localeCompare(basegame, 'en', {sensitivity: 'base'}) != 0) {
      continue
    }

    const GAME_DIRECTORY = path.resolve(__dirname + '/../../' + GAME_MODS[j])
    const includes = INCLUDE_DIRS.map(dir => path.join(GAME_DIRECTORY, dir))
    for(let i = 0; i < includes.length; i++) {
      BASE_DIRECTORIES.push(includes[i])
    }
    BASE_DIRECTORIES.push(GAME_DIRECTORY)
  }

  const BUILD_MODES = buildModes().concat([
    'release-darwin-x86', 'release-linux-x86', 
    'release-mingw-x86', 'release-msys-x86', 'release-qvms-x86',
    'debug-darwin-x86', 'debug-linux-x86', 
    'debug-mingw-x86', 'debug-msys-x86', 'debug-qvms-x86'
  ])
  const GAME_DIRECTORIES = [].concat(BASE_DIRECTORIES)
  for(let j = 0; j < GAME_MODS.length; j++) {
    if(GAME_MODS[j].localeCompare(basegame, 'en', {sensitivity: 'base'}) != 0) {
      continue
    }

    for(let i = 0; i < BASE_DIRECTORIES.length; i++) {
      GAME_DIRECTORIES.push.apply(GAME_DIRECTORIES, 
          BUILD_MODES.map(dir2 => GAME_DIRECTORIES[i] + '/' + dir2 + '/' + GAME_MODS[j]))
      GAME_DIRECTORIES.push.apply(GAME_DIRECTORIES, 
          BUILD_MODES.map(dir2 => GAME_DIRECTORIES[i] + '/' + dir2 + '/' + GAME_MODS[j].toLocaleLowerCase()))
    }

    GAME_DIRECTORIES.push(path.join(FS_GAMEHOME, GAME_MODS[j]))
    for(let i = 0; i < APPLICATIONS.length; i++) {
      GAME_DIRECTORIES.push(path.join(APPLICATIONS[i].basepath, GAME_MODS[j]))
      GAME_DIRECTORIES.push(path.join(APPLICATIONS[i].basepath, GAME_MODS[j].toLocaleLowerCase()))
    }
  }
  // store for later use, because of live reloading we don't need to update this every time
  GAMEDIRS[basegame] = GAME_DIRECTORIES
    .filter(g => (unexisting || fs.existsSync(g)))
    .filter((g, i, arr) => arr.indexOf(g) == i)
  return GAMEDIRS[basegame]
}





function buildModes() {
  const BUILD_OSES = [
    'wasm-js', 'darwin-x86_64', 'linux-x86_64', 
    'mingw-x86_64', 'msys-x86_64', 'qvms-x86_64',
    'qvms-bytecode'
  ]
  const BUILD_MODES = ['release-', 'debug-']
    .reduce(function (arr, item) {
      return arr.concat(BUILD_OSES.map(os => item + os))
    }, [])
  return BUILD_MODES
}




// virtual file-system
function buildDirectories() {
  // This includes a game directory with build/release-os-arch/baseq3a/vm/ui.qvm
  const BUILD_MODES = buildModes()
  const BUILD_ORDER = BUILD_MODES
    .map(mode => path.join(BUILD_DIRECTORY, mode))
    .concat([
      ASSETS_DIRECTORY,
      WEB_DIRECTORY, // last because least reliable
    ])
  return BUILD_ORDER
}






// prevent lots of file-system checks by caching real file's paths here
const CACHY_PATHY = {}


function findFile(filename, findPk3File) {
  if(filename.startsWith('/')) {
    filename = filename.substr(1)
  }
  // TODO: verify all these paths reset the FS-watcher
  if(typeof CACHY_PATHY[filename.toLocaleLowerCase()] != 'undefined') {
    return CACHY_PATHY[filename.toLocaleLowerCase()]
  }

  let BUILD_ORDER = buildDirectories()
  for(let i = 0; i < BUILD_ORDER.length; i++) {
    let newPath = path.join(BUILD_ORDER[i], filename)
    if(fs.existsSync(newPath)) {
      return (CACHY_PATHY[filename.toLocaleLowerCase()] = newPath)
    }
  }

  let modname = filename.split('/')[0]
  if(!modname || modname.length == 0) {
    return
  }

  let GAME_ORDER = gameDirectories(modname)
  for(let i = 0; i < GAME_ORDER.length; i++) {
    let newPath = path.join(GAME_ORDER[i], filename.substr(modname.length))
    if(fs.existsSync(newPath)) {
      return (CACHY_PATHY[filename.toLocaleLowerCase()] = newPath)
    }
  }

  if(findPk3File === false) {
    return
  }

  // no cachy
  let pk3File = filename.replace(/\.pk3.*/gi, '.pk3')
  if(pk3File.length < filename.length) {
    return findFile(pk3File)
  }
}



module.exports = {
  CACHY_PATHY,
  findFile,
  buildDirectories,
  gameDirectories,
}
