const fs = require('fs')
const path = require('path')

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



const VIRTUAL_EXPLAINATION = `
<h2>Virtual Explaination:</h2>
<p>The "Virtual" directory shows all the files listed as they are expected to be
in the final output state. That is files included in pk3s, and converted files.
Files that aren't cached will trigger the conversion when they are first used.
The virtual directory should also show the latest files compiled from development
directories. Visiting some virtual paths will trigger events that take some time,
like starting the engine and rendering a map to collect a fullscreen levelshot.</p>
`


async function filteredVirtual(pk3InnerPath, newFile, modname) {
  let zeroTimer = new Promise(resolve => setTimeout(resolve.bind(null, '0B (Calculating)'), 200))
  let directory = []
  let localDirectory
  console.log(arguments)

  if (newFile) {
    // TODO: need full paths here so we can show/hide layers in virtual mode
    localDirectory = layeredDir(path.join(modname, path.basename(newFile) + 'dir', pk3InnerPath), true)
  } else {
    localDirectory = layeredDir(path.join(modname, pk3InnerPath), true)
  }

  if (localDirectory) {
    let supported = await Promise.all(localDirectory.map(async (file) =>
      Object.assign({}, fs.statSync(file), {
        name: path.basename(file),
        absolute: path.basename(path.dirname(path.dirname(path.dirname(file))))
          + '/' + path.basename(path.dirname(path.dirname(file)))
          + '/' + path.basename(path.dirname(file)) + '/.',
        size: await Promise.any([calculateSize(file), zeroTimer]),
        link: path.join('/', modname, path.basename(file)) + (file.isDirectory ? '/' : '')
      })))
    for (let i = 0; i < supported.length; i++) {
      directory.push(supported[i])
    }
  }

  let pk3File
  if (newFile && (pk3File = findFile(modname + '/' + newFile))) {
    let pk3Dir = await filteredPk3Directory(pk3InnerPath, pk3File, modname)
    for (let i = 0; i < pk3Dir.length; i++) {
      let file = pk3Dir[i]
      if (!(file.isDirectory
        || SUPPORTED_FORMATS.includes(path.extname(file.name))
        || IMAGE_FORMATS.includes(path.extname(file.name))
        || AUDIO_FORMATS.includes(path.extname(file.name)))) {
        continue
      }
      directory.push(file)
    }
  }

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

  let pk3InnerPath = ''
  let modname = filename.split('/')[0]
  let pk3File
  let pk3Name

  if (filename.match(/\.pk3/i)) {
    pk3InnerPath = filename.replace(/^.*?\.pk3[^\/]*?(\/|$)/gi, '')
    pk3Name = filename.replace(/\.pk3.*/gi, '.pk3')
    pk3File = findFile(pk3Name)
    if (pk3File && await streamFileKey(pk3File, pk3InnerPath, response)) {
      return
    }
  } else 
  if(filename.length > 1) {
    let regularFile = findFile(pk3InnerPath)
    if(!fs.statSync(regularFile).isDirectory()) {
      return response.sendFile(regularFile)
    }
  }

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

  // TODO: server a file from inside a pk3 to the pk3dirs
  // TODO: move to layeredDir()?
  let virtualPath
  if(!pk3Name) {
    //pk3File = findFile(filename.replace(/\.pk3.*/gi, '.pk3dir'))
    virtualPath = path.join('/' + modname, pk3InnerPath)
  } else {
    virtualPath = path.join('/' + modname, pk3Name + 'dir', pk3InnerPath)
  }


  let virtual = await filteredVirtual(pk3InnerPath, pk3Name, modname)
  for(let i = 0; i < virtual.length; ++i) {
    if(modname.length <= 1 
      && WEB_FORMATS.includes(path.extname(virtual[i].name))) {
      directory.push(virtual[i])
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
  if (!directory || directory.length <= 1) {
    return next(new Error('Path not found: ' + filename))
  }

  //directory.sort()

  return response.send(renderIndex(`
  ${renderMenu(ASSET_MENU, 'asset-menu')}
  <div class="info-layout">${filename.length <= 1 ? VIRTUAL_EXPLAINATION : ''}
    ${await renderDirectory(filename.length <= 1 ? 'virtual' : virtualPath, directory, !isIndex)}
  </div>`))
}

module.exports = {
  serveVirtual,
}

