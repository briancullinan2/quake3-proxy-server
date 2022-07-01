const fs = require('fs')
const path = require('path')
const {PassThrough, Readable} = require('stream')

const EXISTING_ZIPS = {}
const EXISTING_MTIME = {}

async function getIndex(pk3Path) {
  const StreamZip = require('node-stream-zip')
  let zip
  if(pk3Path instanceof StreamZip) {
    zip = pk3Path
  } else /* if(!fs.existsSync(pk3Path)) */ {
    // if the index has already been loaded, use the
    //   loaded copy until the zip file changes
    let newMtime = fs.statSync(pk3Path).mtime.getTime()
    if(typeof EXISTING_MTIME[pk3Path] != 'undefined'
      && EXISTING_MTIME[pk3Path] >= newMtime
      && typeof EXISTING_ZIPS[pk3Path] != 'undefined') {
      return EXISTING_ZIPS[pk3Path]
    }
    EXISTING_MTIME[pk3Path] = newMtime
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
  EXISTING_MTIME[pk3Path] = Date.now()
  return (EXISTING_ZIPS[pk3Path] = index)
}


async function streamFile(file, stream) {
  return await new Promise(function (resolve, reject) {
    file.zip.stream(file.key, (err, stm) => {
      if(err) {
        console.error(err)
        reject(new Error(err))
      }
      // TODO: result = await execCmd(command, stm)
      stm.pipe(stream);
      stm.on('end', resolve);
    })
  })
}


async function fileKey(pk3Path, fileKey) {
  let index = await getIndex(pk3Path)
  for(let i = 0; i < index.length; i++) {
    // match the converted filename
    if(index[i].isDirectory
        || index[i].name.localeCompare( fileKey, 'en', { sensitivity: 'base' } ) != 0) {
      continue
    }
    return index[i]
  }
}


// async stream a file out of a zip matching the path
async function streamFileKey(pk3Path, key, stream) {
  let file = await fileKey(pk3Path, key)
  if(file) {
    await streamFile(file, stream)
    return true
  }
  return false
}


async function readFileKey(pk3Path, fileKey) {
  return await new Promise(async resolve => {
    let passThrough = new PassThrough()
    const readable = Readable.from(passThrough)
    let file = ''
    readable.on('data', (chunk) => {
      file += chunk
    })
    readable.on('end', function () {
      resolve(file)
    })
    await streamFileKey(pk3Path, fileKey, passThrough)
  })
}


module.exports = {
  EXISTING_ZIPS,
  getIndex,
  streamFileKey,
  streamFile,
  readFileKey,
  fileKey,
}