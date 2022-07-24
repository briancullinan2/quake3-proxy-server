
const path = require('path')
const { PassThrough, Readable } = require('stream')

const { findFile, gameDirectories } = require('../assetServer/virtual.js')
const { IMAGE_FORMATS, AUDIO_FORMATS } = require('../utilities/env.js')
const { ASSET_FEATURES } = require('../contentServer/serve-settings.js')
const { fileKey, streamFileKey } = require('../utilities/zip.js')
const { renderIndex, renderMenu } = require('../utilities/render.js')
const { CONVERTED_IMAGES, convertCmd } = require('../cmdServer/cmd-convert.js')
const { opaqueCmd } = require('../cmdServer/cmd-identify.js')
const { listPk3s } = require('../assetServer/layered.js')
const { renderDirectory } = require('../contentServer/serve-live.js')
const { filteredGames, filteredPk3Directory, filteredPk3List } = require('../mapServer/list-filtered.js')
const { CONVERTED_SOUNDS, encodeCmd } = require('../cmdServer/cmd-encode.js')


const REPACKED_DESCRIPTION = `
<h2>Repacked Explaination:</h2>
<p>Repacked Cache only shows 1) image/audio assets exists in a .pk3 file or .pk3dir, 2) files that have been converted and cached on disk. It doesn't show a complete list of files, for that you should see the Virtual FS. Repacked should show a complete list of files that will go into the final output .pk3 files.</p>
`


async function redirectToVirtual(hasExcluded, pk3InnerPath, pk3Dir, modname) {
  if (hasExcluded) {
    return ({
      name: excluded + ' file' + (excluded > 1 ? 's' : '') + ' excluded.',
      exists: false,
      link: path.join('/' + modname, path.basename(pk3Dir), pk3InnerPath) + '/',
    })
  } else {
    return ({
      name: 'View in virtual directory.',
      exists: false,
      link: path.join('/' + modname, path.basename(pk3Dir), pk3InnerPath) + '/',
    })
  }
}

