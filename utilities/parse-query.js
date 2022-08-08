

// TODO: combine with parseQueryCommands to reduce redundant code
function parseQuery(str) {
  let queryArgs
  if(typeof str == 'string') {
    queryArgs = str
  } else
  if(typeof str == 'object') {
    queryArgs = Object.keys(str).map(k => k + ' ' + str[k]).join(' ')
  }

  let startup = []
	let search = /([^&=]+)/g
	let query  = queryArgs
	let match
	while (match = search.exec(query)) {
		let val = decodeURIComponent(match[1])
		val = val.split(' ')
		val[0] = (val[0][0] != '+' ? '+' : '') + val[0]
		startup.push.apply(startup, val)
	}
  return startup
}

module.exports = {
  parseQuery
}

