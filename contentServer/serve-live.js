// TODO: update stuff based on when file system changes
//   use node watcher
const path = require('path')
const fs = require('fs')

const { streamFile } = require('../assetServer/stream-file.js')
const { renderIndex, renderMenu } = require('../utilities/render.js')
const { buildDirectories, gameDirectories } = require('../assetServer/virtual.js')
const { ASSET_FEATURES, renderFilelist } = require('../contentServer/serve-settings.js')
const { getGames } = require('../utilities/env.js')
const { calculateSize } = require('../utilities/async-size.js')
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


// TODO: add --add-game to add multiple games
async function serveLive(request, response, next) {
  let zeroTimer = new Promise(resolve => setTimeout(
    resolve.bind(null, '0B (Calculating)'), 200))
  let isIndex = request.url.match(/\?index/)
  let isJson = request.url.match(/\?json/)
  let isAlt = request.url.match(/\?alt/)
  let filename = request.url.replace(/\?.*$/, '')
  if (filename.startsWith('/')) {
    filename = filename.substring(1)
  }
  if (filename.endsWith('/')) {
    filename = filename.substring(0, filename.length - 1)
  }

  let modname = filename.split('/')[0]
  let gameNames = getGames()
  let GAME_ORDER = []

  // TODO: add game development directories
  if(modname.length > 1
    && gameNames.includes(modname.toLocaleLowerCase())) {
    GAME_ORDER = gameDirectories(modname).map(dir => path.join(dir, filename.substring(modname.length)))
  }

  // so we can view images that will eventually be converted by the deploy process, live!
  if(isAlt && await streamFile(filename, response)) {
    return
  }

  // list all game mods added intentionally from settings.json
  let BUILD_ORDER = buildDirectories()
      .map(dir => path.join(dir, filename))
      .filter(dir => fs.existsSync(dir))
      .concat(GAME_ORDER)

  for(let i = 0; i < BUILD_ORDER.length; i++) {
    if(fs.existsSync(BUILD_ORDER[i])
      && !fs.statSync(BUILD_ORDER[i]).isDirectory()) {
      return response.sendFile(BUILD_ORDER[i])
    }
  }


  let directory = await combinedDir(BUILD_ORDER)

  let directoryFiltered = directory.map(async file => 
  Object.assign(fs.statSync(file), {
    name: path.basename(path.dirname(file)) + '/' + path.basename(file),
    absolute: path.dirname(file),
    size: await Promise.any([calculateSize(file), zeroTimer]),
    link: path.join('/build', filename, path.basename(file)) + (file.isDirectory ? '/' : '')
  }))
  if(modname.length <= 1) {
    directoryFiltered.unshift.apply(directoryFiltered, gameNames.map(game => ({
      isDirectory: true,
      name: game,
      absolute: '(virtual)/.',
      exists: true,
      link: path.join('/build', game) + '/',
    })))
  }

  return response.send(renderIndex(`
  ${renderMenu(ASSET_FEATURES, 'asset-menu')}
  <div class="info-layout">${filename.length <= 1 ? LIVE_EXPLAINATION : ''}
    ${await renderDirectory(filename.length <= 1
    ? 'live (combined)' : path.join('build', filename), await Promise.all(directoryFiltered), !isIndex)}
  </div>`))
}


function formatDirname(filename, breadcrumbs = 3) {
  let result = ''
  let segments = filename.split('/')
  if(breadcrumbs > segments.length) {
    breadcrumbs = segments.length
  }
  for(let i = 0; i < breadcrumbs; i++) {
    if(i > 0) {
      result += ' / '
    }
    if(i < breadcrumbs - 1) {
      result += `<a href="${segments.slice(0, segments.length - ((breadcrumbs - 1) - i)).join('/')}/?index">`
    }
    if(i == 0 && breadcrumbs > 1) {
      result += '..'
    } else {
      result += segments[segments.length - (breadcrumbs - i)]
    }
    if(i < breadcrumbs - 1) {
      result += '</a>'
    }
  }
  return result
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

