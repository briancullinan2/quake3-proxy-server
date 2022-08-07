const fs = require('fs')
const path = require('path')

const { streamFile } = require('../assetServer/stream-file.js')
const { findFile } = require('../assetServer/virtual.js')
const { layeredDir } = require('../assetServer/layered.js')
const { renderIndex, renderEngine, renderMenu } = require('../utilities/render.js')
const { ASSET_FEATURES } = require('../contentServer/serve-settings.js')
const { renderDirectory } = require('../contentServer/serve-live.js')
const { WEB_FORMATS, IMAGE_FORMATS, AUDIO_FORMATS, SUPPORTED_FORMATS, getGames } = require('../utilities/env.js')
const { calculateSize } = require('../utilities/async-size.js')
const { listPk3s } = require('../assetServer/layered.js')
const { listMaps } = require('../assetServer/list-maps.js')
const { MAP_DICTIONARY } = require('../mapServer/bsp.js')


const VIRTUAL_EXPLAINATION = `
<h2>Virtual Explaination:</h2>
<p>The "Virtual" directory shows all the files listed as they are expected to be
in the final output state. That is files included in pk3s, and converted files.
Files that aren't cached will trigger the conversion when they are first used.
The virtual directory should also show the latest files compiled from development
directories. Visiting some virtual paths will trigger events that take some time,
like starting the engine and rendering a map to collect a fullscreen levelshot.</p>
`


function filterExtname(ext) {
  //if(typeof ext == 'object') {
  //  ext = path.extname(ext.name)
  //}
  if (ext[0] != '.') {
    ext = path.extname(ext)
  }
  if (ext[0] != '.') {
    return false
  }
  return SUPPORTED_FORMATS.includes(ext)
    || WEB_FORMATS.includes(ext)
    || IMAGE_FORMATS.includes(ext)
    || AUDIO_FORMATS.includes(ext)
}


async function listVirtualMap(pk3InnerPath, newFile, modname, mapname) {
  // TODO: basically the same thing, but only show files required by 
  //   loading the map, not included in basepack
  //let images = 
  let directory = await listVirtual(pk3InnerPath, newFile, modname)
  let sorted = []
  for (let i = 0; i < directory.length; i++) {
    let file = directory[i]
    if (file.isDirectory) {
      file.link = path.join('/', modname, mapname + '.pk3dir', pk3InnerPath,
        path.basename(file.link)) + (file.isDirectory ? '/' : ''),

        sorted.push(file)
      continue
    }
    // TODO: compare with output from map images list
    if (file) {

    }
  }
  return sorted
}


// TODO: rename to listVirtual()
async function listVirtual(pk3InnerPath, newFile, modname) {
  let zeroTimer = new Promise(resolve => setTimeout(resolve.bind(null, '0B (Calculating)'), 200))
  let directory = []
  let localDirectory
  let pk3File
  let includeBuild = true

  if (newFile) {
    // TODO: need full paths here so we can show/hide layers in virtual mode
    pk3File = findFile(newFile)
    localDirectory = layeredDir(path.join(modname, path.basename(newFile) + 'dir', pk3InnerPath), false)
  } else {
    localDirectory = layeredDir(path.join(modname, pk3InnerPath), includeBuild)
  }

  if (newFile
    && path.basename(newFile).localeCompare('pak0.pk3', 'en', { sensitivity: 'base' }) == 0) {
    let gamedir = layeredDir(path.join(modname, pk3InnerPath), false)
    localDirectory = (localDirectory || []).concat(gamedir || []).filter(filterExtname)

    // TODO: listPk3s, overlap all from base directory
    let pk3s = (await listPk3s(modname)).sort().reverse().map(findFile).filter(f => f)
    for (let i = 0; i < pk3s.length; i++) {
      let pk3Dir = await filteredPk3Directory(pk3InnerPath, pk3s[i], modname)
      directory = (directory || []).concat(pk3Dir || []).filter(file => {
        return file.isDirectory || filterExtname(file.name)
      }).map(file => {
        return Object.assign(file, {
          link: path.join('/', modname,
            file.isDirectory ? 'pak0.pk3dir' : path.basename(file.file) + 'dir',
            pk3InnerPath, path.basename(file.name))
            + (file.isDirectory ? '/' : ''),
          absolute: path.basename(path.dirname(file.file)) + '/' + path.basename(file.file) + '/.'
        })
      })
    }
  } else
    if (pk3File) {
      // TODO: filter files by size/compressedSize and also show which files are in pk3
      let pk3Dir = await filteredPk3Directory(pk3InnerPath, pk3File, modname)
      directory = (directory || []).concat(pk3Dir || []).filter(file => {
        return file.isDirectory || filterExtname(file.name)
      }).map(file => {
        return Object.assign(file, {
          link: path.join('/', modname, path.basename(file.file) + 'dir',
            pk3InnerPath, path.basename(file.name)) + (file.isDirectory ? '/' : ''),
          absolute: path.basename(path.dirname(file.file)) + '/' + path.basename(file.file) + '/.'
        })
      })
    }

  if (localDirectory) {
    let supported = await Promise.all(localDirectory.map(async (file) => {
      let stat = fs.statSync(file)
      return Object.assign({}, stat, {
        name: path.basename(file),
        absolute: path.basename(path.dirname(path.dirname(path.dirname(file))))
          + '/' + path.basename(path.dirname(path.dirname(file)))
          + '/' + path.basename(path.dirname(file)) + '/.',
        size: await Promise.any([calculateSize(file), zeroTimer]),
        isDirectory: stat.isDirectory(),
        link: path.join('/', modname, newFile ? path.basename(newFile)
          .replace(path.extname(newFile), '.pk3dir') : '', pk3InnerPath,
          path.basename(file)) + (stat.isDirectory() ? '/' : '')
      })
    }))

    for (let i = 0; i < supported.length; i++) {
      directory.push(supported[i])
    }
  }


  // TODO: list pk3s from repackedCache() and downloadCache()
  // TODO: (repacked) indication for files included in pk3 by refault?

  directory.sort((a, b) =>
    /* (a.name.includes('overridden') ? 0 : 2) - (b.name.includes('overridden') ? 0 : 2)
    + */ path.basename(a.name).localeCompare(path.basename(b.name), 'en', { sensitivity: 'base' }))

  let allLowercase = directory.map(file => path.basename(file.name.toLocaleLowerCase()))
  let uniqueDir = directory.map((file, i) => {
    file.exists = allLowercase.indexOf(file.name.toLocaleLowerCase()) == i
    // is it the first occurence of the filename
    if (!file.exists) {
      file.name = '(overridden) ' + file.name
      file.exists = false
      file.overridden = true
    }
    return file
  })
  return uniqueDir
}




