

let mapList


window.addEventListener('load', (event) => {
  mapList = document.getElementById('map-list')
  if(mapList) {
    setInterval(refreshMaps, 20)
    setInterval(function () { previousLine = -1 }, 500)
  }
})

//window.addEventListener('scroll', refreshMaps)
let previousLine = 0
let previousHalf = 0

async function refreshMaps() {
  if(!mapList) {
    return
  }

  let lineHeight = mapList.children[0].clientHeight
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
    loadNextPage(halfwareMark)
  }


  // convenience to put padding on either side of the scroll back
  //   to reduce artifacting when scrolling quickly, instead of
  //   showing all black, there is a better chance they see the
  //   list if the screen refreshes before the scroll delta puts
  //   it out of view again.
  let scrollback = Math.ceil(count / itemsPerLine / 5)
  let startLine = Math.floor(window.scrollY / (scrollback * lineHeight))
  let maxLine = Math.floor((lineCount - halfway * 2) / scrollback)
  if(startLine > maxLine) {
    startLine = maxLine
  }

  let updateVisibility = previousLine == -1
  if(startLine == previousLine) {
    return
  }
  previousLine = startLine

  let offset = startLine * scrollback * lineHeight
  mapList.style.transform = 'translate(0px, ' + offset + 'px)'

  // update lines every half page
  for(let i = 0; i < mapList.children.length; i++) {
    let object = window.sessionLines[startLine * scrollback * itemsPerLine + i]

    let item = mapList.children[i]
    if(!object) {
      item.style.visibility = 'hidden'
      continue
    } else 
    if (item.style.visibility == 'hidden') {
      item.style.visibility = 'visible'
    }
    if(updateVisibility) {
      continue
    }

    item.style.backgroundImage = 'url(' + object.levelshot + ')'

    let title = item.children[0].children[0].children[0]
    title.parentElement.href = '/maps/download/' + object.bsp
    title.innerText = object.title

    let mapname = item.children[0].children[0].children[1]
    mapname.innerText = object.bsp

    let levelshot = item.children[1]
    levelshot.setAttribute('src', object.levelshot)
    if(object.have) {
      levelshot.classList.remove('unknownmap')
    } else {
      levelshot.classList.add('unknownmap')
    }

    let pakname = item.children[2]
    pakname.href = '/maps/download/' + object.bsp
    pakname.innerText = 'Download: ' + object.pakname + '.pk3'
  }
}

async function loadNextPage(halfwareMark) {
  previousHalf = halfwareMark

  if(typeof window.sessionLines[previousHalf] != 'undefined'
    && typeof window.sessionLines[previousHalf * 50] != 'undefined'
    && typeof window.sessionLines[previousHalf * 100] != 'undefined') {
    return
  }

  let json = await fetch('/maps/' 
      + (halfwareMark * 50 - 50) + '/' 
      + (halfwareMark * 50 + 150) + '?json', {
    mode: 'cors',
    responseType: 'json',
    credentials: 'omit',
  })
  .then(response => response.json())
  for(let i = 0; i < json.length; i++) {
    window.sessionLines[(halfwareMark * 50 - 50) + i] = json[i]
  }
  previousLine = -1
}