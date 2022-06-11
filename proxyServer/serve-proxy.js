

// tcp
function createTCP(port) {
  const {createServer} = require('net')
  let tcp = createServer().listen(port)
  tcp.on('connection', createSOCKS)
  return tcp
}

function createUDP(port) {
  const {createSocket} = require('dgram')
  let udp = createSocket('udp4')
  udp.bind(port, '0.0.0.0')
  return udp
}

const UDP_SOCKETS = []
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
