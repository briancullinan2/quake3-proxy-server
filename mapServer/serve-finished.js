
// TODO: OMG SO MANY FILES!
// serve-finished are pk3 files, 
//   serve-repacked are virtual files that would only exist after conversion
const path = require('path')
const fs = require('fs')

const { getGame } = require('../utilities/env.js')
const { sourcePk3Download } = require('../mapServer/download.js')
const { repackBasemap, repackBasepack } = require('../mapServer/repack.js')
const { MAP_DICTIONARY, listMaps } = require('../assetServer/list-maps.js')
const { findFile } = require('../assetServer/virtual.js')


async function serveFinished(request, response, next) {
  let filename = request.originalUrl.replace(/\?.*$/, '')
  if(filename.startsWith('/')) {
    filename = filename.substr(1)
  }
  let modname = filename.split('/')[0]
  let mapname = path.basename(filename).replace(path.extname(filename), '').toLocaleLowerCase()
  let pk3s = await listMaps(modname || getGame())

  let newZip
  if(path.basename(filename).match(/^pak0\.pk3$|^pak0$/i)) {
    newZip = await repackBasepack()
  } else
  if(typeof MAP_DICTIONARY[mapname] != 'undefined') {
    if(MAP_DICTIONARY[mapname].startsWith('pak')) {
      newZip = await repackBasemap()
    } else {
      //newZip = await repackMappak()
    }
  } 
  
  if(!newZip || !fs.existsSync(newZip)) {
    newZip = findFile(getGame() + '/' + mapname + '.pk3')
    //newZip = await repackPk3(newZip)
  }
  if(!newZip) {
    return next(new Error('File not found: ' + filename))
  }

  return response.sendFile(newZip, {
    headers: { 'content-disposition': 
      `attachment; filename="${mapname}.pk3"` }
  })

}

module.exports = {
  serveFinished,

}