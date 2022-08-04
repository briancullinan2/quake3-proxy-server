// TODO: validate shaders list for map uploads, make sure nothing is missing.
const path = require('path')
const fs = require('fs')

const { getGame } = require('../utilities/env.js')
const { getIndex } = require('../utilities/zip.js')
const { findFile } = require('./virtual.js')
const { readFileKey } = require('../utilities/zip.js')
const { listPk3s } = require('../assetServer/layered.js')


async function existingShaders() {
  let chunk_size = 3
  let basegame = getGame()
  //let pk3names = Object.values(MAP_LIST_LOWER)
  let pk3files = (await listPk3s(basegame)).sort().reverse()
  // TODO: chunk out files into managable blocks
  let mapChunks = pk3files.map(function (e, i, arr) { 
    return i%chunk_size===0 ? arr.slice(i,i+chunk_size) : null; 
  }).filter(function(e){ return e; })

  let maps = []
  for(let i = 0; i < mapChunks.length; ++i) {
    maps.push.apply(maps, (await Promise.all(mapChunks[i].map(async function (pk3name) {
      let basename = path.basename(pk3name)
      let index = await getIndex(findFile(pk3name))
      let bsps = index.filter(item => item.key.endsWith('.shader'))
      return bsps.map(function (shader) {
        return `/${basegame}/${basename}dir/${shader.name}`
      })
    }))).flat(1))
  }

  // get all the shaders in the pk3 files
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
const SHADER_TIMES = {

}

function parseCurlys(shaderText) {
  let lines = shaderText.replace(/\/\*[\s\S]*?\*\//ig, '').split('\n')
  let skipBlock = false
  let shaderName
  let depth = 0
  let body = []
  for(let l = 0; l < lines.length; l++) {
    let line = lines[l].replace(/\/\/.*/ig, '')
    //console.log('shader at ', line.match(/\w+/gi), l, line)
    if(!skipBlock && line.match(/\w+/gi)) {
      skipBlock = true
      shaderName = line.trim()
      body = []
    }
  
    if(skipBlock && line.indexOf('{') > -1) {
      depth++
      continue
    } else
    if(skipBlock && line.indexOf('}') > -1) {
      depth--
      if(depth < 0) {
        throw new Error('Badly formatted shader: ' + shaderName)
      } else
      if(depth == 0) {
        skipBlock = false
        SHADER_BODY[shaderName] = body
      }
      continue
    }

    if(skipBlock) {
      body.push(line + '\n')
    } else 
    if (line.trim().length > 0) {
      throw new Error('Don\'t know what to do! (' + skipBlock + ') ' + lines[l-1] + '\n' + line)
    } else {
      // just whitespace
    }
  }
  return shaderText
}


// TODO: make an index of shader names, then as they are loaded, parse for
//   image maps, and return a list of possible images
async function ScanAndLoadShaderFiles() {
let chunk_size = 3
  let shaders = await existingShaders()
  let shaderChunks = shaders.map(function (e, i, arr) { 
    return i%chunk_size===0 ? arr.slice(i,i+chunk_size) : null; 
  }).filter(function(e){ return e; })

  for(let j = 0; j < shaderChunks.length; ++j) {
    let promises = []
    for(let i = 0; i < shaderChunks[j].length; i++) {
      let pakname = findFile(shaderChunks[j][i].replace(/\.pk3.*?$/ig, '.pk3'))

      // cache shaders based on file times
      let stat = fs.statSync(pakname)
      if(typeof SHADER_TIMES[shaderChunks[j][i]] != 'undefined') {
        if(SHADER_TIMES[shaderChunks[j][i]] == stat.mtime.getTime()) {
          continue
        }
      }
      SHADER_TIMES[shaderChunks[j][i]] = stat.mtime.getTime()

      promises.push(readFileKey(pakname, 'scripts/' + path.basename(shaderChunks[j][i]))
      .then(parseCurlys)
      .then(shaderText => { SHADER_LIST[shaderChunks[j][i]] = shaderText }))
    }
    await Promise.all(promises)
  }
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
