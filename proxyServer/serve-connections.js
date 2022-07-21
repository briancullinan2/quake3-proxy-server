// TODO: list connected clients and usernames
const { renderIndex, renderMenu } = require('../utilities/render.js')
const { UDP_CLIENTS, SESSION_URLS, SESSION_IDS } = require('../proxyServer/serve-udp.js')
const { STATUS_MENU } = require('../gameServer/processes.js')

async function serveConnections(request, response, next) {
  let ports = Object.keys(UDP_CLIENTS)
  let proxyConnections = ports.map(p => {
    let sessionId = Object.keys(SESSION_IDS)
        .filter(sess => SESSION_IDS[sess] == p)[0]
    let newUrl
    if(sessionId && SESSION_URLS[sessionId]){
      newUrl = new URL(SESSION_URLS[sessionId])
    }
    let multicast = UDP_CLIENTS[p].map(socket => {
      return {
        name: socket._socket.remoteAddress.replace('::ffff:', '') 
          + ':' + socket._socket.remotePort,
        assignments: p + ' -> ' 
          + (SESSION_URLS[sessionId] || '').replace(/^.*?:\/\/.*?\/|^\//i, ''),
      }
    })
    return multicast
  }).flat(1)
  return response.send(renderIndex(
    renderMenu(STATUS_MENU, 'downloads-menu')
    + `<div class="loading-blur"><img src="/baseq3/pak0.pk3dir/levelshots/q3dm0.jpg"></div>
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