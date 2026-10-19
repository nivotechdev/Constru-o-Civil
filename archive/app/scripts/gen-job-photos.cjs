// Renders the sample job photos in img/jobs/ (used by a few seed jobs to show the photo
// carousels). They are illustrated scenes rather than stock photos so the repo carries no
// third-party image licences. Run: node scripts/gen-job-photos.cjs (needs Playwright).
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const W = 1200, H = 900;
const OUT = path.join(__dirname, '..', 'img', 'jobs');

// ---------- shared pieces ----------
const defs = `
  <filter id="grain" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" result="n"/>
    <feColorMatrix type="saturate" values="0"/>
    <feComponentTransfer><feFuncA type="linear" slope="0.07"/></feComponentTransfer>
  </filter>
  <filter id="soft"><feGaussianBlur stdDeviation="6"/></filter>
  <filter id="shadow" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="14" stdDeviation="14" flood-color="#000" flood-opacity="0.28"/></filter>
  <radialGradient id="vignette" cx="50%" cy="45%" r="75%"><stop offset="60%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="0.35"/></radialGradient>
  <linearGradient id="skyDay" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5E9BE0"/><stop offset="0.7" stop-color="#A9CDF0"/><stop offset="1" stop-color="#DCEBF7"/></linearGradient>
  <linearGradient id="skyGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3D5A8C"/><stop offset="0.55" stop-color="#E7996B"/><stop offset="1" stop-color="#F6CE8E"/></linearGradient>
  <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#B99A77"/><stop offset="1" stop-color="#8A6E52"/></linearGradient>
  <linearGradient id="metal" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9AA3AE"/><stop offset="0.5" stop-color="#E4E8EC"/><stop offset="1" stop-color="#8A939F"/></linearGradient>
  <linearGradient id="wood" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#B7803F"/><stop offset="1" stop-color="#8E5A25"/></linearGradient>
`;
const finish = `<rect width="${W}" height="${H}" fill="url(#vignette)"/><rect width="${W}" height="${H}" filter="url(#grain)"/>`;
const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><defs>${defs}</defs>${body}${finish}</svg>`;

// Deterministic pseudo-random, so re-running produces the same images.
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const shade = (hex, amt) => {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, Math.round(v + amt * 255)));
  return '#' + [c(n >> 16), c((n >> 8) & 255), c(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('');
};

function bricks({ x, y, w, rows, bw = 96, bh = 40, gap = 7, base = '#B5532F', stepEvery = 0 }) {
  let out = `<rect x="${x - 4}" y="${y - rows * (bh + gap) - 2}" width="${w + 8}" height="${rows * (bh + gap) + 6}" fill="#CFC2B0"/>`;
  for (let r = 0; r < rows; r++) {
    const rowY = y - (r + 1) * (bh + gap);
    const cut = stepEvery ? Math.floor(r / stepEvery) * bw * 0.5 : 0;
    const off = r % 2 ? -bw / 2 : 0;
    for (let bx = x + off; bx < x + w - cut; bx += bw + gap) {
      const x0 = Math.max(bx, x), x1 = Math.min(bx + bw, x + w - cut);
      if (x1 - x0 < 8) continue;
      const col = shade(base, (rnd() - 0.5) * 0.12);
      out += `<rect x="${x0}" y="${rowY}" width="${x1 - x0}" height="${bh}" rx="2" fill="${col}"/>`;
      out += `<rect x="${x0}" y="${rowY}" width="${x1 - x0}" height="5" fill="#fff" opacity="0.08"/>`;
    }
  }
  return out;
}

// ---------- scenes ----------
const scenes = {
  // Pedreiro: wall going up, mortar tub and trowel
  'pedreiro-1': () => svg(`
    <rect width="${W}" height="${H}" fill="url(#skyDay)"/>
    <circle cx="980" cy="150" r="70" fill="#FFF6D5" opacity="0.9"/>
    <path d="M0 560 Q300 520 620 548 T1200 530 V900 H0Z" fill="#8FA876" opacity="0.6"/>
    <rect y="640" width="${W}" height="260" fill="url(#ground)"/>
    <g filter="url(#shadow)">${bricks({ x: 120, y: 660, w: 900, rows: 9, stepEvery: 3 })}</g>
    <rect x="160" y="200" width="620" height="18" rx="4" fill="#E6B800" filter="url(#shadow)"/>
    <rect x="430" y="203" width="70" height="12" rx="6" fill="#9BE08C" stroke="#2F6B2A" stroke-width="3"/>
    <g filter="url(#shadow)"><path d="M820 760 L1080 760 L1050 870 L850 870Z" fill="#2C2F33"/><ellipse cx="950" cy="760" rx="130" ry="22" fill="#9C958C"/></g>
    <g transform="translate(700 800) rotate(-18)" filter="url(#shadow)"><path d="M0 0 L150 -40 L160 0 Z" fill="url(#metal)"/><rect x="150" y="-34" width="80" height="22" rx="10" fill="url(#wood)"/></g>`),
  'pedreiro-2': () => svg(`
    <rect width="${W}" height="${H}" fill="#D9D2C7"/>
    ${bricks({ x: 0, y: 900, w: 1200, rows: 19, bw: 120, bh: 42, gap: 6, base: '#A94E2C' })}
    <path d="M0 0 H640 Q600 250 660 420 T620 900 H0Z" fill="#C9C3BA"/>
    <path d="M0 0 H640 Q600 250 660 420 T620 900 H0Z" fill="#fff" opacity="0.18" filter="url(#soft)"/>
    <g transform="translate(560 380) rotate(-28)" filter="url(#shadow)"><rect x="0" y="0" width="300" height="70" rx="8" fill="#DCE1E6"/><rect x="0" y="0" width="300" height="12" rx="6" fill="#fff" opacity="0.6"/><rect x="120" y="-70" width="40" height="70" rx="8" fill="#3B3F45"/><rect x="95" y="-110" width="90" height="46" rx="20" fill="url(#wood)"/></g>`),
  'pedreiro-3': () => svg(`
    <rect width="${W}" height="${H}" fill="url(#skyGold)"/>
    <rect y="700" width="${W}" height="200" fill="#6E5A45"/>
    <g fill="#8A8F96" filter="url(#shadow)">
      <rect x="260" y="250" width="620" height="26"/><rect x="260" y="470" width="620" height="26"/><rect x="260" y="690" width="620" height="26"/>
      <rect x="280" y="250" width="34" height="460"/><rect x="560" y="250" width="34" height="460"/><rect x="826" y="250" width="34" height="460"/>
    </g>
    ${bricks({ x: 314, y: 690, w: 246, rows: 5, bw: 60, bh: 26, gap: 5 })}
    <g stroke="#E0A020" stroke-width="12" fill="none"><path d="M980 700 V110 H620"/><path d="M980 180 L1080 110 H980"/></g>
    <line x1="700" y1="118" x2="700" y2="330" stroke="#444" stroke-width="4"/><rect x="670" y="330" width="60" height="30" fill="#444"/>`),

  // Pintor: roller on a half-painted wall, ladder room
  'pintor-1': () => svg(`
    <rect width="${W}" height="${H}" fill="#E9E4DA"/>
    <path d="M0 0 H760 C720 200 790 360 740 520 C700 660 780 780 740 900 H0Z" fill="#3E8E86"/>
    <path d="M740 0 C720 200 790 360 740 520 C700 660 780 780 740 900" stroke="#2F7169" stroke-width="10" fill="none" opacity="0.5"/>
    <g transform="translate(620 180) rotate(12)" filter="url(#shadow)">
      <rect x="0" y="0" width="260" height="110" rx="46" fill="#3E8E86"/><rect x="0" y="0" width="260" height="30" rx="15" fill="#fff" opacity="0.2"/>
      <path d="M270 55 H330 V300" stroke="#C9CED4" stroke-width="16" fill="none" stroke-linecap="round"/>
      <rect x="310" y="300" width="42" height="220" rx="20" fill="#E0B23F"/>
    </g>
    <g filter="url(#shadow)"><path d="M120 900 L180 760 H480 L520 900Z" fill="#3B4550"/><path d="M180 760 H480 L470 800 H190Z" fill="#3E8E86"/></g>`),
  'pintor-2': () => svg(`
    <rect width="${W}" height="${H}" fill="#F1EEE8"/>
    <rect x="680" y="120" width="360" height="420" fill="#CFE4F5"/><rect x="680" y="120" width="360" height="420" fill="none" stroke="#fff" stroke-width="22"/><line x1="860" y1="120" x2="860" y2="540" stroke="#fff" stroke-width="14"/>
    <polygon points="680,540 1040,540 1200,900 520,900" fill="#FFFBE8" opacity="0.55"/>
    <rect y="700" width="${W}" height="200" fill="#C7B8A2"/>
    <path d="M0 720 L1200 700 V900 H0Z" fill="#E9E3D6" opacity="0.8"/>
    <g stroke="#C08A4A" stroke-width="22" stroke-linecap="round" filter="url(#shadow)"><line x1="260" y1="820" x2="380" y2="160"/><line x1="520" y1="820" x2="400" y2="160"/>
      ${[260, 380, 500, 620, 740].map((y) => { const k = (820 - y) / 660 * 120; return `<line x1="${260 + k}" y1="${y}" x2="${520 - k}" y2="${y}"/>`; }).join('')}</g>
    <g filter="url(#shadow)"><rect x="620" y="720" width="120" height="130" rx="10" fill="#DDE3E8"/><rect x="620" y="720" width="120" height="30" fill="#3E8E86"/><rect x="770" y="750" width="100" height="100" rx="10" fill="#DDE3E8"/><rect x="770" y="750" width="100" height="24" fill="#E8C35A"/></g>`),

  // Azulejista: big porcelain tiles going down, spacers and notched trowel
  'azulejista-1': () => {
    let t = '';
    const size = 300, g = 8;
    for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) {
      if (r === 3 && c > 2) continue;
      const col = shade('#D8D4CE', (rnd() - 0.5) * 0.05);
      t += `<rect x="${c * (size + g) - 60}" y="${r * (size + g) - 80}" width="${size}" height="${size}" fill="${col}"/>`;
      t += `<path d="M${c * (size + g) - 60} ${r * (size + g) - 80 + size * rnd()} q${size / 2} ${-40 + 80 * rnd()} ${size} ${-20 + 40 * rnd()}" stroke="#BFB9B0" stroke-width="3" fill="none" opacity="0.6"/>`;
    }
    return svg(`
      <rect width="${W}" height="${H}" fill="#8C8680"/>
      <rect x="860" y="850" width="400" height="100" fill="#9A938B"/>
      <path d="M800 850 h400 v60 h-400z" fill="#77706A"/>
      ${t}
      <g fill="#fff">${[[240, 220], [548, 220], [240, 528], [856, 528], [548, 836]].map(([x, y]) => `<path d="M${x - 16} ${y - 4} h32 v8 h-32z M${x - 4} ${y - 16} h8 v32 h-8z"/>`).join('')}</g>
      <g transform="translate(900 620) rotate(-24)" filter="url(#shadow)"><path d="M0 0 H240 V120 H0Z" fill="url(#metal)"/><path d="M0 120 ${Array.from({ length: 12 }, (_, i) => `L${i * 20 + 10} 136 L${i * 20 + 20} 120`).join(' ')}" fill="#AAB2BB"/><rect x="90" y="-60" width="60" height="60" fill="#444"/><rect x="60" y="-110" width="120" height="56" rx="24" fill="#2B63D9"/></g>`);
  },
  'azulejista-2': () => {
    let t = '';
    for (let r = 0; r < 16; r++) for (let c = 0; c < 10; c++) {
      const x = c * 124 + (r % 2 ? -62 : 0), y = r * 62;
      t += `<rect x="${x}" y="${y}" width="120" height="58" rx="4" fill="${shade('#F4F6F7', (rnd() - 0.5) * 0.04)}"/>`;
    }
    return svg(`
      <rect width="${W}" height="${H}" fill="#C9D0D6"/>${t}
      <rect x="430" y="260" width="340" height="380" rx="6" fill="#9FB4C3"/><rect x="430" y="260" width="340" height="380" rx="6" fill="none" stroke="#fff" stroke-width="10"/>
      <rect x="450" y="500" width="300" height="14" fill="#fff"/>
      <g filter="url(#shadow)"><rect x="500" y="420" width="46" height="80" rx="10" fill="#E8C35A"/><rect x="580" y="440" width="60" height="60" rx="30" fill="#3E8E86"/><rect x="660" y="400" width="40" height="100" rx="10" fill="#E5E7EA"/></g>
      <rect x="0" y="0" width="${W}" height="${H}" fill="#fff" opacity="0.06"/>`);
  },

  // Eletricista: breaker panel, wires from the wall
  'eletricista-1': () => svg(`
    <rect width="${W}" height="${H}" fill="#D9D6D0"/>
    <g filter="url(#shadow)"><rect x="330" y="110" width="540" height="680" rx="18" fill="#E6E9EC"/><rect x="360" y="140" width="480" height="620" rx="10" fill="#C3C9D1"/></g>
    ${[0, 1, 2, 3].map((row) => `<rect x="380" y="${190 + row * 140}" width="440" height="100" rx="6" fill="#2F3742"/>` +
      Array.from({ length: 8 }, (_, i) => `<g><rect x="${392 + i * 54}" y="${200 + row * 140}" width="46" height="80" rx="4" fill="#F2F4F6"/><rect x="${404 + i * 54}" y="${(rnd() > 0.5 ? 212 : 238) + row * 140}" width="22" height="30" rx="3" fill="${rnd() > 0.8 ? '#D9534F' : '#434C57'}"/></g>`).join('')).join('')}
    <g fill="none" stroke-width="16" stroke-linecap="round">
      <path d="M430 790 C420 850 300 860 250 900" stroke="#1E5BD8"/><path d="M500 790 C500 860 460 880 470 900" stroke="#C0392B"/><path d="M600 790 C620 850 700 860 720 900" stroke="#2E9E4F"/><path d="M700 790 C740 840 860 850 900 900" stroke="#E0A020"/>
    </g>`),
  'eletricista-2': () => svg(`
    <rect width="${W}" height="${H}" fill="#CDBFAE"/>
    <path d="M0 0 H${W} V900 H0Z" fill="#C4B5A2"/>
    <g stroke="#9C8D7A" stroke-width="3" opacity="0.5">${Array.from({ length: 14 }, (_, i) => `<line x1="0" y1="${i * 70}" x2="${W}" y2="${i * 70 + 10}"/>`).join('')}</g>
    <path d="M0 330 H1200" stroke="#E7E1D6" stroke-width="44"/><path d="M600 330 V900" stroke="#E7E1D6" stroke-width="44"/>
    <g filter="url(#shadow)"><rect x="520" y="420" width="160" height="220" rx="12" fill="#F1F2F4"/><rect x="545" y="450" width="110" height="160" rx="8" fill="#DDE1E6"/></g>
    <g fill="none" stroke-width="12" stroke-linecap="round"><path d="M580 520 C520 560 520 640 470 700" stroke="#1E5BD8"/><path d="M600 520 C600 600 640 660 620 740" stroke="#C0392B"/><path d="M620 520 C680 560 700 620 760 660" stroke="#2E9E4F"/></g>
    <g transform="translate(820 520) rotate(30)" filter="url(#shadow)"><rect x="0" y="0" width="40" height="200" rx="18" fill="#E0A020"/><rect x="8" y="200" width="24" height="120" fill="url(#metal)"/><path d="M8 320 L20 350 L32 320Z" fill="#AAB2BB"/></g>`)
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  for (const [name, make] of Object.entries(scenes)) {
    await page.setContent(`<body style="margin:0">${make()}</body>`);
    await page.screenshot({ path: path.join(OUT, name + '.jpg'), type: 'jpeg', quality: 78 });
    console.log('wrote', name);
  }
  await browser.close();
})();
