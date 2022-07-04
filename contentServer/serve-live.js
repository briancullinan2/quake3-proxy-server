// TODO: update stuff based on when file system changes
//   use node watcher
const path = require('path')
const fs = require('fs')
const { renderIndex, renderMenu } = require('../utilities/render.js')
const { buildDirectories } = require('../assetServer/virtual.js')
const { SETTINGS_MENU, renderFilelist } = require('../contentServer/serve-settings.js')

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
  let BUILD_ORDER = buildDirectories()
  // TODO: add game development directories
  // TODO: add --add-game to add multiple games
  for (let i = 0; i < BUILD_ORDER.length; i++) {
    let newPath = path.join(BUILD_ORDER[i], filename)
    if (!fs.existsSync(newPath) 
      || !fs.statSync(newPath).isDirectory()) {
      continue
    }
    let subdirectory =  fs.readdirSync(newPath)
    for(let s = 0; s < subdirectory.length; s++) {
      let stat = fs.statSync(path.join(newPath, subdirectory[s]))
      if(stat.isDirectory()) {
        directory.push({
          name: subdirectory[s] + '/',
          link: `/build/${filename}${filename.length > 1 ? '/' : ''}${subdirectory[s]}`,
          absolute: path.join(path.basename(path.dirname(newPath)), path.basename(newPath), subdirectory[s]),
          mtime: stat.mtime || stat.ctime,
        })
        lowercasePaths.push((subdirectory[s] + '/').toLocaleLowerCase())
      } else {
        directory.push({
          name: subdirectory[s],
          size: stat.size,
          link: `/build/${filename}${filename.length > 1 ? '/' : ''}${subdirectory[s]}`,
          absolute: path.join(path.basename(path.dirname(newPath)), path.basename(newPath), subdirectory[s]),
          mtime: stat.mtime || stat.ctime,
        })
        lowercasePaths.push(subdirectory[s].toLocaleLowerCase())
      }
    }
  }
  let directoryFiltered = directory
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
  if(filename.startsWith('/')) {
    filename = filename.substring(1)
  }
  if(filename.endsWith('/')) {
    filename = filename.substring(0, filename.length - 1)
  }

  let directoryFiltered = await listFiles(filename)

  if(filename.length > 1) {
    directoryFiltered.unshift({
      name: '../',
      link: `/build/${path.dirname(filename)}`,
      mtime: new Date(),
      absolute: 'build/' + filename,
    })
  }

  if (isIndex) {
    return response.send(renderIndex(
    renderMenu(SETTINGS_MENU, 'asset-menu')
    + `<div class="loading-blur"><img src="/baseq3/pak0.pk3dir/levelshots/q3dm0.jpg"></div>
    <a class="close-files" href="/build/${filename}${filename.length > 1 ? '/' : ''}">X</a>
    <div class="info-layout">
    <h2>Directory: /${filename}${filename.length > 1 ? '/' : ''}</h2>
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
  serveVersion,
  serveLive,
}

