const fs = require('fs')
const path = require('path')

const { renderIndex, renderMenu } = require('../utilities/render.js')
const { buildDirectories } = require('../assetServer/virtual.js')
const { getGame, repackedCache, downloadCache, getGames } = require('../utilities/env.js')
const { FILESYSTEM_WATCHERS } = require('../gameServer/processes.js')

let ASSET_FEATURES = [{
  title: 'Shaders',
  subtitle: 'List Shaders / Palettes',
  link: 'palette',
  levelshot: `/build/shaders.svg`,
}, {
  title: 'Virtual FS',
  subtitle: `Combined ${getGame()}/pak0.pk3dir`,
  link: getGame() + '/pak0.pk3dir/?index',
  levelshot: '/build/virtual.svg'
}, {
  title: 'Repacked Cache',
  subtitle: 'On Demand Transcoding',
  link: `repacked/${getGame()}/pak0.pk3dir/?index`,
  levelshot: '/build/repack.svg'
}, {
  title: 'Live Dev',
  subtitle: 'FS Watcher / Hot-reloading',
  link: 'build/?index',
  levelshot: '/build/livecode.svg'
}, {
  title: 'Directories',
  subtitle: 'Settings / Auto-detect',
  link: 'settings',
}, {
  title: 'Downloads',
  subtitle: 'Find Remote content',
  link: 'downloads',
  levelshot: '/build/downloads.svg'
}, {
  title: 'Metadata',
  subtitle: 'Metadata / List datas',
  link: 'metadata',
  levelshot: `/build/metadata.svg`,
}]

let ASSET_MENU = [{
  title: 'Assets',
  link: 'assets'
}, {
  title: 'Skins',
  link: 'assets#skins'
}, {
  title: 'Arenas',
  link: 'assets#arenas'
}, {
  title: 'Matches',
  link: 'assets#matches'
}, {
  title: 'Games',
  link: 'assets#games'
}]



function renderFilelist(node) {
  if(typeof node == 'string') {
    node =  Object.assign({
      name: path.basename(node),
      absolute: node,
    })
  }
  if(typeof node.time == 'number'
    && typeof node.mtime == 'undefined') {
    node.mtime = new Date(node.time)
  }
  let isDir = typeof isDirectory == 'function' 
      ? node.isDirectory() : node.isDirectory
  let result = `
  <li ${node.exists === false ? 'class="unused-path"' : ''}>
  <div><a ${!node.name.endsWith('/') && !isDir ? 'target="_self"' : ''} href="${node.link || ('/' + node.name)}${
    isDir && !(node.link || node.name).endsWith('/') ? '/' : ''}?${
    node.name.endsWith('/') || isDir ? 'index' : 'alt'}">${
    node.name ? node.name : path.basename(node.absolute)
  }</a></div>
  <div>${node.size ? formatSize(node.size) : '&nbsp;'}</div>
  <div>${typeof node.mtime != 'undefined'
      ? `${
      String(node.mtime.getMonth() + 1).padStart(2, '0')}/${
      String(node.mtime.getDate()).padStart(2, '0')}/${
      (node.mtime.getFullYear() + '').substring(2)} 
      ${node.mtime.getHours()}:${node.mtime.getMinutes()}`
      : '&nbsp;'}</div>
  <div>${node.absolute ? path.dirname(node.absolute) 
      : path.dirname(node.name)}</div>
  </li>`
  return result
}


function formatSize(size) {
  let formatted
  let number
  if(typeof size == 'number') {
    number = size
    formatted = [size + '']
  } else 
  if (typeof size == 'undefined'
    || typeof size == 'object' && !size) {
    return ''
  } else 
  if (typeof size == 'string') {
    if(size.length == 0) { return '' }
    formatted = size.split(' ')
    number = parseInt(formatted[0])
  }

  if(size > 1024 * 1024 * 1024) {
    formatted[0] = Math.round(number / 1024 / 1024 / 1024 * 10) / 10 + 'GB'
  } else
  if(size > 1024 * 1024) {
    formatted[0] = Math.round(number / 1024 / 1024 * 10) / 10 + 'MB'
  } else
  if(size > 1024) {
    formatted[0] = Math.round(number / 1024 * 10) / 10 + 'KB'
  } else {
    formatted[0] = number + 'B'
  }
  return formatted.join(' ')
}


