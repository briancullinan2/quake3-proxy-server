
// TODO: generate this code file automatically using input from serve-virtual and serve-repacked
// CODE REVIEW: need at least 2 use-cases to refactor code into something cleaner, that's how you know
//   the code is relevant instead of messy, it fits multiple purposes.
const fs = require('fs')
const path = require('path')
const { PassThrough, Readable } = require('stream')

const { fileKey, streamFileKey } = require('../utilities/zip.js')
const { CACHY_PATHY, findFile } = require('../assetServer/virtual.js')
const { IMAGE_FORMATS, AUDIO_FORMATS, MODS_NAMES, getGames } = require('../utilities/env.js')
const { CONVERTED_IMAGES, convertCmd } = require('../cmdServer/cmd-convert.js')
const { opaqueCmd } = require('../cmdServer/cmd-identify.js')
const { CONVERTED_SOUNDS, encodeCmd } = require('../cmdServer/cmd-encode.js')
const { listPk3s } = require('../assetServer/layered.js')
const { unsupportedImage, unsupportedAudio } = require('../contentServer/unsupported.js')
const { listGameNames } = require('../gameServer/list-games.js')


// TODO: replace about 300 lines of code with 50 LoC
const CONVERTED_FILES = {}
const CONVERTED_TIMES = {}

// TODO: CODE REVIEW, this is kind of like relinking when your functions aren't small enough
//   because a single idea doesn't go far enough to prevent programmer from writing redundant
//   code. So instead of trying to avoid the redundancy and screwing around with some giant
//   complex dependency injection model like RSX, I embrace the inefficiency 2 - 3 times, 
//   and then refactor the repeat code, then that helps me see where the code that is left
//   over and not redundant is innefficent. I actually write messy intentionally just to write
//   so that I have something to clean up later.

// To what end? The deploy.js will be the physical output of all these cached files. Then I can 
//   screw around with adding CD keys, user registrations, logins, unlocking content, etc... In
//   the planet_quake branch using modular callouts and extending this API directly included as
//   as submodule in the planet_quake project.

// CODE REVIEW: ok 200 LoC, but at least it's organized, and operates exactly the same in all
//   4 other locations?

async function findAlt(filename) {
  let pk3InnerPath
  if (filename.startsWith('/'))
    filename = filename.substring(1)

  if (typeof CACHY_PATHY[filename.toLocaleLowerCase()] != 'undefined') {
    return CACHY_PATHY[filename.toLocaleLowerCase()]
  }

  pk3InnerPath = filename
  // TODO: lookup modname like in serve-virtual
  let pk3s = []
  let modname = filename.split('/')[0]
  if (modname) {
    let gameNames = listGameNames()
    if (gameNames.includes(modname.toLocaleLowerCase())) {
      pk3s = (await listPk3s(modname)).sort().reverse().map(findFile).filter(f => f)
      pk3InnerPath = filename.substr(modname.length + 1)
    }
  }

  let pk3File
  if (filename.match(/\.pk3/i)) {
    pk3File = filename.replace(/\.pk3.*/gi, '.pk3')
    pk3InnerPath = filename.replace(/^.*?\.pk3[^\/]*?(\/|$)/gi, '').toLocaleLowerCase()
  }

  // TODO: takes a local / virtual path and traverses both base packs and alternate extensions
  //   similar to a generalized way that the engine does this

  // filter? if (pk3Name && pk3Name.localeCompare('pak0.pk3', 'en', { sensitivity: 'base' })) {
  for (let i = 0; i < pk3s.length; i++) {
    let file = await fileKey(pk3s[i], pk3InnerPath)

    if (!(file) || unsupportedImage(pk3InnerPath)) {
      for (let i = 0; i < IMAGE_FORMATS.length; i++) {
        let altPath = pk3InnerPath.replace(path.extname(pk3InnerPath), IMAGE_FORMATS[i])
        let altFile = await fileKey(pk3s[i], altPath)
        if (altFile) {
          return (CACHY_PATHY[filename.toLocaleLowerCase()] = altFile) // can be sent directly to convert
        }
      }
    }

    if (!(file) || unsupportedAudio(pk3InnerPath)) {
      for (let i = 0; i < AUDIO_FORMATS.length; i++) {
        let altPath = pk3InnerPath.replace(path.extname(pk3InnerPath), AUDIO_FORMATS[i])
        let altFile = await fileKey(pk3s[i], altPath)
        if (altFile) {
          return (CACHY_PATHY[filename.toLocaleLowerCase()] = altFile) // can be sent directly to convert
        }
      }
    }

    // TODO: redirect models IQM and MD3 just like audio/image files

    if (file) {
      return (CACHY_PATHY[filename.toLocaleLowerCase()] = file)
    }
  }

  if (IMAGE_FORMATS.includes(path.extname(pk3InnerPath))) {
    for (let i = 0; i < IMAGE_FORMATS.length; i++) {
      let altPath = findFile(filename.replace(path.extname(filename), IMAGE_FORMATS[i]))
      if (altPath) {
        return (CACHY_PATHY[filename.toLocaleLowerCase()] = altPath) // can be sent directly to convert
      }
    }
  }

  if (AUDIO_FORMATS.includes(path.extname(pk3InnerPath))) {
    for (let i = 0; i < AUDIO_FORMATS.length; i++) {
      let altPath = findFile(filename.replace(path.extname(filename), AUDIO_FORMATS[i]))
      if (altPath) {
        return (CACHY_PATHY[filename.toLocaleLowerCase()] = altPath) // can be sent directly to convert
      }
    }
  }

  // TODO: redirect models IQM and MD3 just like audio/image files

  let file = findFile(filename)
  if (file) {
    return (CACHY_PATHY[filename.toLocaleLowerCase()] = file)
  }

  // TODO: extend this function singularly to handle all repackedCache() calls

}


