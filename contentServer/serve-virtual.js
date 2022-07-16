const fs = require('fs')
const path = require('path')
const { PassThrough, Readable } = require('stream')

const { streamFileKey } = require('../utilities/zip.js')
const { findFile, gameDirectories } = require('../assetServer/virtual.js')
const { layeredDir } = require('../assetServer/layered.js')
const { filteredPk3Directory, filteredPk3List } = require('../mapServer/list-filtered.js')
const { renderIndex, renderFeature, renderMenu } = require('../utilities/render.js')
const { ASSET_MENU } = require('../contentServer/serve-settings.js')
const { renderDirectory } = require('../contentServer/serve-live.js')
const { WEB_FORMATS, IMAGE_FORMATS, AUDIO_FORMATS, SUPPORTED_FORMATS,
  MODS_NAMES, getGames } = require('../utilities/env.js')
const { calculateSize } = require('../utilities/watch.js')
const { CONVERTED_IMAGES, convertCmd } = require('../cmdServer/cmd-convert.js')
const { opaqueCmd } = require('../cmdServer/cmd-identify.js')
const { listPk3s } = require('../assetServer/layered.js')
const { MAP_DICTIONARY, listMaps } = require('../assetServer/list-maps.js')


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
  if(ext[0] != '.') {
    ext = path.extname(ext)
  }
  if(ext[0] != '.') {
    return false
  }
  return SUPPORTED_FORMATS.includes(ext)
      || WEB_FORMATS.includes(ext)
      || IMAGE_FORMATS.includes(ext)
      || AUDIO_FORMATS.includes(ext)
}



