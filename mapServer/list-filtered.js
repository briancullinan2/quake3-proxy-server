const path = require('path')
const fs = require('fs')

const { findFile, gameDirectories } = require('../assetServer/virtual.js')
const { SUPPORTED_FORMATS, IMAGE_FORMATS, AUDIO_FORMATS, repackedCache, getGames } = require('../utilities/env.js')
const { calculateSize } = require('../utilities/watch.js')
const { EXISTING_ZIPS, indexedSize, filteredDirectory, indexedDate, fileKey } = require('../utilities/zip.js')
const { CONVERTED_IMAGES } = require('../cmdServer/cmd-convert.js')


// TODO: would be cool if a virtual directory could span say: 
//   https://github.com/xonotic/xonotic-data.pk3dir
//   and build/convert from remote sources


// TODO: replace listGames()
async function filteredGames() {
  let allGames = getGames().map(game => ({
    isDirectory: true,
    name: game,
    absolute: '(virtual)/.',
    exists: true,
    link: path.join('/repacked', game) + '/',
  })).map(game => [game].concat(gameDirectories(game.name)
    .map(gameDir => Object.assign(fs.statSync(gameDir), {
      isDirectory: true,
      name: path.basename(path.dirname(gameDir)) + '/' + path.basename(gameDir),
      absolute: path.dirname(gameDir),
      exists: false,
      link: path.join('/repacked', game.name) + '/'
    }))))
    .flat(1)
  return allGames
}


async function filteredPk3Directory(pk3InnerPath, newFile, modname) {
  let pk3Dir = newFile.replace(path.extname(newFile), '.pk3dir')
  let zeroTimer = new Promise(resolve => setTimeout(
    resolve.bind(null, '0B (Calculating)'), 200))
  let voidTimer = new Promise(resolve => setTimeout(
    resolve.bind(null, void 0), 200))
  let CACHE_ORDER = repackedCache()

  let result = await filteredDirectory(pk3InnerPath, newFile)
  let directory = result.map(async file => {
    let localPath
    let exists = false
    let fileName = path.basename(file.name)
    let size = file.size
    for (let i = 0; i < CACHE_ORDER.length; i++) {
      // TODO: is pak0.pk3?
      localPath = path.join(CACHE_ORDER[i], path.basename(pk3Dir), pk3InnerPath, fileName)
      //let localPath = path.join(CACHE_ORDER[i], pk3InnerPath, fileName)
      if (fs.existsSync(localPath)) {
        exists = true
        size = Promise.any([calculateSize(localPath), zeroTimer])
        break
      } else {
        localPath = null
      }
    }
    let mtime = new Date(file.time)
    if (!localPath) {
      localPath = findFile(path.join(modname, pk3InnerPath, fileName))
      if(!localPath) {
        localPath = newFile
      } else {
        exists = true
      }
      if (file.isDirectory) {
        size = Promise.any([indexedSize(path.join(pk3InnerPath, fileName), newFile), zeroTimer])
        mtime = Promise.any([indexedDate(path.join(pk3InnerPath, fileName), newFile), voidTimer])
          .then(time => time ? new Date(time) : void 0)
      }
    }
    if (typeof CONVERTED_IMAGES[path.join(newFile, pk3InnerPath, fileName)] != 'undefined') {
      exists = true
    }
    return Object.assign({}, file, {
      // TODO: repackedCache() absolute path
      mtime: await mtime,
      size: await size,
      name: fileName,
      exists: exists,
      absolute: (typeof CONVERTED_IMAGES[path.join(newFile, pk3InnerPath, fileName)] != 'undefined'
        ? '(in memory) ' : '') + path.basename(path.dirname(path.dirname(localPath)))
        + '/' + path.basename(path.dirname(localPath)) + '/.',
    })
  })

  return await Promise.all(directory)
}




async function filteredPk3List(modname, pk3Names) {
  let CACHE_ORDER = repackedCache()
  let directory = pk3Names.reduce((list, pk3) => {
    let pk3Name = path.basename(pk3).replace(path.extname(pk3), '.pk3')
    let newFile
    for (let i = 0; i < CACHE_ORDER.length; i++) {
      let localFile = path.join(CACHE_ORDER[i], pk3Name + 'dir')
      if (fs.existsSync(localFile)) {
        newFile = localFile
      }
    }
    if (!newFile) {
      newFile = findFile(modname + '/' + pk3Name)
    }
    if (!newFile) {
      newFile = findFile(modname + '/' + pk3Name + 'dir')
    }
    if (newFile) {
      list.push(newFile)
    }
    return list
  }, []).map(newFile => {
    let pk3Name = newFile.replace(path.extname(newFile), '.pk3')
    let pk3Dir = newFile.replace(path.extname(newFile), '.pk3dir')
    let loaded = typeof EXISTING_ZIPS[pk3Name] != 'undefined'
    return Object.assign(fs.statSync(newFile), {
      exists: loaded || fs.existsSync(pk3Dir),
      name: path.basename(pk3Dir),
      absolute: (loaded ? '(in memory) ' : '')
        + path.basename(path.dirname(path.dirname(pk3Dir)))
        + '/' + path.basename(path.dirname(pk3Dir)) + '/.',
      isDirectory: true,
      link: path.join('/repacked', modname, path.basename(pk3Dir)) + '/'
    })
  })
  return directory
}


module.exports = {
  filteredGames,
  filteredPk3Directory,
  filteredPk3List,
}
