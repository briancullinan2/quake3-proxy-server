
const {INDEX } = require('../utilities/env.js')

function renderFeature(map) {
  if(!map) {
    return ''
  }
  let result = ''
  result += `<li style="background-image: url('/${map.levelshot}')">`
  result += `<h3 ${map.palette 
    ? `style="background-color: rgba(${shader.palette})"` : ''}>`
  result += `<a href="/${map.link}">`
  result += `<span>${map.title}</span>`
  result += map.bsp && map.title != map.bsp
    ? `<small>${map.bsp}</small>`
    : '<small>&nbsp;</small>'
  result += `</a></h3>`
  result += `<img ${map.have ? '' : 'class="unknownmap"'} src="${map.levelshot}" />`
  result += `<a href="/maps/download/${map.bsp}">Download: ${map.pakname}`
  //result += map.pakname.includes('.pk3') ? '' : '.pk3'
  return result
}

function renderIndex(body) {
  let offset = INDEX.match('<body>').index + 6
  let index = INDEX.substring(0, offset)
    + body + INDEX.substring(offset, INDEX.length)
  return index
}

function renderList(link, jsonView, total) {
  let list = jsonView.map(game => renderFeature(game)).join('')
  return `<ol id="game-list" class="stream-list">${list}</ol>
  <script>window.sessionLines=${JSON.stringify(jsonView)}</script>
  <script>window.sessionLength=${total}</script>
  <script>window.sessionCallback=${link}</script>
  <script async defer src="index.js"></script>
  `
}

module.exports = {
  renderFeature,
  renderIndex,
  renderList,
}