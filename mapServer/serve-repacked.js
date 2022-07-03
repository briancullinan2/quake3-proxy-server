

async function serveRepacked(request, response, next) {
  let filename = request.originalUrl.replace(/\?.*$/, '')
  if(filename.startsWith('/')) {
    filename = filename.substr(1)
  }

  let pk3File = filename.replace(/\.pk3.*/gi, '.pk3')
  let pk3InnerPath = filename.replace(/^.*?\.pk3[^\/]*?(\/|$)/gi, '')
  if(pk3File.length == filename.length) {
    // not a virtual path inside a .pk3
    return next()
  }

  if(!!request.url.match(/\?alt/) 
      && IMAGE_FORMATS.includes(path.extname(pk3InnerPath))) {
    return alternateImage(pk3InnerPath, response, next)
  }

  if(!!request.url.match(/\?alt/) 
      && AUDIO_FORMATS.includes(path.extname(pk3InnerPath))) {
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
  if (newFile && newFile.match(/\.pk3$/i)) {
    // serve unsupported images with ?alt in URL
    if (await streamFileKey(newFile, pk3InnerPath, response)) {
      return
    }
  } else
  if (newFile && newFile.includes('.pk3dir\/')) {
    return response.sendFile(newFile)
  }
  
  // TODO: CODE REVIEW, reduce cascading curlys event though code
  //   is redundant there's still less complexity overall
  return next(new Error('Not in repack: ' + filename))
}

module.exports = {
  serveRepacked,
}