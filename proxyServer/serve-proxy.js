

// tcp
function createTCP(port) {
  const {createServer} = require('net')
  let tcp = createServer().listen(port)
  tcp.on('connection', createSOCKS)
  return tcp
}
