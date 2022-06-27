const fs = require('fs')
const path = require('path')

const { PassThrough } = require('stream')
const { findFile, modDirectory } = require('../contentServer/virtual.js')
const { repackedCache } = require('../utilities/env.js')
const { MAP_DICTIONARY, sourcePk3Download } = require('../mapServer/serve-download.js')
const { getIndex, streamFileKey, streamFile } = require('../utilities/zip.js')
const { execCmd } = require('../utilities/exec.js')
const { convertImage } = require('../contentServer/convert.js')
const { extractPk3 } = require('../contentServer/compress.js')
const { unsupportedImage } = require('../contentServer/content.js')
const { getGame } = require('../utilities/env.js')
const { layeredDir } = require('../contentServer/content.js')



var fileTypes = [
  '.cfg', '.qvm', '.bot',
  '.txt', '.bsp', '.aas',
  '.md3', '.md5', '.iqm',
  '.mdr', '.shader', '.shaderx',
  '.crosshair', '.skin', '.font',
  '.config', '.menu',
  '.defi', // CPMA game mode definition
  '.arena', // map based game mode definition
  // these can be compiled in game to run bot AI
  '.c', '.h', '.scc', // '.map',
]


// same as extractPk3 but initiates conversions immediately
async function unpackPk3(pk3Path) {
  let newZip = path.join(repackedCache(), path.basename(pk3Path))
  let directory = []
  let index = await extractPk3(pk3Path)
  for (let i = 0; i < index.length; i++) {
    if (index[i].isDirectory)
      continue
    let outFile = path.join(newZip + 'dir', index[i].name)
    if (!fs.existsSync(outFile)) {
      continue;
    }
    if (await unsupportedImage(index[i].name)) {
      if(fs.existsSync(outFile.replace(path.extname(outFile), '.jpg'))) {
        directory.push(index[i].name.replace(path.extname(index[i].name, 'jpg')))
        continue
      }
      if(fs.existsSync(outFile.replace(path.extname(outFile), '.png'))) {
        directory.push(index[i].name.replace(path.extname(index[i].name, 'png')))
        continue
      }
      let newImage = await convertImage(outFile, index[i].name)
      directory.push(index[i].name.replace(path.extname(index[i].name, path.extname(newImage))))
    }
    if (fileTypes.includes(path.extname(index[i].name))
      // skip too big files
      || index[i].size < 1024 * 256
      // some images with all zeros will compress significantly
      || index[i].compressedSize < 1024 * 64) {
      directory.push(index[i].name)
    }
  }
  return directory
}


async function repackPk3(directory, newZip) {
  let first = true
  for (let i = 0; i < directory.length; i++) {
    if(await unsupportedImage(directory[i])) {
      continue
    }
    let newDir = directory[i].replace(/\.pk3.*/gi, '.pk3dir')
    let pk3InnerPath = directory[i].replace(/^.*?\.pk3[^\/]*?(\/|$)/gi, '')
    let output = await execCmd(
      //process.env.SHELL, ['-c', 'pwd'
      'zip', [first ? '' : ' -u ',
      '../' + path.basename(newZip), path.join('./', pk3InnerPath)
    ], { cwd: newDir, shell: true })
    //console.log(output)
    first = false
  }
  return newZip
}


