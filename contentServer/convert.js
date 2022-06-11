
async function convertImage(imagePath) {
  let isOpaque
  let pk3InnerPath
  if(imagePath.endsWith('.pk3')) {
    pk3InnerPath = imagePath.replace(/^.*?\.pk3[^\/]*?(\/|$)/gi, '')
    //console.log(pk3InnerPath)
    isOpaque = await pipeZipCmd(`identify -format '%[opaque]' ${isUnsupportedImage[0].substring(1)}:-`, pk3InnerPath, imagePath)
  } else {
    isOpaque = await execCmd(`identify -format '%[opaque]' "${imagePath}"`)
  }

  if(typeof isOpaque != 'string') {
    return false
  }

  let newFile = imagePath.replace(isUnsupportedImage[0], 
    isOpaque.match(/true/ig) ? '.jpg' : '.png')
  let newPath = path.join(repackedCache, newFile.substring(basegame.length))
  if(!fs.existsSync(newPath)) {
    //console.assert(newFile.localeCompare(
    //  request, 'en', { sensitivity: 'base' }) == 0)
    fs.mkdirSync(path.dirname(newPath), { recursive: true })
    if(imagePath.endsWith('.pk3')) {
      pipeZipCmd(`convert -strip -interlace Plane -sampling-factor 4:2:0 \
      -quality 20% -auto-orient ${isUnsupportedImage[0].substring(1)}:- "${newPath}"`, 
      pk3InnerPath, imagePath)
    } else {
      execCmd(`convert -strip -interlace Plane -sampling-factor 4:2:0 \
      -quality 20% -auto-orient "${imagePath}" "${newPath}"`)
    }
    // don't wait for anything
  }
  return newPath
}
