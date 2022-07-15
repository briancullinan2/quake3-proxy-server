const path = require('path')
const fs = require('fs')
const { FS_BASEPATH, MODS_NAMES, MODS } = require('../utilities/env.js')
const { buildDirectories, gameDirectories } = require('../assetServer/virtual.js')


// virtual directory
//  TODO: use in /home/ path for async game assets
//  like switching mods, downloading skins / maps
function layeredDir(filepath, includeBuild) {
  if (filepath.startsWith('/')) {
    filepath = filepath.substr(1)
  }

  // TODO: add full paths and leave non-unique, only used in a few places now

  let result = []
  if (filepath.length == 0) {
    // list available mods
    if (fs.existsSync(FS_BASEPATH) && fs.statSync(FS_BASEPATH).isDirectory()) {
      result.push.apply(result, fs.readdirSync(FS_BASEPATH)
        .map(r => path.join(FS_BASEPATH, r)).filter(r => fs.existsSync(r)))
    }
  }

  if(includeBuild) {
    let BUILD_ORDER = buildDirectories()
    for(let i = 0; i < BUILD_ORDER.length; i++) {
      let newPath = path.join(BUILD_ORDER[i], filepath)
      if(fs.existsSync(newPath) && fs.statSync(newPath).isDirectory()) {
        result.push.apply(result, fs.readdirSync(newPath)
          .map(r => path.join(newPath, r)).filter(r => fs.existsSync(r)))
      }
    }
  }

  let basename = MODS_NAMES.indexOf(filepath.split('\/')[0].toLocaleLowerCase())
  if (basename > -1) {
    let GAME_ORDER = gameDirectories(MODS[basename])
    for (let i = 0; i < GAME_ORDER.length; i++) {
      let newPath = path.join(GAME_ORDER[i], filepath.substr(MODS[basename].length))
      if (fs.existsSync(newPath) && fs.statSync(newPath).isDirectory()) {
        result.push.apply(result, fs.readdirSync(newPath)
          .map(r => path.join(newPath, r)).filter(r => fs.existsSync(r)))
      }
    }
  }

  // because even if its empty, there will be a link to parent ..
  if (result.length) {
    return result.filter((r, i, arr) => !path.basename(r).startsWith('.') 
      /* && arr.indexOf(r) === i */)
  } else {
    return false
  }
}


async function combinedDir(orderedDir) {
  let directory = []
  let lowercasePaths = []
  // TODO: add base directory conversions
  for(let i = 0; i < orderedDir.length; i++) {
    if(!fs.existsSync(orderedDir[i])) {
      continue
    }
    if(!fs.statSync(orderedDir[i]).isDirectory())  {
      continue
    }
    let subdir = fs.readdirSync(orderedDir[i])
    for(let j = 0; j < subdir.length; j++) {
      if(!fs.existsSync(path.join(orderedDir[i], subdir[j]))) {
        continue
      }
      let stat = fs.statSync(path.join(orderedDir[i], subdir[j]))
      let newFile = path.join(orderedDir[i], subdir[j]) + (stat.isDirectory() ? '/' : '')
      directory.push(newFile)
      lowercasePaths.push(subdir[j].toLocaleLowerCase())
    }
  }
  let directoryFiltered = directory.filter((d, i) => d 
      && !path.basename(d).startsWith('.') 
      && lowercasePaths.indexOf(path.basename(d).toLocaleLowerCase()) == i)
  return directoryFiltered
}


function filterPk3(file, i, arr) {
  return !file.startsWith('.') && file.match(/\.pk3$/i) && arr.indexOf(file) === i
}


async function listPk3s(modname) {
  return (await layeredDir(modname, true))
  .filter(filterPk3) // unique / first - basename
  // build directories are include here in repacked because
  //   it is showing what will become, but in "Virtual" mode
  //   only what is currently built is listed with all of the
  //   alternative overrides.
  .map(pk3 => path.join(modname, 
    path.basename(pk3).replace(path.extname(pk3), '.pk3')))
}



module.exports = {
  layeredDir,
  combinedDir,
  listPk3s,
  filterPk3,
}
