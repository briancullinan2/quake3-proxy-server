const fs = require('fs')
const path = require('path')
const {PassThrough} = require('stream')
const {findFile} = require('../contentServer/virtual.js')
const {downloadCache, repackedCache} = require('../utilities/env.js')
const {MAP_DICTIONARY, sourcePk3Download} = require('../mapServer/serve-download.js')
const {getIndex, streamFileKey, streamFile} = require('../utilities/zip.js')
const {execCmd} = require('../utilities/exec.js')
const {convertImage} = require('../contentServer/convert.js')

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
function streamToBuffer (stream) {
  const chunks = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('error', (err) => reject(err));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  })
}

async function repackPk3(pk3Path) {
  const StreamZip = require('node-stream-zip')
  const zip = new StreamZip({
    file: pk3Path,
    storeEntries: true,
    skipEntryNameValidation: true,
  })
  let newZip = path.join(repackedCache(), path.basename(pk3Path))

  // make a new zip, filter out everything but text files
  //   (e.g. menus, cfgs, shaders)
  //   and very small images from shaders/gfx/sfx
  // generate new palette
  let index = await getIndex(pk3Path)
  let directory = []
  for(let i = 0; i < index.length; i++) {
    if(index[i].isDirectory) 
      continue

    let outFile = path.join(newZip + 'dir', index[i].name)
    if(!fs.existsSync(outFile)) {
      console.log('Extracting', index[i].key, '->', outFile)
      fs.mkdirSync(path.dirname(outFile), { recursive: true })

      // stupid TGAs
      if(outFile.match(/\.tga$/i)) {
        let passThrough = new PassThrough()
        let tgaFile = (await Promise.all([
          streamFile(index[i], passThrough),
          streamToBuffer(passThrough)
        ]))[1]
        //fs.writeFileSync(outFile + '_orig', tgaFile)
        if(tgaFile[0] > 0) {
          tgaFile = Array.from(tgaFile)
          tgaFile.splice(18, tgaFile[0])
          tgaFile[0] = 0
          tgaFile = Buffer.from(tgaFile)
        }
        fs.writeFileSync(outFile, tgaFile)
      } else {
        const file = fs.createWriteStream(outFile)
        await streamFile(index[i], file)
        file.close()
      }
    }

    let isUnsupportedImage
    if(index[i].name.match(/levelshots\//i)) {
      isUnsupportedImage = index[i].name.match(/\.tga$|\.dds$|\.png/gi)
    } else {
      isUnsupportedImage = index[i].name.match(/\.tga$|\.dds$/gi)
    }
    let newName = index[i].name
    if(isUnsupportedImage) {
      newName = await convertImage(outFile, index[i].name)
    }

    if(fileTypes.includes(path.extname(index[i].name))
      // skip too big files
      || index[i].size < 1024 * 256) {
      directory.push(newName)
    }
  }
  zip.close()

  for(let i = 0; i < directory.length; i++) {
    await execCmd(`cd ${newZip + 'dir'} && \
      zip ${i==0?' -u ':''} "../${path.basename(pk3Path)}" \
      "${path.join('./', directory[i])}"`)
  }
  return newZip
}


async function repackBasegame() {

}


async function serveRepacked(request, response, next) {
  let filename = request.url.replace(/\?.*$/, '')
  let newFile

  if(filename.includes('maps/repacked/')) {
    if(filename.endsWith('/pak0')) {
      // TODO: repack mod directory pk3s into 1 overlapping 
      //   (i.e. do the same virtual combination the 
      //      engine does and recompile)
      // TODO: get index of all pk3 in non-cache game directories,
      //   make a new pak with combined file-system
    } else {
      // download pk3 and repack
      newFile = await sourcePk3Download(filename)
      if(!newFile.startsWith((repackedCache()))) {
        newFile = await repackPk3(newFile)
      }
      return response.sendFile(newFile, {
        headers: { 'content-disposition': `attachment; filename="${path.basename(newFile)}"`}
      })
    }
  } else {
    newFile = findFile(filename)
  }

  if(!filename.includes('.pk3')) {
    return next()
  }

  let pk3File = filename.replace(/\.pk3.*/gi, '.pk3')
  let pk3InnerPath = filename.replace(/^.*?\.pk3[^\/]*?(\/|$)/gi, '')
  //console.log(filename, '->', newFile, '(', pk3InnerPath, ')')

  if(newFile && newFile.endsWith('.pk3') 
      && pk3File.length < filename.length) {
    if(await streamFileKey(newFile, pk3InnerPath, response)) {
      return
    }
  } // else

  if(newFile && newFile.includes('.pk3dir\/')) {
    return response.sendFile(newFile)
  }

  // missing key!
  if(newFile && newFile.endsWith('.pk3') 
      && !fs.statSync(newFile).isDirectory()) {

    // always convert pk3s, remove media to load individually
    if(!newFile.startsWith(repackedCache())) { 
      newFile = await repackPk3(newFile)
    }

    newFile = findFile(filename)
    if(pk3File.length < filename.length) {
      if(await streamFileKey(newFile, pk3InnerPath, response)) {
        return
      } else {
        return next()
      }
    } else
    if(!fs.statSync(newFile).isDirectory()) {
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

}
