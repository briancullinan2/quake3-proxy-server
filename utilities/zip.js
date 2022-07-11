const fs = require('fs')
const path = require('path')
const {PassThrough, Readable} = require('stream')
const { updatePageViewers } = require('../contentServer/session.js')

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
    zip.file = pk3Path
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
    entry.file = pk3Path || zip.file
  }
  EXISTING_MTIME[pk3Path] = Date.now()
  return (EXISTING_ZIPS[pk3Path] = index)
}


// TODO: abstract into some sort of process template
const EXTRACTING_ZIPS = {}



async function streamFile(file, stream) {
  return await new Promise(function (resolve, reject) {
    let fullPath = file.file + '/' + file.key
    console.log('Extracting: ' + fullPath)
    EXTRACTING_ZIPS[fullPath] = new Date()
    updatePageViewers('/process')
    file.zip.stream(file.key, (err, stm) => {
      if(err) {
        console.error(err)
        reject(new Error(err))
      }
      // TODO: result = await execCmd(command, stm)
      //stream.cork()
      stm.pipe(stream);
      stm.on('end', function () {
        //stream.uncork()
        delete EXTRACTING_ZIPS[fullPath]
        updatePageViewers('/process')
        resolve()
      })
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




async function filteredIndex(pk3InnerPath, pk3File) {
  let directory = []
  let compareNames = []
  // TODO: refactor all of this to 1) remove directories in the first pass, 
  //   2) add all decendents no matter sub directories
  //   3) add connecting subdirectories back in for all decendents
  //   4) filter out decendents and only show current directory
  let index = await getIndex(pk3File)
  for (let i = 0; i < index.length; i++) {
    let newPath = index[i].name.replace(/\\/ig, '/').replace(/\/$/, '')
    let currentPath = newPath.substr(0, pk3InnerPath.length)
    let relativePath = newPath.substr(pk3InnerPath.length + (pk3InnerPath.length > 0 ? 1 : 0))
    if(index[i].isDirectory) {
      continue
    }
    if (pk3InnerPath.length <= 1 && relativePath.length 
      || (currentPath.localeCompare(pk3InnerPath, 'en', { sensitivity: 'base' }) == 0
      && newPath[pk3InnerPath.length] == '/')
    ) {
      compareNames.push(index[i].name.toLocaleLowerCase())
      directory.push(index[i])
    }
  }

  // TODO: zip files sometimes miss directory creation to add a virtual
  //   directory if any file descendents exist for this path
  let skip = pk3InnerPath.split('/').length
  for (let i = directory.length - 1; i >= 0; --i) {
    let subdirs = directory[i].name.split('/')
    for(let j = skip; j < subdirs.length; j++) {
      let currentPath = subdirs.slice(0, j).join('/')
      if(compareNames.includes(currentPath.toLocaleLowerCase())) {
        continue
      }
      compareNames.push(currentPath.toLocaleLowerCase())
      directory.unshift({
        isVirtual: true,
        isDirectory: true,
        name: currentPath,
        time: new Date(),
        size: void 0,
        file: pk3File,
      })
    }
  }

  return directory
}


async function filteredDirectory(pk3InnerPath, pk3File) {
  let directory = []
  let index = await filteredIndex(pk3InnerPath, pk3File)
  for (let i = 0; i < index.length; i++) {
    // recursive directory inside pk3?
    let relativePath = index[i].name.substr(pk3InnerPath.length
        + (pk3InnerPath.length > 0 ? 1 : 0))
    let isSubdir = relativePath.indexOf('/')
    if((isSubdir == -1 || isSubdir == relativePath.length - 1)
      // don't include ./ current directory
      && index[i].name.length > pk3InnerPath.length
    ) {
      directory.push(index[i])
    }
  }
  return directory
}

const INDEXED_QUEUE = []
const INDEXED_DIRS = {}
const INDEXED_TIMES = {}
const INDEXED_SIZES = {}
let indexedTimer

async function indexedSize(pk3InnerPath, pk3File) {
  if(!indexedTimer) {
    indexedTimer = setInterval(function () {
      let funcs = INDEXED_QUEUE.splice(0, 5)
      funcs.forEach(func => func())
    }, 1000/60)
  }

  let key = path.join(pk3File, pk3InnerPath).toLocaleLowerCase()
  let stat = fs.statSync(pk3File)
  let compareTime = stat.mtime.getTime()

  if(typeof INDEXED_DIRS[key] != 'undefined'
    // if the directory hasn't changed, use the size
    //   and list of directories from memory, instead
    //   of reading from disk again
    && INDEXED_TIMES[key] >= compareTime) {
    // recheck subdirectories for changes because child 
    //   changes to not propogate to parent directories
    //return Promise.all(INDEXED_DIRS[key].map(dir => {
    //  return indexedSize(dir, callback)
    //})).then(subsizes => subsizes.reduce((s, i) => (s + i), 0) + INDEXED_SIZES[key])
    return INDEXED_SIZES[key]
  }

  INDEXED_TIMES[key] = compareTime

  // TODO: rate limit to not pound hard drive while playing / developing
  let dirs = await new Promise(resolve => {
    //console.log('Queuing: ', directory)
    INDEXED_QUEUE.push(function () {
      // check again if cache was updated with list
      if(typeof INDEXED_DIRS[key] != 'undefined'
        && INDEXED_TIMES[key] >= compareTime) {
        resolve(INDEXED_DIRS[key])
      } else {
        //console.log('Scanning: ', directory)
        resolve(filteredIndex(pk3InnerPath, pk3File))
      }
    })
  })

  let subdirs = []
  let totalSize = 0
  // queue up the folder inside this folder before resolving
  for(let i = 0; i < dirs.length; i++) {
    if(dirs[i].isDirectory) {
      subdirs.push(dirs[i].name)
    } else {
      totalSize += dirs[i].size
    }
  }

  INDEXED_SIZES[key] = totalSize
  INDEXED_DIRS[key] = subdirs
  // TODO: update based on parent directories?

  //let size = await Promise.all(subdirs.map(dir => indexedSize(dir, callback)))
  //  .then(subsizes => subsizes.reduce((s, i) => (s + i), 0) + totalSize)

  updatePageViewers('/settings')
  updatePageViewers('\/?index')
  return totalSize
}


module.exports = {
  EXTRACTING_ZIPS,
  EXISTING_ZIPS,
  getIndex,
  streamFileKey,
  streamFile,
  readFileKey,
  fileKey,
  filteredIndex,
  filteredDirectory,
  indexedSize,
}