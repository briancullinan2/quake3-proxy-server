
const path = require('path')
const { streamFileKey } = require('../utilities/zip.js')
const { findFile } = require('../assetServer/virtual.js')
const { layeredDir } = require('../assetServer/layered.js')
const { filteredGames, filteredPk3Directory, filteredPk3List } = require('../mapServer/list-filtered.js')
const { renderIndex, renderFeature, renderMenu } = require('../utilities/render.js')
const { ASSET_MENU } = require('../contentServer/serve-settings.js')
const { renderDirectory } = require('../contentServer/serve-live.js')

const VIRTUAL_EXPLAINATION = `
<h2>Virtual Explaination:</h2>
<p>The "Virtual" directory shows all the files listed as they are expected to be
in the final output state. That is files included in pk3s, and converted files.
Files that aren't cached will trigger the conversion when they are first used.
The virtual directory should also show the latest files compiled from development
directories. Visiting some virtual paths will trigger events that take some time,
like starting the engine and rendering a map to collect a sull screen levelshot.</p>
`

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
  if(filename.match(/\.pk3/i)) {
    pk3File = findFile(filename.replace(/\.pk3.*/gi, '.pk3'))
  }
  let pk3InnerPath = filename.replace(/^.*?\.pk3[^\/]*?(\/|$)/gi, '')
  let directory = layeredDir(filename)

  // TODO: server a file from inside a pk3 to the pk3dirs
  // TODO: move to layeredDir()?
  let virtualPath = '/' + modname
  if (pk3File) {
    if(await streamFileKey(pk3File, pk3InnerPath, response)) {
      return
    }
    directory = await filteredPk3Directory(pk3InnerPath, pk3File, modname)
    virtualPath = path.join('/' + modname, path.basename(pk3File) + 'dir', pk3InnerPath)
  }
  //console.log(directory)

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

