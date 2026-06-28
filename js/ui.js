class UI {
  constructor(model, renderer) {
    this.model = model;
    this.renderer = renderer;
    this._cacheElements();
    this._bindEvents();
  }

  _cacheElements() {
    this.panels = {
      training: document.getElementById('panel-training'),
      game: document.getElementById('panel-game'),
      gameover: document.getElementById('panel-gameover'),
    };
    this.training = {
      startBtn: document.getElementById('btn-start-training'),
      status: document.getElementById('train-status'),
      progress: document.getElementById('train-progress'),
      progressText: document.getElementById('train-progress-text'),
      dataGrid: document.getElementById('data-grid'),
      archBody: document.getElementById('arch-body'),
      paramsTotal: document.getElementById('total-params'),
      forwardBtn: document.getElementById('btn-forward-demo'),
      forwardResult: document.getElementById('forward-result'),
      testBtn: document.getElementById('btn-test-pred'),
      testResult: document.getElementById('test-result'),
      playBtn: document.getElementById('btn-play'),
    };
    this.game = {
      canvas: document.getElementById('game-canvas'),
      score: document.getElementById('score'),
      level: document.getElementById('level'),
      timer: document.getElementById('timer'),
      lives: document.getElementById('lives'),
      sliderH: document.getElementById('slider-h'),
      sliderS: document.getElementById('slider-s'),
      sliderV: document.getElementById('slider-v'),
      valH: document.getElementById('val-h'),
      valS: document.getElementById('val-s'),
      valV: document.getElementById('val-v'),
      rgbDisplay: document.getElementById('rgb-display'),
      hexDisplay: document.getElementById('hex-display'),
      coachMsg: document.getElementById('coach-msg'),
      coachAdvice: document.getElementById('coach-advice'),
      coachBox: document.getElementById('coach-box'),
      confirmBtn: document.getElementById('btn-confirm'),
    };
    this.gameover = {
      score: document.getElementById('final-score'),
      level: document.getElementById('final-level'),
      restartBtn: document.getElementById('btn-restart'),
    };
  }

  _bindEvents() {
    this.training.startBtn.addEventListener('click', () => this._onStartTraining());
    this.training.forwardBtn.addEventListener('click', () => this._runForwardDemo());
    this.training.testBtn.addEventListener('click', () => this._runTestPrediction());
    this.training.playBtn.addEventListener('click', () => this._onPlay());

    if (this.game.sliderH) {
      this.game.sliderH.addEventListener('input', () => this._dispatchGameInput());
      this.game.sliderS.addEventListener('input', () => this._dispatchGameInput());
      this.game.sliderV.addEventListener('input', () => this._dispatchGameInput());
    }
    if (this.game.confirmBtn) {
      this.game.confirmBtn.addEventListener('click', () => this._onConfirm());
    }
  }

  _onConfirm = null;

  _onStartTraining = null;
  _onPlay = null;
  _onGameInput = null;

  setCallbacks(cbs) {
    if (cbs.onStartTraining) this._onStartTraining = cbs.onStartTraining;
    if (cbs.onPlay) this._onPlay = cbs.onPlay;
    if (cbs.onGameInput) this._onGameInput = cbs.onGameInput;
    if (cbs.onConfirm) this._onConfirm = cbs.onConfirm;
  }

  showPanel(name) {
    Object.values(this.panels).forEach(p => p.classList.remove('active'));
    if (this.panels[name]) this.panels[name].classList.add('active');
  }

  setTrainStatus(text) { this.training.status.textContent = text; }
  setTrainProgress(pct, text) {
    this.training.progress.style.width = `${pct}%`;
    this.training.progressText.textContent = text || `${Math.round(pct)}%`;
  }

  renderDataGrid(colors) {
    const grid = this.training.dataGrid;
    grid.innerHTML = '';
    const sample = colors.slice(0, 400);
    for (const [r, g, b] of sample) {
      const div = document.createElement('div');
      div.className = 'data-swatch';
      div.style.background = rgb2hex(r, g, b);
      grid.appendChild(div);
    }
  }

  renderArchitecture() {
    const arch = this.model.getArchitecture();
    const tbody = this.training.archBody;
    tbody.innerHTML = '';
    for (const layer of arch) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${layer.name}</td>
        <td>${layer.dim}</td>
        <td>${layer.act || '-'}</td>
        <td>${layer.params || '-'}</td>
      `;
      tbody.appendChild(tr);
    }
    this.training.paramsTotal.textContent = this.model.getTotalParams().toLocaleString();
  }

  _runForwardDemo() {
    const div = this.training.forwardResult;
    if (!this.model.isTrained) { div.innerHTML = '<span style="color:#999">請先訓練模型</span>'; return; }

    const h = Math.random() * 360, s = 0.3 + Math.random() * 0.7, v = 0.3 + Math.random() * 0.7;
    const rgb = hsv2rgb(h, s, v);
    const gen = new TrainingDataGenerator();
    const features = gen.extractFeatures(rgb);
    const activations = this.model.forwardPass(features);
    if (!activations) { div.innerHTML = '無法執行前向傳遞'; return; }

    const predicted = this.model.predict(features);
    const hexTarget = rgb2hex(rgb[0], rgb[1], rgb[2]);
    const hexPred = predicted ? rgb2hex(predicted[0], predicted[1], predicted[2]) : '#888';

    let html = `<div class="forward-vis">
      <div class="fw-row"><strong>輸入特徵</strong><br><code>[${features.map(v => v.toFixed(3)).join(', ')}]</code></div>`;
    for (const act of activations) {
      const vals = Array.isArray(act.values) ? act.values.join(', ') : '';
      html += `<div class="fw-arrow">↓</div>
        <div class="fw-row"><strong>${act.name}</strong> (${act.shape}維)<br><code>[${vals}]</code></div>`;
    }
    html += `<div class="fw-arrow">↓</div>
      <div class="fw-row"><strong>輸出 RGB</strong><br>
        <span style="display:inline-block;width:20px;height:20px;background:${hexTarget};border-radius:4px;vertical-align:middle"></span> 目標 ${hexTarget}
        <span style="display:inline-block;width:20px;height:20px;background:${hexPred};border-radius:4px;vertical-align:middle;margin-left:12px"></span> 預測 ${hexPred}
      </div>`;
    html += `</div>`;
    div.innerHTML = html;
  }

  _runTestPrediction() {
    const div = this.training.testResult;
    if (!this.model.isTrained) { div.innerHTML = '<span style="color:#999">請先訓練模型</span>'; return; }

    const gen = new TrainingDataGenerator();
    const colors = gen.generateUniform(8);
    let html = '<table class="pred-table"><tr><th>目標</th><th>RGB</th><th>預測</th><th>RGB</th><th>誤差</th></tr>';
    for (const rgb of colors) {
      const feat = gen.extractFeatures(rgb);
      const pred = this.model.predict(feat);
      const hexT = rgb2hex(rgb[0], rgb[1], rgb[2]);
      const hexP = pred ? rgb2hex(pred[0], pred[1], pred[2]) : '#888';
      const err = pred ? deltaE(rgb, pred) : 1;
      html += `<tr>
        <td><span style="display:inline-block;width:24px;height:24px;background:${hexT};border-radius:4px"></span></td>
        <td>${rgb.map(v => (v*255).toFixed(0)).join(', ')}</td>
        <td><span style="display:inline-block;width:24px;height:24px;background:${hexP};border-radius:4px"></span></td>
        <td>${pred ? pred.map(v => (v*255).toFixed(0)).join(', ') : '-'}</td>
        <td>${err.toFixed(4)}</td>
      </tr>`;
    }
    html += '</table>';
    div.innerHTML = html;
  }

  updateTrainingChart() {
    this.renderer.drawTrainingChart(this.model.history, 'training-chart');
  }

  showGame() {
    this.showPanel('game');
    this.renderer.resize();
    this.game.sliderH.value = 0;
    this.game.sliderS.value = 0.5;
    this.game.sliderV.value = 0.5;
    this._updateGameLabels(0, 0.5, 0.5);
  }

  _dispatchGameInput() {
    const h = parseFloat(this.game.sliderH.value);
    const s = parseFloat(this.game.sliderS.value);
    const v = parseFloat(this.game.sliderV.value);
    this._updateGameLabels(h, s, v);
    if (this._onGameInput) this._onGameInput(h, s, v);
  }

  _updateGameLabels(h, s, v) {
    this.game.valH.textContent = `${Math.round(h)}°`;
    this.game.valS.textContent = `${Math.round(s * 100)}%`;
    this.game.valV.textContent = `${Math.round(v * 100)}%`;
    const [r, g, b] = hsv2rgb(h, s, v);
    this.game.rgbDisplay.textContent = `RGB(${Math.round(r*255)}, ${Math.round(g*255)}, ${Math.round(b*255)})`;
    this.game.hexDisplay.textContent = rgb2hex(r, g, b);
    this.game.sliderH.style.accentColor = hsv2hex(h, 1, 1);
    this.game.sliderS.style.accentColor = hsv2hex(h, s, 0.7);
    this.game.sliderV.style.accentColor = hsv2hex(h, s, v);
  }

  updateGameUI(game) {
    this.game.score.textContent = game.score;
    this.game.level.textContent = game.getLevelConfig().name;
    this.game.lives.textContent = '●'.repeat(game.lives) + '○'.repeat(Math.max(0, CONFIG.game.lives - game.lives));
    this.game.lives.style.color = game.lives <= 2 ? '#dc2626' : '#666';
    if (game.isActive) {
      this.game.timer.textContent = `⏱ ${Math.ceil(game.timeLeft)}`;
      this.game.timer.style.color = game.timeLeft < 10 ? '#dc2626' : '#666';
    }
  }

  updateCoach(result, initial) {
    if (initial) {
      this.game.coachMsg.innerHTML = `<strong>${initial.summary}</strong><br><span style="color:#666">${initial.rgb}</span>`;
      this.game.coachAdvice.textContent = initial.hint;
    } else {
      this.game.coachMsg.innerHTML = `<strong style="color:${result.feedback.color}">${result.feedback.text}</strong><br><span style="color:#666">${result.compText}</span>`;
      this.game.coachAdvice.innerHTML = result.advice.map(a => `<div>${a}</div>`).join('');
    }
  }

  showGameover(score, levelName) {
    this.showPanel('gameover');
    this.gameover.score.textContent = score;
    this.gameover.level.textContent = levelName;
  }

  resetGameSliders() {
    this.game.sliderH.value = Math.random() * 360;
    this.game.sliderS.value = 0.5;
    this.game.sliderV.value = 0.5;
    this._updateGameLabels(
      parseFloat(this.game.sliderH.value),
      parseFloat(this.game.sliderS.value),
      parseFloat(this.game.sliderV.value)
    );
  }
}
