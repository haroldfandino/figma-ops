#!/usr/bin/env node
// Split a tall screenshot into vertical parts that render reliably in Figma clients.
// Figma fails to render images taller than ~8000px (empirically: 7811 OK, 10203 broken).
//
// Usage:
//   node split-image.js <image.png> [--max=8000] [--jpeg=85] [--out=DIR]
//
// Output: <name>_p1..<name>_pN next to the source (or --out), printed with dimensions
// and the display height to use in Figma at a 720px-wide box (scale 720/sourceWidth).
// If the image is under the limit (and --jpeg is not set) it prints "no split needed".

const sharp = require('sharp');
const path = require('path');

const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith('--'));
const flags = Object.fromEntries(
  args.filter((a) => a.startsWith('--')).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v === undefined ? true : v];
  })
);

if (positional.length < 1) {
  console.error('Usage: node split-image.js <image.png> [--max=8000] [--jpeg=85] [--out=DIR]');
  process.exit(1);
}

const src = positional[0];
const maxH = parseInt(flags.max || '8000', 10);
const jpegQ = flags.jpeg ? parseInt(flags.jpeg, 10) : 0;
const outDir = flags.out || path.dirname(src);
const base = path.basename(src, path.extname(src)).replace(/_full$/, '');

(async () => {
  const meta = await sharp(src).metadata();
  const { width: w, height: h } = meta;
  const disp = (x) => Math.round((x * 720) / w);

  if (h <= maxH && !jpegQ) {
    console.log(`${base}: ${w}x${h} - no split needed (display: 720x${disp(h)})`);
    return;
  }

  const parts = Math.max(1, Math.ceil(h / maxH));
  const partH = Math.ceil(h / parts);
  for (let i = 0; i < parts; i++) {
    const top = i * partH;
    const thisH = Math.min(partH, h - top);
    let img = sharp(src).extract({ left: 0, top, width: w, height: thisH });
    let out;
    if (jpegQ) {
      out = path.join(outDir, `${base}_p${i + 1}.jpg`);
      img = img.jpeg({ quality: jpegQ });
    } else {
      out = path.join(outDir, `${base}_p${i + 1}.png`);
    }
    await img.toFile(out);
    console.log(`${out}: ${w}x${thisH} (display: 720x${disp(thisH)})`);
  }
})();