async function streamAudioFile(filename, response) {
  // findAlt()
  // streamAudioKey or pipe file
  let pk3File
  if (typeof filename == 'object') {
    pk3File = filename
  } else
    if (!fs.existsSync(filename)) {
      pk3File = await findAlt(filename)
    } else {
      pk3File = filename
    }

  if (!pk3File
    || !AUDIO_FORMATS.includes(path.extname(typeof pk3File == 'object'
      ? pk3File.name : pk3File))) {
    return false
  }




  let pk3Name
  if (typeof pk3File == 'string' && pk3File.match(/\.pk3$/i)) {
    pk3Name = filename.replace(/\.pk3.*/gi, '.pk3')
  }

  let pk3InnerPath = typeof filename == 'object'
    ? filename.name
    : filename.replace(/^.*?\.pk3[^\/]*?(\/|$)/gi, '').toLocaleLowerCase()

  let key = typeof pk3File == 'object'
    ? (pk3File.file + '/' + pk3File.name) : (pk3File.match(/\.pk3$/i)
      // not possible?
      ? path.join(pk3Name, pk3InnerPath) : pk3File)
  let newKey = key.replace(path.extname(key), '.ogg')


  // update the file in memory if it has changed
  let stat
  if (!fs.existsSync(typeof pk3File == 'object' ? pk3File.file : pk3File)
    || (stat = fs.statSync(typeof pk3File == 'object' ? pk3File.file : pk3File)).isDirectory()) {
    return false
  }
  if (typeof pk3File == 'object'
    && (typeof CONVERTED_TIMES[newKey] == 'undefined')
    || stat.mtime.getTime() > CONVERTED_TIMES[newKey]) {
    CONVERTED_TIMES[newKey.replace(path.extname(newKey), '').toLocaleLowerCase()] =
      CONVERTED_TIMES[newKey] = stat.mtime.getTime()
  } else


  if (typeof CONVERTED_SOUNDS[newKey] != 'undefined') {
    if (typeof response.setHeader == 'function') {
      response.setHeader('content-type', 'audio/ogg')
      response.send(CONVERTED_SOUNDS[newKey])
    } else {
      const passThrough = new PassThrough()
      passThrough.pipe(response)
      passThrough.end(CONVERTED_SOUNDS[newKey])
    }
    return true
  }

  if (typeof response.setHeader == 'function') {
    response.setHeader('content-type', 'audio/ogg')
  }
  // .pipe(response)
  let passThrough = streamAndCache(newKey, CONVERTED_SOUNDS, response)
  CONVERTED_TIMES[newKey.replace(path.extname(newKey), '').toLocaleLowerCase()] =
    CONVERTED_TIMES[newKey] = stat.mtime.getTime()

  // force async so other threads can answer page requests during conversion
  Promise.resolve(encodeCmd(pk3File, pk3InnerPath, void 0, passThrough, false))
  return true
}



function streamAndCache(key, cache, response) {
  let strippedKey = key.replace(path.extname(key), '').toLocaleLowerCase()
  // TODO: store a piped stream in memory to save some bigger job we just did
  //   also, doesn't make sense to read from FS every time
  if (typeof CONVERTED_FILES[strippedKey] != 'undefined' || typeof cache[key] != 'undefined') {
    const passThrough = new PassThrough()
    passThrough.pipe(response)
    passThrough.end(CONVERTED_FILES[strippedKey] || cache[key])
    return passThrough
  }

  const passThrough = new PassThrough()
  const readable = Readable.from(passThrough)

  // force async so other threads can answer page requests during conversion
  let chunks = []
  Promise.resolve(new Promise(resolve => {
    readable.on('data', chunks.push.bind(chunks))
    readable.on('end', resolve.bind(null, chunks))
    passThrough.pipe(response)
  }).then(chunks => {
    cache[key] = CONVERTED_FILES[strippedKey] = Buffer.concat(chunks)
  }))

  // caller should write to this to activate
  return passThrough
}


