const fs = require('fs')
const path = require('path')

const { INDEX, getGame, repackedCache } = require('../utilities/env.js')
const { getMapInfo } = require('../mapServer/bsp.js')
const { existingMaps } = require('../mapServer/serve-download.js')
const { parseExisting } = require('./list-palettes.js')


async function servePaletteReal(start, end, filterMap, isJson, response) {
  let { palettesNeeded, existingPalette } = await parseExisting()
  // TODO: filterMap
  if (filterMap) {
    await existingMaps()
    let mapInfo
    try {
      mapInfo = await getMapInfo(filterMap)
    } catch (e) {
      console.error(e)
    }

    console.log(mapInfo.images)
    palettesNeeded = palettesNeeded.filter()
  }
  let palettes = palettesNeeded.slice(start, end)
  await Promise.all(palettes.map(shader =>
    formatPalette(shader, existingPalette)))

  let paletteFile = path.join(repackedCache(), '/scripts/palette.shader')
  // only palettize the current range, not to do too much work per request
  let existingNeeded = palettesNeeded.filter(shader => typeof existingPalette[shader.title.replace(path.extname(shader.title), '').toLocaleLowerCase()] != 'undefined')
  let newPixels = await makePalette(palettes.concat(existingNeeded), existingPalette)
  let newPalette = `palettes\/${getGame()}\n
  {\n
    ${newPixels.join('\n')}\n
  }\n`
  fs.writeFileSync(paletteFile, newPalette)


  if (isJson) {
    return response.json(palettes)
  }

  let total = palettesNeeded.length
  let list = (await Promise.all(palettes.map(shader =>
    renderShader(shader)))).join('')
  let offset = INDEX.match('<body>').index + 6
  let index = INDEX.substring(0, offset)
    + `<ol id="shader-list" class="stream-list">${list}</ol>
      <script>window.sessionLines=${JSON.stringify(palettes)}</script>
      <script>window.sessionLength=${total}</script>
      <script>window.sessionCallback='/palette/'</script>
      <script async defer src="index.js"></script>
      ` + INDEX.substring(offset, INDEX.length)
  return response.send(index)
}


async function servePalette(request, response, next) {
  let isJson = request.url.match(/\?json/)
  let start = 0
  let end = 100
  return await servePaletteReal(start, end, null, isJson, response)
}

async function servePaletteRange(request, response, next) {
  let isJson = request.url.match(/\?json/)
  let filename = request.originalUrl.replace(/\?.*$/, '')
  let start = 0
  let end = 100
  let rangeString = filename.split(/\/palette\//i)[1]
  if (rangeString && rangeString.includes('\/')) {
    start = parseInt(rangeString.split('\/')[0])
    end = parseInt(rangeString.split('\/')[1])
  }
  return await servePaletteReal(start, end, null, isJson, response)
}

async function servePaletteMap(request, response, next) {
  let isJson = request.url.match(/\?json/)
  let filename = request.originalUrl.replace(/\?.*$/, '')
  if (filename.startsWith('/')) {
    filename = filename.substring(1)
  }
  let filterMap = filename.split('/')[1]
  return await servePaletteReal(0, 100, filterMap, isJson, response)
}

async function formatPalette(shader, existingPalette) {
  let palette
  let paletteKey = shader.title
    .replace(path.extname(shader.title), '')
    .toLocaleLowerCase()
  if (typeof existingPalette[paletteKey] != 'undefined') {
    palette = existingPalette[paletteKey]
  } else {
    palette = await paletteCmd(shader.absolute)
    existingPalette[paletteKey] = palette
  }
  let formattedPalette = palette.split(',')
  formattedPalette[3] = Math.round(parseInt(formattedPalette[3])
    / 255.0 * 10.0) / 10.0
  formattedPalette = formattedPalette.join(',')
  shader.palette = formattedPalette
}


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

module.exports = {
  servePaletteRange,
  servePalette,
  servePaletteMap,
}

