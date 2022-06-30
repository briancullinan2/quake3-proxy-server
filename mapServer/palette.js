const fs = require('fs')
const path = require('path')
const {PassThrough} = require('stream')

const { findFile } = require('../contentServer/virtual.js')
const { layeredDir } = require('../contentServer/content.js')
const { IMAGE_FORMATS, INDEX, getGame, repackedCache } = require('../utilities/env.js')
const { getIndex, streamFileKey } = require('../utilities/zip.js')
const {execCmd} = require('../utilities/exec.js')
const { unsupportedImage } = require('../contentServer/content.js')

const MATCH_PALETTE = /palette\s"(.*?)"\s([0-9]+(,[0-9]+)*)/ig

async function paletteCmd(imagePath) {
  let passThrough
  let pk3InnerPath = imagePath.replace(/^.*?\.pk3[^\/]*?(\/|$)/gi, '')
  //console.log(imagePath)
  if(!fs.existsSync(imagePath)) {
    let pakname = path.basename(imagePath.replace(/\.pk3.*?$/gi, '.pk3'))
    let pk3Path = findFile(path.join(getGame(), pakname))
    passThrough = new PassThrough()
    streamFileKey(pk3Path, pk3InnerPath, passThrough)
  }
  return (await execCmd('convert', [passThrough 
    ? path.extname(imagePath).substring(1) + ':-' 
    : imagePath, 
    '-resize', '1x1\!', 
    '-format', 
    '"%[fx:int(255*r+.5)],%[fx:int(255*g+.5)],%[fx:int(255*b+.5)],%[fx:int(255*a+.5)]"', 
    'info:-'
  ], {pipe: passThrough, shell: true})).replace(/%/gi, '')
}


function parsePalette(shaderPath) {
  if(!fs.existsSync(shaderPath)) {
    return {}
  }
  let palette = {}
  let m
  let existingPalette = fs.readFileSync(shaderPath).toString('utf-8')
  let match = MATCH_PALETTE
  while((m = (match).exec(existingPalette)) !== null) {
    palette[m[1].replace(path.extname(m[1]), '').toLocaleLowerCase()] = m[2]
  }
  return palette
}


async function parseExisting(pk3files) {
  let basegame = getGame()
  // TODO: CODE REVIEW: some sort of @Preamble template that handles type checking?
  if(!pk3files || pk3files.length == 0) {
    let gamedir = await layeredDir(basegame)
    // TODO: automatically add palette and built QVMs
    pk3files = gamedir
        .filter(file => file.endsWith('.pk3'))
        .map(p => path.basename(p)).sort().reverse()
  }
  let existingPalette = {}
  let palettesNeeded = []
  let virtualPaths = []
  for(let j = 0; j < pk3files.length; j++) {
    let newFile = findFile(path.join(getGame(), path.basename(pk3files[j])))
    let index = await getIndex(newFile)
    for(let i = 0; i < index.length; i++) {
      if(index[i].isDirectory) {
        continue
      }
      if(virtualPaths.includes(index[i].name.replace(path.extname(index[i].name), '').toLocaleLowerCase())) {
        continue
      }
      if(IMAGE_FORMATS.includes(path.extname(index[i].name))) {
        let outFile = path.join(repackedCache(), path.basename(newFile) 
            + 'dir', index[i].name)
        palettesNeeded.push({
          absolute: outFile,
          title: index[i].name,
          levelshot: `${basegame}/pak0.pk3dir/${index[i].name}?alt`,
          pakname:  path.basename(newFile),
        })
        virtualPaths.push(index[i].name.replace(path.extname(index[i].name), '').toLocaleLowerCase())
        /*
        if (unsupportedImage(index[i].name)) {
          if(fs.existsSync(outFile.replace(path.extname(outFile), '.jpg'))) {
            palettesNeeded.push(outFile.replace(path.extname(outFile), '.jpg'))
            virtualPaths.push(index[i].name.replace(path.extname(outFile), '.jpg'))
          } else
          if(fs.existsSync(outFile.replace(path.extname(outFile), '.png'))) {
            palettesNeeded.push(outFile.replace(path.extname(outFile), '.png'))
            virtualPaths.push(index[i].name.replace(path.extname(outFile), '.jpg'))
          }
        }
        */
      }
    }

    let localShader = path.join(repackedCache(), 
        path.basename(newFile) + 'dir', '/scripts/palette.shader')
    if(fs.existsSync(localShader)) {
      existingPalette = Object.assign({}, await parsePalette(localShader), existingPalette)
    }
  }
  let localShader = path.join(repackedCache(), '/scripts/palette.shader')
  if(fs.existsSync(localShader)) {
    existingPalette = Object.assign({}, await parsePalette(localShader), existingPalette)
  }
  return {
    palettesNeeded,
    existingPalette
  }
}


