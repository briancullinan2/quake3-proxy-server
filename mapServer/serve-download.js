
async function sourcePk3Download(filename) {
  let mapname = path.basename(filename)
      .replace('.pk3', '')
  let request
  let response
  if(mapname != 'sokam-bloody') {
    response = await new Promise(function (resolve, reject) {
      request = require('http').get(
        `http://ws.q3df.org/maps/download/${mapname}`,
      function(response) {
        if(response.statusCode != 200) {
          request.end()
          return reject(new Error('Could not download ' + mapname))
        }
        resolve(response)
      })
      request.on('error', reject)
    })
  } else {
    return path.join(downloadCache, 'sokam-bloody.pk3')
  }


  let pk3header = response.headers['content-disposition']
  let pk3name = (/filename=["'\s]*([^"'\s]*)["'\s]*/i).exec(pk3header)
  let repacked = findFile(pk3name[1])
  if(repacked) {
    request.end()
    return repacked
  }
  newFile = path.join(downloadCache, pk3name[1])
  if(fs.existsSync(newFile)) {
    request.end()
    return newFile
  }

  await new Promise(function (resolve, reject) {
    const file = fs.createWriteStream(newFile)
    response.pipe(file)
    file.on('finish', resolve)
  })
  // after download completed close filestream
  return newFile
}

