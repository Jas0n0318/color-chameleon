class AICoach {
  constructor(model) {
    this.model = model;
  }

  analyze(targetHSV, userHSV) {
    const tHSV = this._asHSV(targetHSV);
    const uHSV = this._asHSV(userHSV);

    const tRGB = hsv2rgb(tHSV.h, tHSV.s, tHSV.v);
    const uRGB = hsv2rgb(uHSV.h, uHSV.s, uHSV.v);
    const diff = deltaE(tRGB, uRGB);

    const deltaH = this._angleDelta(tHSV.h, uHSV.h);
    const deltaS = tHSV.s - uHSV.s;
    const deltaV = tHSV.v - uHSV.v;

    const totalRGB = tRGB[0] + tRGB[1] + tRGB[2];
    const compT = totalRGB > 0 ? tRGB.map(c => c / totalRGB) : [1/3, 1/3, 1/3];
    const totalU = uRGB[0] + uRGB[1] + uRGB[2];
    const compU = totalU > 0 ? uRGB.map(c => c / totalU) : [1/3, 1/3, 1/3];

    const advice = [];
    const channelNames = ['紅', '綠', '藍'];

    for (let i = 0; i < 3; i++) {
      const ratioDelta = compT[i] - compU[i];
      if (Math.abs(ratioDelta) > 0.03) {
        if (ratioDelta > 0) {
          advice.push(`🔴 ${channelNames[i]}比例不足 (目標${(compT[i]*100).toFixed(0)}% : 目前${(compU[i]*100).toFixed(0)}%) — ${channelNames[i]}值偏低，導致${channelNames[(i+1)%3]}和${channelNames[(i+2)%3]}相對過重`);
        } else {
          advice.push(`🔴 ${channelNames[i]}比例過多 (目標${(compT[i]*100).toFixed(0)}% : 目前${(compU[i]*100).toFixed(0)}%) — 請降低 ${channelNames[i]} 值`);
        }
      }
    }

    if (Math.abs(deltaH) > 5) {
      const dir = deltaH > 0 ? '順時針' : '逆時針';
      advice.push(`🔄 色相差 ${Math.abs(deltaH).toFixed(0)}°，請將色相${dir}調整`);
    }

    if (Math.abs(deltaS) > 0.04) {
      if (deltaS > 0) {
        advice.push(`🎨 飽和度偏低 (目標${(tHSV.s*100).toFixed(0)}% : 目前${(uHSV.s*100).toFixed(0)}%) — 請將「飽和度」滑桿向右調高，讓顏色更鮮豔`);
      } else {
        advice.push(`🎨 飽和度過高 (目標${(tHSV.s*100).toFixed(0)}% : 目前${(uHSV.s*100).toFixed(0)}%) — 請將「飽和度」滑桿向左調低，讓顏色更柔和`);
      }
    }

    if (Math.abs(deltaV) > 0.04) {
      if (deltaV > 0) {
        advice.push(`☀️ 亮度不足 (目標${(tHSV.v*100).toFixed(0)}% : 目前${(uHSV.v*100).toFixed(0)}%) — 請將「亮度」滑桿向右調高`);
      } else {
        advice.push(`☀️ 亮度过高 (目標${(tHSV.v*100).toFixed(0)}% : 目前${(uHSV.v*100).toFixed(0)}%) — 請將「亮度」滑桿向左調暗`);
      }
    }

    if (advice.length === 0 && diff < 0.05) {
      advice.push('✨ 顏色非常接近了！微調即可完美');
    } else if (advice.length === 0) {
      advice.push('💡 試著同時調整色相和飽和度，觀察顏色變化');
    }

    return {
      diff,
      feedback: this._grade(diff),
      advice,
      hex: rgb2hex(tRGB[0], tRGB[1], tRGB[2]),
      compText: `RGB = ${(tRGB[0]*255).toFixed(0)}, ${(tRGB[1]*255).toFixed(0)}, ${(tRGB[2]*255).toFixed(0)}`,
    };
  }

  getInitialAdvice(h, s, v) {
    const rgb = hsv2rgb(h, s, v);
    const total = rgb[0] + rgb[1] + rgb[2];
    const comp = total > 0 ? rgb.map(c => (c / total * 100).toFixed(0)) : [33, 33, 33];
    const hueNames = ['紅', '橙', '黃', '黃綠', '綠', '青綠', '青', '藍', '紫藍', '紫', '粉紅', '紫紅'];
    const hueIdx = Math.floor((((h % 360) + 360) % 360) / 30);
    const hueName = hueNames[hueIdx];
    const satDesc = s > 0.6 ? '鮮豔' : s > 0.3 ? '中等' : '樸素';
    const valDesc = v > 0.7 ? '明亮' : v > 0.3 ? '適中' : '深暗';

    return {
      summary: `${hueName}色系 · ${satDesc} · ${valDesc}`,
      rgb: `R:${comp[0]}% G:${comp[1]}% B:${comp[2]}%`,
      hex: rgb2hex(rgb[0], rgb[1], rgb[2]),
      hint: `嘗試從色相(H)開始調整到正確色系，再用飽和度(S)和亮度(V)微調`,
    };
  }

  getPredictionFeedback(targetFeatures, model) {
    if (!model || !model.isTrained) return '';
    const predicted = model.predict(targetFeatures);
    if (!predicted) return '';
    const hsv = rgb2hsv(predicted[0], predicted[1], predicted[2]);
    return `AI 預測 → H:${hsv.h.toFixed(0)}° S:${(hsv.s*100).toFixed(0)}% V:${(hsv.v*100).toFixed(0)}%`;
  }

  _asHSV(v) {
    if (Array.isArray(v)) return { h: v[0], s: v[1], v: v[2] };
    return v;
  }

  _angleDelta(a, b) {
    let d = (a - b) % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d;
  }

  _grade(diff) {
    if (diff < CONFIG.game.perfectDelta) return { label: 'perfect', text: '完美！', color: '#22c55e' };
    if (diff < CONFIG.game.goodDelta) return { label: 'good', text: '很接近了', color: '#eab308' };
    if (diff < CONFIG.game.passDelta) return { label: 'pass', text: '還差一些', color: '#f97316' };
    return { label: 'far', text: '差距很大', color: '#ef4444' };
  }
}
