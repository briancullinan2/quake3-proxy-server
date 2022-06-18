// TODO: rank, comment, review, like lvlworld
const path = require('path')
const fs = require('fs')
const {getExistingMaps, sourcePk3Download} = require('../mapServer/serve-download.js')
const { findFile } = require('../contentServer/virtual.js')
const { getGame } = require('../utilities/env.js')
const {MAP_DICTIONARY} = require('../mapServer/serve-download.js')
const { repackedCache, INDEX } = require('../utilities/env.js')
const { streamFileKey } = require('../utilities/zip.js')
const { execCmd } = require('../utilities/exec.js')
const {EXE_NAME, FS_BASEPATH, FS_GAMEHOME} = require('../utilities/env.js')
const { extractPk3 } = require('../contentServer/compress.js')
const { convertImage } = require('../contentServer/convert.js')


async function getMapInfo(mapname) {
  // TODO: make sure BSP file is available synchronously first
  let newFile = await sourcePk3Download(mapname)
  let newZip = path.join(repackedCache(), path.basename(newFile))
  let bspFile = path.join(newZip + 'dir', `/maps/${mapname}.bsp`)

  // extract the BSP because we might change it anyways
  if(!fs.existsSync(bspFile)) {
    fs.mkdirSync(path.dirname(bspFile), { recursive: true })
    const file = fs.createWriteStream(bspFile)
    await streamFileKey(newFile, `maps/${mapname}.bsp`, file)
    file.close()
  }
  
  let basegame = getGame()
  let levelshotPath = `/${basegame}/${path.basename(newFile)}dir/levelshots/` + mapname + '.jpg'
  let levelshot = findFile(levelshotPath)
  if(levelshot.endsWith('.pk3')) {
    newFile = await extractPk3(newFile)
  }

  return {
    levelshot: levelshotPath,
  }

  re.SwitchWorld(worldMaps[i]);
  //re.SetDvrFrame(clientScreens[i][0], clientScreens[i][1], clientScreens[i][2], clientScreens[i][3]);
  /* q3dm0
  views[i].vieworg[0] = -1148;
  views[i].vieworg[1] = -974;
  views[i].vieworg[2] = 50;
  */
  let prevLock = Cvar_VariableIntegerValue("r_lockpvs");
  if(!viewsUpdated[i]) {
    Cvar_Set("r_lockpvs", "1");
  }
  // 480 -352 88
  views[i].vieworg[0] = 0;
  views[i].vieworg[1] = 0;
  views[i].vieworg[2] = 0;
  /*
  */
  /*
  views[i].vieworg[0] = 480;
  views[i].vieworg[1] = -352;
  views[i].vieworg[2] = 108;
  */
  views[i].viewaxis[0][1] = -1;
  views[i].viewaxis[1][0] = 1;
  views[i].viewaxis[2][2] = 1;
  views[i].fov_x = 100;
  views[i].fov_y = 78;
  views[i].x = 0;
  views[i].y = 0;
  views[i].width = cls.glconfig.vidWidth;
  views[i].height = cls.glconfig.vidHeight;
  views[i].time = Sys_Milliseconds();
  re.RenderScene(views[i]);
  if(viewsUpdated[i]) {
    viewsUpdated[i] = qfalse;
  }
  Cvar_Set("r_lockpvs", va("%i", prevLock));
}


// display map info, desconstruct
async function serveMapInfo(request, response, next) {
  await getExistingMaps()
  //console.log(MAP_DICTIONARY)
  let filename = request.originalUrl.replace(/\?.*$/, '')
  let mapname = path.basename(filename).replace('.pk3', '').toLocaleLowerCase()
  let newFile = findFile(getGame() + '/' + MAP_DICTIONARY[mapname] + '.pk3')
  if (newFile) {
    let mapInfo = await getMapInfo(mapname)

  let offset = INDEX.match('<body>').index + 6
  let index = INDEX.substring(0, offset)
    + `<div><img src="${mapInfo.levelshot}" /></div>` 
    + INDEX.substring(offset, INDEX.length)
  return response.send(index)

    console.log(mapInfo)
    /*
    Mapname	Decidia
    Filename	wvwq3dm7.bsp [ readme ]
    Author	wviperw
    Game type	ffa tdm
    Weapons	sg gl rl lg pg
    Items	ra ya sa health largeh mega smallh invis quad
    Functions	moving w fog sound
    Bots	Anarki Doom Keel Major Sarge
    Release date	2003-08-23
    Pk3 file	map_wvwq3dm7.pk3 [ Report ] Share
    File size	4.55 MB
    Checksum	MD5: 8467f1060c3661bfb60f5f5e89d9f974 
    +
    Downloads	340
    Map dependencies	(1) Textures: {Quake III: Arena}
    */

  } else {
    return next(new Error('Map not found ' + mapname))
  }
}