// TODO: rename to listVirtual()
async function filteredVirtual(pk3InnerPath, newFile, modname) {
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


  if(newFile 
    && path.basename(newFile).localeCompare('pak0.pk3', 'en', {sensitivity: 'base'}) == 0) {
    let gamedir = layeredDir(path.join(modname, pk3InnerPath), false)
    localDirectory = (localDirectory || []).concat(gamedir || []).filter(filterExtname)

    // TODO: listPk3s, overlap all from base directory
    let pk3s = (await listPk3s(modname)).sort().reverse().map(findFile)
    for(let i = 0; i < pk3s.length; i++) {
      let pk3Dir = await filteredPk3Directory(pk3InnerPath, pk3s[i], modname)
      directory = (directory || []).concat(pk3Dir || []).filter(file => {
        return file.isDirectory || filterExtname(file.name)
      }).map(file => { return Object.assign(file, {
        link: path.join('/', modname, 'pak0.pk3dir', pk3InnerPath, path.basename(file.name))
          + (file.isDirectory ? '/' : ''),
        absolute: path.basename(path.dirname(file.file)) + '/' + path.basename(file.file) + '/.'
      })})
    }
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


  directory.sort((a, b) => 
    /* (a.name.includes('overridden') ? 0 : 2) - (b.name.includes('overridden') ? 0 : 2)
    + */ path.basename(a.name).localeCompare(b.name, 'en', {sensitivity: 'base'}))

  let allLowercase = directory.map(file => path.basename(file.name.toLocaleLowerCase()))
  let uniqueDir = directory.map((file, i) => {
    file.exists = allLowercase.indexOf(file.name.toLocaleLowerCase()) == i
    // is it the first occurence of the filename
    if(!file.exists) {
      file.name = '(overridden) ' + file.name
      file.exists = false
      file.overridden = true
    }
    return file
  })
  return uniqueDir
}


async function filteredGames() {
  let games = await Promise.all(Object.values(MODS_NAMES).concat(getGames())
    .sort((a, b) => a.localeCompare(b, 'en', {sensitivity: 'base'}))
    .filter((mod, i, arr) => arr.indexOf(mod) == i)
    .reduce((list, game, i) => {
      let devDirectories = gameDirectories(game)
      let first = {
        name: game,
        link: `/${game}/`,
        isDirectory: true,
        absolute: '/.'
      }
      list.push(first)
      for(let j = 0; j < devDirectories.length; j++) {
        if(j == 0) {
          first.absolute = devDirectories[j]
          continue
        }
        list.push({
          name: path.basename(path.dirname(devDirectories[j])) + '/' + path.basename(devDirectories[j]),
          exists: false,
          link: `/${game}/`,
          isDirectory: true,
          absolute: path.dirname(devDirectories[j])
        })
      }
      return list
    }, []))
  return games
}



async function filteredMaps(modname) {
  let pk3s = await listMaps(modname)
  // always included for repack 
  //   because this is how baseq3a is built
  if(!pk3s.includes('pak0')) {
    pk3s.unshift('pak0')
  }

  return pk3s.map(mapname => {
    let realPath = findFile(modname + '/' + MAP_DICTIONARY[mapname])
    if(!realPath) {
      return {
        name: '(virtual) ' + mapname + '.pk3dir',
        absolute: '',
        link: path.join('/', modname, mapname + '.pk3dir') + '/',
        isDirectory: true,
      }
    }
    return Object.assign({}, fs.statSync(realPath), {
      name: mapname + '.pk3dir',
      absolute: realPath,
      link: path.join('/', modname, mapname + '.pk3dir') + '/',
      isDirectory: true,
    })
  }).filter(file => file)
}


// TODO: fs.createReadStream for loading common downloads into memory
async function streamImageKey(pk3File, pk3InnerPath, response) {
  if(!IMAGE_FORMATS.includes(path.extname(pk3InnerPath))
    || path.extname(pk3InnerPath).match(/\.png$|\.jpg$|\.jpeg$/i)) {
    return false
  }

  let strippedPath = path.join(pk3File, pk3InnerPath).replace(path.extname(pk3InnerPath, ''))
  // try to find file by any extension, then convert
  if(typeof CONVERTED_IMAGES[strippedPath + '.jpg'] != 'undefined') {
    response.setHeader('content-type', 'image/jpg')
    response.send(CONVERTED_IMAGES[strippedPath + '.jpg'])
    return true
  } else
  if(typeof CONVERTED_IMAGES[strippedPath + '.png'] != 'undefined') {
    response.setHeader('content-type', 'image/png')
    response.send(CONVERTED_IMAGES[strippedPath + '.png'])
    return true
  }
  let isOpaque = await opaqueCmd(pk3File, pk3InnerPath)
  let newExt = isOpaque ? '.png' : '.jpg'
  response.setHeader('content-type', 'image/' + newExt.substring(1))
  const passThrough = new PassThrough()
  const readable = Readable.from(passThrough)
  // force async so other threads can answer page requests during conversion
  Promise.resolve(new Promise(resolve => {
    let chunks = []
    readable.on('data', chunks.push.bind(chunks))
    readable.on('end', resolve.bind(null, chunks))
    passThrough.pipe(response)
    convertCmd(pk3File, pk3InnerPath, void 0, passThrough, newExt)
  }).then(convertedFile => {
    CONVERTED_IMAGES[path.join(pk3File, pk3InnerPath)] = 
    CONVERTED_IMAGES[strippedPath + newExt] = Buffer.concat(convertedFile)
  }))
  return true
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
    pk3InnerPath = filename.replace(/^.*?\.pk3[^\/]*?(\/|$)/gi, '')
  }

  let modname = filename.split('/')[0]
  let directory = []
  let modNames = []
  let games = await filteredGames()
  for(let i = games.length - 1; i >= 0; --i) {
    modNames.push(games[i].name.toLocaleLowerCase())
    if(modname.length <= 1) {
      directory.unshift(games[i])
    }
  }
  if(modname && modNames.includes(modname.toLocaleLowerCase())) {
    filename = filename.substring(modname.length + 1)
  } else {
    modname = ''
  }

  let regularFile = findFile(modname + '/' + pk3InnerPath)
  if(regularFile && !fs.statSync(regularFile).isDirectory()) {
    if(await streamImageKey(regularFile, pk3InnerPath, response)) {
      return
    } else {
      return response.sendFile(regularFile)
    }
  }

  if(pk3Name) {
    pk3File = findFile(pk3Name)
    // TODO: exception for pak0.pk3 to search all base pk3s for the correct file
    // TODO: convert and redirect, then display the correct file in the index
    // TODO: combine with serve-repacked, fs.createReadStream
    if(pk3File && await streamImageKey(pk3File, pk3InnerPath, response)) {
      return
    }
    if (pk3File && await streamFileKey(pk3File, pk3InnerPath, response)) {
      return
    }
  }  
  

  // TODO: server a file from inside a pk3 to the pk3dirs
  // TODO: move to layeredDir()?
  let virtualPath
  if(!pk3Name) {
    //pk3File = findFile(filename.replace(/\.pk3.*/gi, '.pk3dir'))
    virtualPath = path.join('/' + modname, pk3InnerPath)
  } else {
    virtualPath = path.join('/', pk3Name + 'dir', pk3InnerPath)
  }

  if(modname.length > 1 && !pk3Name) {
    return response.send(renderIndex(`
    ${renderMenu(ASSET_MENU, 'asset-menu')}
    <div class="info-layout">
      ${await renderDirectory(virtualPath, await filteredMaps(modname), !isIndex)}
    </div>`))
  }

  let virtual = await filteredVirtual(pk3InnerPath, pk3Name, modname)

  // TODO: rename entire block to filteredVirtual()
  for(let i = 0; i < virtual.length; ++i) {
    if(modname.length <= 1 
      && WEB_FORMATS.includes(path.extname(virtual[i].name))) {
      directory.push(virtual[i])
      continue
    }
    if(!pk3Name && virtual[i].name.match(/\.pk3/i)) {
      if(virtual[i].name.includes('overridden')) {
        directory.push(virtual[i])
        continue
      }
      // TODO: add both pk3 and pk3dir as (virtual) outputs or precached
      // TODO: check repackedCache()
      let isPk3dir = !!virtual[i].name.match(/\.pk3dir$/gi)
      directory.push(Object.assign({}, virtual[i], {
        name: (isPk3dir ? '(virtual) ' : '') 
          + virtual[i].name.replace(path.extname(virtual[i].name), '.pk3'),
        exists: !virtual[i].overridden && !isPk3dir
      }))
      directory.push(Object.assign({}, virtual[i], {
        name: (!isPk3dir ? '(virtual) ' : '') 
          + virtual[i].name.replace(path.extname(virtual[i].name), '.pk3dir'),
        exists: !virtual[i].overridden && isPk3dir,
        isDirectory: true,
        link: virtual[i].link.replace(path.extname(virtual[i].name), '.pk3dir')
          + (virtual[i].link.endsWith('/') ? '' : '/'),
      }))
      continue
    }
    if(pk3Name) {
      directory.push(virtual[i])
    }
  }

  if(modname.length > 1 && !pk3Name) {
    directory.unshift({
      name: 'pak0.pk3dir',
      exists: true,
      isDirectory: true,
      link: path.join('/', modname, 'pak0.pk3dir') + '/',
      absolute: '(virtual)/.',
    })
    directory.unshift({
      name: 'pak0.pk3',
      exists: true,
      isDirectory: false,
      link: path.join('/', modname, 'pak0.pk3'),
      absolute: '(virtual)/.',
    })
  }

  // duck out early
  if (!directory || directory.length <= 0) {
    return next(new Error('Path not found: ' + filename))
  }

  //directory.sort()
  //console.log(virtualPath)

  return response.send(renderIndex(`
  ${renderMenu(ASSET_MENU, 'asset-menu')}
  <div class="info-layout">${modname <= 1 ? VIRTUAL_EXPLAINATION : ''}
    ${await renderDirectory(modname <= 1 ? 'virtual' : virtualPath, directory, !isIndex)}
  </div>`))
}

module.exports = {
  serveVirtual,
}

