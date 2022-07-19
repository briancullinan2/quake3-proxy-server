const fs = require('fs')
const path = require('path')

const { listPk3s } = require('../assetServer/layered.js')
const { getIndex } = require('../utilities/zip.js')
const { findFile } = require('./virtual.js')
const { IMAGE_FORMATS, getGame, repackedCache } = require('../utilities/env.js')

const MATCH_PALETTE = /palette\s"(.*?)"\s([0-9]+(,[0-9]+)*)/ig

function parsePalette(shaderPath) {
  let existingPalette
  if(!fs.existsSync(shaderPath)) {
    existingPalette = shaderPath + ''
  } else {
    existingPalette = fs.readFileSync(shaderPath).toString('utf-8')
  }
  let palette = {}
  let m
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
    pk3files = (await listPk3s(basegame)).sort().reverse()
    // TODO: automatically add palette and built QVMs
  }
  let existingPalette = {}
  let paletteNeeded = []
  let virtualPaths = []
  for(let j = 0; j < pk3files.length; j++) {
    let newFile = findFile(path.join(getGame(), path.basename(pk3files[j])))
    if(!newFile) {
      continue
    }
    let index = await getIndex(newFile)
    for(let i = 0; i < index.length; i++) {
      if(index[i].isDirectory) {
        continue
      }
      if(virtualPaths.includes(index[i].name.replace(path.extname(index[i].name), '').toLocaleLowerCase())) {
        continue
      }
      if(IMAGE_FORMATS.includes(path.extname(index[i].name))) {
        let outFile = path.join(repackedCache(), path.basename(newFile) + 'dir', index[i].name)
        paletteNeeded.push({
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
            paletteNeeded.push(outFile.replace(path.extname(outFile), '.jpg'))
            virtualPaths.push(index[i].name.replace(path.extname(outFile), '.jpg'))
          } else
          if(fs.existsSync(outFile.replace(path.extname(outFile), '.png'))) {
            paletteNeeded.push(outFile.replace(path.extname(outFile), '.png'))
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
    paletteNeeded,
    existingPalette
  }
}

module.exports = {
  parseExisting,
  parsePalette,
}