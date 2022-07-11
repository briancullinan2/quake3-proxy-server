const path = require('path')
const fs = require('fs')

const { findFile, gameDirectories } = require('../assetServer/virtual.js')
const { SUPPORTED_FORMATS, IMAGE_FORMATS, AUDIO_FORMATS, repackedCache, getGames} = require('../utilities/env.js')
const { calculateSize } = require('../utilities/watch.js')
const { EXISTING_ZIPS, indexedSize, filteredDirectory, indexedDate } = require('../utilities/zip.js')
const { CONVERTED_IMAGES } = require('../cmdServer/cmd-convert.js')


// TODO: would be cool if a virtual directory could span say: 
//   https://github.com/xonotic/xonotic-data.pk3dir
//   and build/convert from remote sources


// TODO: replace listGames()
async function filteredGames(isIndex, response) {
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
  let result = await filteredDirectory(pk3InnerPath, newFile)
  let zeroTimer = new Promise(resolve => setTimeout(
      resolve.bind(null, '0B (Calculating)'), 200))
  let voidTimer = new Promise(resolve => setTimeout(
    resolve.bind(null, void 0), 200))
    let CACHE_ORDER = repackedCache()
  
  let supported = result.filter(file => file.isDirectory
  //  || SUPPORTED_FORMATS.includes(path.extname(file.name))
    || IMAGE_FORMATS.includes(path.extname(file.name))
    || AUDIO_FORMATS.includes(path.extname(file.name))
  ).map(async file => {
    let localPath 
    let exists = false
    let fileName = path.basename(file.name)
    let size = file.size
    for(let i = 0; i < CACHE_ORDER.length; i++) {
      // TODO: is pak0.pk3?
      localPath = path.join(CACHE_ORDER[i], path.basename(pk3Dir), pk3InnerPath, fileName)
      //let localPath = path.join(CACHE_ORDER[i], pk3InnerPath, fileName)
      if(fs.existsSync(localPath)) {
        exists = true
        size = Promise.any([ calculateSize(localPath), zeroTimer ])
        break
      } else {
        localPath = null
      }
    }
    let mtime = new Date(file.time)
    if(!localPath) {
      exists = !!findFile(path.join(pk3InnerPath, fileName))
      localPath = newFile
      if(file.isDirectory) {
        size = Promise.any([ indexedSize(path.join(pk3InnerPath, fileName), newFile), zeroTimer ])
        mtime = Promise.any([ indexedDate(path.join(pk3InnerPath, fileName), newFile), voidTimer ])
          .then(time => time ? new Date(time) : void 0)
      }
    }
    if(typeof CONVERTED_IMAGES[path.join(newFile, pk3InnerPath, fileName)] != 'undefined') {
      exists = true
    }
    return Object.assign({}, file, {
      // TODO: repackedCache() absolute path
      mtime: await mtime,
      size: await size,
      isDirectory: true,
      name: fileName,
      exists: exists,
      link: path.join('/repacked', modname, path.basename(pk3Dir),
          file.name) + (file.isDirectory ? '/' : ''),
      absolute: (typeof CONVERTED_IMAGES[path.join(newFile, pk3InnerPath, fileName)] != 'undefined'
          ? '(in memory) ' : '') + path.basename(path.dirname(path.dirname(localPath))) 
          + '/' + path.basename(path.dirname(localPath)) + '/.',
    })
  })

  //if(result.length != supported.length) {
  let excluded = (result.length - supported.length)
  if(excluded > 0) {
    supported.push({
      name: excluded + ' file' + (excluded > 1 ? 's' : '') + ' excluded.',
      exists: false,
      link: path.join('/' + modname, path.basename(pk3Dir), pk3InnerPath) + '/',
    })
  } else {
    supported.push({
      name: 'View in virtual directory.',
      exists: false,
      link: path.join('/' + modname, path.basename(pk3Dir), pk3InnerPath) + '/',
    })  
  }
  //}
  return await Promise.all(supported)
  /* await Promise.all(result.map(async dir => ({
    name: path.basename(dir),
    absolute: dir,
    size: await Promise.any([ calculateSize(GAME_ORDER[i]), zeroTimer ])
  })))*/
}


async function filteredPk3List(modname, pk3Names) {
  let CACHE_ORDER = repackedCache()
  let directory = pk3Names.reduce((list, pk3) => {
    let pk3Name = path.basename(pk3).replace(path.extname(pk3), '.pk3')
    let newFile
    for(let i = 0; i < CACHE_ORDER.length; i++) {
      let localFile = path.join(CACHE_ORDER[i], pk3Name + 'dir')
      if(fs.existsSync(localFile)) {
        newFile = localFile
      }
    }
    if(!newFile) {
      newFile = findFile(modname + '/' + pk3Name)
    }
    if(!newFile) {
      newFile = findFile(modname + '/' + pk3Name + 'dir')
    }
    if(newFile) {
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
