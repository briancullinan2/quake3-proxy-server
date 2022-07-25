

let mapList
let gameList
let mapInfo
let waveForm
let remoteConsole
let renderInterval

function pageBindings() {
  // TODO: remove all this, handled by callback system now
  /*
  if(mapList) {
    renderInterval setInterval(refreshMaps, 20)
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
  */

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
  if(engineView && typeof DB_STORE_NAME == 'undefined') {
    const ENGINE_SCRIPTS = [
      'nipplejs.js', 'sys_emgl.js', 'sys_fs.js', 'sys_idbfs.js', 'sys_in.js',
      // TODO: override sys_net with changes for frontend, then override engine index to add frontend
      //   and new ENGINE_MENU
      /* 'sys_net.js', */ 'sys_std.js', 'sys_web.js', 'sys_snd.js', 'sys_wasm.js'
    ]
    const promises = []
    for(let i = 0; i < ENGINE_SCRIPTS.length; i++) {
      let tag = document.createElement('script');
      tag.src = window.location.origin + '/' + ENGINE_SCRIPTS[i]
      promises.push(new Promise(resolve => tag.addEventListener('load', resolve, false)))
      document.getElementsByTagName('head')[0].appendChild(tag);
    }
    Promise.all(promises).then(() => window.initialize())
  } else if (engineView) {
    //initialize()
  }

  // TODO: if not connected 
  if(typeof Cbuf_ExecuteText != 'undefined') {
    Cbuf_ExecuteText(0, stringToAddress('clientinfo ;\n'))
  }

	let MATCH_ADDRESS = /[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+\:[0-9]+/gi
	let connectAddr = MATCH_ADDRESS.exec(window.location.pathname + '')
	if((typeof SYS != 'undefined' && SYS.state < 2)
      || (connectAddr && typeof Cbuf_AddText != 'undefined')) {
    let reconnect = addressToString(Cvar_VariableString(stringToAddress('cl_reconnectArgs')))
    if(!reconnect.includes(connectAddr[0])) {
      Cbuf_AddText(stringToAddress('connect ' + connectAddr[0] + ' ;\n'))
    }
  }
  let MATCH_MAPNAME = /maps\/([^\/]+)$/gi
	let mapname = MATCH_MAPNAME.exec(window.location.pathname + '')
	if(typeof SYS != 'undefined' && SYS.state < 2
      || (mapname && typeof Cbuf_AddText != 'undefined')) {
    if(mapname != addressToString(Cvar_VariableString(stringToAddress('mapname')))) {
      Cbuf_AddText(stringToAddress('devmap ' + mapname[1] + ' ;\n'))
    }
  }

}

window.addEventListener('load', (event) => {

  setTimeout(pageBindings, 300)

  if(typeof NET_OpenIP != 'undefind') {
    NET_OpenIP()
  }

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
      if(window.location.pathname + '' == eventPath[i].pathname
        && window.location.search == eventPath[i].search) {
        if(window.location.hash != eventPath[i].hash) {
          return false
        }
        evt.preventDefault()
        return false // dont modify stack, because its the same
      }
      let header = document.getElementsByTagName('H2')[0]
      let sock = NET.socket1
      if(!sock) {
        sock = NET.socket2
      }
      sock.send(eventPath[i].href, { binary: false })
      history.pushState(
        {location: window.location.pathname + ''}, 
        header ? 'Quake III Arena: ' + header : document.title, 
        eventPath[i].href)
      evt.preventDefault()
      return false
    }
  })

  document.addEventListener('keypress', async function (evt) {
    if(evt.target.id == 'rcon-command'
      && evt.keyCode == 13
      && evt.target.value.endsWith('\n')) {
      evt.preventDefault()
      let response = await fetch(window.location.origin + window.location.pathname, {
        method: 'POST',
        cache: 'no-cache',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({command: evt.target.value}),
      })
      evt.target.value = ''
      json = await response.json()
    }
  })

  window.addEventListener('popstate', function () {
    let sock = NET.socket1
    if(!sock) {
      sock = NET.socket2
    }
    sock.send(window.location, { binary: false })
  }, false)
}


//window.addEventListener('scroll', refreshMaps)
let previousLine = 0
let previousHalf = 0
let loading = 0

