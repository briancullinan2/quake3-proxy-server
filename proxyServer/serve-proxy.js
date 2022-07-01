

// tcp
function createTCP(port) {
  const {createServer} = require('net')
  let tcp = createServer().listen(port)
  tcp.on('connection', createSOCKS)
  return tcp
}

const {createApplication, createRedirect} = require('../contentServer/express.js')
const {MASTER_PORTS} = require('../gameServer/serve-games.js')

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

function createProxies(services, forward) {
  let virtualApp = createApplication(services)

  for(let i = 0; i < HTTP_PORTS.length; i++) {
    let httpServer = createHTTP(virtualApp, HTTP_PORTS[i])
    HTTP_LISTENERS[HTTP_PORTS[i]] = httpServer
    if(services.includes('socks')) {
      WEB_SOCKETS[HTTP_PORTS[i]] = createWebsocket(httpServer)
      WEB_SOCKETS[HTTP_PORTS[i]].forward = forward
      WEB_SOCKETS[HTTP_PORTS[i]].on('connection', createSOCKS)
    }
  }

  // since we have an http server to redirect to, if someone visits a service
  //   port redirect them to a web interface, for their convenience
  if(HTTP_PORTS.length > 0) {
    const redirectApp = createRedirect(forward)
    for(let i = 0; i < MASTER_PORTS.length; i++) {
      // http
      HTTP_LISTENERS[MASTER_PORTS[i]] = createHTTP(redirectApp, MASTER_PORTS[i])
    }
  }
}

module.exports = {
  HTTP_PORTS, HTTP_LISTENERS,
  createProxies,
  createHTTP,
  createTCP,
}

