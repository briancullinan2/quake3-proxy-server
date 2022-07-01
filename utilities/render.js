const { getFeatureFilter } = require('../contentServer/features.js')
const { INDEX } = require('../utilities/env.js')


function renderFeature(map) {
  if(!map) {
    return ''
  }
  let result = ''
  result += `<li style="background-image: url('/${map.levelshot}')">`
  result += `<h3 ${map.palette 
    ? `style="background-color: rgba(${map.palette})"` : ''}>`
  result += `<a href="/${map.link}">`
  result += `<span>${map.title}</span>`
  result += (map.bsp || map.subtitle) 
      && map.title != map.bsp && map.title != map.subtitle
    ? `<small>${map.subtitle || map.bsp}</small>`
    : '<small>&nbsp;</small>'
  result += `</a></h3>`
  result += `<img ${map.have ? '' : 'class="unknownmap"'} src="${map.levelshot}" />`
  if(map.download || map.pakname) {
    result += `<a href="/maps/download/${map.bsp}">Download: ${map.pakname}</a>`
  }
  //result += map.pakname.includes('.pk3') ? '' : '.pk3'
  return result
}


function renderMenu(jsonView, id) {
  let list = jsonView.map(game => {
    return `<li><a href="/${game.link}"><span>${game.title}</span></a></li>`
  }).join('')
  return `<ol ${id ? `id="${id}"` : ''} class="main-menu">${list}</ol>`
}


function renderList(link, jsonView, total, id) {
  let list = jsonView.map(game => renderFeature(game)).join('')
  return `<ol ${id ? `id="${id}"` : ''} class="stream-list">${list}</ol>
  <script>window.sessionLines=${JSON.stringify(jsonView)}</script>
  <script>window.sessionLength=${total}</script>
  <script>window.sessionCallback=${link}</script>
  <script async defer src="index.js"></script>
  `
}

function renderFeatureMenu() {
  return renderMenu(getFeatureFilter())
}

function renderIndex(body) {
  let offset = INDEX.match('<body>').index + 6
  let index = INDEX.substring(0, offset)
    + renderFeatureMenu()
    + body + INDEX.substring(offset, INDEX.length)
  return index
}


module.exports = {
  renderFeature,
  renderList,
  renderMenu,
  renderIndex,

}