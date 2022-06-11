
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

async function repackPk3(pk3Path) {
  const StreamZip = require('node-stream-zip')
  const zip = new StreamZip({
    file: pk3Path,
    storeEntries: true,
    skipEntryNameValidation: true,
  })
  let newZip = path.join(repackedCache, path.basename(pk3Path))

  // make a new zip, filter out everything but text files
  //   (e.g. menus, cfgs, shaders)
  //   and very small images from shaders/gfx/sfx
  // generate new palette
  let index = await getZipIndex(pk3Path)
  let directory = []
  for(let i = 0; i < index.length; i++) {
    if(index[i].isDirectory) 
      continue
    if(!fileTypes.includes(path.extname(index[i].name))
      // skip too big files
      && index[i].size > 1024 * 256) 
      continue
    //if() continue // skip too big files
    let outFile = path.join(newZip + 'dir', index[i].name)
    console.log('Extracting', index[i].key, '->', outFile)
    fs.mkdirSync(path.dirname(outFile), { recursive: true })
    await new Promise(function(resolve, reject) {
      zip.stream(index[i].key, (err, stm) => {
        if(err) {
          return reject(err)
        }
        const file = fs.createWriteStream(outFile)
        stm.pipe(file)
        file.on('finish', resolve)
      })
    })
    let isUnsupportedImage = index[i].name.match(/\.tga$|\.dds$/gi)
    if(isUnsupportedImage) {
      await convertImage(outFile)
    }
    directory.push(index[i].name)
  }
  zip.close()

  for(let i = 0; i < directory.length; i++) {
    await execCmd(`cd ${newZip + 'dir'} && \
      zip ${i==0?' -u ':''} "../${path.basename(pk3Path)}" \
      "${path.join('./', directory[i])}"`)
  }
  return newZip
}


async function serveRepacked(request, response, next) {
  let filename = request.url.replace(/\?.*$/, '')
  if(filename.includes('maps/download/')) {
    if(filename.endsWith('/pak0')) {
      // TODO: repack mod directory pk3s into 1 overlapping 
      //   (i.e. do the same virtual combination the 
      //      engine does and recompile)
      //   pak0.pk3 and deliver

    } else {
      // download pk3 and repack
      let newFile = await sourcePk3Download(filename)
      console.log(newFile)
      if(!newFile.startsWith(repackedCache)) {
        newFile = await repackPk3(newFile)
      }
      return response.sendFile(newFile, {
        headers: { 'content-disposition': `attachment; filename="${path.basename(newFile)}"`}
      })
    }
  }

  if(!filename.includes('.pk3')) {
    return next()
  }

  let pk3File = filename.replace(/\.pk3.*/gi, '.pk3')
  let newFile = findFile(filename)
  if(newFile && newFile.endsWith('.pk3') 
      && pk3File.length < filename.length) {
    let pk3InnerPath = filename.replace(/^.*?\.pk3[^\/]*?(\/|$)/gi, '')
    if(await streamZipFile(newFile, pk3InnerPath, response)) {
      return
    } else {
      // not a file inside of zip, skip to directory listing
      return next()
    }
  } else

  if(newFile && !fs.statSync(newFile).isDirectory()) {
    // always convert pk3s, remove media to load individually
    if(!newFile.startsWith(repackedCache)) { 
      newFile = await repackPk3(newFile)
    }
    return response.sendFile(newFile)

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
