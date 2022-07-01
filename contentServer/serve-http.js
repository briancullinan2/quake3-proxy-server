const { serveGames } = require('../gameServer/serve-games.js')
const { serveMaps, serveDownload, serveMapsRange } = require('../mapServer/serve-download.js')
const { serveLevelshot } = require('../mapServer/serve-lvlshot.js')
const { serveMapInfo } = require('../mapServer/serve-map.js')
const { downloadAllMeta } = require('../utilities/metadata.js')


function serveExtensions(features, app) {

  if (features.includes('repack')) {
    app.use('/maps/repacked', serveFinished) // /maps/download/%1
    app.use(/\/palette\/[0-9]+\/[0-9]+/i, servePaletteRange)
    app.use(/\/palette\/.+/, servePaletteMap)
    app.use('/palette', servePalette)
    app.use(serveRepacked) // /maps/download/%1
  }

  if (features.includes('live')) {
    app.use(serveLive) // version.json and /build
  }

  if (features.includes('virtual')) {
    app.use(serveVirtual) // /home fs for updates
  }

  if (features.includes('games')) {
    app.use('/games', serveGames)
  }

  if (features.includes('maps')) {
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
  let offset = INDEX.match('<body>').index + 6
  let index = INDEX.substring(0, offset)
    + `<ol id="feature-list" class="stream-list">${features.map(f => (
      function renderFeature(feature) {
        let result = ''
        result += `<li style="background-image: url('${map.levelshot}')">`
        result += `<h3><a href="/${map.link}">`
        result += `<span>${map.title}</span>`
        result += map.bsp && map.title != map.bsp
          ? `<small>${map.bsp}</small>`
          : '<small>&nbsp;</small>'
        result += `</a></h3>`
        result += `<img ${map.have ? '' : 'class="unknownmap"'} src="${map.levelshot}" />`
        result += `<a href="/maps/download/${map.bsp}">Download: ${map.pakname}`
        //result += map.pakname.includes('.pk3') ? '' : '.pk3'
        return result
      })(f))}</ol>
      ` + INDEX.substring(offset, INDEX.length)
  return response.send(index)
}



module.exports = {
  serveIndex,
  serveExtensions,
}