/*
async function () {
  let dedicated = findFile(DED_NAME)
  execDed(dedicated, mapname)

}
*/


async function serveLevelshot(request, response, next) {
  let basegame = getGame()
  let filename = request.originalUrl.replace(/\?.*$/, '')
  if(!filename.match(/levelshots\/|screenshots\//i)) {
    return next()
  }
  let isLevelshot = filename.match(/levelshots\//i)

  if(filename.match('/unknownmap.jpg')) {
    return response.sendFile(UNKNOWN)
  }

  let mapname = path.basename(filename).replace('.jpg', '')
                                       .replace(/_screenshot[0-9]+/gi, '')
  let localLevelshot = path.join(basegame, isLevelshot 
      ? '/levelshots/' : '/screenshots/', path.basename(filename))
  let levelshot = findFile(localLevelshot)
  if(levelshot) {
    return response.sendFile(levelshot)
  }

  levelshot = findFile(filename)
  if(!levelshot || levelshot.endsWith('.pk3')) {
    let logs = await execLevelshot(mapname)
    console.log(logs)
    let wroteScreenshot = /^Wrote\s+((levelshots\/|screenshots\/).*?)$/gmi
    let match
    while (match = wroteScreenshot.exec(logs)) {
      let unsupportedFormat = findFile(basegame + '/' + match[1])
      console.log(unsupportedFormat)
      await convertImage(unsupportedFormat, match[1])
    }
  }

  levelshot = findFile(localLevelshot)
  if(levelshot) {
    return response.sendFile(levelshot)
  }

  next()
}


async function execLevelshot(mapname) {
  // TODO: this is pretty lame, tried to make a screenshot, and a
  //   bunch of stuff failed, now I have some arbitrary wait time
  //   and it works okay, but a real solution would be "REAL-TIME"!
  // TODO: open a control port and create a new master server. One
  //   separate master control for every single map, split up and only
  //   do 10 maps at a time, because of this.
  // TODO: wait for the new dedicated process to connect to our specialized
  //   control port. Now we have a Quake 3 server command pipe. Send OOB
  //   RCON messages to control our own process remotely / asynchronously.
  // TODO: take the screenshots, run client commands using local dedicate 
  //   connected commands (side-effect, easily switch out client to a real
  //   server using the reconnect command).
  let client = findFile(EXE_NAME)
  const {execFile} = require('child_process')
  return await new Promise(function (resolve, reject) {
    let ps = execFile(client, [
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
      '+set', 'r_fullscreen', '0',
      '+set', 'r_mode', '-1',
      '+set', 'r_customWidth', '1024',
      '+set', 'r_customHeight', '768',
      '+set', 'sv_pure', '0',
      '+set', 's_initsound', '0',
      '+set', 'con_notifytime', '0',
      // TODO: run a few frames to load images before
      //   taking a screen shot and exporting canvas
      //   might also be necessary for aligning animations.
      '+set', 'setupLevelshot',
      '"wait 30 ; team s ; set cg_birdsEye 0 ; set cg_draw2D 0 ; set cg_drawFPS 0 ; '
        + 'set cg_drawSpeed 0 ; set cg_drawStatus 0 ; wait 30 ;"',

      '+set', 'takeLevelshot', 
      '"wait 30 ; levelshot ; wait 30 ; screenshot levelshot ; wait 30 ; screenshot ;"',

      '+set', 'screenshotBirdsEyeView',
      '"wait 30 ; set g_birdsEye 1 ; wait 30 ; screenshot ; wait 30 ; set g_birdsEye 0 ;"',

      '+devmap', mapname,

      '+vstr', 'setupLevelshot',
      '+vstr', 'takeLevelshot',
      '+vstr', 'screenshotBirdsEyeView', // full size levelshot, same angle
      // TODO: export / write entities / mapname.ents file
      // TODO: take screenshot from every camera position
      '+wait',  '30', '+quit'
    ],
    function(errCode, stdout, stderr) {
      if(errCode > 0) {
        reject(new Error(stderr))
      } else {
        resolve(stdout + stderr)
      }
    })
    //ps.stderr.on('data', console.error);
    //ps.stdout.on('data', console.log);
  })
}


module.exports = {
  serveMapInfo,
  serveLevelshot,
}

