(() => {
  let gen, model, coach, game, renderer, ui;
  let animId = null, lastT = 0, overlayTimer = 0;

  const STATE = { TRAINING: 0, PLAYING: 1, ROUND_OVER: 2, GAME_OVER: 3 };
  let currentState = STATE.TRAINING;

  function init() {
    gen = new TrainingDataGenerator();
    model = new ColorNet();
    coach = new AICoach(model);
    game = new Game();
    renderer = new Renderer('game-canvas');
    ui = new UI(model, renderer);

    renderer.canvas.addEventListener('click', onCanvasClick);

    ui.setCallbacks({
      onStartTraining: startTraining,
      onPlay: startGame,
      onGameInput: onGameInput,
      onConfirm: onConfirm,
    });

    document.getElementById('btn-restart').addEventListener('click', restartFromGameOver);

    ui.showPanel('training');
    renderer.resize();
    showTrainingLobby();
  }

  function restartFromGameOver() {
    if (animId) { cancelAnimationFrame(animId); animId = null; }
    game.reset();
    currentState = STATE.TRAINING;
    ui.showPanel('training');
    showTrainingLobby();
    if (model.isTrained) {
      ui.training.playBtn.style.display = 'inline-block';
    }
  }

  function showTrainingLobby() {
    ui.training.playBtn.style.display = 'none';
    ui.setTrainStatus('點擊「開始訓練」啟動');
    ui.renderArchitecture();
    const colors = gen.generateUniform(200);
    ui.renderDataGrid(colors);
  }

  async function startTraining() {
    if (model.isTrained) {
      model.dispose();
      model = new ColorNet();
      coach.model = model;
      model.build();
    }

    ui.training.startBtn.disabled = true;
    ui.training.startBtn.textContent = '訓練中...';
    ui.training.playBtn.style.display = 'none';

    ui.setTrainStatus('產生訓練資料...');
    ui.setTrainProgress(5, '產生資料中');
    await nextFrame();

    const dataset = gen.buildDataset(CONFIG.training.sampleCount);
    ui.renderDataGrid(dataset.colors);
    ui.setTrainProgress(10, '資料準備完成');

    ui.setTrainStatus('建構神經網路...');
    if (!model.model) model.build();
    ui.renderArchitecture();
    await nextFrame();

    ui.setTrainStatus('開始訓練...');
    await model.train(dataset.inputs, dataset.outputs, (epoch, total, logs) => {
      const pct = 10 + (epoch / total) * 80;
      ui.setTrainProgress(pct, `Epoch ${epoch}/${total}`);
      const acc = Math.max(0, (1 - logs.mae / 0.375) * 100);
      ui.setTrainStatus(`正確率 ${acc.toFixed(1)}% | Loss ${logs.loss.toFixed(4)}`);
      ui.updateTrainingChart();
    });

    ui.setTrainProgress(100, '訓練完成');
    ui.setTrainStatus('✅ 訓練完成！');
    ui.updateTrainingChart();
    await nextFrame();

    ui.training.startBtn.textContent = '重新訓練';
    ui.training.startBtn.disabled = false;
    ui.training.playBtn.style.display = 'inline-block';

    ui.renderArchitecture();
    ui._runTestPrediction();
  }

  function startGame() {
    currentState = STATE.PLAYING;
    game.startNewGame();
    ui.showGame();
    ui.resetGameSliders();

    game.userH = parseFloat(ui.game.sliderH.value);
    game.userS = parseFloat(ui.game.sliderS.value);
    game.userV = parseFloat(ui.game.sliderV.value);

    const t = game.getTargetHSV();
    const initial = coach.getInitialAdvice(t.h, t.s, t.v);
    ui.updateCoach(null, initial);

    const result = coach.analyze(game.getTargetHSV(), game.getUserHSV());
    ui.updateCoach(result, null);

    lastT = performance.now();
    startLoop();
  }

  function onGameInput(h, s, v) {
    if (currentState !== STATE.PLAYING) return;
    game.userH = h; game.userS = s; game.userV = v;
    const result = coach.analyze(game.getTargetHSV(), game.getUserHSV());
    ui.updateCoach(result, null);
  }

  function onConfirm() {
    if (currentState !== STATE.PLAYING) return;
    const r = game.confirmRound();
    if (!r) return;
    if (r.tooFar) {
      const result = coach.analyze(game.getTargetHSV(), game.getUserHSV());
      ui.updateCoach(result, null);
      return;
    }
    if (r.success) {
      currentState = STATE.ROUND_OVER;
      overlayTimer = 0;
    }
  }

  function onCanvasClick() {
    if (currentState === STATE.ROUND_OVER) {
      currentState = STATE.PLAYING;
      game.nextRound();
      ui.resetGameSliders();
      game.userH = parseFloat(ui.game.sliderH.value);
      game.userS = parseFloat(ui.game.sliderS.value);
      game.userV = parseFloat(ui.game.sliderV.value);
      const t = game.getTargetHSV();
      const initial = coach.getInitialAdvice(t.h, t.s, t.v);
      ui.updateCoach(null, initial);
      lastT = performance.now();
    }
  }

  function startLoop() {
    if (animId) { cancelAnimationFrame(animId); animId = null; }

    const loop = (ts) => {
      if (currentState === STATE.GAME_OVER) {
        animId = requestAnimationFrame(loop);
        return;
      }

      const dt = Math.min((ts - lastT) / 1000, 0.05);
      lastT = ts;

      if (currentState === STATE.PLAYING) {
        const r = game.update(dt);
        const acc = game.getAccuracy();
        renderer.drawScene(
          game.targetH, game.targetS, game.targetV,
          game.userH, game.userS, game.userV,
          game.detection, acc
        );
        ui.updateGameUI(game);

        if (r.done) {
          if (game.isGameOver()) {
            currentState = STATE.GAME_OVER;
            renderer.drawGameOver(game.score, game.getLevelConfig().name);
            ui.showGameover(game.score, game.getLevelConfig().name);
          } else {
            currentState = STATE.ROUND_OVER;
            overlayTimer = 0;
          }
        } else if (r.success) {
          currentState = STATE.ROUND_OVER;
          overlayTimer = 0;
        }
      }

      if (currentState === STATE.ROUND_OVER) {
        overlayTimer += dt;
        renderer.animTime = overlayTimer;
        renderer.drawScene(
          game.targetH, game.targetS, game.targetV,
          game.userH, game.userS, game.userV,
          0, game.getAccuracy()
        );
        if (game.result) renderer.drawRoundComplete(game.result);
        ui.updateGameUI(game);
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
  }

  function nextFrame() { return new Promise(r => setTimeout(r, 16)); }

  document.addEventListener('DOMContentLoaded', init);
})();
