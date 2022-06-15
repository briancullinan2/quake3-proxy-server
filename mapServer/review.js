// TODO: rank, comment, review, like lvlworld
const path = require('path')
const fs = require('fs')
const {loadRenderer} = require('../utilities/wasm-cli.js')
const {getExistingMaps} = require('../mapServer/serve-download.js')
const { findFile } = require('../contentServer/virtual.js')
const { getGame } = require('../utilities/env.js')
const {MAP_DICTIONARY} = require('../mapServer/serve-download.js')

async function getMapInfo() {
  let re = loadRenderer()
  re.RE_LoadWorldMap()
  re.RE_BeginFrame( STEREO_CENTER )
  return

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
  console.log(MAP_DICTIONARY)
  let filename = request.originalUrl.replace(/\?.*$/, '')
  let mapname = path.basename(filename).replace('.pk3', '').toLocaleLowerCase()
  let newFile = findFile(getGame() + '/' + MAP_DICTIONARY[mapname] + '.pk3')
  if (newFile) {
    let mapInfo = await getMapInfo(newFile)
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

module.exports = {
  serveMapInfo,
}

