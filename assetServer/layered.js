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


async function combinedDir(pk3InnerPath, orderedDir) {
  let directory = []
  let lowercasePaths = []
  // TODO: add base directory conversions
  for(let i = 0; i < orderedDir.length; i++) {
    let newDir = path.join(orderedDir[i], pk3InnerPath)
    if(!fs.existsSync(newDir)) {
      continue
    }
    if(!fs.statSync(newDir).isDirectory())  {
      continue
    }
    let subdir = fs.readdirSync(newDir)
    for(let j = 0; j < subdir.length; j++) {
      let stat = fs.statSync(path.join(newDir, subdir[j]))
      let newFile = path.join(newDir, subdir[j]) + (stat.isDirectory() ? '/' : '')
      directory.push(newFile)
      lowercasePaths.push(subdir[j].toLocaleLowerCase())
    }
  }
  let directoryFiltered = directory.filter((d, i) => d 
      && !path.basename(d).startsWith('.') 
      && lowercasePaths.indexOf(path.basename(d).toLocaleLowerCase()) == i)
  return directoryFiltered
}


async function listPk3s(modname) {
  return (await layeredDir(modname, true))
  .filter(dir => dir.match(/\.pk3/i))
  // build directories are include here in repacked because
  //   it is showing what will become, but in "Virtual" mode
  //   only what is currently built is listed with all of the
  //   alternative overrides.
  .map(pk3 => path.basename(pk3).replace(path.extname(pk3), '.pk3'))
  // always included for repack 
  //   because this is how baseq3a is built
  .concat(['pak0.pk3']).filter((p, i, a) => a.indexOf(p) == i)
}



module.exports = {
  layeredDir,
  combinedDir,
  listPk3s,
}
