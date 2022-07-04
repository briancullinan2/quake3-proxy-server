const fs = require('fs')
const path = require('path')
const { renderIndex, renderMenu } = require('../utilities/render.js')
const { gameDirectories, buildDirectories } = require('../assetServer/virtual.js')
const { getGames, repackedCache, downloadCache } = require('../utilities/env.js')
const { FILESYSTEM_WATCHERS } = require('../utilities/watch.js')

let SETTINGS_MENU = [
  {
    title: 'Virtual FS',
    link: 'baseq3/pak0.pk3dir?index',
  }, {
    title: 'Repacked',
    link: 'repacked/baseq3/pak0.pk3dir?index',
  }, {
    title: 'Live Dev',
    link: 'build?index',
  }, {
    title: 'Directories',
    link: 'settings',
  }
]


function renderFilelist(node) {
  let result = `<li ${node.exists === false ? 'class="unused-path"' : ''}>`
  if(node.name.endsWith('/') || typeof node.size == 'undefined') {
    result += `<a href="${node.link}?index">${node.exists === false ? '(missing) ' : ''}${node.name}</a>`
    result += `<span>&nbsp;</span>`
  } else {
    result += `<a href="${node.link}?alt">${node.name}</a>`
    result += `<span>${formatSize(node.size)}</span>`
  }
  if(typeof node.mtime != 'undefined') {
    result += `<span>${node.mtime.getMonth() + 1}/${node.mtime.getDate()} `
    result += `${node.mtime.getHours()}:${node.mtime.getMinutes()}</span>`
  } else {
    result += `<span>&nbsp;</span>`
  }
  result += `<span>${path.dirname(node.absolute)}</span>`
  result += '</li>'
  return result
}


function formatSize(size) {
  if(size > 1024 * 1024 * 1024) {
   return Math.round(size / 1024 / 1024 / 1024 * 10) / 10 + 'GB'
  } else
  if(size > 1024 * 1024) {
    return Math.round(size / 1024 / 1024 * 10) / 10 + 'MB'
  } else
  if(size > 1024) {
    return Math.round(size / 1024 * 10) / 10 + 'KB'
  } else {
    return size + 'B'
  }
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
        name: '(missing) ' + path.basename(path.dirname(BUILD_ORDER[i])) + '/' + path.basename(BUILD_ORDER[i]),
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

  let allGames = []
  let GAME_MODS = getGames()
  for(let i = 0; i < GAME_MODS.length; i++) {
    let GAME_ORDER = gameDirectories(GAME_MODS[i], true)
    //let nonExistingGames = []
    //let includedGames = []
    for(let i = 0; i < GAME_ORDER.length; i++) {
      let exists = fs.existsSync(GAME_ORDER[i])
      allGames.push({
        name: path.basename(path.dirname(GAME_ORDER[i])) + '/' + path.basename(GAME_ORDER[i]),
        mtime: exists ? fs.statSync(GAME_ORDER[i]).mtime : new Date(0),
        absolute: path.dirname(GAME_ORDER[i]),
        exists: exists
      })
    }
  }

  return response.send(renderIndex(
  renderMenu(SETTINGS_MENU, 'asset-menu')
  + `<div class="loading-blur"><img src="/baseq3/pak0.pk3dir/levelshots/q3dm0.jpg"></div>
  <div class="info-layout">
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
  <ol class="directory-list">${allGames.map(renderFilelist).join('\n')}
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
      name: dir,
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
      name: dir,
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
  </div>
  `))
}

module.exports = {
  SETTINGS_MENU,
  serveSettings,
  renderFilelist
}

