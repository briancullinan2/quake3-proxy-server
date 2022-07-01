
const path = require('path')
const fs = require('fs')

const { EXE_NAME, FS_BASEPATH, FS_GAMEHOME, LVLSHOTS } = require('../utilities/env.js')
const { convertImage } = require('../contentServer/convert.js')
const { findFile } = require('../assetServer/virtual.js')
const { getGame } = require('../utilities/env.js')
const { repackedCache } = require('../utilities/env.js')


const EXECUTING = {

}

async function execLevelshot(mapname) {
  let basegame = getGame()
  let screenshotCommands = []
  let newVstr = ''
  let REPACKED_MAPS = path.join(repackedCache(), '/maps/')
  let REPACKED_SCREENSHOTS = path.join(repackedCache(), '/screenshots/')
  let REPACKED_LVLSHOTS = path.join(repackedCache(), '/levelshots/')

  // figure out which images are missing and do it in one shot
  let needsSetup = false
  let levelshot = path.join(REPACKED_LVLSHOTS, mapname + '.jpg')
  if (!fs.existsSync(levelshot)) {
    newVstr += ' ; vstr takeLevelshot ; '
    needsSetup = true
  }
  let screenshot1 = path.join(REPACKED_SCREENSHOTS, mapname + '_screenshot0001.jpg')
  if (!fs.existsSync(screenshot1)) {
    newVstr += ' ; vstr takeLevelshotFullsize ; '
    needsSetup = true
  }

  // special exception
  if (needsSetup) {
    newVstr = ' ; vstr setupLevelshot ; ' + newVstr
  }

  let screenshot2 = path.join(REPACKED_SCREENSHOTS, mapname + '_screenshot0002.jpg')
  if (!fs.existsSync(screenshot2)) {
    newVstr += ' ; vstr screenshotBirdsEyeView ; '
  }
  let tracemap1 = path.join(REPACKED_MAPS, mapname + '_tracemap0001.jpg')
  if (!fs.existsSync(tracemap1)) {
    newVstr += ' ; vstr exportAreaMask ; '
  }

  let tracemap2 = path.join(REPACKED_MAPS, mapname + '_tracemap0002.jpg')
  if (!fs.existsSync(tracemap2)) {
    newVstr += ' ; vstr exportHeightMap ; '
  }

  let tracemap3 = path.join(REPACKED_MAPS, mapname + '_tracemap0003.jpg')
  if (!fs.existsSync(tracemap3)) {
    newVstr += ' ; vstr exportSkybox ; '
  }

  let tracemap4 = path.join(REPACKED_MAPS, mapname + '_tracemap0004.jpg')
  if (!fs.existsSync(tracemap4)) {
    newVstr += ' ; vstr exportBottomup ; '
  }

  let tracemap5 = path.join(REPACKED_MAPS, mapname + '_tracemap0005.jpg')
  if (!fs.existsSync(tracemap5)) {
    newVstr += ' ; vstr exportGroundheight ; '
  }

  let tracemap6 = path.join(basegame, '/maps/', mapname + '_tracemap0006.jpg')
  if (!fs.existsSync(tracemap6)) {
    newVstr += ' ; vstr exportSkyboxVolume ; '
  }

  let tracemap7 = path.join(REPACKED_MAPS, mapname + '_tracemap0007.jpg')
  if (!fs.existsSync(tracemap7)) {
    newVstr += ' ; vstr exportSkyboxVolume2 ; '
  }

  let tracemap8 = path.join(REPACKED_MAPS, mapname + '_tracemap0008.jpg')
  if (!fs.existsSync(tracemap8)) {
    newVstr += ' ; vstr exportSkyboxVolume3 ; '
  }

  // TODO: export / write entities / mapname.ents file
  let entityFile = path.join(REPACKED_MAPS, mapname + '.ent')
  fs.mkdirSync(path.join(FS_GAMEHOME, basegame, '/maps/'), { recursive: true })
  if (!fs.existsSync(entityFile)) {
    screenshotCommands.push.apply(screenshotCommands, [
      '+set', 'cm_saveEnts', '1'
    ])
  }

  let shaderFile = path.join(REPACKED_MAPS, mapname + '-shaders.txt')
  if (!fs.existsSync(shaderFile)) {
    newVstr += ' ; shaderlist ; '
  }

  let imageFile = path.join(REPACKED_MAPS, mapname + '-images.txt')
  if (!fs.existsSync(imageFile)) {
    newVstr += ' ; imagelist ; '
  }

  // TODO: take screenshot from every camera position
  // TODO: export all BLUEPRINTS and all facets through sv_bsp_mini
  let logs = ''
  if (newVstr.length > 0) {
    screenshotCommands.push.apply(screenshotCommands, [
      '+set', 'lvlshotCommands', `"${newVstr}"`,
      '+exec', `".config/levelinfo_${mapname}.cfg"`,
      '+vstr', 'resetLvlshot',
      '+devmap', mapname,
      '+vstr', 'lvlshotCommands',
      '+wait', '200', '+quit'
    ])


    fs.mkdirSync(path.join(FS_GAMEHOME, basegame, '.config'), { recursive: true })
    let lvlconfig = path.join(FS_GAMEHOME, basegame, '.config/levelinfo_' + mapname + '.cfg')
    fs.writeFileSync(lvlconfig, LVLSHOTS.replace(/\$\{mapname\}/ig, mapname))
    logs = await execLevelshotDed(mapname, screenshotCommands)
    fs.unlinkSync(lvlconfig)
  }

  let outputEnts = path.join(FS_GAMEHOME, basegame, '/maps/' + mapname + '.ent')
  fs.mkdirSync(REPACKED_MAPS, { recursive: true })
  if (fs.existsSync(outputEnts)) {
    fs.renameSync(outputEnts, path.join(REPACKED_MAPS, mapname + '.ent'))
  }
  //if(screenshotCommands.length) {
  //}

  // convert TGAs to JPG.
  // TODO: transparent PNGs with special background color?
  let WROTE_SCREENSHOT = /^Wrote\s+((levelshots\/|screenshots\/|maps\/).*?)$/gmi
  let match
  while (match = WROTE_SCREENSHOT.exec(logs)) {
    let unsupportedFormat = findFile(basegame + '/' + match[1])
    if (!unsupportedFormat) {
      console.error('WARNING: output image not found ' + match[1])
      continue
    }
    // TODO: don't wait for anything?
    await convertImage(unsupportedFormat, match[1], '80%')
  }

  let IMAGE_LIST = /-name-------\n([\s\S]*?)total images/gi
  let imageList = IMAGE_LIST.exec(logs)
  if (imageList) {
    let images = imageList[0].split('\n').slice(1, -3)
      .map(line => (' ' + line).split(/\s+/ig).pop())
      .join('\n')
    fs.writeFileSync(imageFile, images)
  }

  // TODO: CODE REVIEW, in another location, I call resolve() after a promised resolve()
  //   but from within the same function
  if (typeof EXECUTING[mapname] != 'undefined') {
    for (let i = 1; i < EXECUTING[mapname].length; i++) {
      EXECUTING[mapname][i](logs)
    }
    EXECUTING[mapname].splice(0)
  }

  return logs
}


module.exports = {
  execLevelshot,
}

