const { getFeatureFilter } = require('../contentServer/features.js')
const { INDEX, getGame } = require('../utilities/env.js')
const { START_SERVICES } = require('../contentServer/features.js')


function renderFeature(map) {
  if(!map) {
    return ''
  }
  let result = ''
  result += `<li style="background-image: url('${map.levelshot || '/unknownmap.jpg'}')">`
  result += `<h3 ${map.palette 
    ? `style="background-color: rgba(${map.palette})"` : ''}>`
  if(map.link) {
    result += `<a href="${map.link.includes('://') ? '' : '/'}${map.link}">`
  } else {
    result += `<a name="${map.title || map.subtitle || map.bsp}">`
  }
  result += `<span>${map.title}</span>`
  result += (map.bsp || map.subtitle) 
      && map.title != map.bsp && map.title != map.subtitle
    ? `<small>${map.subtitle || map.bsp}</small>`
    : '<small>&nbsp;</small>'

  result += '</a>'
  result += '</h3>'
  result += `<img ${map.have ? '' : 'class="unknownmap"'} src="${map.levelshot || '/unknownmap.jpg'}" />`
  if(map.download || map.pakname) {
    result += `<a href="/maps/download/${map.download || map.bsp}">${map.pakname || map.download}</a>`
  }
  //result += map.pakname.includes('.pk3') ? '' : '.pk3'
  return result
}


function renderMenu(jsonView, id) {
  let list = jsonView.map(game => {
    return `<li><a href="${game.link.includes('://') ? '' : '/'}${game.link}">
      <span>${game.title}</span></a></li>`
  }).join('')
  return `<ol ${id ? `id="${id}"` : ''} class="main-menu">${list}</ol>`
}


function renderList(link, jsonView, total, id) {
  let list = jsonView.map(renderFeature).join('\n')
  return `<ol ${id ? `id="${id}"` : ''} class="stream-list">${list}</ol>
  <script>window.sessionLines=${JSON.stringify(jsonView)};</script>
  <script>window.sessionLength=${total};</script>
  <script>window.sessionCallback='${link}';</script>
  `
}

function renderFeatureMenu() {
  return renderMenu(getFeatureFilter())
}

function renderIndex(body, bodyClass) {
  let bodyTag = INDEX.match(/<body[\n\r.^>]*?>/i)
  let offset = bodyTag.index + bodyTag[0].length
  let index = INDEX.substring(0, offset).replace('<body', `<body ${bodyClass ? bodyClass : ''} `)
    + renderFeatureMenu() 
    + (START_SERVICES.includes('deploy') 
    ? `<div class="cache-notify">This page was loaded from cache. 
        Reconnecting to proxy server...</div>` : '')
    + (!body.includes('loading-blur') 
    ? `<div class="loading-blur">
      <img src="/baseq3/pak0.pk3dir/levelshots/q3dm0.jpg">
    </div>` : '')
    + body + INDEX.substring(offset, INDEX.length)
  return index
}



function renderEngine() {
  return `
  <div id="viewport-frame">
		<div id="dialog"><h4 class="title"></h4><p class="description"></p></div>
		<div id="flipper">
			<div class="front">
				<!-- front content -->
			</div>
			<div class="back">
				<!-- back content -->
			</div>
		</div>
		<div id="left-joystick"></div><div id="right-joystick"></div>
		<canvas></canvas>
	</div>`
}


module.exports = {
  renderFeatureMenu,
  renderFeature,
  renderList,
  renderMenu,
  renderIndex,
  renderEngine,
}