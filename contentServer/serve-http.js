const { serveGames, serveGamesRange } = require('../gameServer/serve-games.js')
const { serveMaps, serveDownload, serveMapsRange } = require('../mapServer/serve-download.js')
const { serveLevelshot } = require('../mapServer/serve-lvlshot.js')
const { serveMapInfo } = require('../mapServer/serve-map.js')
const { downloadAllMeta } = require('../utilities/metadata.js')
const { CONTENT_FEATURES } = require('../contentServer/features.js')
const { renderFeature, renderIndex } = require('../utilities/render.js')


function setupExtensions(features, app) {


  if (features.includes('all')
    || features.includes('games')) {
    app.use(/\/games\/[0-9]+\/[0-9]+/i, serveGamesRange)
    app.use('/games', serveGames)
  }

  if (features.includes('all')
    || features.includes('maps')) {
    app.use(/\/maps\/[0-9]+\/[0-9]+/i, serveMapsRange)
    app.use(/\/maps\/.+/, serveMapInfo)
    app.use('/maps', serveMaps)
  }
  return

  if (features.includes('all')
    || features.includes('repack')) {
    app.use('/maps/repacked', serveFinished) // /maps/download/%1
    app.use(/\/palette\/[0-9]+\/[0-9]+/i, servePaletteRange)
    app.use(/\/palette\/.+/, servePaletteMap)
    app.use('/palette', servePalette)
    app.use(serveRepacked) // /maps/download/%1
  }

  if (features.includes('all')
    || features.includes('live')) {
    app.use(serveLive) // version.json and /build
  }

  if (features.includes('all')
    || features.includes('virtual')) {
    app.use(serveVirtual) // /home fs for updates
  }

  if (features.includes('all')
    || features.includes('maps')) {
    app.use('/maps/reload', downloadAllMeta)
    app.use('/maps/download', serveDownload)
    app.use(/\/maps\/[0-9]+\/[0-9]+/i, serveMapsRange)
    app.use(/\/maps\/.+/, serveMapInfo)
    app.use('/maps', serveMaps)
  }

  app.use('/*/*/levelshots/*.jpg', serveLevelshot)
  app.use('/*/screenshots/*.jpg', serveLevelshot)
  app.use('/*/levelshots/*.jpg', serveLevelshot)
  app.use('/*/maps/*_tracemap*.jpg', serveLevelshot)

}


async function serveIndex(features, response) {
  let index = renderIndex(
    `<ol id="feature-list" class="stream-list">${features
      .map(f => renderFeature(CONTENT_FEATURES[f]))}</ol>`)
  return response.send(index)
}

/*
// TODO: if I could generilize this, I wouldn't have to rewrite it for every list
async function renderShader(shader) {
  let result = ''
  result += `<li style="background-image: url('/${shader.levelshot}')">`
  result += `<h3 style="background-color: rgba(${shader.palette})">`
  result += `<a href="/${shader.link}">`
  result += `<span>${shader.title}</span>`
  result += shader.bsp && shader.title != shader.bsp
    ? `<small>${shader.bsp}</small>`
    : '<small>&nbsp;</small>'
  result += `</a></h3>`
  result += `<img src="/${shader.levelshot}" />`
  result += `<a href="/maps/download/">Download: ${shader.pakname}`
  return result
}
*/

module.exports = {
  serveIndex,
  setupExtensions,
}
