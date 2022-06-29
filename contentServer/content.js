const fs = require('fs')
const path = require('path')
const { getIndex } = require('../utilities/zip.js')
const { findFile, gameDirectories } = require('../contentServer/virtual.js')
const { AUDIO_FORMATS, IMAGE_FORMATS, FS_BASEPATH, MODS_NAMES, MODS } = require('../utilities/env.js')


function unsupportedImage(imagePath) {
  if(!IMAGE_FORMATS.includes(path.extname(imagePath))) {
    return
  }
  if (imagePath.match(/levelshots\//i)) {
    isUnsupportedImage = imagePath.match(/\.tga$|\.dds$|\.bmp$|\.png$/gi)
  } else {
    isUnsupportedImage = imagePath.match(/\.tga$|\.dds$|\.bmp$/gi)
  }
  if(isUnsupportedImage || !imagePath.includes('.')) {
    return imagePath
  }
}

function unsupportedAudio(audioPath) {
  if(!AUDIO_FORMATS.includes(path.extname(audioPath))) {
    return
  }
  let isUnsupportedAudio = !audioPath.match(/\.ogg$/gi)
  if(isUnsupportedAudio || !audioPath.includes('.')) {
    return audioPath
  }
}

// TODO: would be cool if a virtual directory could span say: 
//   https://github.com/xonotic/xonotic-data.pk3dir
//   and build/convert from remote sources
async function serveVirtualPk3dir(filename) {
  let pk3File = filename.replace(/\.pk3.*/gi, '.pk3')
  if (pk3File.startsWith('/')) {
    pk3File = pk3File.substr(1)
  }
  let pk3Path = findFile(pk3File)
  if (!pk3Path) {
    return []
  }
  let index = await getIndex(pk3Path)
  let pk3InnerPath = filename.replace(/^.*?\.pk3[^\/]*?(\/|$)/gi, '')
  let directory = []
  for (let i = 0; i < index.length; i++) {
    let newPath = index[i].name.replace(/\\/ig, '/')
      .replace(/\/$/, '')
    let currentPath = newPath.substr(0, pk3InnerPath.length)
    let relativePath = newPath.substr(pk3InnerPath.length + 1)
    let isSubdir = relativePath.indexOf('/')

    if ((pk3InnerPath.length == 0 
      || (currentPath.localeCompare(pk3InnerPath, 'en', { sensitivity: 'base' }) == 0)
      && relativePath.length && newPath[pk3InnerPath.length] == '/')
      // recursive directory inside pk3?
      && (isSubdir == -1 || isSubdir == relativePath.length - 1)
      && newPath.length > currentPath.length
    ) {
      console.log(newPath, currentPath)
      directory.push(path.join(pk3File + 'dir', newPath))
    }
  }
  return directory
}

// virtual directory
//  TODO: use in /home/ path for async game assets
//  like switching mods, downloading skins / maps
function layeredDir(filepath) {
  if (filepath.startsWith('/')) {
    filepath = filepath.substr(1)
  }
  let result = []
  if (filepath.length == 0) {
    // list available mods
    if (fs.existsSync(FS_BASEPATH) && fs.statSync(FS_BASEPATH).isDirectory()) {
      result.push.apply(result, fs.readdirSync(FS_BASEPATH))
    }
  }
  /*
  let BUILD_ORDER = buildDirectories()
  for(let i = 0; i < BUILD_ORDER.length; i++) {
    let newPath = path.join(BUILD_ORDER[i], filepath)
    if(fs.existsSync(newPath) && fs.statSync(newPath).isDirectory()) {
      result.push.apply(result, fs.readdirSync(newPath))
    }
  }
  */
  let basename = MODS_NAMES.indexOf(filepath.split('\/')[0].toLocaleLowerCase())
  if (basename > -1) {
    let GAME_ORDER = gameDirectories(MODS[basename])
    for (let i = 0; i < GAME_ORDER.length; i++) {
      let newPath = path.join(GAME_ORDER[i], filepath.substr(MODS[basename].length))
      if (fs.existsSync(newPath) && fs.statSync(newPath).isDirectory()) {
        result.push.apply(result, fs.readdirSync(newPath))
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


/*
Theory: instead of trying to modify qcommon/files.c
 to get it to load different PK3s, I'll provide the 
 pk3s the server thinks the client should have from
 the proxy server. This would simplify repacking, 
 but wont necessarily help UDP downloads unless I
 added some sort of mod_rewrite type setting for pk3s.
Server admin control over pk3 content is a long 
 outstanding issue.
*/
async function serveVirtual(request, response, next) {
  let isJson = request.url.match(/\?json/)
  let filename = request.url.replace(/\?.*$/, '')
  let directory = layeredDir(filename)

  // TODO: server a file from inside a pk3 to the pk3dirs
  // TODO: move to layeredDir()?
  if (filename.includes('.pk3')) {
    let pk3directory = await serveVirtualPk3dir(filename)
    if (!directory) {
      directory = []
    }
    for (let i = 0; i < pk3directory.length; i++) {
      if (!directory.includes(pk3directory[i])) {
        directory.push(pk3directory[i])
      }
    }
  }
  

  for (let i = 0; i < directory.length; i++) {
    if(directory[i].endsWith('.pk3')) {
      if (!directory.includes(directory[i] + 'dir')) {
        directory.push(directory[i] + 'dir')
      }
    }
  }

  // duck out early
  if (!directory || directory.length == 0) {
    return next()
  }

  directory.sort()

  // at least one directory exists
  if (isJson) {
    return response.json(directory)
  } else {
    return '<ol>'
      + response.send(directory.map(node =>
        `<li><a href="/${node}?alt">${node}</a></li>`).join('\n'))
      + '</ol>'
  }
}

module.exports = {
  gameDirectories,
  serveVirtual,
  layeredDir,
  unsupportedImage,
  unsupportedAudio,
}

