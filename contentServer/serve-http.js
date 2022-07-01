const { serveGames, serveGamesRange } = require('../gameServer/serve-games.js')
const { serveMaps, serveDownload, serveMapsRange } = require('../mapServer/serve-download.js')
const { serveLevelshot } = require('../mapServer/serve-lvlshot.js')
const { serveMapInfo } = require('../mapServer/serve-map.js')
const { downloadAllMeta } = require('../utilities/metadata.js')
const { serveModInfo, serveMods, serveModsRange } = require('../gameServer/serve-mods.js')
const { servePalette, servePaletteMap, servePaletteRange} = require('../assetServer/serve-palette.js')


function setupExtensions(features, app) {

  if (features.includes('all')
    || features.includes('games')) {
    app.use(/\/games\/[0-9]+\/[0-9]+/i, serveGamesRange)
    app.use(/\/games\/?$/i, serveGames)
  }

  if (features.includes('all')
    || features.includes('maps')) {
    app.use(/\/maps\/[0-9]+\/[0-9]+$/i, serveMapsRange)
    app.use(/\/maps\/[^\/]+$/i, serveMapInfo)
    app.use(/\/maps\/?$/i, serveMaps)
  }

  if (features.includes('all')
    || features.includes('mods')) {
    app.use(/\/mods\/[0-9]+\/[0-9]+/i, serveModsRange)
    app.use(/\/mods\/[^\/]+$/i, serveModInfo)
    app.use(/\/mods\/?$/i, serveMods)
  }

  if (features.includes('all')
    || features.includes('shaders')) {
    app.use(/\/palette\/[0-9]+\/[0-9]+/i, servePaletteRange)
    app.use(/\/palette\/.+/i, servePaletteMap)
    app.use(/\/palette\/?$/i, servePalette)
  }

  return

  if (features.includes('all')
    || features.includes('repack')) {
    app.use('/maps/repacked', serveFinished) // /maps/download/%1
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


module.exports = {
  setupExtensions,
}
