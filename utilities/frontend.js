

let mapList
let gameList
let mapInfo
let waveForm


function pageBindings() {
  mapList = document.getElementById('map-list')
  if(mapList) {
    setInterval(refreshMaps, 20)
    setInterval(function () { previousLine = -1 }, 500)
  }

  mapList = document.getElementById('shader-list')
  if(mapList) {
    setInterval(refreshMaps, 20)
    setInterval(function () { previousLine = -1 }, 500)
  }

  mapInfo = document.getElementById('map-info')
  if(mapInfo) {
    setInterval(refreshMapinfo, 20)
    setInterval(function () { previousLine = -1 }, 2000)
  }

  let waveForm = document.getElementById('waveform')
  if(waveForm) {
    var wavesurfer = WaveSurfer.create({
      container: '#waveform',
      waveColor: '#D9DCFF',
      progressColor: '#4353FF',
      cursorColor: '#4353FF',
      barWidth: 3,
      barRadius: 3,
      cursorWidth: 1,
      height: 200,
      barGap: 3
    })
    wavesurfer.load((window.location + '').replace(/\/?\?index/i, '?alt'))
    wavesurfer.on('ready', function () {
      wavesurfer.play()
    })
    waveForm.addEventListener('click', function () {
      wavesurfer.play()
    }, false)
  }


  let engineView = document.getElementById('viewport-frame')
  if(engineView && typeof window.ENGINE == 'undefined') {
    const ENGINE_SCRIPTS = [
      'nipplejs.js', 'sys_emgl.js', 'sys_fs.js', 'sys_idbfs.js', 'sys_in.js',
      'sys_net.js', 'sys_std.js', 'sys_web.js', 'sys_snd.js', 'sys_wasm.js'
    ]
    var tag
    for(let i = 0; i < ENGINE_SCRIPTS.length; i++) {
      tag = document.createElement('script');
      tag.src = window.location.origin + '/' + ENGINE_SCRIPTS[i]
      document.getElementsByTagName('head')[0].appendChild(tag);
    }
    tag.addEventListener('load', setTimeout.bind(null, function () {
      window.initialize()
    }, 100), false)
  } else if (engineView) {
    initialize()
  }
}

window.addEventListener('load', (event) => {

  pageBindings()

  startLive()

  initEvents()
})

async function initEvents() {

  document.addEventListener('click', function (evt) {
    let eventPath = evt.composedPath()
    for(let i = 0; i < eventPath.length; i++) {
      if(eventPath[i].tagName != 'A' || !eventPath[i].href) {
        continue
      }
      if(eventPath[i].target) {
        return false
      }
      if(window.location.pathname == eventPath[i].pathname
        && window.location.search == eventPath[i].search) {
        if(window.location.hash != eventPath[i].hash) {
          return false
        }
        evt.preventDefault()
        return false // dont modify stack, because its the same
      }
      let header = document.getElementsByTagName('H2')[0]
      socket1.send(eventPath[i].href, { binary: false })
      history.pushState(
        {location: window.location.pathname}, 
        header ? 'Quake III Arena: ' + header : document.title, 
        eventPath[i].href)
      evt.preventDefault()
      return false
    }
  })

  window.addEventListener('popstate', function () {
    socket1.send(window.location, { binary: false })
  }, false)
}


async function refreshMapinfo() {
  
}


//window.addEventListener('scroll', refreshMaps)
let previousLine = 0
let previousHalf = 0
let loading = 0

