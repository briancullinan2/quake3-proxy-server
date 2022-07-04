
// TODO: OMG SO MANY FILES!
// serve-finished are pk3 files, 
//   serve-repacked are virtual files that would only exist after conversion
const path = require('path')
const fs = require('fs')
const { sourcePk3Download } = require('../mapServer/download.js')


async function serveFinished(request, response, next) {
  let filename = request.url.replace(/\?.*$/, '')
  if(filename.startsWith('/')) {
    filename = filename.substr(1)
  }

  await existingMaps()

  let mapname = path.basename(filename).replace(path.extname(filename), '').toLocaleLowerCase()
  let newZip
  if(path.basename(filename).match(/pak0\.pk3/i)) {
    newZip = await buildBasepack()
  } else
  if(typeof MAP_DICTIONARY[mapname] != 'undefined') {
    if(MAP_DICTIONARY[mapname].startsWith('pak')) {
      newZip = await repackBasemap()
    } else {
      newZip = await repackMappak()
    }
  } else {
    newZip = sourcePk3Download()
    newZip = await repackPk3(newZip)
  }

  return response.sendFile(newZip, {
    headers: { 'content-disposition': 
      `attachment; filename="${mapname}.pk3"` }
  })

}

module.exports = {
  serveFinished,

}