const fs = require('fs')
const path = require('path')
const WEB_DIRECTORY = path.resolve(__dirname)
const ASSETS_DIRECTORY = path.resolve(__dirname + '/../../docs/')
const BUILD_DIRECTORY = path.resolve(__dirname + '/../../build/')



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
      return arr
      .concat(BUILD_OSES.map(os => item + os))
    }, [])
  const BUILD_ORDER = BUILD_MODES
    .map(mode => path.join(BUILD_DIRECTORY, mode))
    .concat([
      repackedCache, // TODO: 
      WEB_DIRECTORY,
      ASSETS_DIRECTORY,
    ])
  return BUILD_ORDER
}

function gameDirectories() {
  const GAME_DIRECTORY = path.resolve(__dirname + '/../../../' + basegame)
  const GAME_DIRECTORIES = [
    repackedCache, // TODO: 
    path.join(GAME_DIRECTORY, 'build/linux'),
    path.join(GAME_DIRECTORY, 'build/win32-qvm'),
    path.join(GAME_DIRECTORY, 'assets'),
    GAME_DIRECTORY,
  ]
  if(fs.existsSync(path.join(basepath, basegame))) {
    GAME_DIRECTORIES.push(path.join(basepath, basegame))
  }
  if(fs.existsSync(path.join(steampath, basegame))) {
    GAME_DIRECTORIES.push(path.join(steampath, basegame))
  }
  return GAME_DIRECTORIES
}


// TODO: would be cool if a virtual directory could span say: 
//   https://github.com/xonotic/xonotic-data.pk3dir
//   and build/convert from remote sources
async function serveVirtualPk3dir(filename) {
  let pk3File = filename.replace(/\.pk3.*/gi, '.pk3')
  if(pk3File.startsWith('/')) {
    pk3File = pk3File.substr(1)
  }
  let pk3Path = findFile(pk3File)
  if(!pk3Path) {
    return []
  }
  let index = await getZipIndex(pk3Path)
  let pk3InnerPath = filename.replace(/^.*?\.pk3[^\/]*?(\/|$)/gi, '')
  let directory = []
  for(let i = 0; i < index.length; i++) {
    let newPath = index[i].name.replace(/\\/ig, '/')
                               .replace(/\/$/, '')
    let currentPath = newPath.substr(0, pk3InnerPath.length)
    let relativePath = newPath.substr(pk3InnerPath.length + 1)
    let isSubdir = relativePath.indexOf('/')

    if((pk3InnerPath.length == 0 || currentPath.localeCompare(
        pk3InnerPath, 'en', { sensitivity: 'base' }) == 0)
        && relativePath.length
        // recursive directory inside pk3?
        && (isSubdir == -1 || isSubdir == relativePath.length - 1)) {
      directory.push(path.join(pk3File + 'dir', newPath))
    }
  }
  return directory
}

// virtual directory
//  TODO: use in /home/ path for async game assets
//  like switching mods, downloading skins / maps
function layeredDir(filepath) {
  if(filepath.startsWith('/')) {
    filepath = filepath.substr(1)
  }
  let result = []
  /*
  let BUILD_ORDER = buildDirectories()
  for(let i = 0; i < BUILD_ORDER.length; i++) {
    let newPath = path.join(BUILD_ORDER[i], filepath)
    if(fs.existsSync(newPath) && fs.statSync(newPath).isDirectory()) {
      result.push.apply(result, fs.readdirSync(newPath))
    }
  }
  */
  if(filepath.startsWith(basegame)) {
    let GAME_ORDER = gameDirectories()
    for(let i = 0; i < GAME_ORDER.length; i++) {
      let newPath = path.join(GAME_ORDER[i], filepath.substr(basegame.length))
      if(fs.existsSync(newPath) && fs.statSync(newPath).isDirectory()) {
        result.push.apply(result, fs.readdirSync(newPath))
      }
    }
  }
  // because even if its empty, there will be a link to parent ..
  if(result.length) {
    return result.filter((r, i, arr) => 
        !r.startsWith('.') && arr.indexOf(r) === i)
        .map(dir => path.join(filepath, dir))
  } else {
    return false
  }
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

  if(!filename.startsWith(basegame)) {
    return
  }
  let GAME_ORDER = gameDirectories()
  for(let i = 0; i < GAME_ORDER.length; i++) {
    let newPath = path.join(GAME_ORDER[i], filename.substr(basegame.length))
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
