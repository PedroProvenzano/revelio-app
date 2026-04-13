const jimp = require('jimp');

async function processImage(file) {
  try {
    const image = await jimp.read(file);
    const w = image.bitmap.width;
    const h = image.bitmap.height;
    
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const color = jimp.intToRGBA(image.getPixelColor(x, y));
        
        // Check for green chroma key
        // Green should be dominant
        if (color.g > color.r * 1.2 && color.g > color.b * 1.2 && color.g > 100) {
          image.setPixelColor(0x00000000, x, y);
        }
      }
    }
    
    await image.writeAsync(file);
    console.log('Processed', file);
  } catch(e) {
    console.error('Failed to process', file, e);
  }
}

async function run() {
  await processImage('public/tshirt_front.png');
  await processImage('public/tshirt_back.png');
  await processImage('public/tshirt_side.png');
}

run();
