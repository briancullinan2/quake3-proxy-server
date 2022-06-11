
function createMasters() {
  // udp
  const redirectApp = createRedirect()
  for(let i = 0; i < master.length; i++) {
    UDP_SOCKETS[master[i]] = createUDP(master[i])
    UDP_SOCKETS[master[i]].on('message', async function (message, rinfo) {
      try {
        await serveMaster(UDP_SOCKETS[master[i]], message, rinfo)
      } catch (e) {
        console.log(e)
      }
    })
    // http
    if(http.length > 0) {
      HTTP_LISTENERS[master[i]] = createHTTP(redirectApp, master[i])
    }
  }

  for(let i = 0; i < masters.length; i++) {

  }
}

