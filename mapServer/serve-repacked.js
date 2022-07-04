const path = require('path')
const fs = require('fs')

const { findFile, gameDirectories } = require('../assetServer/virtual.js')
const { repackedCache, getGames } = require('../utilities/env.js')
const { layeredDir } = require('../assetServer/layered.js')
const { listGames } = require('../contentServer/serve-settings.js')
const { renderDirectoryIndex } = require('../contentServer/serve-live.js')


async function listCached(filename) {
  let directory = []
  let lowercasePaths = []
  let CACHE_ORDER = repackedCache()
  let GAME_MODS = getGames()
  if(filename.startsWith('/')) {
    filename = filename.substring(1)
  }
  //let modname = filename.split('/')[0]

  for(let i = 0; i < CACHE_ORDER.length; i++) {

    //if(GAME_ORDER.length == 0) {
    //  continue
    //}
    let stat = fs.statSync(CACHE_ORDER[0])
    directory.push({
      name: GAME_MODS[i] + '/',
      link: `/repacked/${GAME_MODS[i]}/`,
      absolute: path.join(path.basename(path.dirname(CACHE_ORDER[0])), path.basename(CACHE_ORDER[0]), GAME_MODS[i]),
      mtime: stat.mtime || stat.ctime,
    })
    lowercasePaths.push((GAME_MODS[i] + '/').toLocaleLowerCase())
  }

  let directoryFiltered = directory
    .filter((d, i) => d.name && !d.name.startsWith('.') 
      && lowercasePaths.indexOf(d.name.toLocaleLowerCase()) == i)
  directoryFiltered.sort(function (a, b) {
    return b.mtime - a.mtime // a.name.localeCompare(b.name, 'en', {sensitivity: 'base'})
  })
  return directoryFiltered
}

async function serveRepacked(request, response, next) {
  let isIndex = request.url.match(/\?index/)
  let isAlt = !!request.url.match(/\?alt/)
  let filename = request.url.replace(/\?.*$/, '')
  if(filename.startsWith('/')) {
    filename = filename.substr(1)
  }
  if(filename.endsWith('/')) {
    filename = filename.substring(0, filename.length - 1)
  }
  let modname = filename.split('/')[0]
  if(!modname || modname.length == 0) {
    let allGames = listGames()
    return await renderDirectoryIndex(filename, allGames, false, isIndex, response)
  } else {
    filename = filename.substring(modname.length + 1)
  }

  let GAME_ORDER = gameDirectories(modname)
  if(!GAME_ORDER.length) {
    return next(new Error('Not in repack: ' + modname))
  }

  let pk3File = path.basename(filename.replace(/\.pk3.*/gi, '.pk3'))
  let pk3InnerPath = filename.replace(/^.*?\.pk3[^\/]*?(\/|$)/gi, '')
  let pk3Names = (await layeredDir(modname)).filter(dir => dir.match(/\.pk3/i))
  if(pk3File.length == 0) {
    return await renderDirectoryIndex(modname, pk3Names.map(pk3 => {
      let pk3Name = path.basename(pk3).replace(path.extname(pk3), '.pk3')
      let newFile = findFile(pk3)
      let stat
      if(newFile) {
        stat = fs.statSync(newFile)
      }
      return {
        name: pk3Name + 'dir/',
        link: `/repacked/${pk3}dir/`,
        absolute: newFile || ('repacked/' + pk3 + '/.'),
        mtime: stat ? (stat.mtime || stat.ctime) : void 0,
      }
    }), true, isIndex, response)
  }

  if(!pk3Names.length || !pk3File.match(/\.pk3/i)
      // pk3 not found so pk3dir wont exist either
      || (pk3File != 'pak0.pk3' && !pk3Names.includes(pk3File))
  ) {
    return next(new Error('Not in pk3s: ' + pk3File))
  }

  console.log(pk3InnerPath)
  if(pk3InnerPath.length == 0) {
    let directory = (await listCached(pk3File))
    return await renderDirectoryIndex(filename, directory, true, isIndex, response)
  }
  

  // TODO: CODE REVIEW, reduce cascading curlys event though code
  //   is redundant there's still less complexity overall
  return next(new Error('Not in repack: ' + filename))

  let newFile = findFile(filename)
  if (newFile && newFile.match(/\.pk3$/i)) {
    // serve unsupported images with ?alt in URL
    if (await streamFileKey(newFile, pk3InnerPath, response)) {
      return
    }
  } else
  if (newFile && newFile.includes('.pk3dir\/')) {
    return response.sendFile(newFile)
  }
}

module.exports = {
  serveRepacked,
}