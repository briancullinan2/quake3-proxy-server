const { serveGames, serveGamesRange, serveList } = require('../gameServer/serve-games.js')
const { serveMaps, serveDownload, serveMapsRange, serveDownloadList } = require('../mapServer/serve-download.js')
const { serveLevelshot } = require('../mapServer/serve-lvlshot.js')
const { serveMapInfo } = require('../mapServer/serve-map.js')
const { downloadAllMeta } = require('../quake3Utils/metadata.js')
const { serveModInfo, serveMods, serveModsRange } = require('../gameServer/serve-mods.js')
const { servePalette, servePaletteMap, servePaletteRange } = require('../assetServer/serve-palette.js')
const { getFeatureFilter } = require('../contentServer/features.js')
const { renderIndex, renderFeature } = require('../utilities/render.js')
const { serveAssets } = require('../assetServer/serve-assets.js')
const { serveMetadata } = require('../assetServer/serve-metadata.js')
const { serveLive } = require('../contentServer/serve-live.js')
const { serveSettings } = require('../contentServer/serve-settings.js')
const { serveConnections } = require('../proxyServer/serve-connections.js')
const { serveProcess } = require('../gameServer/serve-process.js')

// circular dependency
function serveFeatures(features, response) {
  let featureList = getFeatureFilter(features)
  let index = renderIndex(
    `<ol id="feature-list" class="stream-list">${featureList
      .map(renderFeature).join('')}</ol>`)
  return response.send(index)
}


function setupExtensions(features, app) {

  if (features.includes('all')
    || features.includes('games')) {
    app.use(/\/games\/[0-9]+\/[0-9]+/i, serveGamesRange)
    app.use(/\/games\/?$/i, serveGames)
    app.use(/\/servers\/?$/i, serveList)
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


  if (features.includes('all')
    || features.includes('assets')) {
    app.use(/\/assets\/?$/i, serveAssets)
  }


  if (features.includes('all')
    || features.includes('metadata')) {
    app.use(/\/metadata\/?$/i, serveMetadata)
  }

  if (features.includes('all')
    || features.includes('live')) {
    app.use('/build', serveLive) // version.json and /build
  }

  if (features.includes('all')
    || features.includes('live')
    || features.includes('repack')
    || features.includes('virtual')) {
    app.use(/\/settings\/?$/i, serveSettings)
  }

  if (features.includes('all')
    || features.includes('downloads')) {
    app.use(/\/downloads\/?$/i, serveDownloadList)
    app.use(/\/missing\/?$/i, serveDownloadList)
    app.use('/maps/download', serveDownload)
  }


  if (features.includes('all')
    || features.includes('proxy')) {
    app.use(/\/proxy\/?$/i, serveConnections)
  }


  if (features.includes('all')
    || features.includes('process')) {
    app.use(/\/process\/?$/i, serveProcess)
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
  serveFeatures,
}