async function serveSettings(request, response, next) {
  let isIndex = request.url.match(/\?index/)
  let isJson = request.url.match(/\?json/)
  let filename = request.url.replace(/\?.*$/, '')

  let BUILD_ORDER = buildDirectories()
  let includedPaths = []
  let nonExisting = []
  for (let i = 0; i < BUILD_ORDER.length; i++) {
    if (!fs.existsSync(BUILD_ORDER[i]) 
      || !fs.statSync(BUILD_ORDER[i]).isDirectory()) {
      nonExisting.push({
        name: '(unused) ' + path.basename(path.dirname(BUILD_ORDER[i])) + '/' + path.basename(BUILD_ORDER[i]),
        absolute: path.dirname(BUILD_ORDER[i]),
      })
    } else {
      includedPaths.push({
        name: path.basename(path.dirname(BUILD_ORDER[i])) + '/' + path.basename(BUILD_ORDER[i]),
        mtime: fs.statSync(BUILD_ORDER[i]).mtime,
        absolute: path.dirname(BUILD_ORDER[i]),
      })
    }
  }

  let GAME_MODS = getGames()
  let gamesFiltered = []
  for(let j = 0; j < GAME_MODS.length; j++) {
    let GAME_ORDER = gameDirectories(GAME_MODS[j], false)
    for(let i = 0; i < GAME_ORDER.length; i++) {
      let exists = fs.existsSync(GAME_ORDER[i])
      gamesFiltered.push({
        name: (exists === false ? '(missing) ' : '') + dir,
        absolute: GAME_ORDER[i],
        exists: exists,
        mtime: exists ? fs.statSync(GAME_ORDER[i]).mtime : void 0,
      })
    }
  }

  return response.send(renderIndex(
  renderMenu(ASSET_FEATURES, 'asset-menu')
  + `<div class="info-layout">
  <h2>Settings</h2>
  <p>Various paths are checked for files. Each directory is combined into a layered virtual
    directory with all the files combined. This is because each system has it's own configurable
    paths for where pk3 and games files are stored.</p>
  <h3>Combined Paths</h3>
  <ol class="directory-list">${includedPaths.map(renderFilelist).join('\n')}
  </ol>
  <h3>Game Directories</h3>
  <p>Various game directories can be added, and accessed in game using the directory name 
  as thegame setting. These paths can be modified to support multiple games on the same 
  system, at the same time; through this web interface. Game directories are generally not added automatically, and must be configured. Built VMs from building the game files are  automatically included, for your convenience.
  <ol class="directory-list">${gamesFiltered.map(renderFilelist).join('\n')}
  </ol>
  <h3>Content Caching</h3>
  <p>Some files require conversion in order to use on the web. If caching is turned on, 
  the converted files can be stored for repeat use. These paths are checked for already
  downloaded content based on filename. They are only checked when accessed directly,
  but using this tool, you can browse the converted / cached files in memory and on
  disk.</p>
  <ol class="directory-list">${repackedCache().map(dir => {
    let exists = fs.existsSync(dir)
    return {
      name: (exists === false ? '(missing) ' : '') + dir,
      absolute: dir,
      exists: exists,
      mtime: exists ? fs.statSync(dir).mtime : void 0,
    }
  }).map(renderFilelist).join('\n')}
  </ol>
  <h3>Downloaded Content</h3>
  <p>Content can be downloaded from multiple sources and managed from the Downloads page.
  These paths are currently being checked for downloaded .pk3 files. Combined with the 
  content caching directories above, all downloaded, cached, and developing content
  is included in the Virtual Directory.</p>
  <ol class="directory-list">${downloadCache().map(dir => {
    let exists = fs.existsSync(dir)
    return {
      name: (exists === false ? '(missing) ' : '') + dir,
      absolute: dir,
      exists: exists,
      mtime: exists ? fs.statSync(dir).mtime : void 0,
    }
  }).map(renderFilelist).join('\n')}
  </ol>
  <h3>File-system Watchers</h3>
  <p>File watchers can run events when a file change is detected. Instead of waiting for 
  user input, the page can refresh automatically if .pk3 files are added. The parent 
  directory and glob matching are listed on the left and the event that it triggers
  is listed on the right.
  <ol class="directory-list">${FILESYSTEM_WATCHERS.map(renderFilelist).join('\n')}
  </ol>
  <h3>Unused Paths</h3>
  <ol id="unused-paths" class="directory-list">${nonExisting.map(renderFilelist).join('\n')}
  </ol>
  <h3>Automatic Upgrade</h3>
  ${renderMenu([{
    title: 'Git Pull',
    link: 'upgrade'
  }], 'upgrade-menu')}

  </div>
  `))
}

module.exports = {
  ASSET_FEATURES,
  ASSET_MENU,
  serveSettings,
  renderFilelist,
}

