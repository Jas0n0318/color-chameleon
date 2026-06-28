class Renderer {
  constructor(canvas) {
    this.canvas = typeof canvas === 'string' ? document.getElementById(canvas) : canvas;
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
  }

  resize() {
    const p = this.canvas.parentElement;
    if (!p) return;
    this.w = p.clientWidth;
    this.h = p.clientHeight;
    this.canvas.width = this.w;
    this.canvas.height = this.h;
  }

  _resize() {
    const p = this.canvas.parentElement;
    if (!p) return;
    this.w = p.clientWidth;
    this.h = p.clientHeight;
    this.canvas.width = this.w;
    this.canvas.height = this.h;
  }

  drawScene(level, user, target, timeLeft) {
    this._resize();
    const { w, h, ctx } = this;
    const s = Math.min(w, h);
    const [tr, tg, tb] = hsv2rgb(target.h, target.s, target.v);
    const [ur, ug, ub] = hsv2rgb(user.h, user.s, user.v);

    // solid background = target color
    ctx.fillStyle = rgb2hex(tr, tg, tb);
    ctx.fillRect(0, 0, w, h);

    this._drawChameleon(w * 0.3, h * 0.55, s * 0.2, tr, tg, tb);
    this._drawChameleon(w * 0.7, h * 0.55, s * 0.2, ur, ug, ub);

    // labels
    ctx.fillStyle = this._contrastColor(tr, tg, tb);
    ctx.font = `bold ${Math.round(s * 0.035)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('目標', w * 0.3, h * 0.78);
    ctx.fillText('你的變色龍', w * 0.7, h * 0.78);

    // level + timer HUD
    const hud = `第${level + 1}關  ${Math.max(0, Math.ceil(timeLeft))}s`;
    ctx.font = `bold ${Math.round(s * 0.04)}px monospace`;
    ctx.textAlign = 'center';
    const tw = ctx.measureText(hud).width;
    const pad = s * 0.025;
    const bx = w / 2 - tw / 2 - pad;
    const bw = tw + pad * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.roundRect(bx, s * 0.05, bw, s * 0.065, s * 0.015);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(hud, w / 2, s * 0.098);
  }

  _drawChameleon(cx, cy, size, r, g, b) {
    const { ctx } = this;
    const bodyW = size * 0.7;
    const bodyH = size * 0.35;
    const headR = size * 0.22;
    const legL = size * 0.22;

    ctx.save();
    ctx.translate(cx, cy);

    // body
    ctx.fillStyle = rgb2hex(r, g, b);
    ctx.beginPath();
    ctx.ellipse(0, 0, bodyW, bodyH, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // head
    ctx.beginPath();
    ctx.arc(bodyW * 0.6, -bodyH * 0.2, headR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // eye
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(bodyW * 0.6 + headR * 0.2, -bodyH * 0.2 - headR * 0.2, headR * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(bodyW * 0.6 + headR * 0.3, -bodyH * 0.2 - headR * 0.2, headR * 0.12, 0, Math.PI * 2);
    ctx.fill();

    // legs
    ctx.strokeStyle = rgb2hex(r * 0.7, g * 0.7, b * 0.7);
    ctx.lineWidth = 3;
    const lx = [bodyW * -0.2, bodyW * 0.2, bodyW * -0.2, bodyW * 0.2];
    const ly = [bodyH * 0.6, bodyH * 0.6, bodyH * -0.4, bodyH * -0.4];
    const ldir = [1, 1, -1, -1];
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(lx[i], ly[i]);
      ctx.lineTo(lx[i] + ldir[i] * legL * 1.2, ly[i] + legL);
      ctx.stroke();
    }

    // tail spiral
    ctx.strokeStyle = rgb2hex(r * 0.8, g * 0.8, b * 0.8);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let t = 0; t < 1; t += 0.05) {
      const a = t * Math.PI * 2.5;
      const tr = -bodyW * 0.75 - t * size * 0.3;
      const ty = Math.sin(a) * size * 0.1 * (1 - t * 0.3);
      t === 0 ? ctx.moveTo(-bodyW * 0.5, 0) : ctx.lineTo(tr, ty);
    }
    ctx.stroke();

    ctx.restore();
  }

  _contrastColor(r, g, b) {
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    return lum > 0.5 ? '#222' : '#eee';
  }

  drawTrainingChart(history, canvasId) {
    const cvs = typeof canvasId === 'string' ? document.getElementById(canvasId) : canvasId;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    const w = cvs.width = cvs.clientWidth;
    const h = cvs.height = cvs.clientHeight;
    ctx.clearRect(0, 0, w, h);

    const acc = history.accuracy || [];
    const valAcc = history.valAccuracy || [];
    const loss = history.loss || [];
    const mae = history.mae || [];

    if (!loss.length || loss.length < 2) {
      ctx.fillStyle = '#ccc';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('訓練後顯示曲線', w / 2, h / 2);
      return;
    }

    const pad = { t: 10, r: 14, b: 22, l: 34 };
    const pw = w - pad.l - pad.r;
    const ph = h - pad.t - pad.b;
    const n = loss.length;
    const xScale = (i) => pad.l + (i / Math.max(n - 1, 1)) * pw;

    // ── left axis: accuracy 0‑100 ──
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#999';
    ctx.fillText('正確率 %', pad.l - 4, pad.t + 8);
    for (let i = 0; i <= 4; i++) {
      const v = i * 25;
      const y = pad.t + ph * (1 - v / 100);
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
      ctx.fillStyle = '#999';
      ctx.fillText(String(v), pad.l - 4, y + 3);
    }

    // ── right axis: Loss / MAE ──
    const yMaxLoss = Math.max(...loss, ...mae) * 1.2 || 1;
    const lossYP = (v) => pad.t + ph * (1 - v / yMaxLoss);
    const rAxisX = w - pad.r + 4;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#bbb';
    ctx.font = '8px sans-serif';
    ctx.fillText('Loss', rAxisX + 2, pad.t + 8);
    ctx.fillText('MAE', rAxisX + 16, pad.t + 16);
    for (let i = 0; i <= 3; i++) {
      const v = (yMaxLoss / 3) * i;
      const y = lossYP(v);
      ctx.fillStyle = '#ccc';
      ctx.fillText(v.toFixed(2), rAxisX + 2, y + 3);
    }

    // ── draw series ──
    // accuracy (prominent solid green)
    ctx.strokeStyle = '#16a34a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i < acc.length; i++) {
      const x = xScale(i);
      const y = pad.t + ph * (1 - acc[i] / 100);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();

    // valAccuracy (dashed lighter green)
    if (valAcc.length > 1) {
      ctx.strokeStyle = '#86efac';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      for (let i = 0; i < valAcc.length; i++) {
        const x = xScale(i);
        const y = pad.t + ph * (1 - valAcc[i] / 100);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // loss (thin red)
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i < loss.length; i++) {
      const x = xScale(i);
      const y = lossYP(loss[i]);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();

    // mae (thin blue)
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i < mae.length; i++) {
      const x = xScale(i);
      const y = lossYP(mae[i]);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();

    // ── legend ──
    const legend = [
      { label: '正確率', color: '#16a34a', dash: false },
      { label: '驗證正確率', color: '#86efac', dash: true },
      { label: 'Loss', color: '#dc2626', dash: false },
      { label: 'MAE', color: '#2563eb', dash: false },
    ];
    const lx = pad.l + 4, ly = pad.t + ph - 6;
    ctx.textAlign = 'left';
    ctx.font = '9px sans-serif';
    legend.forEach((item, idx) => {
      const xx = lx + idx * (w * 0.2 + 24);
      ctx.strokeStyle = item.color;
      ctx.lineWidth = 1.5;
      item.dash ? ctx.setLineDash([3, 3]) : ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(xx, ly); ctx.lineTo(xx + 16, ly); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#666';
      ctx.fillText(item.label, xx + 20, ly + 3);
    });

    // x axis
    ctx.fillStyle = '#aaa';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('1', pad.l, h - 4);
    ctx.fillText(String(n), w - pad.r, h - 4);
    ctx.fillText('Epoch', w / 2, h - 4);
  }

  drawResultOverlay(result) {
    this._resize();
    const { w, h, ctx } = this;
    const s = Math.min(w, h);

    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(0, 0, w, h);

    const icon = result.pass ? '✓' : '✗';
    const msg = result.pass
      ? `第${result.level + 1}關 通過！`
      : `第${result.level + 1}關 失敗`;
    ctx.fillStyle = result.pass ? '#2e7d32' : '#c62828';
    ctx.font = `bold ${Math.round(s * 0.07)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(`${icon} ${msg}`, w / 2, h * 0.3);

    ctx.fillStyle = '#333';
    ctx.font = `${Math.round(s * 0.035)}px monospace`;
    ctx.fillText(
      `誤差: ${(result.diff * 100).toFixed(1)}%  /  容許: ${(result.tol * 100).toFixed(1)}%`,
      w / 2, h * 0.44
    );

    if (!result.pass) {
      ctx.fillStyle = '#555';
      ctx.font = `${Math.round(s * 0.03)}px monospace`;
      ctx.fillText('色差超過關卡容許值...', w / 2, h * 0.54);
    }
  }

  drawVictoryOverlay() {
    this._resize();
    const { w, h, ctx } = this;
    const s = Math.min(w, h);

    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#1b5e20';
    ctx.font = `bold ${Math.round(s * 0.07)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('🎉 全部通關！', w / 2, h * 0.35);

    ctx.fillStyle = '#444';
    ctx.font = `${Math.round(s * 0.035)}px monospace`;
    ctx.fillText('你通過了所有 5 個關卡', w / 2, h * 0.48);
  }


}