async function filteredMaps(modname) {
  let zeroTimer = new Promise(resolve => setTimeout(resolve.bind(null, '0B (Calculating)'), 200))
  let pk3s = await listMaps(modname)
  // always included for repack 
  //   because this is how baseq3a is built
  if (!pk3s.includes('pak0')) {
    pk3s.unshift('pak0')
  }

  let pk3Files = pk3s.map(mapname => {
    let realPath = findFile(modname + '/' + MAP_DICTIONARY[mapname])
    if (!realPath) {
      realPath = ''
    }
    return Object.assign(realPath ? fs.statSync(realPath) : {}, {
      name: (!realPath ? '(virtual) ' : '') + mapname + '.pk3dir',
      absolute: realPath,
      link: path.join('/', modname, mapname + '.pk3dir') + '/',
      isDirectory: true,
    })
  }).filter(file => file)

  localDirectory = await Promise.all(layeredDir(modname, true)
  .map(async (file) => {
    let stat = fs.statSync(file)
    return Object.assign({}, stat, {
      name: path.basename(file),
      absolute: path.basename(path.dirname(path.dirname(path.dirname(file))))
        + '/' + path.basename(path.dirname(path.dirname(file)))
        + '/' + path.basename(path.dirname(file)) + '/.',
      size: await Promise.any([calculateSize(file), zeroTimer]),
      isDirectory: stat.isDirectory(),
      link: path.join('/', modname, path.basename(file)) + (stat.isDirectory() ? '/' : '')
    })
  }))

  for(let i = 0; i < localDirectory.length; i++) {
    pk3Files.push(localDirectory[i])
  }

  return pk3Files
}


function parseQuery(str) {
  let startup = []
	let search = /([^&=]+)/g
	let query  = str
	let match
	while (match = search.exec(query)) {
		let val = decodeURIComponent(match[1])
		val = val.split(' ')
		val[0] = (val[0][0] != '+' ? '+' : '') + val[0]
		startup.push.apply(startup, val)
	}
  return startup
}

