// TODO: update stuff based on when file system changes
//   use node watcher
const path = require('path')
const fs = require('fs')
const { renderIndex, renderFeature, renderMenu } = require('../utilities/render.js')
const { buildDirectories } = require('../assetServer/virtual.js')

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
          link: `/build/${filename}${filename.length > 1 ? '/' : ''}${subdirectory[s]}?index`,
          absolute: path.join(path.basename(path.dirname(newPath)), path.basename(newPath), subdirectory[s]),
          mtime: stat.mtime || stat.ctime,
        })
        lowercasePaths.push((subdirectory[s] + '/').toLocaleLowerCase())
      } else {
        directory.push({
          name: subdirectory[s],
          size: stat.size,
          link: `/build/${filename}${filename.length > 1 ? '/' : ''}${subdirectory[s]}?alt`,
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
    return a.name.localeCompare(b.name, 'en', {sensitivity: 'base'})
  })
  return directoryFiltered
}


function renderFilelist(node) {
  let result = '<li>'
  result += `<a href="${node.link}">${node.name}</a>`
  if(node.name.endsWith('/')) {
    result += `<span>&nbsp;</span>`
  } else {
    result += `<span>${formatSize(node.size)}</span>`
  }
  result += `<span>${node.mtime.getMonth() + 1}/${node.mtime.getDay()} `
  result += `${node.mtime.getHours()}:${node.mtime.getMinutes()}</span>`
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


  if (isIndex) {
    if(filename.length > 1) {
      directoryFiltered.unshift({
        name: '../',
        link: `/build/${path.dirname(filename)}?index`,
        mtime: new Date(),
        absolute: ''
      })
    }
    return response.send(renderIndex(
    `<div class="loading-blur"><img src="/baseq3/pak0.pk3dir/levelshots/q3dm0.jpg"></div>
    <a class="close-files" href="/build/${filename}${filename.length > 1 ? '/' : ''}">X</a>
    <div class="info-layout">
    <h2>Directory: /${filename}${filename.length > 1 ? '/' : ''}</h2>
    <ol class="directory-list">${directoryFiltered.map(renderFilelist).join('\n')}
    </ol>
    </div>
    `))
  } else {
    return response.send('<ol>' + directoryFiltered.map(node =>
    `<li><a href="/${node}?alt">${node}</a></li>`).join('\n')
    + '</ol>')
  }
}

module.exports = {

  serveLive,
}

