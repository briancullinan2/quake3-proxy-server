
// TODO: generate this code file automatically using input from serve-virtual and serve-repacked
// CODE REVIEW: need at least 2 use-cases to refactor code into something cleaner, that's how you know
//   the code is relevant instead of messy, it fits multiple purposes.

// TODO: replace about 300 lines of code with 50 LoC

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
  let pk3File

  let localName = filename
  if (localName.startsWith('/'))
    localName = localName.substring(1)

  // TODO: lookup modname like in serve-virtual

  // TODO: takes a local / virtual path and traverses both base packs and alternate extensions
  //   similar to a generalized way that the engine does this

  // filter? if (pk3Name && pk3Name.localeCompare('pak0.pk3', 'en', { sensitivity: 'base' })) {
  let pk3s = (await listPk3s(modname)).sort().reverse().map(findFile).filter(f => f)
  for (let i = 0; i < pk3s.length; i++) {
    // TODO: filter pk3File?

    let file = await fileKey(pk3File, pk3InnerPath)

    if (!(file) || unsupportedImage(pk3InnerPath)) {
      for (let i = 0; i < IMAGE_FORMATS.length; i++) {
        let altPath = pk3InnerPath.replace(path.extname(pk3InnerPath), IMAGE_FORMATS[i])
        file = await fileKey(pk3File, altPath)
        if (file) {
          return file // can be sent directly to convert
        }
      }
    }

    if (!(file) || unsupportedAudio(pk3InnerPath)) {
      for (let i = 0; i < AUDIO_FORMATS.length; i++) {
        let altPath = pk3InnerPath.replace(path.extname(pk3InnerPath), AUDIO_FORMATS[i])
        file = await fileKey(pk3File, altPath)
        if (file) {
          return file // can be sent directly to convert
        }
      }
    }

    // TODO: redirect models IQM and MD3 just like audio/image files

    if (file) {
      return file
    }
  }

  if (unsupportedImage(pk3InnerPath)) {
    for (let i = 0; i < IMAGE_FORMATS.length; i++) {
      let altPath = findFile(pk3File.replace(path.extname(pk3File), IMAGE_FORMATS[i]))
      if (altPath) {
        return altPath // can be sent directly to convert
      }
    }
  }

  if (unsupportedAudio(pk3InnerPath)) {
    for (let i = 0; i < AUDIO_FORMATS.length; i++) {
      let altPath = findFile(pk3File.replace(path.extname(pk3File), AUDIO_FORMATS[i]))
      if (altPath) {
        return altPath // can be sent directly to convert
      }
    }
  }

  // TODO: redirect models IQM and MD3 just like audio/image files

  let altPath = findFile(pk3File)
  if (altPath) {
    return altPath
  }

  // TODO: extend this function singularly to handle all repackedCache() calls

}


function streamAudioFile(filename, response) {
  // findAlt()
  // streamAudioKey or pipe file
  if (!AUDIO_FORMATS.includes(path.extname(pk3InnerPath))) {
    return false
  }


  let pk3File
  if (typeof filename == 'object') {
    pk3File = filename
  } else
    if (fs.existsSync(filename)) {
      pk3File = await findAlt(filename)
    }
  if (!pk3File) {
    return false
  }


  let pk3Name
  if (typeof pk3File == 'string' && pk3File.match(/\.pk3$/i)) {
    pk3Name = filename.replace(/\.pk3.*/gi, '.pk3')
  }

  let pk3InnerPath = fullPath.replace(/^.*?\.pk3[^\/]*?(\/|$)/gi, '').toLocaleLowerCase()

  let key = typeof pk3File == 'object'
    ? (pk3File.file + '/' + pk3File.name) : (pk3File.match(/\.pk3$/i)
      // not possible?
      ? path.join(pk3Name, pk3InnerPath) : pk3File)

  if (typeof CONVERTED_SOUNDS[key.replace(path.extname(pk3InnerPath), '.ogg')] != 'undefined') {
    response.setHeader('content-type', 'audio/ogg')
    response.send(CONVERTED_SOUNDS[strippedPath + '.ogg'])
    return true
  }

  response.setHeader('content-type', 'audio/ogg')
  let passThrough = streamAndCache(key.replace(path.extname(pk3InnerPath), '.ogg'), CONVERTED_SOUNDS, response)
  // force async so other threads can answer page requests during conversion
  Promise.resolve(encodeCmd(pk3File, pk3InnerPath, void 0, passThrough, false))
  return true
}



