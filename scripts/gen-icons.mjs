import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const OUT = path.join(process.cwd(), "public", "icons");
await mkdir(OUT, { recursive: true });

// The IronPath reactor mark, rendered on the dark brand background.
function svg(size, padded) {
  const pad = padded ? 0.16 : 0; // maskable safe zone
  const s = 512;
  const inset = s * pad;
  const vb = s;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${vb} ${vb}">
  <defs>
    <linearGradient id="molten" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ff8a4c"/>
      <stop offset="55%" stop-color="#ff6a2c"/>
      <stop offset="100%" stop-color="#ff3d2e"/>
    </linearGradient>
    <radialGradient id="core" cx="50%" cy="45%" r="60%">
      <stop offset="0%" stop-color="#fff6ec"/>
      <stop offset="38%" stop-color="#ff8a4c"/>
      <stop offset="100%" stop-color="#ff3d2e"/>
    </radialGradient>
    <radialGradient id="bg" cx="50%" cy="30%" r="90%">
      <stop offset="0%" stop-color="#151d2b"/>
      <stop offset="100%" stop-color="#0b0e14"/>
    </radialGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ff6a2c" stop-opacity="0.45"/>
      <stop offset="70%" stop-color="#ff6a2c" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${vb}" height="${vb}" rx="${padded ? 0 : 96}" fill="url(#bg)"/>
  <g transform="translate(${inset},${inset}) scale(${(s - 2 * inset) / s})">
    <circle cx="256" cy="256" r="220" fill="url(#glow)"/>
    <circle cx="256" cy="256" r="180" fill="none" stroke="#2a3646" stroke-width="12"/>
    <circle cx="256" cy="256" r="180" fill="none" stroke="url(#molten)" stroke-width="14" stroke-linecap="round" stroke-dasharray="900 1200" transform="rotate(-90 256 256)"/>
    <g stroke="#ff6a2c" stroke-width="7" opacity="0.55">
      ${Array.from({ length: 12 })
        .map((_, i) => {
          const a = (i / 12) * Math.PI * 2;
          const x1 = 256 + Math.cos(a) * 132;
          const y1 = 256 + Math.sin(a) * 132;
          const x2 = 256 + Math.cos(a) * 152;
          const y2 = 256 + Math.sin(a) * 152;
          return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`;
        })
        .join("")}
    </g>
    <polygon points="256,150 348,203 348,309 256,362 164,309 164,203" fill="none" stroke="url(#molten)" stroke-width="9"/>
    <circle cx="256" cy="256" r="66" fill="url(#core)"/>
    <circle cx="256" cy="256" r="34" fill="#fff3e6" opacity="0.92"/>
  </g>
</svg>`;
}

async function render(name, size, padded = false) {
  await sharp(Buffer.from(svg(size, padded))).png().toFile(path.join(OUT, name));
  console.log("wrote", name);
}

await render("icon-192.png", 192);
await render("icon-512.png", 512);
await render("apple-icon.png", 180);
await render("maskable-512.png", 512, true);
console.log("done");
