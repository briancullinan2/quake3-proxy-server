// TODO: update stuff based on when file system changes
//   use node watcher
const path = require('path')
const fs = require('fs')
const { renderIndex, renderFeature, renderMenu } = require('../utilities/render.js')
const { buildDirectories } = require('../assetServer/virtual.js')

function serveLiveReal(request, response, next) {
  let isJson = request.url.match(/\?json/)
  let filename = request.url.replace(/\?.*$/, '')
  let pk3File = filename.replace(/\.pk3.*/gi, '.pk3')
  let newFile = findFile(filename)

  if (newFile && newFile.endsWith('.pk3')
    && pk3File.length < filename.length) {
    // probably meant to request a file inside the pk3, this script is just for updated
    // TODO: check directory times?
    return next()
  } else
    if (newFile && !fs.statSync(newFile).isDirectory()) {
      return response.sendFile(newFile)
    } else
      if (newFile && !isJson) {
        let indexFile = findFile(path.join(filename, 'index.html'))
        if (indexFile && indexFile.endsWith('.pk3')
          && pk3File.length < filename.length) {
          // let repackaging service handle it
          return next()
        } else
          if (indexFile && path.basename(indexFile).match(/index\.html/gi)) {
            // inject engine init

          } else
            if (indexFile) {
              return response.sendFile(indexFile)
            }
        return next() // TODO: VIRTUAL
        throw new Error('Directories not implemented')
      } else
        // cache busting for clients
        if (filename.includes('version.json')) {
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
  // TODO: send refresh signal over websocket/proxy
  //   in a POSIX similar way? This would be cool
  //   because then all remote clients will refresh
  //   and reconnect to existing game

  return next()
}



function serveLive(request, response, next) {
  let isIndex = request.url.match(/\?index/)
  let isJson = request.url.match(/\?json/)
  let filename = request.url.replace(/\?.*$/, '')
  if(filename.startsWith('/')) {
    filename = filename.substring(1)
  }
  if(filename.endsWith('/')) {
    filename = filename.substring(0, filename.length - 1)
  }
  let directory = []

  let BUILD_ORDER = buildDirectories()
  for (let i = 0; i < BUILD_ORDER.length; i++) {
    let newPath = path.join(BUILD_ORDER[i], filename)
    if (fs.existsSync(newPath) 
      && fs.statSync(newPath).isDirectory()) {
      let subdirectory =  fs.readdirSync(newPath)
      for(let s = 0; s < subdirectory.length; s++) {
        if(fs.statSync(path.join(newPath, subdirectory[s])).isDirectory()) {
          directory.push(subdirectory[s] + '/')
        } else {
          directory.push(subdirectory[s])
        }
      }
    }
  }
  let directoryFiltered = directory.sort()
      .filter((d, i, arr) => d && !d.startsWith('.') && arr.indexOf(d) == i)
  if(filename.length > 1) {
    directoryFiltered.unshift('../')
  }

  if (isIndex) {
    return response.send(renderIndex(
      `<div class="loading-blur"><img src="/baseq3/pak0.pk3dir/levelshots/q3dm0.jpg"></div>
    <div class="info-layout">
    <h2>Directory: /${filename}${filename.length > 1 ? '/' : ''}</h2>
    <ol class="directory-list">${directoryFiltered.map(node => {
      if(node.endsWith('/')) {
        return `<li><a href="/build/${filename}/${node}?index">${node}</a></li>`
      } else {
        return `<li><a href="/build/${filename}/${node}?alt">${node}</a></li>`
      }
    }).join('\n')}
    </ol>
    </div>
    `))
  } else {
    //return '<ol>' + response.send(directory.map(node =>
    //  `<li><a href="/${node}?alt">${node}</a></li>`).join('\n'))
    //  + '</ol>'
  }
}

module.exports = {

  serveLive,
}

