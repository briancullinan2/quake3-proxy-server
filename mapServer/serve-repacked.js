const path = require('path')
const fs = require('fs')

const { findFile, gameDirectories } = require('../assetServer/virtual.js')
const { repackedCache, getGames } = require('../utilities/env.js')
const { layeredDir } = require('../assetServer/layered.js')
const { listGames } = require('../contentServer/serve-settings.js')
const { renderDirectoryIndex } = require('../contentServer/serve-live.js')
const { calculateSize } = require('../utilities/watch.js')
const { fileKey, getIndex, streamFileKey } = require('../utilities/zip.js')
const { renderIndex } = require('../utilities/render.js')
const { convertCmd } = require('../cmdServer/cmd-convert.js')
const { opaqueCmd } = require('../cmdServer/cmd-identify.js')



async function filteredIndex(pk3InnerPath, pk3File) {
  let directory = []
  let compareNames = []
  // TODO: refactor all of this to 1) remove directories in the first pass, 
  //   2) add all decendents no matter sub directories
  //   3) add connecting subdirectories back in for all decendents
  //   4) filter out decendents and only show current directory
  let index = await getIndex(pk3File)
  for (let i = 0; i < index.length; i++) {
    let newPath = index[i].name.replace(/\\/ig, '/').replace(/\/$/, '')
    let currentPath = newPath.substr(0, pk3InnerPath.length)
    let relativePath = newPath.substr(pk3InnerPath.length + (pk3InnerPath.length > 0 ? 1 : 0))
    if(index[i].isDirectory) {
      continue
    }
    if (pk3InnerPath.length <= 1 && relativePath.length 
      || (currentPath.localeCompare(pk3InnerPath, 'en', { sensitivity: 'base' }) == 0
      && newPath[pk3InnerPath.length] == '/')
    ) {
      compareNames.push(index[i].name.toLocaleLowerCase())
      directory.push(index[i])
    }
  }

  // TODO: zip files sometimes miss directory creation to add a virtual
  //   directory if any file descendents exist for this path
  let skip = pk3InnerPath.split('/').length
  for (let i = 0; i < directory.length; i++) {
    let subdirs = directory[i].name.split('/')
    for(let j = skip; j < subdirs.length; j++) {
      let currentPath = subdirs.slice(0, j).join('/')
      if(compareNames.includes(currentPath.toLocaleLowerCase())) {
        continue
      }
      compareNames.push(currentPath.toLocaleLowerCase())
      directory.push({
        isVirtual: true,
        isDirectory: true,
        name: currentPath,
        time: new Date(),
        size: void 0,
      })
    }
  }

  return directory
}


async function filteredDirectory(pk3InnerPath, pk3File) {
  let directory = []
  let index = await filteredIndex(pk3InnerPath, pk3File)
  for (let i = 0; i < index.length; i++) {
    // recursive directory inside pk3?
    let relativePath = index[i].name.substr(pk3InnerPath.length
        + (pk3InnerPath.length > 0 ? 1 : 0))
    let isSubdir = relativePath.indexOf('/')
    if((isSubdir == -1 || isSubdir == relativePath.length - 1)
      // don't include ./ current directory
      && index[i].name.length > pk3InnerPath.length
    ) {
      directory.push(index[i])
    }
  }
  return directory
}


async function listPk3s(modname) {
  return (await layeredDir(modname, true))
  .filter(dir => dir.match(/\.pk3/i))
  // build directories are include here in repacked because
  //   it is showing what will become, but in "Virtual" mode
  //   only what is currently built is listed with all of the
  //   alternative overrides.
  .map(pk3 => path.basename(pk3).replace(path.extname(pk3), '.pk3'))
  // always included for repack 
  //   because this is how baseq3a is built
  .concat(['pak0.pk3'])
}


