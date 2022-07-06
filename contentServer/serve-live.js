// TODO: update stuff based on when file system changes
//   use node watcher
const path = require('path')
const fs = require('fs')
const { renderIndex, renderMenu } = require('../utilities/render.js')
const { buildDirectories, gameDirectories } = require('../assetServer/virtual.js')
const { ASSET_MENU, renderFilelist } = require('../contentServer/serve-settings.js')
const { getGames } = require('../utilities/env.js')
const { calculateSize } = require('../utilities/watch.js')

// TODO: send refresh signal over websocket/proxy
//   in a POSIX similar way? This would be cool
//   because then all remote clients will refresh
//   and reconnect to existing game

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


async function listFiles(filename) {
  let directory = []
  let lowercasePaths = []
  let BUILD_ORDER = buildDirectories().map(dir => path.join(dir, filename))
  let GAME_MODS = getGames()
  if (filename.startsWith('/')) {
    filename = filename.substring(1)
  }
  let modname = filename.split('/')[0]

  // list all game mods added intentionally from settings.json
  for (let i = 0; i < GAME_MODS.length; i++) {
    let GAME_ORDER = gameDirectories(GAME_MODS[i])
      .map(dir => path.join(dir, filename.substring(modname.length)))
      .filter(dir => fs.existsSync(dir) && fs.statSync(dir).isDirectory())
    if (GAME_ORDER.length == 0) {
      continue
    }

    // add the game mod as a virtual directory for live development
    if (modname.localeCompare(GAME_MODS[i], 'en', { sensitivity: 'base' }) == 0) {
      BUILD_ORDER.push.apply(BUILD_ORDER, GAME_ORDER)
    }

    // if we are searching from the top directory, list game mods as directories 
    //   under root /build/ directory
    if (filename.length > 1) {
      continue
    }
    let stat = fs.statSync(GAME_ORDER[0])
    directory.push(new Promise(async function (resolve) {
      return resolve({
        name: GAME_MODS[i] + '/',
        link: `/build/${GAME_MODS[i]}/`,
        absolute: path.join(path.basename(path.dirname(GAME_ORDER[0])), path.basename(GAME_ORDER[0]), GAME_MODS[i]),
        mtime: stat.mtime || stat.ctime,
        // I had this idea, what if a page could take a specific amount of time,
        //   and the server only tries to get done what it thinks it can in that.
        size: await Promise.any([
          calculateSize(GAME_ORDER[0]),
          new Promise(resolve => setTimeout(resolve.bind(null, '0B (Calculating)'), 200))]),
      })
    }))
    lowercasePaths.push((GAME_MODS[i] + '/').toLocaleLowerCase())
  }

  // TODO: add game development directories
  // TODO: add --add-game to add multiple games
  for (let i = 0; i < BUILD_ORDER.length; i++) {
    if (!fs.existsSync(BUILD_ORDER[i])
      || !fs.statSync(BUILD_ORDER[i]).isDirectory()) {
      continue
    }
    let subdirectory = fs.readdirSync(BUILD_ORDER[i])
    for (let s = 0; s < subdirectory.length; s++) {
      if (!fs.existsSync(path.join(BUILD_ORDER[i], subdirectory[s]))) {
        continue
      }
      let stat = fs.statSync(path.join(BUILD_ORDER[i], subdirectory[s]))
      if (stat.isDirectory()) {
        directory.push(new Promise(async function (resolve) {
          return resolve({
            name: subdirectory[s] + '/',
            link: `/build/${filename}${filename.length > 1 ? '/' : ''}${subdirectory[s]}/`,
            absolute: path.join(path.basename(path
              .dirname(BUILD_ORDER[i])), path.basename(BUILD_ORDER[i]),
              subdirectory[s]),
            mtime: stat.mtime || stat.ctime,
            // I had this idea, what if a page could take a specific amount of time,
            //   and the server only tries to get done what it thinks it can in that.
            size: await Promise.any([
              calculateSize(path.join(BUILD_ORDER[i], subdirectory[s])),
              new Promise(resolve => setTimeout(resolve.bind(null, '0B (Calculating)'), 200))]),
          })
        }))
        lowercasePaths.push((subdirectory[s] + '/').toLocaleLowerCase())
      } else {
        directory.push(Promise.resolve({
          name: subdirectory[s],
          size: stat.size,
          link: `/build/${filename}${filename.length > 1 ? '/' : ''}${subdirectory[s]}`,
          absolute: path.join(path.basename(path
            .dirname(BUILD_ORDER[i])), path.basename(BUILD_ORDER[i]),
            subdirectory[s]),
          mtime: stat.mtime || stat.ctime,
        }))
        lowercasePaths.push(subdirectory[s].toLocaleLowerCase())
      }
    }
  }
  let directoryFiltered = (await Promise.all(directory))
    .filter((d, i) => d.name && !d.name.startsWith('.')
      && lowercasePaths.indexOf(d.name.toLocaleLowerCase()) == i)
  directoryFiltered.sort(function (a, b) {
    return b.mtime - a.mtime // a.name.localeCompare(b.name, 'en', {sensitivity: 'base'})
  })
  return directoryFiltered
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

  let directoryFiltered = await listFiles(filename)
  return await renderDirectoryIndex(filename, directoryFiltered, filename.length > 1, isIndex, response)
}


async function renderDirectoryIndex(filename, directoryFiltered, isSub, isIndex, response) {
  if (isIndex) {
    return response.send(renderIndex(
      renderMenu(ASSET_MENU, 'asset-menu')
      + `<div class="loading-blur"><img src="/baseq3/pak0.pk3dir/levelshots/q3dm0.jpg"></div>
    <div class="info-layout">
    <a class="close-files" href="/${filename}${filename.length > 1 ? '/' : ''}">X</a>
    <h2>Directory: 
    ${path.dirname(filename).includes('/') ? 
    `<a href="/${path.dirname(path.dirname(filename))}/?index">..</a>
    /
    ` : ''}
    ${filename.includes('/') ?
    `<a href="/${path.dirname(filename)}/?index">${path.basename(path.dirname(filename))}</a>
    /
    ` : ''}
    ${path.basename(filename)}</h2>
    <ol class="directory-list">${directoryFiltered.map(renderFilelist).join('\n')}
    </ol>
    </div>
    `))
  } else {
    return response.send('<ol>' + directoryFiltered.map(node =>
      `<li><a href="${node.link}?alt">${node.name}</a></li>`).join('\n')
      + '</ol>')
  }
}



module.exports = {
  renderDirectoryIndex,
  serveVersion,
  serveLive,
}