async function refreshMaps() {
  mapList = document.getElementById('map-list')

  if(!mapList || !mapList.children[0]) {
    return
  }

  if(!renderInterval) {
    renderInterval = setInterval(refreshMaps, 50)
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
    Promise.resolve(loadNextPage(window.sessionCallback, halfwareMark))
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
    //if(levelshot.getAttribute('src') != object.levelshot) {
      levelshot.setAttribute('src', object.levelshot 
      //    + (object.levelshot.includes('?') ? '&t=' : '?t=') + Date.now()
      )
    //}
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
    console.error('PAGING', e)
    loading--
    return
  }

  for(let i = 0; i < json.length; i++) {
    window.sessionLines[(halfwareMark * 50 - 50) + i] = json[i]
  }
  previousLine = -1
}


let previousUrl = ''
let debounceTimer

function socketProxyControl(evt) {
  if(typeof evt.data != 'string') {
    return
  }
  // TODO 
  if(evt.data.startsWith('{')
    || evt.data.startsWith('[')
    || evt.data.startsWith('"')) {
    // try to parse javascript
    let json
    try {
      json = JSON.parse(evt.data)
    } catch (e) {

    }
    // TODO: 
    if (typeof window.sessionCallback != 'undefined') {
      // replace contents of list instead of the entire dang DOM page
      for(let i = 0; i < json.length; i++) {
        window.sessionLines[json[i].index || i] = json[i]
      }
      previousLine = -1
      refreshMaps()
    }

    // unlikely if fail but try the next statement anyways, 
    //   in-case we are doing something stupid with JSON template strings in another module
  } // else
  if(evt.data.includes('<html')) {
    let length = document.body.children.length
    let hasViewport = false
    let hasGamesmenu = false
    for(let i = length - 1; i > 0; --i) { // don't remove menu
      if(document.body.children[i].id == 'viewport-frame') {
        hasViewport = true
        continue
      }
      if(evt.data.includes('viewport-frame') // since we won't be adding
        && document.body.children[i].id == 'home-menu') {
        // preserve games menu
        hasGamesmenu = true
        continue
      }
      document.body.children[i].remove()
    }
    let loaderDiv = document.createElement('div')
    loaderDiv.style.display = 'none'
    let innerContent = (/<body[\s\S]*?>([\s\S]*?)<\/body>/gi)
        .exec(evt.data)[1].replace(/<ol[\s\S]*?main-menu[\s\S]*?<\/ol>/i, '')
    loaderDiv.innerHTML = innerContent
    document.body.appendChild(loaderDiv)
    let previous = null
    for(let i = loaderDiv.children.length - 1; i >= 0; --i) {
      let current = loaderDiv.children[i]
      // don't add engine twice, because it hangs around
      if(hasViewport && current.id == 'viewport-frame') {
        continue
      }
      if(hasGamesmenu && current.id == 'home-menu') {
        continue
      }

      if(previous) {
        document.body.insertBefore(loaderDiv.children[i], previous)
      } else {
        document.body.appendChild(loaderDiv.children[i])
      }
      previous = current
    }
    loaderDiv.remove()
    pageBindings()
    return
  } else
  if(evt.data.startsWith('URL: ')) {
    window.location = window.location
    return
  } else
  if(evt.data.startsWith('UPDATE: ')) {
    let regexp = tryRegExp(evt.data.substring(8))
    if((window.location + '').match(evt.data.substring(8))
      || (regexp && (window.location + '').match(regexp))) {
      if(previousUrl.localeCompare(evt.data.substring(8), 'en', {sensitivity: 'base'}) != 0) {
        previousUrl = evt.data.substring(8)
        clearTimeout(debounceTimer)
        debounceTimer = null
      }
      if(!debounceTimer) {
        debounceTimer = setTimeout(function () {
          debounceTimer = null
          let sock = NET.socket1
          if(!sock) {
            sock = NET.socket2
          }
          if (typeof window.sessionCallback != 'undefined') {
            sock.send(window.location.origin + window.location.pathname + '?json', { binary: false })
          } else {
            sock.send(window.location + '', { binary: false })
          }
        }, 1000)
      }
    }
    return
  }

}

function tryRegExp(exp) {
  try {
    return new RegExp(exp, 'gi')
  } catch (e) {
    return null
  }
}