async function repackBasegame() {
  let newZip = path.join(repackedCache(), 'pak0.pk3')
  // start extracting other zips simultaneously,
  //   then wait for all of them to resolve
  let directory = []
  let gamedir = await layeredDir(getGame())
  let pk3files = gamedir.filter(file => file.endsWith('.pk3')).sort().reverse()
  for (let j = 0; j < pk3files.length; j++) {
    let newFile = findFile(pk3files[j])
    await unpackPk3(newFile)
    let newZip = path.join(repackedCache(), path.basename(newFile))
    let index = await getIndex(newFile)
    for(let i = 0; i < index.length; i++) {
      if (!fileTypes.includes(path.extname(index[i].name))) {
        continue
      }
      if(index[i].size > 1024 * 256
        || index[i].compressedSize > 1024 * 64) {
        continue
      }
      directory.push(path.join(newZip, index[i].name))
    }
  }
  await repackPk3(directory, newZip)
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
      newZip = await repackBasegame()
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

async function tryAltPath(newFile, pk3InnerPath, response) {
  let index = await getIndex(newFile)
  //console.log(newFile)

  for (let i = 0; i < index.length; i++) {
    if(index[i].isDirectory) {
      continue
    }
    if(!await unsupportedImage(index[i])) {
      continue
    }

    let fileKey = pk3InnerPath.replace(path.extname(pk3InnerPath), path.extname(index[i].name))
    if(index[i].name.localeCompare( fileKey, 'en', { sensitivity: 'base' } ) != 0) {
      continue
    }

    // FOUND IT!
    // convert in addition to stream
    //let outFile = path.join(repackedCache(), path.basename(newFile) + 'dir', index[i].name)
    let newImage = await convertImage(newFile, index[i].name)
    await response.sendFile(newImage)
    return true
  }

  return false
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

  // TODO:
  let isAlt = !!request.url.match(/\?alt/) 
        && !!(await unsupportedImage(pk3InnerPath))

  let newFile = findFile(filename)
  if (newFile && newFile.endsWith('.pk3')) {
    // serve unsupported images with ?alt in URL
    if(isAlt) {
      try {
        let newImage = await convertImage(newFile, pk3InnerPath)
        return response.sendFile(newImage)
      } catch (e) {
        if(!e.message.startsWith('File not found')) {
          console.log(e)
        }
      }
    } else
    if (await streamFileKey(newFile, pk3InnerPath, response)) {
      return
    }
  } // else

  if (newFile && newFile.includes('.pk3dir\/')) {
    return response.sendFile(newFile)
  }

  // exit out early 
  let altFile = pk3InnerPath.replace(path.extname(pk3InnerPath), '')
  if(!isAlt) {
    // TODO: CODE REVIEW, reduce cascading curlys event though code
    //   is redundant there's still less complexity overall
    return next()
  }



  let gamedir = await layeredDir(getGame())
  let pk3files = gamedir.filter(file => file.endsWith('.pk3')).sort().reverse()  
  const IMAGE_FORMATS = ['.jpg', '.png', '.tga']
  for(let i = 0; i < IMAGE_FORMATS.length; i++) {
    let newFile = findFile(altFile + IMAGE_FORMATS[i])
    if(newFile && !newFile.endsWith('.pk3')) {
      return response.sendFile(newFile)
    }
  }

  for(let i = 0; i < pk3files.length; i++) {
    for(let j = 0; j < IMAGE_FORMATS.length; j++) {
      let altPath = path.join(repackedCache(), path.basename(pk3files[i]) + 'dir', altFile + IMAGE_FORMATS[j])
      if(fs.existsSync(altPath)) {
        return response.sendFile(altPath)
      }
    }
  }

  for(let i = 0; i < pk3files.length; i++) {
    try {
      let newFile = findFile(pk3files[i])
      let newImage = await convertImage(newFile, pk3InnerPath)
      return response.sendFile(newImage)
    } catch (e) {
      if(!e.message.startsWith('File not found')) {
        console.log(e)
      }
    }

    for(let j = 0; j < IMAGE_FORMATS.length; j++) {
      try {
        let newImage = await convertImage(findFile(pk3files[i]),
        altFile + IMAGE_FORMATS[j])
        return response.sendFile(newImage)
      } catch (e) {
        if(!e.message.startsWith('File not found')) {
          console.log(e)
        }
      }
    }
  }

  return next()

  /*
  TODO: load base pk3 here, load alt-path images from loadImage()
  TODO: load images/sounds async based on some sort of minimized compressed graph
      of all 3,000+ maps.
  TODO: validate pk3 data, remove QVMs, check for improper overrides,
      reference all BSP textures, and re-merge working lazy load, trigger 
      downloads from Sys_FOpen like before. 
  TODO: Try to get this working through NextDownload() but with the download
      progress displayed in latency graph, micro-manage Ranges to not affect ping. 
      Add to native.
  */

}

module.exports = {
  serveRepacked,
  serveFinished,
  repackPk3,
  
}
