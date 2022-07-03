
const path = require('path')
const fs = require('fs')

const { EXE_NAME, FS_BASEPATH, FS_GAMEHOME, LVLSHOTS } = require('../utilities/env.js')
const { convertImage } = require('../contentServer/convert.js')
const { findFile } = require('../assetServer/virtual.js')
const { getGame } = require('../utilities/env.js')
const { repackedCache } = require('../utilities/env.js')


const EXECUTING_ENGINE = {}


// TODO: treat each task as a separate unit of work, 
//   but only wait on the one that is requested, even if 
//   many are running in a single instance.
//   sort by requested count
// TODO: run engine for specific tasks and connect back the 
//   isolated master server, send RCON commands instead of
//   running separate processes for every map, run 4 instances
//   and rotate maps between them.

async function resolveScreenshot(filter, logs, task) {

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
    return true
  }

}


async function resolveEnts(logs, task) {

  let WROTE_ENTS = /^Wrote\s+(maps.*?\.ent)$/gmi
  let outputEnts = path.join(FS_GAMEHOME, basegame, '/maps/' + mapname + '.ent')
  fs.mkdirSync(REPACKED_MAPS, { recursive: true })
  if (fs.existsSync(outputEnts)) {
    fs.renameSync(outputEnts, path.join(REPACKED_MAPS, mapname + '.ent'))
    return true
  }

}


async function resolveImages(logs, task) {

  let IMAGE_LIST = /-name-------\n([\s\S]*?)total images/gi
  let imageList = IMAGE_LIST.exec(logs)
  if (imageList) {
    let images = imageList[0].split('\n').slice(1, -3)
      .map(line => (' ' + line).split(/\s+/ig).pop())
      .join('\n')
    fs.writeFileSync(imageFile, images)
  }

}


async function execLevelshot(mapname) {
  let basegame = getGame()
  let screenshotCommands = []
  let newVstr = ''
  let caches = repackedCache()

  // figure out which images are missing and do it in one shot
  let LVL_COMMANDS = [{
    mapname: mapname,
    cmd: ' ; vstr setupLevelshot ;  ; vstr takeLevelshot ; ',
    resolve: resolveScreenshot.bind(null, 'levelshots\/'),
    test: path.join('levelshots', mapname + '.jpg')
  }, {
    mapname: mapname,
    // special exception
    cmd: ' ; vstr setupLevelshot ;  ; vstr takeLevelshotFullsize ; ',
    resolve: resolveScreenshot.bind(null, 'screenshot0001'),
    test: path.join('screenshots', mapname + '_screenshot0001.jpg')
  }, {
    mapname: mapname,
    // special exception
    cmd: ' ; vstr screenshotBirdsEyeView ; ',
    resolve: resolveScreenshot.bind(null, 'screenshot0002'),
    test: path.join('screenshots', mapname + '_screenshot0002.jpg')
  }]
  // TODO: take screenshot from every camera position
  // TODO: export all BLUEPRINTS and all facets through sv_bsp_mini
  // TODO: palette pastel full levelshot

  const TRACEMAPS = {
    1: ' ; vstr exportAreaMask ; ',
    2: ' ; vstr exportHeightMap ; ',
    3: ' ; vstr exportSkybox ; ',
    4: ' ; vstr exportBottomup ; ',
    5: ' ; vstr exportGroundheight ; ',
    6: ' ; vstr exportSkyboxVolume ; ',
    7: ' ; vstr exportSkyboxVolume2 ; ',
    8: ' ; vstr exportSkyboxVolume3 ; ',

  }
  LVL_COMMANDS.push.apply(LVL_COMMANDS, Object.keys(TRACEMAPS).map(i => {
    let tracename = `${mapname}_tracemap${String(i).padStart(4, '0')}.jpg`
    return {
      mapname: mapname,
      // special exception
      cmd: TRACEMAPS[i],
      resolve: resolveScreenshot.bind(null, tracename),
      test: path.join('maps', tracename)
    }
  }))

  // TODO: export / write entities / mapname.ents file
  LVL_COMMANDS.push({
    mapname: mapname,
    // special exception
    cmd: ' ; saveents ; ',
    resolve: resolveEnts,
    test: path.join('maps', mapname + '.ent')
  })

  LVL_COMMANDS.push({
    mapname: mapname,
    // special exception
    cmd: ' ; imagelist ; ',
    resolve: resolveImages,
    test: path.join('maps', mapname + '-images.txt')
  })

  for(let i = 0; i < LVL_COMMANDS.length; i++) {
    for(let j = 0; j < caches.length; j++) {
      if(fs.existsSync(path.join(caches[j], LVL_COMMANDS[i].test))) {
        continue
      }

      // resolve based on filename and no logs? 
      //   i.e. output already exists, but not converted
      if(await LVL_COMMANDS[i].resolve('', LVL_COMMANDS[i])) { 
        continue
      }

      newVstr += LVL_COMMANDS[i].cmd
      // TODO: queue the commands for the map and wait for individual success

    }
  }

  /*
  let shaderFile = path.join(REPACKED_MAPS, mapname + '-shaders.txt')
  if (!fs.existsSync(shaderFile)) {
    newVstr += ' ; shaderlist ; '
  }
  */

  let logs = ''
  if (newVstr.length == 0) {
    return
  }

  screenshotCommands.push.apply(screenshotCommands, [
    '+set', 'lvlshotCommands', `"${newVstr}"`,
    '+exec', `".config/levelinfo_${mapname}.cfg"`,
    '+vstr', 'resetLvlshot',
    '+devmap', mapname,
    '+vstr', 'lvlshotCommands',
    '+wait', '200', '+quit'
  ])


  fs.mkdirSync(path.join(FS_GAMEHOME, basegame, '/maps/'), { recursive: true })
  fs.mkdirSync(path.join(FS_GAMEHOME, basegame, '.config'), { recursive: true })
  let lvlconfig = path.join(FS_GAMEHOME, basegame, '.config/levelinfo_' + mapname + '.cfg')
  fs.writeFileSync(lvlconfig, LVLSHOTS.replace(/\$\{mapname\}/ig, mapname))

  return await new Promise(resolve => {
    Promise.resolve(execLevelshotDed(mapname, screenshotCommands))
      .then(logs => {
        fs.unlinkSync(lvlconfig)
        resolve(logs)
        // resolve other waiters
        for (let i = 1; i < EXECUTING[mapname].length; i++) {
          EXECUTING[mapname][i](logs)
        }
        EXECUTING[mapname].splice(0)
      })
  })
}


module.exports = {
  EXECUTING_ENGINE,
  execLevelshot,
}

