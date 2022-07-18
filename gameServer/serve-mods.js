const path = require('path')

const { MODS_NAMES, getGame, getGames } = require('../utilities/env.js')
const { renderIndex, renderList } = require('../utilities/render.js')

/*
  if (rangeString && rangeString.includes(':')) {
    let address = rangeString.split(':')[0]
    let port = rangeString.split(':')[1]
    return next()
  }
*/


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
  let games = await Promise.all(Object.values(MODS_NAMES).concat(getGames())
    .filter((mod, i, arr) => arr.indexOf(mod) == i)
    .slice(start, end).map(async (game, i) => {
      let levelshot
      return {
        title: MODS_NAMES[i],
        subtitle: game,
        levelshot: levelshot,
        link: `mods/${game}`,
      }
    }))
  games.sort((a, b) => a.title.localeCompare(b.title, 'en', {sensitivity: 'base'}))
  if (isJson) {
    return response.json(games)
  }
  let total = Object.values(MODS_NAMES).length
  let index = renderIndex(renderList('/mods/', games, total))
  return response.send(index)
}


async function serveModInfo(request, response, next) {
  let filename = request.originalUrl.replace(/\?.*$/, '')
  let isJson = request.originalUrl.match(/\?json/)
  let modname = path.basename(filename).toLocaleLowerCase()

  return response.send(renderIndex(
    `<div id="mod-info" class="info-layout">
    <h2>${modname}</h2>
    <h3>Screenshots</h3>
    <h3>Links</h3>`
    + renderList('/menu/', [
      {
        title: 'Play',
        link: 'index.html?set%20fs_game%20' + modname,
      },
      {
        title: 'Assets',
        link: modname + '/?index',
      },
    ], 3)))
}

module.exports = {
  serveMods,
  serveModsRange,
  serveModInfo,
}