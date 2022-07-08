// TODO: update stuff based on when file system changes
//   use node watcher
const path = require('path')
const fs = require('fs')
const { renderIndex, renderMenu } = require('../utilities/render.js')
const { buildDirectories, gameDirectories } = require('../assetServer/virtual.js')
const { ASSET_MENU, renderFilelist } = require('../contentServer/serve-settings.js')
const { getGames } = require('../utilities/env.js')
const { calculateSize } = require('../utilities/watch.js')
const { combinedDir } = require('../assetServer/layered.js')

const LIVE_EXPLAINATION = `
<h2>Live Explaination:</h2>
<p>The "Live" directory shows all the files listed in build 
directories only. The purpose is to show exactly which source 
code files are being loaded into the final built .pk3 output. 
The files change, the output files are automatically triggered 
to be rebuilt so the new changes can be loaded in the page on 
refresh.</p>
`

async function serveVersion() {
  // cache busting for clients
  if (!filename.includes('version.json')) {
    return
  }
  // create a virtual version file based on the max time
  //   of all our search directories, if any one of them 
  //   changed from new build files, the version.json
  //   check will break the IDBFS cache.
  let BUILD_ORDER = buildDirectories()
  let latest = 0
  let time
  for (let i = 0; i < BUILD_ORDER.length; i++) {
    let newPath = path.join(BUILD_ORDER[i], filename)
    if (fs.existsSync(newPath)) {
      let newTime = fs.statSync(newPath).mtime
      if (newTime.getTime() > latest) {
        latest = newTime.getTime()
        time = newTime
      }
    }
  }
  if (latest > 0) {
    return response.json([time, time])
  }
}


async function serveLive(request, response, next) {
  let isIndex = request.url.match(/\?index/)
  let isJson = request.url.match(/\?json/)
  let filename = request.url.replace(/\?.*$/, '')
  if (filename.startsWith('/')) {
    filename = filename.substring(1)
  }
  if (filename.endsWith('/')) {
    filename = filename.substring(0, filename.length - 1)
  }

  //let GAME_ORDER = gameDirectories(GAME_MODS[i])


  // TODO: add game development directories
  // TODO: add --add-game to add multiple games
  // list all game mods added intentionally from settings.json
  let BUILD_ORDER = buildDirectories().filter(dir => fs.existsSync(dir))
  let GAME_MODS = [] // getGames()
  let modname = filename.split('/')[0]
  let directory = await combinedDir(
    filename.substring(modname.length), GAME_MODS.concat(BUILD_ORDER))

  let directoryFiltered = directory.map(async filename => 
  Object.assign(fs.statSync(filename), {
    name: path.basename(path.dirname(filename)) + '/' + path.basename(filename),
    absolute: path.dirname(filename),
    size: await Promise.any([calculateSize(filename), 
      new Promise(resolve => setTimeout(resolve.bind(null, 
        '0B (Calculating)'), 200))])
  }))

  return response.send(renderIndex(`
  ${renderMenu(ASSET_MENU, 'asset-menu')}
  <div class="info-layout">${LIVE_EXPLAINATION}
    ${await renderDirectory(filename.length <= 1
    ? 'live (combined)' : filename, await Promise.all(directoryFiltered), !isIndex)}
  </div>`))
}


function formatDirname(filename) {
  return (path.dirname(filename).includes('/') ?
    `<a href="/${path.dirname(path.dirname(filename))}/?index">..</a>
  / ` : '')
    + (filename.includes('/') ?
      `<a href="/${path.dirname(filename)}/?index">${
        path.basename(path.dirname(filename))}</a>
  / ` : '')
    + path.basename(filename)
}


async function renderDirectory(filename, directoryFiltered, simple) {
  if (simple) {
    return `<ol>${directoryFiltered.map(node =>
      `<li><a href="${node.link}?alt">${node.name}</a></li>`)
      .join('\n')}</ol>`
  }
  return `
  <a class="close-files" href="/${filename}${filename.length > 1 ? '/' : ''}">X</a>
  <h2>Directory: ${formatDirname(filename)}</h2>
  <ol class="directory-list">
  ${directoryFiltered.map(renderFilelist).join('\n')}
  ${directoryFiltered.length == 0 ? '<li>No files found.</li>' : ''}
  </ol>`
}



module.exports = {
  serveVersion,
  serveLive,
  renderDirectory,
}

