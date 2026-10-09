const Jimp = require('jimp');
const pngToIco = require('png-to-ico');
const fs = require('fs');

async function run() {
  try {
    const image = await Jimp.read('d:\\\\SystemAdminTasker\\\\public\\\\pwa-512x512.png');
    image.resize(256, 256);
    await image.writeAsync('d:\\\\SystemAdminTasker\\\\public\\\\temp_icon.png');
    const buf = await pngToIco('d:\\\\SystemAdminTasker\\\\public\\\\temp_icon.png');
    fs.writeFileSync('d:\\\\SystemAdminTasker\\\\public\\\\app-icon.ico', buf);
    console.log('Successfully created app-icon.ico');
  } catch(e) {
    console.error(e);
  }
}
run();
