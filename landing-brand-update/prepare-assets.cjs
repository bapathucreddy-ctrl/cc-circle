const fs = require('node:fs');
const path = require('node:path');
const sharp = require('../.local-tools/reel-renderer/node_modules/sharp');
const names = ['bridal-makeup','party-makeup','festive-makeup','wedding-photography','portrait-photography','product-photography','bridal-hair','party-hair','video-editing','reel-editing','brand-content','event-reels'];
(async () => {
  for (const name of names) await sharp(path.join(__dirname,'../mobile/assets/services',name+'.jpg')).resize(1000,1000,{fit:'cover'}).webp({quality:85}).toFile(path.join(__dirname,'dist/assets',name+'.webp'));
  for (const color of ['black','white']) fs.copyFileSync(path.join(__dirname,'../mobile/assets/brand/mark-'+color+'.svg'),path.join(__dirname,'dist/assets/mark-'+color+'.svg'));
})();
