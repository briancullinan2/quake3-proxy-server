const path = require('path')

const { unsupportedImage } = require('../contentServer/unsupported.js')
const { FindShaderInShaderText } = require('../assetServer/shaders.js')

async function renderImages(images, pk3name, basegame) {
  let imageHtml = ''
  // sort by the second directory and group by like trenchbroom does
  images.sort(/* (a, b) => {
    let ai = a.indexOf('/')
    let bi = b.indexOf('/')
    let left = ai > -1 ? a.substring(ai + 1) : a
    let right = bi > -1 ? b.substring(bi + 1) : b
    return left.localeCompare(right, 'en', {sensitivity: 'base'})
  } */)
  // text in shaders, like Q3e renderer does
  let composites = await Promise.all(images.map(i => {
    if (i[0] == '*') {
      return
    }
    return FindShaderInShaderText(i.replace(path.extname(i), ''))
  }))
  let previousGroup = ''
  for (let i = 0; i < images.length; i++) {
    if (images[i][0] == '*') {
      continue
    }
    if (!images[i].includes('.')) {
      images[i] += '.tga'
    }
    let ai = images[i].indexOf('/')
    let left = ai > -1 ? images[i].substring(ai + 1) : images[i]
    if (previousGroup.localeCompare(images[i].substring(0, ai), 'en', { sensitivity: 'base' }) != 0) {
      previousGroup = images[i].substring(0, ai)
      imageHtml += `<li class="title"><span>${images[i].substring(0, ai)}</span></li>`
    }
    if (composites[i] && composites[i].length > 0) {
      imageHtml += `<li>${composites[i].map(function (shader) {
        let bi = shader.indexOf('/')
        return `
          <img src="/${basegame}/${pk3name}dir/${shader}?alt" />
          <a href="">${bi > -1 ? shader.substring(bi + 1) : shader}</a>`
      }).join('')}</li>`
    } else
      if (await unsupportedImage(images[i])) {
        imageHtml += `<li><img src="/${basegame}/${pk3name}dir/${images[i]}?alt" /><a href="/${basegame}/${pk3name}dir/${images[i]}?alt">${left}</a></li>`
      } else {
        imageHtml += `<li><img src="/${basegame}/${pk3name}dir/${images[i]}" /><a href="/${basegame}/${pk3name}dir/${images[i]}">${left}</a></li>`
      }
  }

  return `
  <li class="title"><span>World</span></li>
  <li class="title"><span>Overrides</span></li>
  <li class="title"><span>Base</span></li>
  ${imageHtml}`
}

module.exports = {
  renderImages
}