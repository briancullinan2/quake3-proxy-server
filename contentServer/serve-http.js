const { serveGames, serveGamesRange, serveList, serveGameInfo,
  serveRcon } = require('../gameServer/serve-games.js')
const { serveMaps, serveDownload, serveMapsRange, serveDownloadList } = require('../mapServer/serve-download.js')
const { serveLevelshot } = require('../mapServer/serve-lvlshot.js')
const { serveMapInfo } = require('../mapServer/serve-map.js')
const { downloadAllMeta } = require('../quake3Utils/metadata.js')
const { serveModInfo, serveMods, serveModsRange } = require('../gameServer/serve-mods.js')
const { servePalette, servePaletteMap, servePaletteRange } = require('../assetServer/serve-palette.js')
const { serveFinished } = require('../mapServer/serve-finished.js')
const { getFeatureFilter } = require('../contentServer/features.js')
const { renderIndex, renderFeature } = require('../utilities/render.js')
const { serveAssets } = require('../assetServer/serve-assets.js')
const { serveMetadata } = require('../assetServer/serve-metadata.js')
const { serveLive } = require('../contentServer/serve-live.js')
const { serveSettings } = require('../contentServer/serve-settings.js')
const { serveConnections } = require('../proxyServer/serve-connections.js')
const { serveProcess } = require('../gameServer/serve-process.js')
const { serveRepacked } = require('../mapServer/serve-repacked.js')
const { serveVirtual } = require('../contentServer/serve-virtual.js')
const { serveUpgrade } = require('../contentServer/serve-upgrade.js')


// circular dependency
function serveFeatures(features, response) {
  let featureList = getFeatureFilter(features)
  let index = renderIndex(
    `<div class="info-layout">
    <h2>Site Map</h2>
    <ol id="feature-list" class="menu-list">${featureList.map(renderFeature).join('')}</ol>
    </div>`)
  response.setHeader('content-type', 'text/html')
  return response.send(index)
}


function setupExtensions(features, app) {

  if (features.includes('all')
    || features.includes('games')) {
    app.use(/\/games\/[0-9]+\/[0-9]+/i, serveGamesRange)
    app.use(/\/servers\/?$/i, serveList)
    app.post(/\/rcon\/[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+\:[0-9]+/i, serveRcon)
    app.use(/\/rcon\/[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+\:[0-9]+/i, serveRcon)
    app.use(/\/games\/[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+\:[0-9]+/i, serveGameInfo)
    app.use('\/games', serveGames)
  }


  if (features.includes('all')
    || features.includes('maps')) {
    app.use(/\/maps\/[0-9]+\/[0-9]+$/i, serveMapsRange)
    app.use(/\/maps\/[^\/]+$/i, serveMapInfo)
    app.use(/\/maps\/?$/i, serveMaps)
    app.use('/maps/reload', downloadAllMeta)
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


  if (features.includes('all')
    || features.includes('repack')) {
    app.use(/\/[^\/]+\/[^\/]+\.pk3$/i, serveFinished)
    app.use('/maps/repacked', serveFinished) // /maps/download/%1
    app.use('/repacked', serveRepacked) // /maps/download/%1
  }

  if (features.includes('all')
    || features.includes('upgrade')) {
    app.use(/\/upgrade\/?$/i, serveUpgrade)
  }

  if (features.includes('all')
    || features.includes('virtual')) {
    app.use('/*', serveVirtual) // /home fs for updates
  }

  if (features.includes('all')
    || features.includes('lvlshot')) {
    app.use('/*/*/levelshots/*', serveLevelshot)
    app.use('/*/screenshots/*', serveLevelshot)
    app.use('/*/levelshots/*', serveLevelshot)
    app.use('/*/maps/*_tracemap*', serveLevelshot)
  }

}


module.exports = {
  setupExtensions,
  serveFeatures,
}
