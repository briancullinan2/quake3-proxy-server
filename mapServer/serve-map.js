// TODO: way to complicated of rendering

// TODO: rank, comment, review, like lvlworld
const path = require('path')

const { findFile } = require('../assetServer/virtual.js')
const { getGame } = require('../utilities/env.js')
const { MAP_DICTIONARY, existingMaps } = require('../assetServer/list-maps.js')
const { unsupportedImage } = require('../contentServer/unsupported.js')
const { FindShaderInShaderText } = require('../assetServer/shaders.js')
const { getMapInfo } = require('../mapServer/bsp.js')
const { renderIndex, renderMenu } = require('../utilities/render.js')


// display map info, desconstruct
async function serveMapInfo(request, response, next) {
  let basegame = getGame()
  let mapsAvailable = await existingMaps()
  //console.log(MAP_DICTIONARY)
  let filename = request.originalUrl.replace(/\?.*$/, '')
  let mapname = path.basename(filename).replace(/\.pk3/ig, '').toLocaleLowerCase()
  if (typeof MAP_DICTIONARY[mapname] == 'undefined') {
    return next(new Error('Map not found ' + mapname))
  }

  let newFile = findFile(basegame + '/' + MAP_DICTIONARY[mapname])
  if (!newFile) {
    return next(new Error('Map not found ' + mapname))
  }

  let previousMap = mapsAvailable[mapsAvailable.map(map => map.bsp).indexOf(mapname)-1]
  let nextMap = mapsAvailable[mapsAvailable.map(map => map.bsp).indexOf(mapname)+1]
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

  if(previousMap) {
    MAP_MENU.push({
      title: 'Previous: ' + (previousMap.title || previousMap.bsp),
      link: 'maps/' + previousMap.bsp,
    })
  }
  if(nextMap) {
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


async function renderImages(images, pk3name, basegame) {
  let imageHtml = ''
  // sort by the second directory and group by like trenchbroom does
  images.sort(/* (a, b) => {
    let ai = a.indexOf('/')
    let bi = b.indexOf('/')
    let left = ai > -1 ? a.substring(ai + 1) : a
    let right = bi > -1 ? b.substring(bi + 1) : b
    return left.localeCompare(right, 'en', {sensitivity: 'base'})
  } */)
  // text in shaders, like Q3e renderer does
  let composites = await Promise.all(images.map(i => {
    if (i[0] == '*') {
      return
    }
    return FindShaderInShaderText(i.replace(path.extname(i), ''))
  }))
  let previousGroup = ''
  for (let i = 0; i < images.length; i++) {
    if (images[i][0] == '*') {
      continue
    }
    if (!images[i].includes('.')) {
      images[i] += '.tga'
    }
    let ai = images[i].indexOf('/')
    let left = ai > -1 ? images[i].substring(ai + 1) : images[i]
    if (previousGroup.localeCompare(images[i].substring(0, ai), 'en', { sensitivity: 'base' }) != 0) {
      previousGroup = images[i].substring(0, ai)
      imageHtml += `<li class="title"><span>${images[i].substring(0, ai)}</span></li>`
    }
    if (composites[i] && composites[i].length > 0) {
      imageHtml += `<li>${composites[i].map(function (shader) {
        let bi = shader.indexOf('/')
        return `
          <img src="/${basegame}/${pk3name}dir/${shader}?alt" />
          <a href="">${bi > -1 ? shader.substring(bi + 1) : shader}</a>`
      }).join('')}</li>`
    } else
      if (await unsupportedImage(images[i])) {
        imageHtml += `<li><img src="/${basegame}/${pk3name}dir/${images[i]}?alt" /><a href="/${basegame}/${pk3name}dir/${images[i]}?alt">${left}</a></li>`
      } else {
        imageHtml += `<li><img src="/${basegame}/${pk3name}dir/${images[i]}" /><a href="/${basegame}/${pk3name}dir/${images[i]}">${left}</a></li>`
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
