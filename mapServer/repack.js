const fs = require('fs')
const path = require('path')

const { findFile, modDirectory } = require('../contentServer/virtual.js')
const { IMAGE_FORMATS, AUDIO_FORMATS, repackedCache } = require('../utilities/env.js')
const { MAP_DICTIONARY, sourcePk3Download } = require('../mapServer/serve-download.js')
const { streamFileKey } = require('../utilities/zip.js')
const { execCmd } = require('../utilities/exec.js')
const { unsupportedImage, unsupportedAudio } = require('../contentServer/content.js')
const { unpackBasegame, alternateImage, alternateAudio } = require('../mapServer/unpack.js')
const { rebuildPalette } = require('../mapServer/palette.js')



async function repackPk3(directory, newZip) {
  let first = true
  for (let i = 0; i < directory.length; i++) {
    if(await unsupportedImage(directory[i])) {
      continue
    }
    if(await unsupportedAudio(directory[i])) {
      continue
    }

    console.log(directory[i])
    let newDir = directory[i].replace(/\.pk3.*/gi, '.pk3dir')
    let pk3InnerPath = directory[i].replace(/^.*?\.pk3[^\/]*?(\/|$)/gi, '')
    let startArgs = []
    if(!first) {
      startArgs.push('-u')
    }
    startArgs.push.apply(startArgs, [
      '../' + path.basename(newZip), path.join('./', pk3InnerPath)
    ])
    let output = await execCmd(
      //process.env.SHELL, ['-c', 'pwd'
      'zip', startArgs, { cwd: newDir, /* shell: true */ })
    console.log(output)
    first = false
  }
  return newZip
}


async function repackBasemap(mapname) {
  // TODO: load the map in renderer, get list of loaded images / shaders available 
  //   on server, and package into new converted / compressed zip
  
}

async function serveFinished(request, response, next) {
  let filename = request.url.replace(/\?.*$/, '')
  if(filename.startsWith('/')) {
    filename = filename.substr(1)
  }

  let mapname = path.basename(filename).replace('.pk3', '').toLocaleLowerCase()
  if (mapname.localeCompare('pak0', 'en', { sensitivity: 'base' }) == 0) {
    // TODO: repack mod directory pk3s into 1 overlapping 
    //   (i.e. do the same virtual combination the 
    //      engine does and recompile)
    // TODO: get index of all pk3 in non-cache game directories,
    //   make a new pak with combined file-system
    let newZip = path.join(repackedCache(), 'pak0.pk3')
    if(!fs.existsSync(newZip)) {
      let newZip = path.join(repackedCache(), 'pak0.pk3')
      let filtered = await unpackBasegame(newZip)
      filtered.push(await rebuildPalette(filtered))
      newZip = await repackPk3(filtered, newZip)
    }
    return response.sendFile(newZip, {
      headers: { 'content-disposition': 
        `attachment; filename="pak0.pk3"` }
    })
  }

  // repack base-maps for web
  if(typeof MAP_DICTIONARY[mapname] == 'undefined') {
    return next(new Error('File not found: ' + filename))
  }
  if(MAP_DICTIONARY[mapname].substr(0, 3) == 'pak'
    && MAP_DICTIONARY[mapname].charCodeAt(3) - '0'.charCodeAt(0) < 9) {
    return repackBasemap(mapname)
  }

  // download pk3 and repack
  newFile = await sourcePk3Download(filename)
  if (!newFile.startsWith(repackedCache())) {
    newFile = await repackPk3(newFile)
  }
  return response.sendFile(newFile, {
    headers: { 'content-disposition': 
        `attachment; filename="${path.basename(newFile)}"` }
  })
}



async function serveRepacked(request, response, next) {
  let filename = request.url.replace(/\?.*$/, '')
  if(filename.startsWith('/')) {
    filename = filename.substr(1)
  }

  let pk3File = filename.replace(/\.pk3.*/gi, '.pk3')
  let pk3InnerPath = filename.replace(/^.*?\.pk3[^\/]*?(\/|$)/gi, '')
  if(pk3File.length == filename.length) {
    // not a virtual path inside a .pk3
    return next()
  }

  // TODO:
  //let isAltImage = !!request.url.match(/\?alt/) 
  //      && !!(await unsupportedImage(pk3InnerPath))

  if(IMAGE_FORMATS.includes(path.extname(pk3InnerPath))) {
    return alternateImage(pk3InnerPath, response, next)
  }

  //let isAltAudio = !!request.url.match(/\?alt/) 
  //      && !!(await unsupportedAudio(pk3InnerPath))

  if(AUDIO_FORMATS.includes(path.extname(pk3InnerPath))) {
    return alternateAudio(pk3InnerPath, response, next)
  }

  let repackedFile = path.join(repackedCache(), path.basename(pk3File) + 'dir', pk3InnerPath)
  if(fs.existsSync(repackedFile)) {
    return response.sendFile(repackedFile)
  }

  let modname = modDirectory(filename)
  if(modname) {
    repackedFile = path.join(repackedCache(), filename.substr(modname.length))
    if(fs.existsSync(repackedFile)) {
      return response.sendFile(repackedFile)
    }
  }

  let newFile = findFile(filename)
  if (newFile && newFile.endsWith('.pk3')) {
    // serve unsupported images with ?alt in URL
    if (await streamFileKey(newFile, pk3InnerPath, response)) {
      return
    }
  } else
  if (newFile && newFile.includes('.pk3dir\/')) {
    return response.sendFile(newFile)
  } else {
    // TODO: CODE REVIEW, reduce cascading curlys event though code
    //   is redundant there's still less complexity overall
    return next()
  }

}



module.exports = {
  serveRepacked,
  serveFinished,
  repackPk3,
  rebuildPalette,
}
