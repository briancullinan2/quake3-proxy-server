const fs = require('fs')
const path = require('path')

const { streamFileKey } = require('../utilities/zip.js')
const { findFile } = require('../assetServer/virtual.js')
const { layeredDir } = require('../assetServer/layered.js')
const { filteredGames, filteredPk3Directory, filteredPk3List } = require('../mapServer/list-filtered.js')
const { renderIndex, renderFeature, renderMenu } = require('../utilities/render.js')
const { ASSET_MENU } = require('../contentServer/serve-settings.js')
const { renderDirectory } = require('../contentServer/serve-live.js')
const { WEB_FORMATS, IMAGE_FORMATS, AUDIO_FORMATS, SUPPORTED_FORMATS } = require('../utilities/env.js')
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
  let zeroTimer = new Promise(resolve => setTimeout(
    resolve.bind(null, '0B (Calculating)'), 200))
  let directory = []
  let localDirectory
  if (newFile) {
    // TODO: need full paths here so we can show/hide layers in virtual mode
    localDirectory = layeredDir(path.join(modname, newFile + 'dir', pk3InnerPath), true)
  } else {
    localDirectory = layeredDir(modname, true)
  }

  if (localDirectory) {
    let supported = await Promise.all(localDirectory.map(async (file) =>
      Object.assign({}, fs.statSync(file), {
        name: path.basename(file),
        absolute: path.basename(path.dirname(path.dirname(file)))
          + '/' + path.basename(path.dirname(file)) + '/.',
        size: await Promise.any([calculateSize(file), zeroTimer]),
        link: path.join('/', modname, path.basename(file)) + (file.isDirectory ? '/' : '')
      })))
    for (let i = 0; i < supported.length; i++) {
      directory.push(supported[i])
    }
  }

  if (newFile && newFile.match(/\.pk3/i)) {
    let pk3Dir = await filteredPk3Directory(pk3InnerPath, newFile, modname)
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

  let allLowercase = directory.map(file => path.basename(file.name.toLocaleLowerCase()))
  let uniqueDir = directory.map((file, i) => {
    file.exists = allLowercase.indexOf(file.name.toLocaleLowerCase()) == i
    return file
  })
  return uniqueDir
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
  let modname = filename.split('/')[0]
  let pk3File
  if (filename.match(/\.pk3/i)) {
    pk3File = findFile(filename.replace(/\.pk3.*/gi, '.pk3'))
  }
  let pk3InnerPath = filename.replace(/^.*?\.pk3[^\/]*?(\/|$)/gi, '')

  // TODO: server a file from inside a pk3 to the pk3dirs
  // TODO: move to layeredDir()?
  let virtualPath = '/' + modname
  if (pk3File) {
    if (await streamFileKey(pk3File, pk3InnerPath, response)) {
      return
    }
    virtualPath = path.join('/' + modname, path.basename(pk3File) + 'dir', pk3InnerPath)
  }

  directory = await filteredVirtual(pk3InnerPath, pk3File, modname)

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

