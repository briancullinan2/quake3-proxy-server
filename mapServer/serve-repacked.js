const path = require('path')
const fs = require('fs')

const { findFile, gameDirectories } = require('../assetServer/virtual.js')
const { repackedCache, getGames } = require('../utilities/env.js')
const { layeredDir } = require('../assetServer/layered.js')
const { ASSET_MENU } = require('../contentServer/serve-settings.js')
const { calculateSize } = require('../utilities/watch.js')
const { fileKey, getIndex, streamFileKey, filteredDirectory } = require('../utilities/zip.js')
const { renderIndex, renderMenu } = require('../utilities/render.js')
const { convertCmd } = require('../cmdServer/cmd-convert.js')
const { opaqueCmd } = require('../cmdServer/cmd-identify.js')
const { listPk3s } = require('../assetServer/layered.js')
const { renderDirectory } = require('../contentServer/serve-live.js')


const REPACKED_DESCRIPTION = `
<h2>Repacked Explaination:</h2>
<p>Repacked Cache only shows 1) image/audio assets exists in a .pk3 file or .pk3dir, 2) files that have been converted and cached on disk. It doesn't show a complete list of files, for that you should see the Virtual FS.</p>
`


async function filteredGames(isIndex, response) {
  let allGames = getGames().map(game => ({
    isDirectory: true,
    exists: true,
    name: game,
    absolute: '(virtual)/.',
  })).map(game => [game].concat(gameDirectories(game.name)
  .map(gameDir => Object.assign({
    name: path.basename(path.dirname(gameDir)) + '/' + path.basename(gameDir),
    absolute: path.dirname(gameDir),
    exists: false,
  }, fs.statSync(gameDir)))))
  .flat(1)
  return allGames
}


async function formattedPk3List(isIndex, response) {
  let directory = pk3Names.reduce((list, pk3) => {
    let pk3Name = path.basename(pk3).replace(path.extname(pk3), '.pk3')
    let newFile = findFile(modname + '/' + pk3Name)
    if(!newFile) {
      newFile = findFile(modname + '/' + pk3Name + 'dir')
    }
    let stat
    if(newFile) {
      stat = fs.statSync(newFile)
    }
    stat.absolute = newFile
    list.push(stat)
    return list
  }, [])
  return await renderDirectoryIndex(path.join('repacked', modname), 
      directory, true, isIndex, response)
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
    let allGames = await filteredGames(isIndex, response)
    return response.send(renderIndex(`
    ${renderMenu(ASSET_MENU, 'asset-menu')}
    <div class="info-layout">${REPACKED_DESCRIPTION}
      ${await renderDirectory('repacked (virtual)', allGames, !isIndex)}
    </div>`))
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
    return formattedPk3List(isIndex, response)
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
    renderImages()
  }


  // TODO: combine these paths, extracted / cached with pk3InnerPath list
  if(newFile) {
    let index = await filteredDirectory(pk3InnerPath, newFile)
    return await renderDirectoryIndex(path.join('repacked', modname, filename), 
        index, true, isIndex, response)
  }


  //let CACHE_ORDER = repackedCache()
  //directoryFiltered.sort(function (a, b) {
  //  return b.mtime - a.mtime // a.name.localeCompare(b.name, 'en', {sensitivity: 'base'})
  //})

  //let directory = (await listCached(modname, pk3File, pk3InnerPath))
  return await renderDirectoryIndex(path.join('repacked', modname, filename), 
      directory, true, isIndex, response)

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