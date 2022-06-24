const fs = require('fs')
const path = require('path')
const { PassThrough } = require('stream')
const { findFile, modDirectory } = require('../contentServer/virtual.js')
const { repackedCache } = require('../utilities/env.js')
const { sourcePk3Download } = require('../mapServer/serve-download.js')
const { getIndex, streamFileKey, streamFile } = require('../utilities/zip.js')
const { execCmd } = require('../utilities/exec.js')
const { convertImage } = require('../contentServer/convert.js')
const { extractPk3 } = require('../contentServer/compress.js')

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
  '.c', '.h', '.map', '.scc',
]

//  SOURCE: https://stackoverflow.com/questions/10623798/how-do-i-read-the-contents-of-a-node-js-stream-into-a-string-variable
function streamToBuffer(stream) {
  const chunks = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('error', (err) => reject(err));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  })
}


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

    let isUnsupportedImage
    if (index[i].name.match(/levelshots\//i)) {
      isUnsupportedImage = index[i].name.match(/\.tga$|\.dds$|\.png/gi)
    } else {
      isUnsupportedImage = index[i].name.match(/\.tga$|\.dds$/gi)
    }
    if (isUnsupportedImage) {
      await convertImage(outFile, index[i].name)
    }

    if (fileTypes.includes(path.extname(index[i].name))
      // skip too big files
      || index[i].size < 1024 * 256
      // some images with all zeros will compress significantly
      || index[i].compressedSize < 1024 * 64) {
      directory.push(index[i].name)
    }
  }
  zip.close()
  return directory
}


async function repackPk3(pk3Path) {
  let newZip = path.join(repackedCache(), path.basename(pk3Path))

  let directory = await unpackPk3(pk3Path)

  for (let i = 0; i < directory.length; i++) {
    await execCmd(`cd ${newZip + 'dir'} && \
      zip ${i == 0 ? ' -u ' : ''} "../${path.basename(pk3Path)}" \
      "${path.join('./', directory[i])}"`)
  }

  return newZip
}


async function repackBasegame(pk3Path) {
  let newZip = path.join(repackedCache(), path.basename(pk3Path) + '.pk3')
  let promises = []
  promises.push(Promise.resolve(unpackPk3(newZip)))
  // start extracting other zips simultaneously,
  //   then wait for all of them to resolve



  return newZip
}


async function serveFinished() {
  if (filename.endsWith('/pak0')) {
    // TODO: repack mod directory pk3s into 1 overlapping 
    //   (i.e. do the same virtual combination the 
    //      engine does and recompile)
    // TODO: get index of all pk3 in non-cache game directories,
    //   make a new pak with combined file-system
    let newZip = path.join(repackedCache(), path.basename(pk3Path) + '.pk3')
    if(fs.existsSync(newZip)) {
      return newZip
    } else {
      return repackBasegame()
    }
  } else {
    // download pk3 and repack
    newFile = await sourcePk3Download(filename)
    if (!newFile.startsWith((repackedCache()))) {
      //newFile = await repackPk3(newFile)
    }
    return response.sendFile(newFile, {
      headers: { 'content-disposition': `attachment; filename="${path.basename(newFile)}"` }
    })
  }
}

async function tryAltPath(newFile, pk3InnerPath, response) {
  let index = await getIndex(newFile)
  //console.log(newFile)

  for (let i = 0; i < index.length; i++) {
    if(index[i].isDirectory) {
      continue
    }

    let isUnsupportedImage
    if (index[i].name.match(/levelshots\//i)) {
      isUnsupportedImage = index[i].name.match(/\.tga$|\.dds$|\.png/gi)
    } else {
      isUnsupportedImage = index[i].name.match(/\.tga$|\.dds$/gi)
    }
    if(!isUnsupportedImage) {
      continue
    }

    let fileKey = pk3InnerPath.replace(path.extname(pk3InnerPath), path.extname(index[i].name))
    if(index[i].name.localeCompare( fileKey, 'en', 
          { sensitivity: 'base' } ) != 0) {
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
  let pk3File = filename.replace(/\.pk3.*/gi, '.pk3')
  let pk3InnerPath = filename.replace(/^.*?\.pk3[^\/]*?(\/|$)/gi, '')
  let repackedFile = path.join(repackedCache(), path.basename(pk3File) + 'dir', pk3InnerPath)
  if(pk3File.length < filename.length && fs.existsSync(repackedFile)) {
    return response.sendFile(newFile)
  }
  if(filename.startsWith('/')) {
    filename = filename.substr(1)
  }

  let modname = modDirectory(filename)
  if(modname) {
    repackedFile = path.join(repackedCache(), filename.substr(modname.length))
    console.log(repackedFile)
    if(fs.existsSync(repackedFile)) {
      return response.sendFile(repackedFile)
    }
  }

  
  let newFile = findFile(filename)
  if (newFile && newFile.endsWith('.pk3')
      && pk3File.length < filename.length) {  
    if (await streamFileKey(newFile, pk3InnerPath, response)) {
      return
    }
  } // else

  if (newFile && newFile.includes('.pk3dir\/')) {
    return response.sendFile(newFile)
  }

  // missing key!
  if (newFile && newFile.endsWith('.pk3')
    && !fs.statSync(newFile).isDirectory()) {

    // always convert pk3s, remove media to load individually
    if (!newFile.startsWith(repackedCache())) {
      //newFile = await unpackPk3(newFile)
    }

    newFile = findFile(filename)
    if (pk3File.length < filename.length) {
      if (await streamFileKey(newFile, pk3InnerPath, response)) {
        return
      } else {
        return next()
      }
    } else
      if (!fs.statSync(newFile).isDirectory()) {
        return response.sendFile(newFile)
      } else {
        return response.sendFile(newFile)
      }

  } else {
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
    //if(builtQVMs) {

    //}
  }

}

module.exports = {
  serveRepacked,
  serveFinished,
  repackPk3,
  
}