async function streamImageFile(filename, response) {

  let pk3File
  if (typeof filename == 'object') {
    pk3File = filename
  } else
    if (!fs.existsSync(filename)) {
      pk3File = await findAlt(filename)
    } else {
      pk3File = filename
    }

  if (!pk3File
    || !IMAGE_FORMATS.includes(path.extname(typeof pk3File == 'object' ? pk3File.name : pk3File))) {
    return false
  }

  let pk3Name
  if (typeof pk3File == 'string' && pk3File.match(/\.pk3$/i)) {
    pk3Name = filename.replace(/\.pk3.*/gi, '.pk3')
  }

  let pk3InnerPath = typeof filename == 'object'
    ? filename.name
    : filename.replace(/^.*?\.pk3[^\/]*?(\/|$)/gi, '').toLocaleLowerCase()

  let key = typeof pk3File == 'object'
    ? (pk3File.file + '/' + pk3File.name) : (pk3Name
      // not possible?
      ? path.join(pk3Name, pk3InnerPath) : pk3File)
  let newKey
  if (typeof CONVERTED_IMAGES[key.replace(path.extname(pk3InnerPath), '.jpg')] != 'undefined') {
    newKey = key.replace(path.extname(key), '.jpg')
  } else
  if (typeof CONVERTED_IMAGES[key.replace(path.extname(pk3InnerPath), '.png')] != 'undefined') {
    newKey = key.replace(path.extname(key), '.png')
  }
  


  // update the file in memory if it has changed
  let stat
  if (!fs.existsSync(typeof pk3File == 'object' ? pk3File.file : pk3File)
    || (stat = fs.statSync(typeof pk3File == 'object' ? pk3File.file : pk3File)).isDirectory()) {
    return false
  }
  if (!newKey) {
    // fall through to convert
  } else
  if(typeof CONVERTED_TIMES[newKey] == 'undefined'
    || stat.mtime.getTime() > CONVERTED_TIMES[newKey]) {
    CONVERTED_TIMES[newKey.replace(path.extname(newKey), '').toLocaleLowerCase()] =
      CONVERTED_TIMES[newKey] = stat.mtime.getTime()
    // fall through to convert
  } else

    if (typeof CONVERTED_IMAGES[newKey] != 'undefined') {
      if (typeof response.setHeader == 'function') {
        response.setHeader('content-type', 'image/' + path.extname(newKey).substring(1))
        response.send(CONVERTED_IMAGES[newKey])
      } else {
        const passThrough = new PassThrough()
        passThrough.pipe(response)
        passThrough.end(CONVERTED_IMAGES[newKey])
      }
      return true
    }


  // TODO: call out to this somehow and result results
  isOpaque = await opaqueCmd(pk3File, pk3InnerPath)
  let newExt = isOpaque ? '.jpg' : '.png'
  newKey = key.replace(path.extname(key), newExt)
  CONVERTED_TIMES[newKey.replace(path.extname(newKey), '').toLocaleLowerCase()] =
  CONVERTED_TIMES[newKey] = stat.mtime.getTime()
  if (typeof response.setHeader == 'function') {
    response.setHeader('content-type', 'image/' + newExt.substring(1))
  }

  // .pipe(response)
  let passThrough = streamAndCache(newKey, CONVERTED_IMAGES, response)
  // force async so other threads can answer page requests during conversion
  Promise.resolve(convertCmd(pk3File, pk3InnerPath, void 0, passThrough, newExt))
  return true
}


// TODO: streamFile that does the path setup?
// leftovers?
async function streamFile(filename, stream) {
  // streamImageKey or streamAudioKey or findAlt()

  let pk3File
  if (typeof filename == 'object') {
    pk3File = filename
  } else
    if (!fs.existsSync(filename)) {
      pk3File = await findAlt(filename)
    }
  if (!pk3File) {
    return false
  }

  let pk3Name
  if (typeof pk3File == 'string' && pk3File.match(/\.pk3$/i)) {
    pk3Name = filename.replace(/\.pk3.*/gi, '.pk3')
  }

  let pk3InnerPath = filename.replace(/^.*?\.pk3[^\/]*?(\/|$)/gi, '').toLocaleLowerCase()

  let key = typeof pk3File == 'object'
    ? (pk3File.file + '/' + pk3File.name) : (pk3Name
      // not possible?
      ? path.join(pk3Name, pk3InnerPath) : pk3File)

  if ((passThrough = await streamAudioFile(pk3File, stream))) {
    return passThrough
  } else
    if ((passThrough = await streamImageFile(pk3File, stream))) {
      return passThrough
    } else
      if (pk3Name && typeof pk3File == 'object' && !pk3File.isDirectory
        && await streamFileKey(pk3File, pk3InnerPath, stream)) {
        return true
      }


  if (!fs.existsSync(pk3File)
    || fs.statSync(pk3File).isDirectory()) {
    return false
  }

  // TODO: cache read in CONVERTED_FILES?
  //passThrough.pipe(response)
  //passThrough.end(CONVERTED_FILES[strippedKey] || cache[key])
  if (typeof stream.setHeader == 'function') {
    stream.sendFile(pk3File)
    return true
  } else {
    passThrough = fs.createReadStream(pk3File)
    passThrough.pipe(stream)
    return passThrough
  }
}

module.exports = {
  CONVERTED_FILES,
  streamAudioFile,
  streamImageFile,
  streamFile,
  findAlt,
}