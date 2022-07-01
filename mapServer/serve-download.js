
// This lvlworld dictionary is a full dump of the database from
//   Tig https://lvlworld.com/metadata/from:2021-04-01/extended
// Although lvlworld has been extremely helpful. The database 
//   design, comment system, none of it is open source, so it 
//   can't be supplemented with filters for specific mods, 
//   custom templates for admins to use, or this chat program
//   from https://efservers.com/
// There are multiple conversations on how nice it would be to 
//   have their own open source version of lvlworld or ws.q3df.org
//   Philosophically, I see this like the fork-tree-of-life.
//   A project gets forked dozens of times, people make their 
//   modifications, and only the greatest ideas are filtered
//   by upstream. 
// Since idSoftware isn't accepting PRs, the 
//   most upstream is ioq3, and I'm banned. A new form of 
//   "Not Invented Here", I'm not allowed to contribute. ioq3
//   has administration problems, I'm blocked from forking, even
//   though there is a path to cleaning up ioq3. NuclearMonster 
//   could easily create a new repository that is based on the 
//   previous repository. Obviously, the question arises, "what
//   happens to all those people relying on updates to code?".
//   Rename the old repository to something like ioq3_old, and
//   then rename the new repository back to ioq3. Maintainers 
//   will still get updates, but the overloaded list of forks
//   on Github will be reset.
const fs = require('fs')
const path = require('path')

const { LVLWORLD_DB, downloadCache } = require('../utilities/env.js')
const { MAP_DICTIONARY } = require('../assetServer/list-maps.js')
const { renderList, renderIndex } = require('../utilities/render.js')
const { existingMaps } = require('../assetServer/list-maps.js')


const MAP_LIST = require(path.join(LVLWORLD_DB, 'maplist.json'))
  .reduce((obj, item) => {
    obj[item.id] = item.fileName
    return obj
  }, {})
const MAP_LIST_LOWER = Object.keys(MAP_LIST)
  .reduce((obj, key) => {
    obj[key] = MAP_LIST[key].toLocaleLowerCase()
    return obj
  }, {})



async function serveDownload(request, response, next) {
  let filename = request.url.replace(/\?.*$/, '')
  if (filename.startsWith('/')) {
    filename = filename.substr(1)
  }
  let mapname = path.basename(filename).replace('.pk3', '').toLocaleLowerCase()
  await existingMaps()
  if (typeof MAP_DICTIONARY[mapname] == 'undefined') {
    return next(new Error('File not found: ' + filename))
  }
  if (MAP_DICTIONARY[mapname].substr(0, 3) == 'pak'
    && MAP_DICTIONARY[mapname].charCodeAt(3) - '0'.charCodeAt(0) < 9) {
    return next(new Error('Won\'t serve base file: ' + MAP_DICTIONARY[mapname]))
  }
  let newFile = path.join(downloadCache(), MAP_DICTIONARY[mapname])
  console.log('Downloading:', newFile)
  if (fs.existsSync(newFile)) {
    return response.sendFile(newFile, {
      headers: { 'content-disposition': `attachment; filename="${MAP_DICTIONARY[mapname]}"` }
    })
  } else {
    return next(new Error('File not found: ' + filename))
  }

}


async function serveMapsRange(request, response, next) {
  let isJson = request.url.match(/\?json/)
  let filename = request.originalUrl.replace(/\?.*$/, '')
  let start = 0
  let end = 100
  let rangeString = filename.split(/\/maps\//i)[1]
  if (rangeString && rangeString.includes('\/')) {
    start = parseInt(rangeString.split('\/')[0])
    end = parseInt(rangeString.split('\/')[1])
  }
  return await serveMapsReal(start, end, isJson, response)
}


async function serveMapsReal(start, end, isJson, response) {
  let mapsAvailable = await existingMaps()
  let maps = mapsAvailable.slice(start, end)
  if (isJson) {
    return response.json(maps)
  }

  let total = mapsAvailable.length
  let index = renderIndex(renderList('/maps/', maps, total))
  return response.send(index)
}


async function serveMaps(request, response, next) {
  let isJson = request.url.match(/\?json/)
  let start = 0
  let end = 100
  return await serveMapsReal(start, end, isJson, response)
}


module.exports = {
  serveMaps,
  serveDownload,
  serveMapsRange,
}
