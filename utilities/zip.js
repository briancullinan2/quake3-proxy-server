const fs = require('fs')

async function getIndex(pk3Path) {
  const StreamZip = require('node-stream-zip')
  let zip
  if(pk3Path instanceof StreamZip) {
    zip = pk3Path
  } else
  /* if(!fs.existsSync(pk3Path)) */ {
    zip = new StreamZip({
      file: pk3Path,
      storeEntries: true,
      skipEntryNameValidation: true,
    })
  }
  const index = await new Promise(resolve => {
    zip.on('ready', () => {
      console.log('Entries read: ' + zip.entriesCount + ' ' + path.basename(pk3Path))
      resolve(Object.values(zip.entries()))
    })
    zip.on('error', (err) => {
      console.warn(err, pk3Path)
      resolve([])
    })
  })

  for(var i = 0; i < index.length; i++) {
    var entry = index[i]
    entry.key = entry.name
    entry.name = entry.name.replace(/\\/ig, '/')
                           .replace(/\/$/, '')
    entry.zip = zip
  }

  return index
}


// async stream a file out of a zip matching the path
async function streamFile(pk3Path, fileKey, stream) {
  let index = await getIndex(pk3Path)
  for(let i = 0; i < index.length; i++) {
    // match the converted filename
    if(index[i].isDirectory
        || index[i].name.localeCompare( fileKey, 'en', 
            { sensitivity: 'base' } ) != 0) {
      continue
    }

    await new Promise(function (resolve, reject) {
      index[i].stream(index[i].key, (err, stm) => {
        if(err) {
          console.error(err)
          reject(new Error(err))
        }
        // TODO: result = await execCmd(command, stm)
        stm.pipe(stream);
        stm.on('end', resolve);
      })
    })
    return true
  }
  return false
}


module.exports = {
  getIndex,
  streamFile
}