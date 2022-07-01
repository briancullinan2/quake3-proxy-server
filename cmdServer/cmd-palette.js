
const fs = require('fs')
const path = require('path')
const {PassThrough} = require('stream')


const { streamFileKey } = require('../utilities/zip.js')
const {execCmd} = require('../utilities/exec.js')
const { findFile } = require('../assetServer/virtual.js')

async function paletteCmd(imagePath) {
  let passThrough
  // TODO: CODE REVIEW make this a template of some sort
  //   should be best guess cache location
  if(!fs.existsSync(imagePath)) {
    let pk3InnerPath = imagePath.replace(/^.*?\.pk3[^\/]*?(\/|$)/gi, '')
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
  ], {pipe: passThrough})).replace(/%/gi, '')
}

module.exports = {
  paletteCmd
}