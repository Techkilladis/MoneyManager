// Draws the Money Manager logo (indigo gradient + white wallet) and writes
// every icon asset. Run: node scripts/generate-icons.js
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const SIZE = 1024;
const SS = 3; // supersampling per axis
const A = [30, 27, 75]; // #1E1B4B
const B = [79, 70, 229]; // #4F46E5

// signed distance to a rounded rect centred at (cx, cy)
function sdRoundRect(x, y, cx, cy, w, h, r) {
  const qx = Math.abs(x - cx) - (w / 2 - r);
  const qy = Math.abs(y - cy) - (h / 2 - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}
const sdCircle = (x, y, cx, cy, r) => Math.hypot(x - cx, y - cy) - r;
const cover = (d) => Math.min(1, Math.max(0, 0.5 - d)); // 1px antialias

function gradient(x, y) {
  const t = Math.min(1, Math.max(0, (x + y) / (2 * SIZE)));
  return A.map((a, i) => a + (B[i] - a) * t);
}

// Wallet glyph layers, centred on the canvas. Returns {white, cut} coverage.
function glyph(x, y) {
  const cx = 512;
  // card peeking out of the top
  const card = sdRoundRect(x, y, cx, 372, 400, 150, 44);
  // wallet body
  const body = sdRoundRect(x, y, cx, 560, 560, 380, 92);
  // clasp (pill on the right edge) and its dot
  const clasp = sdRoundRect(x, y, 690, 570, 190, 130, 65);
  const dot = sdCircle(x, y, 715, 570, 22);
  const white = Math.max(cover(body), cover(card) * 0.62);
  // cut = the clasp area drawn in brand colour, with a white dot
  const cut = cover(clasp);
  const dotCover = cover(dot);
  return { white, cut, dotCover };
}

function render({ background, glyphMode, rounded }) {
  const png = new PNG({ width: SIZE, height: SIZE });
  for (let py = 0; py < SIZE; py++) {
    for (let px = 0; px < SIZE; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = px + (sx + 0.5) / SS;
          const y = py + (sy + 0.5) / SS;
          let col = [0, 0, 0], alpha = 0;
          if (background) {
            const inside = rounded ? cover(sdRoundRect(x, y, 512, 512, SIZE, SIZE, 224)) : 1;
            col = gradient(x, y);
            alpha = inside;
          }
          if (glyphMode) {
            const gl = glyph(x, y);
            if (glyphMode === 'mono') {
              // white glyph, clasp cut out, dot kept
              const w = Math.max(0, gl.white * (1 - gl.cut)) + gl.dotCover;
              col = [255, 255, 255];
              alpha = Math.min(1, w);
            } else {
              const base = gradient(x, y);
              // body/card over background
              const w = gl.white;
              col = col.map((c, i) => c * (1 - w) + 255 * w);
              alpha = Math.max(alpha, w);
              // clasp in brand colour, then white dot
              col = col.map((c, i) => c * (1 - gl.cut) + base[i] * gl.cut);
              alpha = Math.max(alpha, gl.cut);
              col = col.map((c) => c * (1 - gl.dotCover) + 255 * gl.dotCover);
              alpha = Math.max(alpha, gl.dotCover);
            }
          }
          r += col[0] * alpha; g += col[1] * alpha; b += col[2] * alpha; a += alpha;
        }
      }
      const n = SS * SS;
      const o = (py * SIZE + px) * 4;
      const alpha = a / n;
      png.data[o] = alpha > 0 ? Math.round(r / a) : 0;
      png.data[o + 1] = alpha > 0 ? Math.round(g / a) : 0;
      png.data[o + 2] = alpha > 0 ? Math.round(b / a) : 0;
      png.data[o + 3] = Math.round(alpha * 255);
    }
  }
  return png;
}

function write(name, png, size) {
  let out = png;
  if (size && size !== SIZE) {
    out = new PNG({ width: size, height: size });
    const k = SIZE / size;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0, c = 0;
      for (let yy = 0; yy < k; yy++) for (let xx = 0; xx < k; xx++) {
        const o = (Math.floor(y * k + yy) * SIZE + Math.floor(x * k + xx)) * 4;
        const al = png.data[o + 3];
        r += png.data[o] * al; g += png.data[o + 1] * al; b += png.data[o + 2] * al; a += al; c++;
      }
      const o = (y * size + x) * 4;
      out.data[o] = a ? Math.round(r / a) : 0; out.data[o + 1] = a ? Math.round(g / a) : 0;
      out.data[o + 2] = a ? Math.round(b / a) : 0; out.data[o + 3] = Math.round(a / c);
    }
  }
  fs.writeFileSync(path.join(__dirname, '..', 'assets', name), PNG.sync.write(out));
  console.log('wrote', name);
}

write('icon.png', render({ background: true, glyphMode: 'color', rounded: false }));
write('android-icon-background.png', render({ background: true }));
write('android-icon-foreground.png', render({ glyphMode: 'color' }));
write('android-icon-monochrome.png', render({ glyphMode: 'mono' }));
write('splash-icon.png', render({ background: true, glyphMode: 'color', rounded: true }));
write('favicon.png', render({ background: true, glyphMode: 'color', rounded: true }), 48);