async function listCached(modname, filename, pk3InnerPath) {
  let directory = []
  let lowercasePaths = []
  let CACHE_ORDER = repackedCache()
  let GAME_MODS = getGames()
  if(filename.startsWith('/')) {
    filename = filename.substring(1)
  }

  
  // TODO: add base directory conversions
  for(let i = 0; i < CACHE_ORDER.length; i++) {
    let newDir = path.join(CACHE_ORDER[i], 
        /* modname + '-converted', */
        filename + 'dir', pk3InnerPath)
    if(!fs.existsSync(newDir)) {
      continue
    }
    if(! fs.statSync(newDir).isDirectory())  {
      continue
    }
    let subdirectory = fs.readdirSync(newDir)
    for(let j = 0; j < subdirectory.length; j++) {
      let stat = fs.statSync(path.join(newDir, subdirectory[j]))
      directory.push({
        name: subdirectory[j] + (stat.isDirectory() ? '/' : ''),
        link: `/repacked/${modname}/${filename}dir/${subdirectory[j]}${stat.isDirectory() ? '/' : ''}`,
        absolute: path.join(path.basename(path.dirname(CACHE_ORDER[i])), path.basename(CACHE_ORDER[i])) + '/.',
        mtime: stat.mtime || stat.ctime,
        size: await Promise.any([
          calculateSize(path.join(newDir, subdirectory[j])),
          new Promise(resolve => setTimeout(resolve.bind(null, '0B (Calculating)'), 200))]),
        exists: true,
      })
      lowercasePaths.push((subdirectory[j] + (stat.isDirectory() ? '/' : '')).toLocaleLowerCase())
    }
  }

  // TODO: list directories and files inside of pk3s available for repackaging



  let directoryFiltered = (await Promise.all(directory))
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
    let dir = ''
    let allGames = (await listGames()).reduce((list, g) => {
      if(dir != g.link) {
        dir = g.link
        list.push(Object.assign({}, g))
        list[list.length - 1].exists = true
        list[list.length - 1].name = path.basename(g.link) + '/'
        list[list.length - 1].absolute = '(virtual)/.'
      }
      g.exists = false 
      list.push(g)
      return list
    }, [])
    return await renderDirectoryIndex('repacked (virtual)', allGames, `
    <h2>Repacked Explaination:</h2>
    <p>Repacked Cache only shows 1) image/audio assets exists in a .pk3 file or .pk3dir, 2) files that have been converted and cached on disk. It doesn't show a complete list of files, for that you should see the Virtual FS.</p>
    `, isIndex, response)
  } else {
    filename = filename.substring(modname.length + 1)
  }

  let GAME_ORDER = gameDirectories(modname)
  if(!GAME_ORDER.length) {
    return next(new Error('Not in repack: ' + modname))
  }

  
  let pk3File = path.basename(filename.replace(/\.pk3.*/gi, '.pk3'))
  let pk3InnerPath = filename.replace(/^.*?\.pk3[^\/]*?(\/|$)/gi, '')
  let pk3Names = await listPk3s(modname)

  if(pk3File.length == 0) {
    return await renderDirectoryIndex(path.join('repacked', modname), pk3Names.map(pk3 => {
      let pk3Name = path.basename(pk3).replace(path.extname(pk3), '.pk3')
      let newFile = findFile(modname + '/' + pk3Name)
      if(!newFile) {
        newFile = findFile(modname + '/' + pk3Name + 'dir')
      }
      let stat
      if(newFile) {
        stat = fs.statSync(newFile)
      }
      return {
        name: (!newFile && pk3Name == 'pak0.pk3' ? '(virtual) ' : '') + pk3Name + 'dir/',
        link: `/repacked/${modname}/${pk3}dir/`,
        absolute: newFile || '',
        exists: !!newFile,
        size: stat ? stat.size : void 0,
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

  let newFile = findFile(modname + '/' + pk3File)

  if(isAlt
    && !path.extname(pk3InnerPath).match(/\.png$|\.jpg$|\.jpeg$/i)) {
    // try to find file by any extension, then convert
    let isOpaque = await opaqueCmd(newFile, pk3InnerPath)
    response.setHeader('content-type', 'image/' + (isOpaque ? 'png' : 'jpg'));
    convertCmd(newFile, pk3InnerPath, void 0, response, isOpaque ? '.jpg' : '.png')
    return
  }

  if (!isIndex && await streamFileKey(newFile, pk3InnerPath, response)) {
    return
  }

  if(!isIndex && !newFile) {
    return next()
  }


  if(newFile && await fileKey(newFile, pk3InnerPath, response)) {
    
  }

  if(newFile) {
    let index = await filteredDirectory(pk3InnerPath, newFile)
    return await renderDirectoryIndex(path.join('repacked', modname, filename), index, true, isIndex, response)
  }

  let directory = (await listCached(modname, pk3File, pk3InnerPath))
  return await renderDirectoryIndex(path.join('repacked', modname, filename), directory, true, isIndex, response)

}


async function renderImages() {
  let directory = (await listCached(modname, pk3File, path.dirname(pk3InnerPath)))
  let imgIndex = directory
      .map(img => path.basename(img.link))
      .indexOf(path.basename(pk3InnerPath))
  // TODO: render image scroller view like Apple album shuffle
  let index = renderIndex(`
  <div class="loading-blur"><img src="/baseq3/pak0.pk3dir/levelshots/q3dm0.jpg" /></div>
  <div id="album-view">
  <h2>Images: 
  <a href="/repacked/${modname}/${pk3File}dir/${path.dirname(pk3InnerPath).includes('/') ? path.dirname(path.dirname(pk3InnerPath)) : path.dirname(pk3InnerPath)}/?index">
  ..</a>
  /
  <a href="/repacked/${modname}/${pk3File}dir/${pk3InnerPath.includes('/') ? (path.dirname(pk3InnerPath) + '/') : ''}?index">
  ${path.basename(path.dirname(path.join(newFile, pk3InnerPath)))}</a>
  /
  ${path.basename(pk3InnerPath)}</h2>
  <ol>
  <li class="album-prev"><a href="${directory[imgIndex <= 0 ? directory.length - 1 : imgIndex-1].link}?index">&nbsp;</a></li>
  <li class="album-next"><a href="${directory[imgIndex >= directory.length - 1 ? 0 : imgIndex+1].link}?index">&nbsp;</a></li>

  ${directory.map((img, i, arr) => {
    let order = ''
    if(i == imgIndex) {
      order = 'class="middle"'
    } else 
    if(i + 2 == imgIndex) {
      order = 'class="left2"'
    } else
    if(i + 1 == imgIndex) {
      order = 'class="left"'
    } else
    if(i - 1 == imgIndex) {
      order = 'class="right"'
    }
    if(i - 2 == imgIndex) {
      order = 'class="right2"'
    }
    return `<li ${order}>
      <a style="background-image:url('${img.link}?alt')" href="${img.link}?index">
        <img src="${img.link}?alt" /></a></li>`
  }).join('\n')}
  </ol>
  </div>`)
  return response.send(index)

}



module.exports = {
  serveRepacked,
}