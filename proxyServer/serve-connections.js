// TODO: list connected clients and usernames
const { renderIndex } = require('../utilities/render.js')
const { UDP_CLIENTS } = require('../proxyServer/serve-udp.js')

async function serveConnections(request, response, next) {
  let ports = Object.keys(UDP_CLIENTS)
  let proxyConnections = ports.map(p => {
    return {
      name: UDP_CLIENTS[p]._socket.remoteAddress.replace('::ffff:', '') 
        + ':' + UDP_CLIENTS[p]._socket.remotePort,
      assignments: p + ' -> ',
    }
  })
  return response.send(renderIndex(
    //renderMenu(PROXY_MENU, 'downloads-menu')
    //+ 
    `<div class="loading-blur"><img src="/baseq3/pak0.pk3dir/levelshots/q3dm0.jpg"></div>
    <div class="info-layout">
    <h2>Proxy Clients</h2>
    <ol class="directory-list">${proxyConnections.map(renderConnection).join('\n')}
    </ol>
    </div>
    `))
}

function renderConnection(node) {
  let result = '<li>'
  if(node.name.endsWith('/') || typeof node.size == 'undefined') {
    result += `<a href="${node.link}?index">${node.name}</a>`
    result += `<span>&nbsp;</span>`
  } else {
    result += `<a href="${node.link}?alt">${node.name}</a>`
    result += `<span>${formatSize(node.size)}</span>`
  }
  if(typeof node.mtime != 'undefined') {
    result += `<span>${node.mtime.getMonth() + 1}/${node.mtime.getDate()} `
    result += `${node.mtime.getHours()}:${node.mtime.getMinutes()}</span>`
  } else {
    result += `<span>&nbsp;</span>`
  }
  result += `<span>${node.assignments}</span>`
  result += '</li>'
  return result
}

module.exports = {
  serveConnections
}