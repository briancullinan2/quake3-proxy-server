
// ws
function createWebsocket(httpServer) {
  const {Server} = require('ws')
  let wss = new Server({server: httpServer})
  return wss
}