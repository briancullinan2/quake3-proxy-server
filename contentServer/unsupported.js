
function unsupportedImage(imagePath) {
  if(!IMAGE_FORMATS.includes(path.extname(imagePath))) {
    return
  }
  if (imagePath.match(/levelshots\//i)) {
    isUnsupportedImage = imagePath.match(/\.tga$|\.dds$|\.bmp$|\.png$/gi)
  } else {
    isUnsupportedImage = imagePath.match(/\.tga$|\.dds$|\.bmp$/gi)
  }
  if(isUnsupportedImage || !imagePath.includes('.')) {
    return imagePath
  }
}

function unsupportedAudio(audioPath) {
  if(!AUDIO_FORMATS.includes(path.extname(audioPath))) {
    return
  }
  let isUnsupportedAudio = !audioPath.match(/\.ogg$/gi)
  if(isUnsupportedAudio || !audioPath.includes('.')) {
    return audioPath
  }
}

module.exports = {
  unsupportedImage,
  unsupportedAudio,
}