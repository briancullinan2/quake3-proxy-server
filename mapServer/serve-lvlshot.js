const path = require('path')
const fs = require('fs')

// use WASM renderer to screenshot uploaded maps
const { findFile, modDirectory } = require('../contentServer/virtual.js')
const {EXE_NAME, FS_BASEPATH, FS_GAMEHOME, LVLSHOTS} = require('../utilities/env.js')
const { convertImage } = require('../contentServer/convert.js')
const {getGame} = require('../utilities/env.js')
const {repackedCache} = require('../utilities/env.js')



const EXECUTING = {
  
}


// TODO: combine this master server serveDed()
async function execLevelshotDed(mapname, extraCommands) {
  if(typeof EXECUTING[mapname] == 'undefined') {
    EXECUTING[mapname] = []
  }
  
  // prevent clients from making multiple requests on 
  //   the same map. just wait a few seconds
  if(EXECUTING[mapname].length != 0) {
    return await new Promise(function (resolve, reject) {
      let rejectTimer = setTimeout(function () {
        reject(new Error('Levelshot Service timed out.'))
      }, 10000)
      EXECUTING[mapname].push(function (/* logs */) {
        clearTimeout(rejectTimer)
        resolve()
      })
    })
  }

  // TODO: this is pretty lame, tried to make a screenshot, and a
  //   bunch of stuff failed, now I have some arbitrary wait time
  //   and it works okay, but a real solution would be "REAL-TIME"!
  // TODO: open a control port and create a new master server. One
  //   separate master control for every single map, split up and only
  //   do 10 maps at a time, because of this.
  let startArgs = [
    '+set', 'fs_basepath', FS_BASEPATH,
    '+set', 'fs_homepath', FS_GAMEHOME,
    '+set', 'bot_enable', '0',
    '+set', 'developer', '0',
    // Ironically, the thing I learned working for the radio station about
    //   M$ Windows not being able to run without a video card for remote
    //   desktop, but Xvfb working fine with remote desktop, has suddenly
    //   become relevant, and now I understand why.
    // https://stackoverflow.com/questions/12482166/creating-opengl-context-without-window
    '+set', 'r_headless', '1',
    // TODO: run a few frames to load images before
    //   taking a screen shot and exporting canvas
    //   might also be necessary for aligning animations.
  ]
  .concat(extraCommands)
  //console.log(startArgs)
  // TODO: wait for the new dedicated process to connect to our specialized
  //   control port. Now we have a Quake 3 server command pipe. Send OOB
  //   RCON messages to control our own process remotely / asynchronously.
  // TODO: take the screenshots, run client commands using local dedicate 
  //   connected commands (side-effect, easily switch out client to a real
  //   server using the reconnect command).
  let client = findFile(EXE_NAME)
  const {execFile} = require('child_process')
  //console.log(startArgs)
  // TODO: CODE REVIEW, using the same technique in compress.js (CURRENTLY_UNPACKING)
  //   but the last resolve function would be here after the resolve(stderr)
  //   instead of after, in the encapsulating function call.
  return await new Promise(function (resolve, reject) {
    EXECUTING[mapname].push('placeholder')
    let ps = execFile(client, startArgs,
    function(errCode, stdout, stderr) {
      if(errCode > 0) {
        reject(new Error(stderr))
      } else {
        resolve(stderr + stdout)
      }
    })
    //ps.stderr.on('data', console.error);
    //ps.stdout.on('data', console.log);
  })

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
  if(!fs.existsSync(levelshot)) {
    newVstr += ' ; vstr takeLevelshot ; '
    needsSetup = true
  }
  let screenshot1 = path.join(REPACKED_SCREENSHOTS, mapname + '_screenshot0001.jpg')
  if(!fs.existsSync(screenshot1)) {
    newVstr += ' ; vstr takeLevelshotFullsize ; '
    needsSetup = true
  }

  // special exception
  if(needsSetup) {
    newVstr = ' ; vstr setupLevelshot ; ' + newVstr
  }

  let screenshot2 = path.join(REPACKED_SCREENSHOTS, mapname + '_screenshot0002.jpg')
  if(!fs.existsSync(screenshot2)) {
    newVstr += ' ; vstr screenshotBirdsEyeView ; '
  }
  let tracemap1 = path.join(REPACKED_MAPS, mapname + '_tracemap0001.jpg')
  if(!fs.existsSync(tracemap1)) {
    newVstr += ' ; vstr exportAreaMask ; '
  }

  let tracemap2 = path.join(REPACKED_MAPS, mapname + '_tracemap0002.jpg')
  if(!fs.existsSync(tracemap2)) {
    newVstr += ' ; vstr exportHeightMap ; '
  }

  let tracemap3 = path.join(REPACKED_MAPS, mapname + '_tracemap0003.jpg')
  if(!fs.existsSync(tracemap3)) {
    newVstr += ' ; vstr exportSkybox ; '
  }

  let tracemap4 = path.join(REPACKED_MAPS, mapname + '_tracemap0004.jpg')
  if(!fs.existsSync(tracemap4)) {
    newVstr += ' ; vstr exportBottomup ; '
  }

  let tracemap5 = path.join(REPACKED_MAPS, mapname + '_tracemap0005.jpg')
  if(!fs.existsSync(tracemap5)) {
    newVstr += ' ; vstr exportGroundheight ; '
  }

  let tracemap6 = path.join(basegame, '/maps/', mapname + '_tracemap0006.jpg')
  if(!fs.existsSync(tracemap6)) {
    newVstr += ' ; vstr exportSkyboxVolume ; '
  }

  let tracemap7 = path.join(REPACKED_MAPS, mapname + '_tracemap0007.jpg')
  if(!fs.existsSync(tracemap7)) {
    newVstr += ' ; vstr exportSkyboxVolume2 ; '
  }

  let tracemap8 = path.join(REPACKED_MAPS, mapname + '_tracemap0008.jpg')
  if(!fs.existsSync(tracemap8)) {
    newVstr += ' ; vstr exportSkyboxVolume3 ; '
  }

  // TODO: export / write entities / mapname.ents file
  let entityFile = path.join(REPACKED_MAPS, mapname + '.ent')
  fs.mkdirSync(path.join(FS_GAMEHOME, basegame, '/maps/'), {recursive: true})
  if(!fs.existsSync(entityFile)) {
    screenshotCommands.push.apply(screenshotCommands, [
      '+set', 'cm_saveEnts', '1'
    ])
  }

  let shaderFile = path.join(REPACKED_MAPS, mapname + '-shaders.txt')
  if(!fs.existsSync(shaderFile)) {
    newVstr += ' ; shaderlist ; '
  }

  let imageFile = path.join(REPACKED_MAPS, mapname + '-images.txt')
  if(!fs.existsSync(imageFile)) {
    newVstr += ' ; imagelist ; '
  }

  // TODO: take screenshot from every camera position
  // TODO: export all BLUEPRINTS and all facets through sv_bsp_mini
  let logs = ''
  if(newVstr.length > 0) {
    screenshotCommands.push.apply(screenshotCommands, [
      '+set', 'lvlshotCommands', `"${newVstr}"`, 
      '+exec', `".config/levelinfo_${mapname}.cfg"`,
      '+vstr', 'resetLvlshot',
      '+devmap', mapname,
      '+vstr', 'lvlshotCommands', 
      '+wait', '200', '+quit'
    ])


    fs.mkdirSync(path.join(FS_GAMEHOME, basegame, '.config'), {recursive: true})
    let lvlconfig = path.join(FS_GAMEHOME, basegame, '.config/levelinfo_' + mapname + '.cfg')
    fs.writeFileSync(lvlconfig, LVLSHOTS.replace(/\$\{mapname\}/ig, mapname))
    logs = await execLevelshotDed(mapname, screenshotCommands)
    fs.unlinkSync(lvlconfig)
  } 
  
  let outputEnts = path.join(FS_GAMEHOME, basegame, '/maps/' + mapname + '.ent')
  fs.mkdirSync(REPACKED_MAPS, {recursive: true})
  if(fs.existsSync(outputEnts)) {
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
    if(!unsupportedFormat) {
      console.error('WARNING: output image not found ' + match[1])
      continue
    }
    // TODO: don't wait for anything?
    await convertImage(unsupportedFormat, match[1], '80%')
  }

  let IMAGE_LIST = /-name-------\n([\s\S]*?)total images/gi
  let imageList = IMAGE_LIST.exec(logs)
  if(imageList) {
    let images = imageList[0].split('\n').slice(1, -3)
        .map(line => (' ' + line).split(/\s+/ig).pop())
        .join('\n')
    fs.writeFileSync(imageFile, images)
  }

  // TODO: CODE REVIEW, in another location, I call resolve() after a promised resolve()
  //   but from within the same function
  if(typeof EXECUTING[mapname] != 'undefined') {
    for(let i = 1; i < EXECUTING[mapname].length; i++) {
      EXECUTING[mapname][i](logs)
    }
    EXECUTING[mapname].splice(0)
  }

  return logs
}