async function streamAndCache(key, cache, response) {
  let strippedKey = key.replace(path.extname(key), '')
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


function streamImageFile(filename, response) {
  if (!IMAGE_FORMATS.includes(path.extname(filename))) {
    return false
  }

  let pk3File
  if (typeof filename == 'object') {
    pk3File = filename
  } else
    if (fs.existsSync(filename)) {
      pk3File = await findAlt(filename)
    }
  if (!pk3File) {
    return false
  }

  let pk3Name
  if (typeof pk3File == 'string' && pk3File.match(/\.pk3$/i)) {
    pk3Name = filename.replace(/\.pk3.*/gi, '.pk3')
  }

  let pk3InnerPath = fullPath.replace(/^.*?\.pk3[^\/]*?(\/|$)/gi, '').toLocaleLowerCase()

  let key = typeof pk3File == 'object'
    ? (pk3File.file + '/' + pk3File.name) : (pk3Name
      // not possible?
      ? path.join(pk3Name, pk3InnerPath) : pk3File)

  if (typeof CONVERTED_IMAGES[key.replace(path.extname(pk3InnerPath), '.jpg')] != 'undefined') {
    response.setHeader('content-type', 'image/jpg')
    response.send(CONVERTED_IMAGES[key.replace(path.extname(pk3InnerPath), '.jpg')])
    return true
  } else
    if (typeof CONVERTED_IMAGES[key.replace(path.extname(pk3InnerPath), '.png')] != 'undefined') {
      response.setHeader('content-type', 'image/png')
      response.send(CONVERTED_IMAGES[key.replace(path.extname(pk3InnerPath), '.png')])
      return true
    }

  // TODO: call out to this somehow and result results
  isOpaque = await opaqueCmd(pk3File, pk3InnerPath)
  let newExt = isOpaque ? '.jpg' : '.png'
  response.setHeader('content-type', 'image/' + newExt.substring(1))
  let passThrough = streamAndCache(key.replace(path.extname(pk3InnerPath), newExt), CONVERTED_IMAGES, response)
  // force async so other threads can answer page requests during conversion
  Promise.resolve(convertCmd(pk3File, pk3InnerPath, void 0, passThrough, newExt))
  return true
}


// TODO: streamFile that does the path setup?
// leftovers?
function streamFile(filename, stream) {
  // streamImageKey or streamAudioKey or findAlt()

  let pk3File
  if (typeof filename == 'object') {
    pk3File = filename
  } else
    if (fs.existsSync(filename)) {
      pk3File = await findAlt(filename)
    }
  if (!pk3File) {
    return false
  }

  let pk3Name
  if (typeof pk3File == 'string' && pk3File.match(/\.pk3$/i)) {
    pk3Name = filename.replace(/\.pk3.*/gi, '.pk3')
  }

  let pk3InnerPath = fullPath.replace(/^.*?\.pk3[^\/]*?(\/|$)/gi, '').toLocaleLowerCase()

  let key = typeof pk3File == 'object'
    ? (pk3File.file + '/' + pk3File.name) : (pk3Name
      // not possible?
      ? path.join(pk3Name, pk3InnerPath) : pk3File)

  let passThrough
  if ((passThrough = streamAudioFile(pk3File, stream))) {
    return passThrough
  } else
    if ((passThrough = streamImageFile(pk3File, stream))) {
      return passThrough
    } else
      if (pk3Name && await streamFileKey(pk3File, pk3InnerPath, stream)) {
        return
      }

  // TODO: cache read in CONVERTED_FILES?
  //passThrough.pipe(response)
  //passThrough.end(CONVERTED_FILES[strippedKey] || cache[key])

  passThrough = fs.createReadStream(pk3File)
  passThrough.pipe(stream)
  return passThrough
}

module.exports = {
  streamAudioFile,
  streamImageFile,
  streamFile,
  findAlt,
}