class TrainingDataGenerator {
  generateUniform(count) {
    const data = [];
    for (let i = 0; i < count; i++) {
      const h = Math.random() * 360;
      const s = 0.15 + Math.random() * 0.85;
      const v = 0.15 + Math.random() * 0.85;
      data.push(hsv2rgb(h, s, v));
    }
    const grayCount = Math.floor(count * 0.1);
    for (let i = 0; i < grayCount; i++) {
      const g = Math.random();
      data.push([g, g, g]);
    }
    return data.slice(0, count);
  }

  extractFeatures(rgb) {
    const [r, g, b] = rgb;
    const hsv = rgb2hsv(r, g, b);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const chroma = mx - mn;
    const intensity = (r + g + b) / 3;
    const hueRad = hsv.h * Math.PI / 180;
    return [
      Math.sin(hueRad),
      Math.cos(hueRad),
      hsv.s,
      hsv.v,
      chroma,
      intensity,
      chroma > 0.08 ? 1 : 0,
      Math.round(hsv.h / 30) % 12 / 12,
    ];
  }

  buildDataset(count) {
    const colors = this.generateUniform(count);
    const inputs = [], outputs = [];
    for (const rgb of colors) {
      inputs.push(this.extractFeatures(rgb));
      outputs.push(rgb);
    }
    return { inputs, outputs, colors };
  }

  getFeatureLabels() {
    return ['sin(色相)', 'cos(色相)', '飽和度', '明度', '彩度', '強度', '有彩色', '色相帶'];
  }
}
