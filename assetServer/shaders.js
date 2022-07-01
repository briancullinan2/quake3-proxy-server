// TODO: validate shaders list for map uploads, make sure nothing is missing.
const path = require('path')
const fs = require('fs')

const { getGame } = require('../utilities/env.js')
const { layeredDir } = require('../assetServer/layered.js')
const { getIndex } = require('../utilities/zip.js')
const { findFile } = require('./virtual.js')
const { readFileKey } = require('../utilities/zip.js')


async function existingShaders() {
  let basegame = getGame()
  //let pk3names = Object.values(MAP_LIST_LOWER)
  let gamedir = await layeredDir(basegame)
  let pk3files = gamedir.filter(file => file.endsWith('.pk3')).sort().reverse()
  let maps = (await Promise.all(pk3files.map(async function (pk3name) {
    let basename = path.basename(pk3name)
    let index = await getIndex(findFile(pk3name))
    let bsps = index.filter(item => item.key.endsWith('.shader'))
    return bsps.map(function (shader) {
      return `/${basegame}/${basename}dir/${shader.name}`
    })
  }))).flat(1)
  let mapsNames = maps.map(m => path.basename(m).toLocaleLowerCase())
  let uniqueMaps = maps.filter((m, i) => mapsNames
      .indexOf(path.basename(m).toLocaleLowerCase()) == i)
  uniqueMaps.sort()
  return uniqueMaps
}


const SHADER_LIST = {

}
const SHADER_BODY = {

}


async function ScanAndLoadShaderFiles() {
  let shaders = await existingShaders()

  for(let i = 0; i < shaders.length; i++) {
    let pakname = findFile(shaders[i].replace(/\.pk3.*?$/ig, '.pk3'))
    let shaderText = await readFileKey(pakname, 'scripts/' + path.basename(shaders[i]))
    //let shaderText = fs.readFileSync(shaders[i]).toString('utf-8')
    SHADER_LIST[shaders[i]] = shaderText
    let lines = shaderText.split('\n')
    let skipBlock = false
    let shaderName
    let depth = 0
    let body = []
    for(let l = 0; l < lines.length; l++) {
      let line = lines[l].replace(/\/\/.*/ig, '')
      if(!skipBlock && line.match(/\w/gi)) {
        skipBlock = true
        shaderName = line.trim()
        body = []
      } else
      if(skipBlock && line.indexOf('{') > -1) {
        depth++
      } else
      if(skipBlock && line.indexOf('}') > -1) {
        depth--
        if(depth < 0) {
          throw new Error('Badly formatted shader: ' + shaderName + ' in ' + shaders[i])
        } else
        if(depth == 0) {
          skipBlock = false
          SHADER_BODY[shaderName] = body
        }
      } else
      if(skipBlock) {
        body.push(line + '\n')
      } else 
      if (line.trim().length > 0) {
        throw new Error('Don\'t know what to do! ' + line)
      } else {
        // just whitespace
      }
    }
  }
  // TODO: make an index of shader names, then as they are loaded, parse for
  //   image maps, and return a list of possible images
  //console.log(SHADER_BODY)
}


async function FindShaderInShaderText(shaderName) {
  let result = []
  let lower = shaderName.toLocaleLowerCase().replace(path.extname(shaderName), '')
  if(typeof SHADER_BODY[lower] == 'undefined') {
    return
  }
 
  for(let l = 0; l < SHADER_BODY[lower].length; l++) {
    let line = SHADER_BODY[lower][l]
    let match
    if((match = (/map ([\/\w-\._]+)/gi).exec(line))) {
      result.push(match[1] + (match[1].includes('.') ? '' : '.tga'))
    }
    if(line.match(/implicit/gi) && !result.includes(shaderName)) {
      result.push(shaderName + (shaderName.includes('.') ? '' : '.tga'))
    }
  }

  if(result.length) {
    return result
  }
}


module.exports = {
  ScanAndLoadShaderFiles,
  FindShaderInShaderText,
}
