
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
  const GAME_MODS = getGames()
  if(!GAME_MODS.includes(basegame)
    // CODE REVIEW: allow other detected directory names to
    //   be used in development automatically? might make setup easier.
    && !MODS_NAMES.includes(basegame.toLocaleLowerCase())) {
    return []
  }
  const GAME_DIRECTORY = path.resolve(__dirname + '/../../' + basegame)
  const BUILD_MODES = buildModes()
  const GAME_DIRECTORIES = [
    path.join(GAME_DIRECTORY, 'build/linux'),
    path.join(GAME_DIRECTORY, 'build/win32-qvm'),
    path.join(GAME_DIRECTORY, 'build/linux/build'),
    path.join(GAME_DIRECTORY, 'build/win32-qvm/build'),
    path.join(GAME_DIRECTORY, 'assets'),
    GAME_DIRECTORY,
  ].filter(dir => unexisting || fs.existsSync(dir))
  GAME_DIRECTORIES.push.apply(GAME_DIRECTORIES, GAME_DIRECTORIES.reduce((list, dir) => {
    list.push.apply(list, BUILD_MODES.map(dir2 => dir + '/' + dir2 + '/' + basegame))
    list.push.apply(list, BUILD_MODES.map(dir2 => dir + '/' + dir2 + '/' + basegame.toLocaleLowerCase()))
    return list
  }, []))
  GAME_DIRECTORIES.push(path.join(FS_GAMEHOME, basegame))
  for(let i = 0; i < APPLICATIONS.length; i++) {
    GAME_DIRECTORIES.push(path.join(APPLICATIONS[i].basepath, basegame))
    GAME_DIRECTORIES.push(path.join(APPLICATIONS[i].basepath, basegame.toLocaleLowerCase()))
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


function findFile(filename) {
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
