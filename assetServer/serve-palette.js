const fs = require('fs')
const path = require('path')

const { getMapInfo } = require('../mapServer/bsp.js')
const { filteredMaps } = require('../assetServer/list-maps.js')
const { parseExisting } = require('./list-palettes.js')
const { renderIndex, renderList, renderMenu } = require('../utilities/render.js')
const { paletteCmd } = require('../cmdServer/cmd-palette.js')
const { makePalette } = require('../assetServer/make-palette.js')
const { parsePalette } = require('../assetServer/list-palettes.js')
const { ASSET_FEATURES } = require('../contentServer/serve-settings.js')

let CACHED_PALETTE = ''

async function servePaletteReal(start, end, filterMap, isJson, response) {
  let { paletteNeeded, existingPalette } = await parseExisting()
  if (CACHED_PALETTE) {
    existingPalette = Object.assign({}, await parsePalette(CACHED_PALETTE), existingPalette)
  }

  // TODO: filterMap
  if (filterMap) {
    await filteredMaps()
    let mapInfo
    try {
      mapInfo = await getMapInfo(filterMap)
    } catch (e) {
      console.error('MAPINFO:', e)
    }
    console.log(mapInfo.images)
    paletteNeeded = paletteNeeded.filter()
  }
  let palettes = paletteNeeded.slice(start, end)
  await Promise.all(palettes.map(shader =>
    formatPalette(shader, existingPalette)))


  // only palettize the current range, not to do too much work per request
  let existingNeeded = paletteNeeded.filter(shader =>
    typeof existingPalette[shader.title.replace(path
      .extname(shader.title), '').toLocaleLowerCase()] != 'undefined')
  //console.log(palettes.concat(existingNeeded))
  CACHED_PALETTE = await makePalette(palettes.concat(existingNeeded), existingPalette)


  if (isJson) {
    return response.json(palettes)
  }

  let total = paletteNeeded.length
  let index = renderIndex(
    renderMenu(ASSET_FEATURES, 'asset-menu')
    + renderList('/palette/', palettes, total))
  response.setHeader('content-type', 'text/html')
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
  formattedPalette[3] = Math.round(parseInt(formattedPalette[3]) / 255.0 * 10.0) / 10.0
  formattedPalette = formattedPalette.join(',')
  shader.palette = formattedPalette
}


module.exports = {
  servePaletteRange,
  servePalette,
  servePaletteMap,
}

