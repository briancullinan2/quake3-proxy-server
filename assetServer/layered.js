const path = require('path')
const fs = require('fs')
const { MODS_NAMES, MODS } = require('../utilities/env.js')
const { buildDirectories, gameDirectories } = require('../assetServer/virtual.js')


// virtual directory
//  TODO: use in /home/ path for async game assets
//  like switching mods, downloading skins / maps
function layeredDir(filepath, includeBuild) {
  if (filepath.startsWith('/')) {
    filepath = filepath.substr(1)
  }
  let result = []
  if (filepath.length == 0) {
    // list available mods
    if (fs.existsSync(FS_BASEPATH) && fs.statSync(FS_BASEPATH).isDirectory()) {
      result.push.apply(result, fs.readdirSync(FS_BASEPATH).filter(r => fs.existsSync(path.join(FS_BASEPATH, r))))
    }
  }

  if(includeBuild) {
    let BUILD_ORDER = buildDirectories()
    for(let i = 0; i < BUILD_ORDER.length; i++) {
      let newPath = path.join(BUILD_ORDER[i], filepath)
      if(fs.existsSync(newPath) && fs.statSync(newPath).isDirectory()) {
        result.push.apply(result, fs.readdirSync(newPath).filter(r => fs.existsSync(path.join(newPath, r))))
      }
    }
  }

  let basename = MODS_NAMES.indexOf(filepath.split('\/')[0].toLocaleLowerCase())
  if (basename > -1) {
    let GAME_ORDER = gameDirectories(MODS[basename])
    for (let i = 0; i < GAME_ORDER.length; i++) {
      let newPath = path.join(GAME_ORDER[i], filepath.substr(MODS[basename].length))
      if (fs.existsSync(newPath) && fs.statSync(newPath).isDirectory()) {
        result.push.apply(result, fs.readdirSync(newPath).filter(r => fs.existsSync(path.join(newPath, r))))
      }
    }
  }

  // because even if its empty, there will be a link to parent ..
  if (result.length) {
    return result.filter((r, i, arr) =>
      !r.startsWith('.') && arr.indexOf(r) === i)
      .map(dir => path.join(filepath, dir))
  } else {
    return false
  }
}

module.exports = {
  layeredDir,
}