async function filterRepacked(pk3InnerPath, newFile, modname) {
  let directory = await filteredPk3Directory(pk3InnerPath, newFile, modname)
  let supported = directory.filter(file => file.isDirectory
    || IMAGE_FORMATS.includes(path.extname(file.name))
    || AUDIO_FORMATS.includes(path.extname(file.name))
  ).map(file => Object.assign(file, {
    link: path.join('/repacked', modname, path.basename(newFile).replace(path.extname(newFile), '.pk3dir'),
    pk3InnerPath, file.name) + (file.isDirectory ? '/' : ''),
    isDirectory: true,
  }))
  supported.push(await redirectToVirtual(supported.length < directory, pk3InnerPath, newFile, modname))
  return supported
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
    let allGames = await filteredGames()
    return response.send(renderIndex(`
    ${renderMenu(ASSET_FEATURES, 'asset-menu')}
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
    ${renderMenu(ASSET_FEATURES, 'asset-menu')}
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
  // TODO: replace with streamAudioKey and findAlt()
  if (isAlt && IMAGE_FORMATS.includes(path.extname(pk3InnerPath))
    && !path.extname(pk3InnerPath).match(/\.png$|\.jpg$|\.jpeg$/i)) {
    let strippedPath = path.join(newFile, pk3InnerPath).replace(path.extname(pk3InnerPath, ''))
    // try to find file by any extension, then convert
    if(typeof CONVERTED_IMAGES[strippedPath + '.jpg'] != 'undefined') {
      response.setHeader('content-type', 'image/jpg')
      return response.send(CONVERTED_IMAGES[strippedPath + '.jpg'])
    } else
    if(typeof CONVERTED_IMAGES[strippedPath + '.png'] != 'undefined') {
      response.setHeader('content-type', 'image/png')
      return response.send(CONVERTED_IMAGES[strippedPath + '.png'])
    }
    let isOpaque = await opaqueCmd(newFile, pk3InnerPath)
    let newExt = isOpaque ? '.png' : '.jpg'
    response.setHeader('content-type', 'image/' + newExt.substring(1))
    const passThrough = new PassThrough()
    const readable = Readable.from(passThrough)
    // force async so other threads can answer page requests during conversion
    Promise.resolve(new Promise(resolve => {
      let chunks = []
      readable.on('data', chunks.push.bind(chunks))
      readable.on('end', resolve.bind(null, chunks))
      passThrough.pipe(response)
      convertCmd(newFile, pk3InnerPath, void 0, passThrough, newExt)
    }).then(convertedFile => {
      CONVERTED_IMAGES[path.join(newFile, pk3InnerPath)] = 
      CONVERTED_IMAGES[strippedPath + newExt] = Buffer.concat(convertedFile)
    }))
    return
  }

  // TODO: replace with streamAudioKey and findAlt()
  if (isAlt && AUDIO_FORMATS.includes(path.extname(pk3InnerPath))
    && !path.extname(pk3InnerPath).match(/\.ogg$/i)) {
    let strippedPath = path.join(newFile, pk3InnerPath).replace(path.extname(pk3InnerPath, ''))
    if(typeof CONVERTED_SOUNDS[strippedPath + '.ogg'] != 'undefined') {
      response.setHeader('content-type', 'audio/ogg')
      return response.send(CONVERTED_SOUNDS[strippedPath + '.ogg'])
    }
    response.setHeader('content-type', 'audio/ogg')
    const passThrough = new PassThrough()
    const readable = Readable.from(passThrough)
    // force async so other threads can answer page requests during conversion
    Promise.resolve(new Promise(resolve => {
      let chunks = []
      readable.on('data', chunks.push.bind(chunks))
      readable.on('end', resolve.bind(null, chunks))
      passThrough.pipe(response)
      encodeCmd(newFile, pk3InnerPath, void 0, passThrough, false)
    }).then(convertedFile => {
      CONVERTED_SOUNDS[path.join(newFile, pk3InnerPath)] = 
      CONVERTED_SOUNDS[strippedPath + '.ogg'] = Buffer.concat(convertedFile)
    }))
    return
  }

  if (!isIndex && await streamFileKey(newFile, pk3InnerPath, response)) {
    return
  }

  if (!isIndex && !newFile) {
    return next()
  }

  if (newFile && await fileKey(newFile, pk3InnerPath, response)) {
    let isImage = IMAGE_FORMATS.includes(path.extname(pk3InnerPath))
    let isAudio = AUDIO_FORMATS.includes(path.extname(pk3InnerPath))
    if(isImage) {
      return response.send(await renderImages(pk3InnerPath, newFile, modname))
    } else if (isAudio) {
      return response.send(await renderSounds(pk3InnerPath, newFile, modname))
    } else {
      return next(new Error('Can\'t handle file: ' + pk3InnerPath))
    }
  }


  // TODO: combine these paths, extracted / cached with pk3InnerPath list
  let directory = []
  if (newFile) {
    directory = await filterRepacked(pk3InnerPath, newFile, modname)
  }

  // duck out early
  if (!directory || directory.length <= 1) {
    return next(new Error('Path not found: ' + filename))
  }


  return response.send(renderIndex(`
  ${renderMenu(ASSET_FEATURES, 'asset-menu')}
  <div class="info-layout">
    ${await renderDirectory(path.join('repacked', modname,
    pk3File + 'dir', pk3InnerPath), directory, !isIndex)}
  </div>`))
}


async function renderImages(pk3InnerPath, pk3File, modname) {
  let directory = await filterRepacked(path.dirname(pk3InnerPath), pk3File, modname)
  let directoryFiltered = directory.filter(img => IMAGE_FORMATS.includes(path.extname(img.name)))
  let imgIndex = directoryFiltered.map(img => path.basename(img.link)).indexOf(path.basename(pk3InnerPath))
  // TODO: render image scroller view like Apple album shuffle
  let index = renderIndex(`
  <div class="loading-blur"><img src="/baseq3/pak0.pk3dir/levelshots/q3dm0.jpg" /></div>
  <div id="album-view" class="album-view">
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


async function renderSounds(pk3InnerPath, pk3File, modname) {
  let directory = await filterRepacked(path.dirname(pk3InnerPath), pk3File, modname)
  let directoryFiltered = directory.filter(img => AUDIO_FORMATS.includes(path.extname(img.name)))
  let imgIndex = directoryFiltered.map(img => path.basename(img.link)).indexOf(path.basename(pk3InnerPath))
  let index = renderIndex(`
  <div class="loading-blur"><img src="/baseq3/pak0.pk3dir/levelshots/q3dm0.jpg" /></div>
  <div id="wave-view" class="album-view">
  <h2>Sounds: 
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
        return `<li ${order}>${imgIndex == i ? `
        <div id="waveform"></div>` : '' /* }
      <a style="background-image:url('${img.link}?alt')" href="${img.link}?index">
      ${img.name}</a> */ }</li>`
      }).join('\n')}
  </ol>
  <script src="/build/wavesurfer.js"></script>
  </div>`)
  return index

}



module.exports = {
  serveRepacked,
}