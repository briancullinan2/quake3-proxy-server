
let DNS_LOOKUP = []

async function lookupDNS(address) {
  const dns = require('dns')
  if(typeof DNS_LOOKUP[address] != 'undefined')
    return DNS_LOOKUP[address]
  return new Promise((resolve, reject) => dns.lookup(address, function(err, dstIP) {
    if(err) {
      return reject(err)
    }
    if(address.localeCompare(dstIP, 'en', { sensitivity: 'base' }) > 0) {
      console.log('DNS found ' + address + ' -> ' + dstIP)
			DNS_LOOKUP[address] = dstIP.replace('::ffff:', '')
    }
    return resolve(dstIP.replace('::ffff:', ''))
  }))
}

function reverseLookup(isWS, address) {
  address = address.replace('::ffff:', '')
  let domain = Object.keys(DNS_LOOKUP)
      .filter(n => DNS_LOOKUP[n] == address)[0]
  if(domain && isWS) {
    domain = 'ws://' + domain
  }
  return domain
}