async function refreshMaps() {
  if(!mapList || !mapList.children[0]) {
    return
  }

  let lineHeight = mapList.children[0].clientHeight
  if(!lineHeight) {
    mapList.children[0].style.display = ''
    return
  }
  let count = mapList.children.length
  let itemsPerLine = 0
  for(let i = 0; i < mapList.children.length; i++) {
    if(mapList.children[i].offsetTop < lineHeight / 2) {
      itemsPerLine++
    } else {
      break
    }
  }
  if(itemsPerLine == 0) {
    debugger
    return
  }


  let lineCount = Math.ceil(window.sessionLength / itemsPerLine)
  let totalHeight = lineHeight * lineCount
  document.body.style.maxHeight = totalHeight + 'px'
  document.body.style.height = totalHeight + 'px'


  let halfway = Math.ceil(count / itemsPerLine / 2)
  let halfwareMark = Math.floor(window.scrollY / (halfway * lineHeight))
  if(halfwareMark != previousHalf) {
    loadNextPage(window.sessionCallback, halfwareMark)
  }


  // convenience to put padding on either side of the scroll back
  //   to reduce artifacting when scrolling quickly, instead of
  //   showing all black, there is a better chance they see the
  //   list if the screen refreshes before the scroll delta puts
  //   it out of view again.
  let scrollback = Math.ceil(count / itemsPerLine / 5)
  let startLine = Math.floor(window.scrollY / (scrollback * lineHeight))
  let maxLine = Math.floor((lineCount - halfway * 2) / scrollback)
  if(maxLine < 1) {
    maxLine = 1
  }
  if(startLine > maxLine) {
    startLine = maxLine
  }

  let updateVisibility = previousLine == -1

  if(startLine == previousLine) {
    return
  }
  previousLine = startLine

  let offset = startLine * scrollback * lineHeight
  mapList.style.transform = `translate(0px, ${offset}px)`

  // update lines every half page
  for(let i = 0; i < mapList.children.length; i++) {
    let ariaId = startLine * scrollback * itemsPerLine + i
    let object = window.sessionLines[ariaId]

    let item = mapList.children[i]
    if(!object && !loading) {
      item.style.display = 'none'
      continue
    } else 
    if (item.style.display == 'none') {
      item.style.display = ''
    }
    if(updateVisibility && parseInt(item.getAttribute('aria-id')) == ariaId) {
      continue
    }
    if(!object) {
      continue
    }
    item.style.backgroundImage = `url(${object.levelshot})`

    let title = item.children[0].children[0].children[0]
    if(object.link
      && title.parentElement.href != object.link) {
      title.parentElement.href = object.link
    } else
    if(object.bsp 
      && title.parentElement.href != '/maps/' + object.bsp) {
      title.parentElement.href = '/maps/' + object.bsp
    }
    if(title.innerText != object.title) {
      title.innerText = object.title
    }

    let mapname = item.children[0].children[0].children[1]
    if(object.bsp && mapname.innerText != object.bsp) {
      mapname.innerText = object.bsp
    }

    let levelshot = item.children[1]
    if(levelshot.getAttribute('src') != object.levelshot) {
      levelshot.setAttribute('src', object.levelshot)
    }
    if(object.have) {
      levelshot.classList.remove('unknownmap')
    } else {
      levelshot.classList.add('unknownmap')
    }

    let pakname = item.children[2]
    if(pakname.href != '/maps/download/' + object.bsp) {
      pakname.href = '/maps/download/' + object.bsp
    }
    if(!pakname.innerText.includes(object.pakname)) {
      pakname.innerText = `${object.pakname}`
    }
  }
}



async function loadNextPage(page, halfwareMark) {
  previousHalf = halfwareMark

  if(typeof window.sessionLines[previousHalf] != 'undefined'
    && typeof window.sessionLines[previousHalf * 50] != 'undefined'
    && typeof window.sessionLines[previousHalf * 100] != 'undefined') {
    return
  }

  let json
  loading++
  try {
    let response = await fetch( page
        + (halfwareMark * 50 - 50) + '/' 
        + (halfwareMark * 50 + 150) + '?json', {
      mode: 'cors',
      responseType: 'json',
      credentials: 'omit',
    })
    json = await response.json()
    loading--
  } catch (e) {
    console.error(e)
    loading--
    return
  }

  for(let i = 0; i < json.length; i++) {
    window.sessionLines[(halfwareMark * 50 - 50) + i] = json[i]
  }
  previousLine = -1
}

let reconnect = false
let queue
let socket1
let socket2
let heartbeat

function sendHeartbeat(sock) {
  if(sock.readyState == WebSocket.OPEN) {
		sock.fresh = 5
    sock.send(Uint8Array.from([0x05, 0x01, 0x00, 0x00]),
      { binary: true })
  } else if(sock.readyState == WebSocket.CLOSED) {
    reconnect = true
    if(sock == socket1) {
     socket1 = null
    } else {
      socket2 = null
    }
    startLive()
  }
}


function sendLegacyEmscriptenConnection(socket, port) {
  socket.send(Uint8Array.from([
    0xFF, 0xFF, 0xFF, 0xFF,
    'p'.charCodeAt(0), 'o'.charCodeAt(0), 'r'.charCodeAt(0), 't'.charCodeAt(0),
    (port & 0xFF00) >> 8, (port & 0xFF)
  ]))

}


function socketOpen(evt) {
	evt.target.fresh = 1
	evt.target.send(Uint8Array.from([
    0x05, 0x01, 0x00, // no password caps?
  ]))
	if(!heartbeat) {
		heartbeat = setInterval(function () {
      if(socket1) {
        sendHeartbeat(socket1)
      } else {
        setTimeout(startLive, 100)
      }
      heartbeatTimeout = setTimeout(function () {
        if(socket2) {
          sendHeartbeat(socket2)
        }
      }, 7000)
		}, 9000)
	}
  if(!reconnect) return
	sendLegacyEmscriptenConnection(evt.target, window.net_port)
}

let previousUrl = ''
let debounceTimer

