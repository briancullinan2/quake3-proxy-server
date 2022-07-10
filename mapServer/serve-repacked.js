const path = require('path')
const fs = require('fs')

const { findFile, gameDirectories } = require('../assetServer/virtual.js')
const { SUPPORTED_FORMATS, IMAGE_FORMATS, AUDIO_FORMATS,
  repackedCache, getGames
} = require('../utilities/env.js')
const { layeredDir } = require('../assetServer/layered.js')
const { ASSET_MENU } = require('../contentServer/serve-settings.js')
const { calculateSize } = require('../utilities/watch.js')
const { EXISTING_ZIPS, fileKey, getIndex,
  streamFileKey, filteredDirectory } = require('../utilities/zip.js')
const { renderIndex, renderMenu } = require('../utilities/render.js')
const { convertCmd } = require('../cmdServer/cmd-convert.js')
const { opaqueCmd } = require('../cmdServer/cmd-identify.js')
const { listPk3s } = require('../assetServer/layered.js')
const { renderDirectory } = require('../contentServer/serve-live.js')


const REPACKED_DESCRIPTION = `
<h2>Repacked Explaination:</h2>
<p>Repacked Cache only shows 1) image/audio assets exists in a .pk3 file or .pk3dir, 2) files that have been converted and cached on disk. It doesn't show a complete list of files, for that you should see the Virtual FS. Repacked should show a complete list of files that will go into the final output .pk3 files.</p>
`


// TODO: replace listGames()
async function filteredGames(isIndex, response) {
  let allGames = getGames().map(game => ({
    isDirectory: true,
    name: game,
    absolute: '(virtual)/.',
    exists: true,
    link: path.join('/repacked', game) + '/',
  })).map(game => [game].concat(gameDirectories(game.name)
    .map(gameDir => Object.assign(fs.statSync(gameDir), {
      isDirectory: true,
      name: path.basename(path.dirname(gameDir)) + '/' + path.basename(gameDir),
      absolute: path.dirname(gameDir),
      exists: false,
      link: path.join('/repacked', game.name) + '/'
    }))))
    .flat(1)
  return allGames
}



async function filteredPk3Directory(pk3InnerPath, newFile, modname) {
  let pk3Dir = newFile.replace(path.extname(newFile), '.pk3dir')
  let result = await filteredDirectory(pk3InnerPath, newFile)
  let zeroTimer = new Promise(resolve => setTimeout(
      resolve.bind(null, '0B (Calculating)'), 200))
  let CACHE_ORDER = repackedCache()
  
  let supported = result.filter(file => file.isDirectory
    || SUPPORTED_FORMATS.includes(path.extname(file.name))
    || IMAGE_FORMATS.includes(path.extname(file.name))
    || AUDIO_FORMATS.includes(path.extname(file.name))
  ).map(file => {
    let localPath 
    let exists = false
    for(let i = 0; i < CACHE_ORDER.length; i++) {
      // TODO: is pak0.pk3?
      localPath = path.join(CACHE_ORDER[i], path.basename(pk3Dir), pk3InnerPath, file.name)
      //let localPath = path.join(CACHE_ORDER[i], pk3InnerPath, file.name)
      if(fs.existsSync(localPath)) {
        exists = true
        break
      } else {
        localPath = null
      }
    }
    if(!localPath) {
      exists = !!findFile(path.join(pk3InnerPath, file.name))
      localPath = newFile
    }
    return Object.assign({}, file, {
      // TODO: repackedCache() absolute path
      isDirectory: true,
      name: path.basename(file.name),
      exists: exists,
      link: path.join('/repacked', modname, path.basename(pk3Dir),
          file.name) + (file.isDirectory ? '/' : ''),
      absolute: path.basename(path.dirname(path.dirname(localPath))) 
          + '/' + path.basename(path.dirname(localPath)) + '/.',
    })
  })

  //if(result.length != supported.length) {
  let excluded = (result.length - supported.length)
  supported.push({
    name: excluded + ' file' + (excluded > 1 ? 's' : '') + ' excluded.',
    exists: false,
    link: path.join('/' + modname, path.basename(pk3Dir), pk3InnerPath) + '/',
  })
  //}
  return supported
  /* await Promise.all(result.map(async dir => ({
    name: path.basename(dir),
    absolute: dir,
    size: await Promise.any([ calculateSize(GAME_ORDER[i]), zeroTimer ])
  })))*/
}


async function filteredPk3List(modname, pk3Names) {
  let CACHE_ORDER = repackedCache()
  let directory = pk3Names.reduce((list, pk3) => {
    let pk3Name = path.basename(pk3).replace(path.extname(pk3), '.pk3')
    let newFile
    for(let i = 0; i < CACHE_ORDER.length; i++) {
      let localFile = path.join(CACHE_ORDER[i], pk3Name + 'dir')
      if(fs.existsSync(localFile)) {
        newFile = localFile
      }
    }
    if(!newFile) {
      newFile = findFile(modname + '/' + pk3Name)
    }
    if(!newFile) {
      newFile = findFile(modname + '/' + pk3Name + 'dir')
    }
    if(newFile) {
      list.push(newFile)
    }
    return list
  }, []).map(newFile => {
    let pk3Name = newFile.replace(path.extname(newFile), '.pk3')
    let pk3Dir = newFile.replace(path.extname(newFile), '.pk3dir')
    let loaded = typeof EXISTING_ZIPS[pk3Name] != 'undefined'
    return Object.assign(fs.statSync(newFile), {
      exists: loaded || fs.existsSync(pk3Dir),
      name: path.basename(pk3Dir),
      absolute: (loaded ? '(in memory) ' : '')
          + path.basename(path.dirname(path.dirname(pk3Dir)))
          + '/' + path.basename(path.dirname(pk3Dir)) + '/.',
      isDirectory: true,
      link: path.join('/repacked', modname, path.basename(pk3Dir)) + '/'
    })
  })
  return directory
}


