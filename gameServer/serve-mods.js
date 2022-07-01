
const { MAP_DICTIONARY } = require('../assetServer/list-maps.js')
const { sourcePk3Download } = require('../mapServer/download.js')
const { GAME_SERVERS } = require('./master.js')
const { MODS_NAMES, getGame } = require('../utilities/env.js')
const { renderList, renderIndex } = require('../utilities/render.js')

/*
  if (rangeString && rangeString.includes(':')) {
    let address = rangeString.split(':')[0]
    let port = rangeString.split(':')[1]
    return next()
  }
*/

async function modInfo(modName) {
  let levelshot
  return {
    title: modName,
    levelshot: levelshot,
    link: `mods/${modName}`,
  }
}


async function serveMods(request, response, next) {
  let isJson = request.originalUrl.match(/\?json/)
  let start = 0
  let end = 100
  return serveModsReal(start, end, isJson, response, next)
}


async function serveModsRange(request, response, next) {
  let filename = request.originalUrl.replace(/\?.*$/, '')
  let isJson = request.originalUrl.match(/\?json/)
  let rangeString = filename.split('\/mods\/')[1]
  let start = 0
  let end = 100
  if (rangeString && rangeString.includes('\/')) {
    start = parseInt(rangeString.split('\/')[0])
    end = parseInt(rangeString.split('\/')[1])
  }
  return serveModsReal(start, end, isJson, response, next)
}


async function serveModsReal(start, end, isJson, response, next) {
  // TODO: filter games by game type
  let games = await Promise.all(Object.values(MODS_NAMES).slice(start, end).map(game => modInfo(game)))
  if (isJson) {
    return response.json(json)
  }
  let total = Object.values(MODS_NAMES).length
  let index = renderIndex(renderList('/mods/', games, total))
  return response.send(index)
}


module.exports = {
  serveMods,
  serveModsRange,
}