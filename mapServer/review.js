// TODO: rank, comment, review, like lvlworld
const path = require('path')
const fs = require('fs')

const {existingMaps, sourcePk3Download} = require('../mapServer/serve-download.js')
const { findFile } = require('../contentServer/virtual.js')
const { getGame } = require('../utilities/env.js')
const {MAP_DICTIONARY} = require('../mapServer/serve-download.js')
const { repackedCache, INDEX } = require('../utilities/env.js')
const { streamFileKey } = require('../utilities/zip.js')
const { layeredDir, unsupportedImage } = require('../contentServer/content.js')
const {execLevelshot} = require('../mapServer/serve-lvlshot.js')
const {ScanAndLoadShaderFiles, FindShaderInShaderText} = require('../mapServer/shaders.js')

const GAME_ARENAS = {

}

const MAP_ARENAS = {
  
}

async function getMapInfo(mapname) {
  let basegame = getGame()
  // TODO: make sure BSP file is available synchronously first
  let newFile = await sourcePk3Download(mapname)
  await ScanAndLoadShaderFiles()

  let newZip = path.join(repackedCache(), path.basename(newFile))
  let bspFile = path.join(newZip + 'dir', `/maps/${mapname}.bsp`)
  let pk3Path = `/${basegame}/${path.basename(newFile)}dir`

  // extract the BSP because we might change it anyways
  if(!fs.existsSync(bspFile)) {
    fs.mkdirSync(path.dirname(bspFile), { recursive: true })
    const file = fs.createWriteStream(bspFile)
    await streamFileKey(newFile, `maps/${mapname}.bsp`, file)
    file.close()
  }
  
  let levelshotPath = path.join(pk3Path, '/levelshots/', mapname + '.jpg')
  let levelshot = findFile(levelshotPath)
  if(levelshot.endsWith('.pk3')) {
    //newFile = await extractPk3(newFile)
  }


  console.log(path.join(pk3Path, '/scripts/'))
  let scripts = await layeredDir(path.join(pk3Path, '/scripts/'))
  if(typeof GAME_ARENAS[basegame] == 'undefined') {
    let baseArenas = findFile( path.join(basegame, '/pak0.pk3/scripts/arenas.txt') )

  }


  let entityFile = path.join(repackedCache(), '/maps/', mapname + '.ent')
  if(!fs.existsSync(entityFile)) {
    let logs = await execLevelshot(mapname)
    console.log(logs)
  }
  let entities = ''
  if(fs.existsSync(entityFile)) {
    entities = fs.readFileSync(entityFile).toString('utf-8')
  } else {
    console.error('WARNING: entities not found: ' + mapname)
  }


  let shaderFile = path.join(repackedCache(), '/maps/', mapname + '-shaders.txt')
  if(!fs.existsSync(shaderFile)) {
    //let logs = await execLevelshot(mapname)
    //console.log(logs)
  }
  let shaders = []
  if(fs.existsSync(shaderFile)) {
    shaders = fs.readFileSync(shaderFile).toString('utf-8').split('\n')
  } else {
    console.error('WARNING: shaders not found: ' + mapname)
  }


  let imagesFile = path.join(repackedCache(), '/maps/', mapname + '-images.txt')
  if(!fs.existsSync(imagesFile)) {
    let logs = await execLevelshot(mapname)
    console.log(logs)
  }
  let images = []
  if(fs.existsSync(imagesFile)) {
    images = fs.readFileSync(imagesFile).toString('utf-8').split('\n')
  } else {
    console.error('WARNING: images not found: ' + mapname)
  }


	let worldspawn = []
  let entityStr = entities
	entityStr.replace(/\{([^}]*)\}/mg, function($0, entitySrc) {
		var entity = {
			classname: 'unknown'
		};

		entitySrc.replace(/"(.+)" "(.+)"$/mg, function($0, key, value) {
			entity[key] = value
		})

		worldspawn.push(entity)
	})

  return {
    bsp: mapname,
    levelshot: levelshotPath,
    entities: entities + '\n' + (scripts || []).join('\n'),
    worldspawn: worldspawn[0],
    title: (worldspawn[0] || {}).message || mapname,
    images: images,
    pakname: MAP_DICTIONARY[mapname]
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
  let basegame = getGame()
  await existingMaps()
  //console.log(MAP_DICTIONARY)
  let filename = request.originalUrl.replace(/\?.*$/, '')
  let mapname = path.basename(filename).replace(/\.pk3/ig, '').toLocaleLowerCase()
  if(typeof MAP_DICTIONARY[mapname] == 'undefined') {
    return next(new Error('Map not found ' + mapname))
  }
  
  let newFile = findFile(basegame + '/' + MAP_DICTIONARY[mapname])
  if (!newFile) {
    return next(new Error('Map not found ' + mapname))
  }

  let mapInfo
  try {
    mapInfo = await getMapInfo(mapname)
  } catch (e) {
    console.error(e)
    return next(e)
  }

  let offset = INDEX.match('<body>').index + 6
  let index = INDEX.substring(0, offset)
    + `<div class="loading-blur"><img src="${mapInfo.levelshot}" /></div>
    <div id="map-info">
    <h2>${mapInfo.title}</h2>
    <h3>Screenshots</h3>
    <ol class="screenshots">
      <li class="title"><span>Levelshot</span></li>
      <li><img src="/${basegame}/screenshots/${mapname}_screenshot0001.jpg" /><a href="">Full resolution levelshot</a></li>
      <li class="title"><span>Birds-eye</span></li>
      <li><img src="/${basegame}/screenshots/${mapname}_screenshot0002.jpg" /><a href="">Top-down Full color</a></li>
    </ol>
    <h3>Trace-maps</h3>
    <ol class="tracemaps">
    <li class="title"><span>Single pass</span></li>
    <li><img src="/${basegame}/maps/${mapname}_tracemap0001.jpg" /><a href="">Area mask</a></li>
    <li><img src="/${basegame}/maps/${mapname}_tracemap0002.jpg" /><a href="">Basic top-down</a></li>
    <li><img src="/${basegame}/maps/${mapname}_tracemap0003.jpg" /><a href="">Skybox height-map</a></li>
    <li><img src="/${basegame}/maps/${mapname}_tracemap0004.jpg" /><a href="">Skybox bottom-up</a></li>
    <li><img src="/${basegame}/maps/${mapname}_tracemap0005.jpg" /><a href="">Ground height-map</a></li>
    <li class="title"><span>Occupyable Spaces</span></li>
    <li><img src="/${basegame}/maps/${mapname}_tracemap0007.jpg" /><a href="">Skybox volumes (monochrome)</a></li>
    <li><img src="/${basegame}/maps/${mapname}_tracemap0006.jpg" /><a href="">Skybox volumes (RGB = top, bottom, diff)</a></li>
    <li><img src="/${basegame}/maps/${mapname}_tracemap0008.jpg" /><a href="">Skybox volumes (45 degrees)</a></li>

    <!--<li><img src="/${basegame}/maps/${mapname}_tracemap0003.jpg" /><a href="">X-Ray (2-samples)</a></li>
    <li><img src="/${basegame}/maps/${mapname}_tracemap0003.jpg" /><a href="">X-Ray (4-samples)</a></li>
    <li><img src="/${basegame}/maps/${mapname}_tracemap0003.jpg" /><a href="">X-Ray (8-samples)</a></li>
    <li><img src="/${basegame}/maps/${mapname}_tracemap0003.jpg" /><a href=""></a></li>-->
    <li class="title"><span>Mins/Maxs</span></li>
    <li class="title"><span>Scaled</span></li>
    <li class="title"><span>Multipass</span></li>
    <li class="title"><span>Volumetric</span></li>
    <li class="title"><span>Atmospheric</span></li>
    <li class="title"><span>Blueprint</span></li>
    <li class="title"><span>Path-finding</span></li>
    <li class="title"><span>Faceted</span></li>
    <li class="title"><span>Perspective</span></li>
    <li class="title"><span>Heatmaps</span></li>
    <li class="title"><span>Predator</span></li>
    </ol>
    <h3>Models</h3>
    <ol class="models">
      <li class="title"><span>Inline</span></li>
      <li class="title"><span>Model2</span></li>
    </ol>
    <h3>Shaders</h3>
    <ol class="shaders">${await renderImages(mapInfo.images, mapInfo.pakname, basegame)}</ol>
    <h3>Voxelized</h3>
    <p>Coming soon. Reconstructed maps using only X/Y image data.</p>
    <h3>Entities</h3>
    <pre contenteditable="true" class="code">${mapInfo.entities}</pre>
    <h3>Palette</h3>
    <ol class="palette">
      <li class="title"><span>World</span></li>
      <li class="title"><span>Overrides</span></li>
      <li class="title"><span>Base</span></li>
    </ol>
    </div>`
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
}


/*
async function () {
  let dedicated = findFile(DED_NAME)
  execDed(dedicated, mapname)

}
*/


async function renderImages(images, pk3name, basegame) {
  let imageHtml = ''
  // TODO: text in shaders, like Q3e renderer does


  for(let i = 0; i < images.length; i++) {
    if(images[i][0] == '*') {
      continue
    }
    let composite = await FindShaderInShaderText(images[i]
          .replace(path.extname(images[i]), ''))
    if(composite) {

    } else
    if(unsupportedImage(images[i])) {
      imageHtml += `<li><img src="/${basegame}/${pk3name}dir/${images[i]}?alt" /><a href="">${images[i]}</a></li>`
    } else {
      imageHtml += `<li><img src="/${basegame}/${pk3name}dir/${images[i]}" /><a href="">${images[i]}</a></li>`
    }
  }
  
  return `
  <li class="title"><span>World</span></li>
  <li class="title"><span>Overrides</span></li>
  <li class="title"><span>Base</span></li>
  ${imageHtml}`
}


module.exports = {
  serveMapInfo,
  unsupportedImage,
}