function makePalette(palettesNeeded, existingPalette) {
  return Promise.all(palettesNeeded.map(async function ({absolute}) {
    let localPath = absolute.replace(/^.*?\.pk3.*?\//gi, '')
    if(typeof existingPalette[localPath.replace(path.extname(localPath), '').toLocaleLowerCase()] != 'undefined') {
      return `  palette "${localPath}" ${existingPalette[localPath.replace(path.extname(localPath), '').toLocaleLowerCase()]}`
    }
    return `  palette "${localPath}" ${await paletteCmd(absolute)}`
  }))
}


async function rebuildPalette(pk3files) {
  // TODO: get list of pk3s involved
  let pk3sOnly = (pk3files || [])
      .map(p => path.basename(p.replace(/\.pk3.*?$/gi, '.pk3')))
      .filter((p, i, arr) => p && arr.indexOf(p) == i).sort().reverse()
  if(pk3sOnly.length == 0) {
    let gamedir = await layeredDir(getGame())
    // TODO: automatically add palette and built QVMs
    pk3sOnly = gamedir.filter(file => file.endsWith('.pk3'))
        .map(p => path.basename(p)).sort().reverse()
  }

  let paletteFile = path.join(repackedCache(), pk3sOnly[0] + 'dir', '/scripts/palette.shader')
  fs.mkdirSync(path.dirname(paletteFile), { recursive: true })
  let {palettesNeeded, existingPalette} = await parseExisting(pk3sOnly)
  let newPixels = await makePalette(palettesNeeded, existingPalette)
  let newPalette = `palettes\/${getGame()}\n
  {\n
    ${newPixels.join('\n')}\n
  }\n`
  fs.writeFileSync(paletteFile, newPalette)
  // TODO: get complete list of images no matter the size from index, ugh, again

  // TODO: convert list of images to filtered list without extensions, 
  //   but leave the original extension from .pk3 on
  return paletteFile
}

async function servePaletteReal(start, end, isJson, response) {
  let {palettesNeeded, existingPalette} = await parseExisting()
  let palettes = palettesNeeded.slice(start, end)
  await Promise.all(palettes.map(shader => 
      formatPalette(shader, existingPalette)))

  let paletteFile = path.join(repackedCache(), '/scripts/palette.shader')
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
  return await servePaletteReal(start, end, isJson, response)
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
  return await servePaletteReal(start, end, isJson, response)
}

async function formatPalette(shader, existingPalette) {
  let palette
  let paletteKey = shader.title
      .replace(path.extname(shader.title), '')
      .toLocaleLowerCase()
  if(typeof existingPalette[paletteKey] != 'undefined') {
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
  result += `<h3 style="background-color: rgba(${shader.palette})"><a href="/${shader.levelshot}">`
  result += `<span>${shader.title}</span>`
  result += shader.bsp && shader.title != shader.bsp
    ? '<small>' + shader.bsp + '</small>' : '<small>&nbsp;</small>'
  result += `</a></h3>`
  result += `<img src="/${shader.levelshot}" />`
  result += `<a href="/maps/download/">Download: ${shader.pakname}`
  return result
}

module.exports = {
  rebuildPalette,
  servePaletteRange,
  servePalette,
}