function socketMessage(evt) {
  if(typeof evt.data == 'string'
    && evt.data.includes('<html')) {
    let length = document.body.children.length
    for(let i = length - 1; i > 0; --i) { // don't remove menu
      document.body.children[i].remove()
    }
    document.body.innerHTML += (/<body[\s\S]*?>([\s\S]*?)<\/body>/gi)
    //document.body.innerHTML += (/<body[\s\S]*?main-menu[\s\S]*?<\/ol>([\s\S]*?)<\/body>/gi)
        .exec(evt.data)[1].replace(/<ol[\s\S]*?main-menu[\s\S]*?<\/ol>/i, '')
    pageBindings()
    return
  } else
  if(typeof evt.data == 'string'
    && evt.data.startsWith('URL: ')) {
    window.location = window.location
    return
  } else
  if(typeof evt.data == 'string'
    && evt.data.startsWith('UPDATE: ')) {
    if((window.location + '').match(evt.data.substring(8))) {
      if(previousUrl.localeCompare(evt.data.substring(8), 'en', {sensitivity: 'base'}) != 0) {
        previousUrl = evt.data.substring(8)
        clearTimeout(debounceTimer)
        debounceTimer = null
      }
      if(!debounceTimer) {
        debounceTimer = setTimeout(function () {
          debounceTimer = null
          socket1.send(window.location + '', { binary: false })
        }, 100)
      }
    }

    return
  }


  let message = new Uint8Array(evt.data)
  switch(evt.target.fresh) {
    case 1:
      if(message.length != 2) {
        throw new Error('wtf? this socket no worky')
      } else

      if(message[1] != 0) {
        debugger
        throw new Error('this socket requires a password, dude')
      }

      // send the UDP associate request
      evt.target.send(Uint8Array.from([
				0x05, 0x03, 0x00, 0x01, 
				0x00, 0x00, 0x00, 0x00, // ip address
				(window.net_port & 0xFF00) >> 8, (window.net_port & 0xFF)
			]))
      evt.target.fresh = 2
    break
		case 2:
      if(message.length == 2) {
        evt.target.fresh = 3
        break
      } else
			if(message.length < 5) {
				throw new Error('denied, can\'t have ports')
			} else
			if(message[3] != 1) {
				throw new Error('relay address is not IPV4')
			}

			sendLegacyEmscriptenConnection(evt.target, window.net_port)
			evt.target.fresh = 3
      // TODO: 
			/*
      if(socket ==socket1) {
				for(let i = 0, count =socket1Queue.length; i < count; i++) {
					socket.send(socket1Queue.shift())
				}
			} else {
				for(let i = 0, count =socket1Queue.length; i < count; i++) {
					socket.send(socket2Queue.shift())
				}
			}
      */

		break
		case 3:
			if(message.length == 10) {
				evt.target.fresh = 4
				break
			}

		case 4:
		case 5:
				// add messages to queue for processing
			if(message.length == 2 || message.length == 10) {
				evt.target.fresh = 4
				return
			}

			let addr, remotePort, msg
			if(message[3] == 1) {
				addr = message.slice(4, 8)
				remotePort = message.slice(8, 10)
				msg = Array.from(message.slice(10))
			} else if (message[3] == 3) {
				addr = Array.from(message.slice(5, 5 + message[4])).map(function (c) {
					return String.fromCharCode(c)
				}).join('')
				remotePort = message.slice(5 + message[4], 5 + message[4] + 2)
				msg = Array.from(message.slice(5 + addr.length + 2))
			} else {
				throw new Error('don\' know what to do mate')
			}

    break
  }
}

function socketError(evt) {
  reconnect = true
  if(evt.target ==socket1) {
   socket1 = null
  }
  if(evt.target == socket2) {
    socket2 = null
  }
}



function startLive() {
  if(!queue) {
    queue = []
  }
  if(window.location.protocol != 'http:' 
    && window.location.protocol != 'https:') {
    return
  }
  let fullAddress = 'ws' 
    + (window.location.protocol.length > 5 ? 's' : '')
    + '://' + window.location.hostname + ':' + window.location.port 
    + window.location.pathname
  if(!socket1) {
   socket1 = new WebSocket(fullAddress /* , {headers: cookie: '__planet_quake_sess='} */)
   socket1.binaryType = 'arraybuffer';
   socket1.addEventListener('open', socketOpen, false)
   socket1.addEventListener('close', socketError, false)
   socket1.addEventListener('message', socketMessage, false)
   socket1.addEventListener('error', socketError, false)
  }
  if(!socket2) {
    socket2 = new WebSocket(fullAddress)
    socket2.binaryType = 'arraybuffer';
    socket2.addEventListener('open', socketOpen, false)
    socket2.addEventListener('close', socketError, false)
    socket2.addEventListener('message', socketMessage, false)
    socket2.addEventListener('error', socketError, false)
  }
}