async function serveLevelshot(request, response, next) {
  let basegame = getGame()
  let filename = request.originalUrl.replace(/\?.*$/, '')
  if(filename.startsWith('/')) {
    filename = filename.substr(1)
  }

  let match
  if(!(match = (/levelshots\/|screenshots\/|maps\//i).exec(filename))) {
    return next()
  }
  match = match[0].toLocaleLowerCase()

  if(filename.match('/unknownmap.jpg')) {
    return response.sendFile(UNKNOWN)
  }

  let mapname = path.basename(filename).replace('.jpg', '')
                                       .replace(/_screenshot[0-9]+/gi, '')
                                       .replace(/_tracemap[0-9]+/gi, '')
  // replace the full pk3 name that we looked up in another service with
  //   the simpler output pathname, i.e. /baseq3/pak0.pk3/levelshots/q3dm0.jpg
  //   is also an alias for the path /baseq3/levelshots/q3dm0.jpg
  // we're assuming there aren't duplicate bsp names to worry about in the 
  //   levelshots/ and screenshots/ directories.
  let localLevelshot = path.join(basegame, match, path.basename(filename))
  let levelshot = findFile(localLevelshot)
  if(levelshot) {
    return response.sendFile(levelshot)
  }

  
  let modname = modDirectory(filename)
  if(modname) {
    repackedFile = path.join(repackedCache(), match, path.basename(filename))
    if(fs.existsSync(repackedFile)) {
      return response.sendFile(repackedFile)
    }
    repackedFile = path.join(repackedCache(), filename.substr(modname.length))
    if(fs.existsSync(repackedFile)) {
      return response.sendFile(repackedFile)
    }
  }


  levelshot = findFile(filename)
  if(levelshot && !levelshot.endsWith('.pk3')) {
    return response.sendFile(levelshot)
  }


  /*
  let gamedir = await layeredDir(basegame)
  let pk3files = gamedir.filter(file => file.endsWith('.pk3'))
  let maps = (await Promise.all(pk3files.map(async function (pk3name) {
    let basename = path.basename(pk3name)
    let index = await getIndex(findFile(pk3name))
  */


  // still can't find a levelshot or screenshot, execute the engine to generate
  try {
    let logs = await execLevelshot(mapname)
    console.log(logs)
    levelshot = findFile(localLevelshot)
    if(levelshot) {
      return response.sendFile(levelshot)
    }
  } catch (e) {
    console.error(e)
  }

  next()
}


module.exports = {
  execLevelshot,
  serveLevelshot,
}

