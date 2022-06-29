const path = require('path')
const fs = require('fs')
const { repackedCache } = require('../utilities/env.js')
const { getIndex, streamFile } = require('../utilities/zip.js')
const {PassThrough} = require('stream')

const CURRENTLY_UNPACKING = {}

/*
//  SOURCE: https://stackoverflow.com/questions/10623798/how-do-i-read-the-contents-of-a-node-js-stream-into-a-string-variable
function streamToBuffer(stream) {
  const chunks = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('error', (err) => reject(err));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  })
}
*/

// TODO: convert this setTimeout pattern to a utility for any server function to use

/*
async function extractPk3(pk3Path) {
  const StreamZip = require('node-stream-zip')
  const zip = new StreamZip({
    file: pk3Path,
    storeEntries: true,
    skipEntryNameValidation: true,
  })
  let newZip = path.join(repackedCache(), path.basename(pk3Path))
  if(typeof CURRENTLY_UNPACKING[newZip] == 'undefined') {
    CURRENTLY_UNPACKING[newZip] = []
  }

  // only extract the same pk3 once, even if multiple page loads initiates it
  if(CURRENTLY_UNPACKING[newZip].length > 0) {
    return await new Promise(function (resolve, reject) {
      let rejectTimer = setTimeout(function () {
        reject(new Error('Already extracting timed out.'))
        rejectTimer = null
      }, 3000)
      CURRENTLY_UNPACKING[newZip].push(function (directoryIndex) {
        if(rejectTimer) {
          cancelTimeout(rejectTimer)
          resolve(directoryIndex)
        }
      })
    })
  }

  // make a new zip, filter out everything but text files
  //   (e.g. menus, cfgs, shaders)
  //   and very small images from shaders/gfx/sfx
  // generate new palette
  let index = await getIndex(pk3Path)
  for (let i = 0; i < index.length; i++) {
    if (index[i].isDirectory)
      continue

    let outFile = path.join(newZip + 'dir', index[i].name)
    if (fs.existsSync(outFile)) {
      continue;
    }
  
    console.log('Extracting', index[i].key, '->', outFile)
    fs.mkdirSync(path.dirname(outFile), { recursive: true })

  }

  return await new Promise(resolve => {
    resolve(index)
    for(let i = 0; i < CURRENTLY_UNPACKING[newZip].length; i++) {
      CURRENTLY_UNPACKING[newZip](index)
    }
    CURRENTLY_UNPACKING[newZip].splice(0)
  })
}
*/


module.exports = {
  extractPk3,
}