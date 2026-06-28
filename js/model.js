class ColorNet {
  constructor() {
    this.model = null;
    this.history = { loss: [], valLoss: [], mae: [], valMae: [], accuracy: [], valAccuracy: [] };
    this.isTrained = false;
  }

  build() {
    this.model = tf.sequential();
    this.model.add(tf.layers.dense({ inputShape: [8], units: 64, activation: 'relu', name: 'Dense1' }));
    this.model.add(tf.layers.batchNormalization());
    this.model.add(tf.layers.dropout({ rate: 0.15 }));
    this.model.add(tf.layers.dense({ units: 32, activation: 'relu', name: 'Dense2' }));
    this.model.add(tf.layers.batchNormalization());
    this.model.add(tf.layers.dropout({ rate: 0.1 }));
    this.model.add(tf.layers.dense({ units: 16, activation: 'relu', name: 'Dense3' }));
    this.model.add(tf.layers.dense({ units: 3, activation: 'sigmoid', name: 'Output' }));
    this.model.compile({
      optimizer: tf.train.adam(CONFIG.training.learningRate),
      loss: 'meanSquaredError',
      metrics: ['mae'],
    });
  }

  async train(features, labels, onEpochEnd) {
    if (!this.model) this.build();
    this.history = { loss: [], valLoss: [], mae: [], valMae: [], accuracy: [], valAccuracy: [] };
    const xs = tf.tensor2d(features);
    const ys = tf.tensor2d(labels);
    const randomGuessMae = 0.375;

    await this.model.fit(xs, ys, {
      epochs: CONFIG.training.epochs,
      batchSize: CONFIG.training.batchSize,
      validationSplit: CONFIG.training.validationSplit,
      shuffle: true,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          this.history.loss.push(logs.loss);
          this.history.valLoss.push(logs.val_loss);
          this.history.mae.push(logs.mae);
          this.history.valMae.push(logs.val_mae);
          this.history.accuracy.push(Math.max(0, (1 - logs.mae / randomGuessMae)) * 100);
          this.history.valAccuracy.push(Math.max(0, (1 - logs.val_mae / randomGuessMae)) * 100);
          if (onEpochEnd) onEpochEnd(epoch + 1, CONFIG.training.epochs, logs);
        },
      },
    });

    xs.dispose(); ys.dispose();
    this.isTrained = true;
  }

  predict(features) {
    if (!this.isTrained || !this.model) return null;
    const t = tf.tensor2d([features]);
    const o = this.model.predict(t);
    const rgb = Array.from(o.dataSync());
    t.dispose(); o.dispose();
    return rgb;
  }

  forwardPass(features) {
    if (!this.isTrained || !this.model) return null;
    const layers = this.model.layers;
    let x = tf.tensor2d([features]);
    const acts = [{ name: '輸入', shape: 8, values: features.map(v => +v.toFixed(3)) }];
    for (const layer of layers) {
      if (layer.name.startsWith('dropout') || layer.name.startsWith('batch_normalization')) continue;
      x = layer.apply(x);
      const arr = Array.from(x.dataSync());
      acts.push({ name: layer.name, units: layer.units || arr.length, shape: arr.length, values: arr.slice(0, 6).map(v => +v.toFixed(3)) });
    }
    x.dispose();
    return acts;
  }

  getWeights() {
    if (!this.model) return [];
    return this.model.layers.filter(l => l.getWeights().length > 0).map(l => ({
      name: l.name,
      kernel: l.getWeights()[0].dataSync(),
      bias: l.getWeights().length > 1 ? l.getWeights()[1].dataSync() : null,
      kernelShape: l.getWeights()[0].shape,
    }));
  }

  getArchitecture() {
    return [
      { name: '輸入層', dim: '8', act: '-', params: '-' },
      { name: '全連接 1', dim: '64', act: 'ReLU', params: '512+64' },
      { name: 'BatchNorm', dim: '64', act: '-', params: '-' },
      { name: 'Dropout', dim: '64', act: '0.15', params: '-' },
      { name: '全連接 2', dim: '32', act: 'ReLU', params: '2048+32' },
      { name: 'BatchNorm', dim: '32', act: '-', params: '-' },
      { name: 'Dropout', dim: '32', act: '0.10', params: '-' },
      { name: '全連接 3', dim: '16', act: 'ReLU', params: '528+16' },
      { name: '輸出層', dim: '3', act: 'Sigmoid', params: '-' },
    ];
  }

  getTotalParams() {
    const w = this.getWeights();
    let total = 0;
    for (const layer of w) {
      if (layer.kernelShape.length === 2) total += layer.kernelShape[0] * layer.kernelShape[1];
      if (layer.bias) total += layer.bias.length;
    }
    return total;
  }

  hasSavedData(name = 'color-net') {
    return !!localStorage.getItem(`${name}-model`);
  }

  async saveToStorage(name = 'color-net') {
    if (!this.model) return;
    try {
      const allWeights = [];
      for (const layer of this.model.layers) {
        for (const w of layer.getWeights()) {
          allWeights.push({ shape: w.shape, data: Array.from(w.dataSync()) });
        }
      }
      const data = {
        topology: this.model.toJSON(),
        weights: allWeights,
        history: this.history,
      };
      localStorage.setItem(`${name}-model`, JSON.stringify(data));
      localStorage.setItem(`${name}-trained`, '1');
      localStorage.setItem(`${name}-history`, JSON.stringify(this.history));
    } catch (e) {
      console.error('saveToStorage failed', e);
    }
  }

  async loadModelFromStorage(name = 'color-net') {
    if (typeof tf === 'undefined') return false;
    try {
      const json = localStorage.getItem(`${name}-model`);
      if (!json) return false;
      const data = JSON.parse(json);
      this.model = await tf.models.modelFromJSON(data.topology);
      let wi = 0;
      for (const layer of this.model.layers) {
        const n = layer.getWeights().length;
        if (n > 0) {
          const layerWs = data.weights.slice(wi, wi + n);
          const tensors = layerWs.map(w => tf.tensor(w.data, w.shape));
          layer.setWeights(tensors);
          tensors.forEach(t => t.dispose());
          wi += n;
        }
      }
      this.model.compile({
        optimizer: tf.train.adam(CONFIG.training.learningRate),
        loss: 'meanSquaredError',
        metrics: ['mae'],
      });
      this.isTrained = true;
      if (data.history) this.history = data.history;
      return true;
    } catch (e) {
      console.error('loadModelFromStorage failed', e);
      return false;
    }
  }

  dispose() {
    if (this.model) { this.model.dispose(); this.model = null; }
  }
}