/*
Theory: instead of trying to modify qcommon/files.c
 to get it to load different PK3s, I'll provide the 
 pk3s the server thinks the client should have from
 the proxy server. This would simplify repacking, 
 but wont necessarily help UDP downloads unless I
 added some sort of mod_rewrite type setting for pk3s.
Server admin control over pk3 content is a long 
 outstanding issue.
*/
async function serveVirtual(request, response, next) {
  let isAlt = request.originalUrl.match(/\?alt/)
  let isIndex = request.originalUrl.match(/\?index/)
  let isJson = request.originalUrl.match(/\?json/)
  let filename = request.originalUrl.replace(/\?.*$/, '')
  if (filename.startsWith('/')) {
    filename = filename.substring(1)
  }
  if (filename.endsWith('/')) {
    filename = filename.substring(0, filename.length - 1)
  }

  let pk3File
  let pk3Name
  let pk3InnerPath = ''
  if (filename.match(/\.pk3/i)) {
    pk3Name = filename.replace(/\.pk3.*/gi, '.pk3')
    pk3File = findFile(pk3Name)
    pk3InnerPath = filename.replace(/^.*?\.pk3[^\/]*?(\/|$)/gi, '')
  }

  let modname = filename.split('/')[0]
  let modNames = getGames()
  if (modname && modNames.includes(modname.toLocaleLowerCase())) {
    filename = filename.substring(modname.length + 1)
  } else {
    modname = ''
  }

  let queryArgs = Object.keys(request.query).map(k => k + ' ' + request.query[k]).join(' ')
  let startArgs = parseQuery(queryArgs)
  // TODO: convert and redirect, then display the correct file in the index
  // TODO: combine with serve-repacked, fs.createReadStream
  if (filename.match('index.html')) {
    response.setHeader('content-type', 'text/html')
    return response.send(renderIndex(
      renderEngine()
      + '<div class="loading-blur" style="display:none;"></div>'
      + renderMenu([{
        title: 'Fullscreen',
        link: '#fullscreen',
      }, {
        title: 'Map Upload',
        link: 'maps/upload'
      }, {
        title: 'Game Info',
        link: 'games/' + (startArgs.includes('+connect') ? startArgs[startArgs.indexOf('+connect') + 1] : 'first')
      }, {
        title: 'Create Game',
        link: 'games/new'
      }], 'home-menu')))
  }

  let regularFile
  if (!filename.includes('.pk3')) {
    regularFile = modname + '/' + filename
  } else {
    regularFile = modname + '/' + pk3InnerPath
  }

  if(await streamFile(regularFile, response)) {
    return
  }


  let mapname
  if (pk3Name) {
    // TODO: check mapname and convert to pk3Name
    mapname = path.basename(pk3Name).replace(path.extname(pk3Name), '').toLocaleLowerCase()
    let pk3s = await listMaps(modname)
    if (pk3s.includes(mapname)) {
      pk3Name = modname + '/' + MAP_DICTIONARY[mapname]
      pk3File = findFile(pk3Name)
    } else {
      mapname = null
    }
  }

  // TODO: exception for pak0.pk3 to search all base pk3s for the correct file
  if(pk3Name) {
    if(isAlt && await streamFile(path.join(modname, pk3Name, pk3InnerPath), response)) {
      return 
    }
  } else {
    if(isAlt && await streamFile(path.join(modname, filename), response)) {
      return 
    }
  }

  if (!isIndex) {
    return next()
  }


  // TODO: server a file from inside a pk3 to the pk3dirs
  // TODO: move to layeredDir()?
  let virtualPath
  if (mapname) {
    virtualPath = path.join('/', modname, mapname + '.pk3dir', pk3InnerPath)
  } else
    if (!pk3Name) {
      virtualPath = path.join('/' + modname, filename)
    } else {
      virtualPath = path.join('/', pk3Name + 'dir', pk3InnerPath)
    }

  if (modname.length > 1 && !pk3Name && filename.length <= 1) {
    response.setHeader('content-type', 'text/html')
    return response.send(renderIndex(`
    ${renderMenu(ASSET_FEATURES, 'asset-menu')}
    <div class="info-layout">
      ${await renderDirectory(virtualPath, await filteredMaps(modname), !isIndex)}
    </div>`))
  } else if (!pk3Name) {
    pk3InnerPath = filename
  }

  let virtual
  if (mapname) {
    virtual = await listVirtualMap(pk3InnerPath, pk3Name, modname, mapname)
  } else {
    virtual = await listVirtual(pk3InnerPath, pk3Name, modname)
  }
  let directory = [].concat(modNames)
  for (let i = 0; i < virtual.length; i++) {
    directory.push(virtual[i])
  }

  // duck out early
  if (!directory || directory.length <= 0) {
    return next(/* new Error('Virtual path not found: ' + filename) */)
  }

  return response.send(renderIndex(`
  ${renderMenu(ASSET_FEATURES, 'asset-menu')}
  <div class="info-layout">${modname <= 1 ? VIRTUAL_EXPLAINATION : ''}
    ${await renderDirectory(modname <= 1 ? 'virtual' : virtualPath, directory, !isIndex)}
  </div>`))
}

module.exports = {
  serveVirtual,
}

