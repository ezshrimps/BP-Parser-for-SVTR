// Run with Node.js to generate placeholder icons
// node create-icons.js
const fs = require('fs');
const { createCanvas } = require('canvas'); // npm install canvas

const sizes = [16, 48, 128];

for (const size of sizes) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#1a73e8';
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, size * 0.15);
  ctx.fill();

  // Text "BP"
  ctx.fillStyle = 'white';
  ctx.font = `bold ${size * 0.42}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('BP', size / 2, size / 2);

  fs.writeFileSync(`icons/icon${size}.png`, canvas.toBuffer('image/png'));
  console.log(`Created icon${size}.png`);
}
