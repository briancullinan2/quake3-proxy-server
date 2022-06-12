
// ws
function createWebsocket(httpServer) {
  const {Server} = require('ws')
  let wss = new Server({server: httpServer})
  return wss
}

// http
function createHTTP(app, port) {
  const {createServer} = require('http')
  return createServer(app).listen(port)
}

const HTTP_PORTS = [8080]
const HTTP_LISTENERS = []
const WEB_SOCKETS = []

function createProxies() {
  let virtualApp = createVirtual()
  for(let i = 0; i < http.length; i++) {
    let httpServer = createHTTP(virtualApp, http[i])
    HTTP_LISTENERS[http[i]] = httpServer
    WEB_SOCKETS[http[i]] = createWebsocket(httpServer)
    WEB_SOCKETS[http[i]].on('connection', createSOCKS)
  }
}

module.exports = {
  HTTP_PORTS, HTTP_LISTENERS,
  createProxies,
  createHTTP
}

