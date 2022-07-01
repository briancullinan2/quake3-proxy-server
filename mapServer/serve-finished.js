
// TODO: OMG SO MANY FILES!
// serve-finished are pk3 files, 
//   serve-repacked are virtual files that would only exist after conversion



async function serveFinished(request, response, next) {
  let filename = request.url.replace(/\?.*$/, '')
  if(filename.startsWith('/')) {
    filename = filename.substr(1)
  }

  await existingMaps()


  let mapname = path.basename(filename).replace('.pk3', '').toLocaleLowerCase()
  if (mapname.localeCompare('pak0', 'en', { sensitivity: 'base' }) == 0) {
    // TODO: repack mod directory pk3s into 1 overlapping 
    //   (i.e. do the same virtual combination the 
    //      engine does and recompile)
    // TODO: get index of all pk3 in non-cache game directories,
    //   make a new pak with combined file-system
    let newZip = path.join(repackedCache(), 'pak0.pk3')
    if(!fs.existsSync(newZip)) {
      let newZip = path.join(repackedCache(), 'pak0.pk3')
      let filtered = await unpackBasegame(newZip)
      //filtered.push(await rebuildPalette(filtered))
      newZip = await repackPk3(filtered, newZip)
    }
    return response.sendFile(newZip, {
      headers: { 'content-disposition': `attachment; filename="pak0.pk3"` }
    })
  }

  // repack base-maps for web
  if(typeof MAP_DICTIONARY[mapname] == 'undefined') {
    return next(new Error('File not found: ' + filename))
  }
  if(MAP_DICTIONARY[mapname].substr(0, 3) == 'pak'
    && MAP_DICTIONARY[mapname].charCodeAt(3) - '0'.charCodeAt(0) < 9) {
    let newZip = await repackBasemap(mapname)
    return response.sendFile(newZip, {
      headers: { 'content-disposition': 
        `attachment; filename="${mapname}.pk3"` }
    })
  }

  // download pk3 and repack
  newFile = await sourcePk3Download(filename)
  if (!newFile.startsWith(repackedCache())) {
    newFile = await repackPk3(newFile)
  }
  return response.sendFile(newFile, {
    headers: { 'content-disposition': 
        `attachment; filename="${path.basename(newFile)}"` }
  })
}

module.exports = {
  serveFinished,

}