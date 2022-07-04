// TODO: way to complicated of rendering

// TODO: rank, comment, review, like lvlworld
const path = require('path')

const { findFile } = require('../assetServer/virtual.js')
const { getGame } = require('../utilities/env.js')
const { MAP_DICTIONARY, existingMaps } = require('../assetServer/list-maps.js')
const { unsupportedImage } = require('../contentServer/unsupported.js')
const { getMapInfo } = require('../mapServer/bsp.js')
const { renderIndex, renderMenu } = require('../utilities/render.js')
const { renderImages } = require('../mapServer/shaders.js')


// display map info, desconstruct
async function serveMapInfo(request, response, next) {
  let basegame = getGame()
  let mapsAvailable = await existingMaps()
  let filename = request.originalUrl.replace(/\?.*$/, '')
  let mapname = path.basename(filename).replace(/\.pk3/ig, '').toLocaleLowerCase()
  if (typeof MAP_DICTIONARY[mapname] == 'undefined') {
    return next(new Error('Map not found ' + mapname))
  }

  let newFile = findFile(basegame + '/' + MAP_DICTIONARY[mapname])
  if (!newFile) {
    return next(new Error('Map not found ' + mapname))
  }

  let previousMap = mapsAvailable[mapsAvailable.map(map => map.bsp).indexOf(mapname) - 1]
  let nextMap = mapsAvailable[mapsAvailable.map(map => map.bsp).indexOf(mapname) + 1]
  let mapInfo
  try {
    mapInfo = await getMapInfo(mapname)
  } catch (e) {
    console.error(e)
    return next(e)
  }


  let MAP_MENU = [{
    title: 'Play Now',
    link: 'index.html?map%20' + mapname,
  }, {
    title: 'Download',
    link: 'maps/download/' + mapname,
  }, {
    title: 'Screenshots',
    link: 'maps/' + mapname + '#screenshots',
  }, {
    title: 'Arenas',
    link: 'maps/' + mapname + '#arenas',
  }, {
    title: 'Models',
    link: 'maps/' + mapname + '#models',
  }, {
    title: 'Sounds',
    link: 'maps/' + mapname + '#sounds',
  }, {
    title: 'Shaders',
    link: 'maps/' + mapname + '#shaders',
  }, {
    title: 'Entities',
    link: 'maps/' + mapname + '#entities',
  }]

  if (previousMap) {
    MAP_MENU.push({
      title: 'Previous: ' + (previousMap.title || previousMap.bsp),
      link: 'maps/' + previousMap.bsp,
    })
  }
  if (nextMap) {
    MAP_MENU.push({
      title: 'Next: ' + (nextMap.title || nextMap.bsp),
      link: 'maps/' + nextMap.bsp,
    })
  }

  let index = renderIndex(
    renderMenu(MAP_MENU, 'map-menu')
    + `<div class="loading-blur"><img src="${mapInfo.levelshot}" /></div>
    <div id="map-info">
    <h2>${mapInfo.title}</h2>
    <h3><a name="screenshots">Screenshots</a></h3>
    <ol class="screenshots">
      <li class="title"><span>Levelshot</span></li>
      <li><img src="/${basegame}/screenshots/${mapname}_screenshot0001.jpg" /><a href="/${basegame}/screenshots/${mapname}_screenshot0001.jpg">Full resolution levelshot</a></li>
      <li class="title"><span>Birds-eye</span></li>
      <li><img src="/${basegame}/screenshots/${mapname}_screenshot0002.jpg" /><a href="/${basegame}/screenshots/${mapname}_screenshot0002.jpg">Top-down Full color</a></li>
    </ol>
    <h3><a name="arenas">Arenas</a></h3>
    <ol class="models">
      <li class="title"><span>Bots</span></li>
      <li class="title"><span>Gametypes</span></li>
    </ol>
    <h3><a name="models">Models</a></h3>
    <ol class="models">
      <li class="title"><span>Inline</span></li>
      <li class="title"><span>Model2</span></li>
    </ol>
    <h3><a name="sounds">Sounds</a></h3>
    <ol class="models">
      <li class="title"><span>Background</span></li>
      <li class="title"><span>Overrides</span></li>
      <li class="title"><span>Other</span></li>
    </ol>
    <h3><a name="shaders">Shaders</a></h3>
    <ol class="shaders">${await renderImages(mapInfo.images, mapInfo.pakname, basegame)}</ol>
    <h3>Voxelized</h3>
    <p>Coming soon. Reconstructed maps using only X/Y image data.</p>
    <h3><a name="entities">Entities</a></h3>
    <pre contenteditable="true" class="code">${mapInfo.entities}</pre>
    <h3>Trace-maps</h3>
    <ol class="tracemaps">
    <li class="title"><span>Single pass</span></li>
    <li><img src="/${basegame}/maps/${mapname}_tracemap0001.jpg" /><a href="/${basegame}/maps/${mapname}_tracemap0001.jpg">Area mask</a></li>
    <li><img src="/${basegame}/maps/${mapname}_tracemap0002.jpg" /><a href="/${basegame}/maps/${mapname}_tracemap0002.jpg">Basic top-down</a></li>
    <li><img src="/${basegame}/maps/${mapname}_tracemap0003.jpg" /><a href="/${basegame}/maps/${mapname}_tracemap0003.jpg">Skybox height-map</a></li>
    <li><img src="/${basegame}/maps/${mapname}_tracemap0004.jpg" /><a href="/${basegame}/maps/${mapname}_tracemap0004.jpg">Skybox bottom-up</a></li>
    <li><img src="/${basegame}/maps/${mapname}_tracemap0005.jpg" /><a href="/${basegame}/maps/${mapname}_tracemap0005.jpg">Ground height-map</a></li>
    <li class="title"><span>Occupyable Spaces</span></li>
    <li><img src="/${basegame}/maps/${mapname}_tracemap0007.jpg" /><a href="/${basegame}/maps/${mapname}_tracemap0007.jpg">Skybox volumes (monochrome)</a></li>
    <li><img src="/${basegame}/maps/${mapname}_tracemap0006.jpg" /><a href="/${basegame}/maps/${mapname}_tracemap0006.jpg">Skybox volumes (RGB = top, bottom, diff)</a></li>
    <li><img src="/${basegame}/maps/${mapname}_tracemap0008.jpg" /><a href="/${basegame}/maps/${mapname}_tracemap0008.jpg">Skybox volumes (45 degrees)</a></li>

    <!--<li><img src="/${basegame}/maps/${mapname}_tracemap0003.jpg" /><a href="">X-Ray (2-samples)</a></li>
    <li><img src="/${basegame}/maps/${mapname}_tracemap0003.jpg" /><a href="/${basegame}/maps/${mapname}_tracemap0003.jpg">X-Ray (4-samples)</a></li>
    <li><img src="/${basegame}/maps/${mapname}_tracemap0003.jpg" /><a href="/${basegame}/maps/${mapname}_tracemap0003.jpg">X-Ray (8-samples)</a></li>
    <li><img src="/${basegame}/maps/${mapname}_tracemap0003.jpg" /><a href="/${basegame}/maps/${mapname}_tracemap0003.jpg"></a></li>-->
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
    </div>`)
  return response.send(index)
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



module.exports = {
  serveMapInfo,
  unsupportedImage,
}

