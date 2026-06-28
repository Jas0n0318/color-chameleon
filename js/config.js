const CONFIG = {
  training: {
    sampleCount: 6000,
    epochs: 40,
    batchSize: 128,
    validationSplit: 0.15,
    learningRate: 0.001,
  },
  game: {
    roundTime: 45,
    perfectDelta: 0.03,
    goodDelta: 0.08,
    passDelta: 0.15,
  },
  levels: [
    { name: '第1關', tolerance: 0.20 },
    { name: '第2關', tolerance: 0.15 },
    { name: '第3關', tolerance: 0.12 },
    { name: '第4關', tolerance: 0.08 },
    { name: '第5關', tolerance: 0.05 },
  ],
};

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function hsv2rgb(h, s, v) {
  h = ((h % 360) + 360) % 360;
  const i = Math.floor(h / 60);
  const f = h / 60 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const table = [
    [v, t, p], [q, v, p], [p, v, t],
    [p, q, v], [t, p, v], [v, p, q],
  ];
  return table[i % 6];
}

function rgb2hsv(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const d = mx - mn;
  let h = 0;
  if (d > 1e-6) {
    if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (mx === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  return { h: h % 360, s: mx === 0 ? 0 : d / mx, v: mx };
}

function deltaE(c1, c2) {
  const dr = c1[0] - c2[0], dg = c1[1] - c2[1], db = c1[2] - c2[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function rgb2hex(r, g, b) {
  const toHex = (v) => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hsv2hex(h, s, v) {
  const [r, g, b] = hsv2rgb(h, s, v);
  return rgb2hex(r, g, b);
}
