const fs = require('fs')
const path = require('path')
const { streamFileKey, getIndex } = require('../utilities/zip.js')
const { findFile } = require('../assetServer/virtual.js')
const { layeredDir } = require('../assetServer/layered.js')


// TODO: would be cool if a virtual directory could span say: 
//   https://github.com/xonotic/xonotic-data.pk3dir
//   and build/convert from remote sources
async function serveVirtualPk3dir(filename) {
  let pk3File = filename.replace(/\.pk3.*/gi, '.pk3')
  if (!fs.existsSync(pk3File)) {
    if (pk3File.startsWith('/')) {
      pk3File = pk3File.substr(1)
    }
    pk3File = findFile(pk3File)
  }
  if (!fs.existsSync(pk3File)) {
    return []
  }
  let index = await getIndex(pk3File)
  let pk3InnerPath = filename.replace(/^.*?\.pk3[^\/]*?(\/|$)/gi, '')
  let directory = []
  for (let i = 0; i < index.length; i++) {
    let newPath = index[i].name.replace(/\\/ig, '/').replace(/\/$/, '')
    let currentPath = newPath.substr(0, pk3InnerPath.length)
    let relativePath = newPath.substr(pk3InnerPath.length + 1)
    let isSubdir = relativePath.indexOf('/')
    if ((pk3InnerPath.length <= 1
      || (currentPath.localeCompare(pk3InnerPath, 'en', { sensitivity: 'base' }) == 0)
      && relativePath.length && newPath[pk3InnerPath.length] == '/')
      // recursive directory inside pk3?
      && (isSubdir == -1 || isSubdir == relativePath.length - 1)
      && newPath.length > currentPath.length
    ) {
      directory.push(path.join(pk3File + 'dir', newPath))
    }
  }
  return directory
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

  let pk3File
  if(filename.match(/\.pk3/i)) {
    pk3File = findFile(filename.replace(/\.pk3.*/gi, '.pk3'))
  }
  let pk3InnerPath = filename.replace(/^.*?\.pk3[^\/]*?(\/|$)/gi, '')
  let directory = layeredDir(filename)
  // TODO: server a file from inside a pk3 to the pk3dirs
  // TODO: move to layeredDir()?
  if (pk3File) {
    if(await streamFileKey(pk3File, pk3InnerPath, response)) {
      return
    }
    let pk3directory = await serveVirtualPk3dir(filename)
    if (!directory) {
      directory = []
    }
    for (let i = 0; i < pk3directory.length; i++) {
      if (!directory.includes(pk3directory[i])) {
        directory.push(pk3directory[i])
      }
    }
  }


  for (let i = 0; i < directory.length; i++) {
    if (directory[i].match(/\.pk3$/i)) {
      if (!directory.includes(directory[i] + 'dir')) {
        directory.push(directory[i] + 'dir')
      }
    }
  }

  // duck out early
  if (!directory || directory.length == 0) {
    return next(new Error('Path not found: ' + filename))
  }

  directory.sort()

  // at least one directory exists
  if (isJson) {
    return response.json(directory)
  } else {
    return response.send('<ol>' + directory.map(node =>
      `<li><a href="/${filename}/${path.basename(node)
      }?alt">${node}</a></li>`).join('\n') + '</ol>')
  }
}

module.exports = {
  serveVirtualPk3dir,
  serveVirtual,
}