async function serveRepacked(request, response, next) {
  let isIndex = request.url.match(/\?index/)
  let isAlt = !!request.url.match(/\?alt/)
  let filename = request.url.replace(/\?.*$/, '')
  if (filename.startsWith('/')) {
    filename = filename.substr(1)
  }
  if (filename.endsWith('/')) {
    filename = filename.substring(0, filename.length - 1)
  }
  let modname = filename.split('/')[0]

  if (!modname || modname.length == 0) {
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
  if (!GAME_ORDER.length) {
    return next(new Error('Not in repack: ' + modname))
  }


  let pk3File = path.basename(filename.replace(/\.pk3.*/gi, '.pk3'))
  let pk3InnerPath = filename.replace(/^.*?\.pk3[^\/]*?(\/|$)/gi, '')

  let pk3Names = await listPk3s(modname)
  if (pk3File.length == 0) {
    let directory = await filteredPk3List(modname, pk3Names)
    return response.send(renderIndex(`
    ${renderMenu(ASSET_MENU, 'asset-menu')}
    <div class="info-layout">
      ${await renderDirectory(path.join('repacked', modname), directory, !isIndex)}
    </div>`))
  }

  if (!pk3File.match(/\.pk3/i)
    // pk3 not found so pk3dir wont exist either
    || (pk3File != 'pak0.pk3' && !pk3Names.includes(pk3File))
  ) {
    return next(new Error('Not in pk3s: ' + pk3File))
  }

  let newFile = findFile(modname + '/' + pk3File)

  if (isAlt
    && !path.extname(pk3InnerPath).match(/\.png$|\.jpg$|\.jpeg$/i)) {
    // try to find file by any extension, then convert
    let isOpaque = await opaqueCmd(newFile, pk3InnerPath)
    response.setHeader('content-type', 'image/' + (isOpaque ? 'png' : 'jpg'))
    convertCmd(newFile, pk3InnerPath, void 0, response, isOpaque ? '.jpg' : '.png')
    return
  }

  if (!isIndex && await streamFileKey(newFile, pk3InnerPath, response)) {
    return
  }

  if (!isIndex && !newFile) {
    return next()
  }

  if (newFile && await fileKey(newFile, pk3InnerPath, response)) {
    return response.send(await renderImages(pk3InnerPath, newFile, modname))
  }


  // TODO: combine these paths, extracted / cached with pk3InnerPath list
  let directory = []
  if (newFile) {
    directory = await filteredPk3Directory(pk3InnerPath, newFile, modname)
  }


  return response.send(renderIndex(`
  ${renderMenu(ASSET_MENU, 'asset-menu')}
  <div class="info-layout">
    ${await renderDirectory(path.join('repacked', modname,
    pk3File + 'dir', pk3InnerPath), directory, !isIndex)}
  </div>`))
}


async function renderImages(pk3InnerPath, pk3File, modname) {
  let directory = await filteredPk3Directory(path.dirname(pk3InnerPath), pk3File, modname)
  let directoryFiltered = directory.filter(img => IMAGE_FORMATS.includes(path.extname(img.name)))
  let imgIndex = directoryFiltered.map(img => path.basename(img.link))
    .indexOf(path.basename(pk3InnerPath))
  // TODO: render image scroller view like Apple album shuffle
  let index = renderIndex(`
  <div class="loading-blur"><img src="/baseq3/pak0.pk3dir/levelshots/q3dm0.jpg" /></div>
  <div id="album-view">
  <h2>Images: 
  <a href="/repacked/${modname}/${pk3File}dir/${path.dirname(pk3InnerPath).includes('/')
      ? path.dirname(path.dirname(pk3InnerPath)) : path.dirname(pk3InnerPath)}/?index">
  ..</a>
  /
  <a href="/repacked/${modname}/${pk3File}dir/${pk3InnerPath.includes('/')
      ? (path.dirname(pk3InnerPath) + '/') : ''}?index">
  ${path.basename(path.dirname(path.join(pk3File, pk3InnerPath)))}</a>
  /
  ${path.basename(pk3InnerPath)}</h2>
  <ol>
  <li class="album-prev"><a href="${directoryFiltered[imgIndex <= 0
      ? directoryFiltered.length - 1 : imgIndex - 1].link}?index">&nbsp;</a></li>
  <li class="album-next"><a href="${directoryFiltered[imgIndex >= directoryFiltered.length - 1
      ? 0 : imgIndex + 1].link}?index">&nbsp;</a></li>

  ${directoryFiltered.map((img, i, arr) => {
        let order = ''
        if (i == imgIndex) {
          order = 'class="middle"'
        } else
          if (i + 2 == imgIndex) {
            order = 'class="left2"'
          } else
            if (i + 1 == imgIndex) {
              order = 'class="left"'
            } else
              if (i - 1 == imgIndex) {
                order = 'class="right"'
              }
        if (i - 2 == imgIndex) {
          order = 'class="right2"'
        }
        return `<li ${order}>
      <a style="background-image:url('${img.link}?alt')" href="${img.link}?index">
        <img src="${img.link}?alt" /></a></li>`
      }).join('\n')}
  </ol>
  </div>`)
  return index

}



module.exports = {
  serveRepacked,
}