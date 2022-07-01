// TODO: update stuff based on when file system changes
//   use node watcher



function serveLive(request, response, next) {
  let isJson = request.url.match(/\?json/)
  let filename = request.url.replace(/\?.*$/, '')
  let pk3File = filename.replace(/\.pk3.*/gi, '.pk3')
  let newFile = findFile(filename)

  if(newFile && newFile.endsWith('.pk3') 
      && pk3File.length < filename.length) {
    // probably meant to request a file inside the pk3, this script is just for updated
    // TODO: check directory times?
    return next()
  } else
  if(newFile && !fs.statSync(newFile).isDirectory()) {
    return response.sendFile(newFile)
  } else 
  if (newFile && !isJson) {
    let indexFile = findFile(path.join(filename, 'index.html'))
    if(indexFile && indexFile.endsWith('.pk3') 
        && pk3File.length < filename.length) {
      // let repackaging service handle it
      return next()
    } else
    if (indexFile && path.basename(indexFile).match(/index\.html/gi)) {
      // inject engine init
      
    } else
    if(indexFile) {
      return response.sendFile(indexFile)
    }
    return next() // TODO: VIRTUAL
    throw new Error('Directories not implemented')
  } else
  // cache busting for clients
  if(filename.includes('version.json')) {
    // create a virtual version file based on the max time
    //   of all our search directories, if any one of them 
    //   changed from new build files, the version.json
    //   check will break the IDBFS cache.
    let BUILD_ORDER = buildDirectories()
    let latest = 0
    let time
    for(let i = 0; i < BUILD_ORDER.length; i++) {
      let newPath = path.join(BUILD_ORDER[i], filename)
      if(fs.existsSync(newPath)) {
        let newTime = fs.statSync(newPath).mtime
        if(newTime.getTime() > latest) {
          latest = newTime.getTime()
          time = newTime
        }
      }
    }
    if(latest > 0) {
      return response.json([time, time])
    }
  }
  // TODO: send refresh signal over websocket/proxy
  //   in a POSIX similar way? This would be cool
  //   because then all remote clients will refresh
  //   and reconnect to existing game

  return next()
}
