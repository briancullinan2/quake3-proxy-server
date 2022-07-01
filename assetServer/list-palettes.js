const fs = require('fs')
const path = require('path')

const { getIndex } = require('../utilities/zip.js')
const { findFile } = require('./virtual.js')
const { layeredDir } = require('../contentServer/serve-virtual.js')
const { IMAGE_FORMATS, getGame, repackedCache } = require('../utilities/env.js')

const MATCH_PALETTE = /palette\s"(.*?)"\s([0-9]+(,[0-9]+)*)/ig

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
          size: index[i].compressedSize,
          absolute: outFile,
          title: index[i].name,
          levelshot: `${basegame}/pak0.pk3dir/${index[i].name}?alt`,
          link: `${basegame}/pak0.pk3dir/${index[i].name}?alt`,
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
            virtualPaths.push(index[i].name.replace(path.extname(outFile), '.png'))
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

module.exports = {
  parseExisting,
}