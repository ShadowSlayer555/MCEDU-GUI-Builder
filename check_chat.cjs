const fs = require('fs');
const text = fs.readFileSync('node_modules/@minecraft/server/index.d.ts', 'utf8');
const matched = text.match(/.{0,50}beforeEvents.{0,50}/g);
console.log(matched);
