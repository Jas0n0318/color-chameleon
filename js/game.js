class Game {
  constructor() {
    this.reset();
  }

  reset() {
    this.level = 0;
    this.isActive = false;
    this.timeLeft = CONFIG.game.roundTime;
    this.targetH = 0; this.targetS = 0.5; this.targetV = 0.5;
    this.userH = 0; this.userS = 0.5; this.userV = 0.5;
    this.result = null;
  }

  startNewGame() {
    this.reset();
    this.isActive = true;
    this._newRound();
  }

  _newRound() {
    this.targetH = Math.random() * 360;
    this.targetS = 0.3 + Math.random() * 0.7;
    this.targetV = 0.3 + Math.random() * 0.7;
    this.userH = Math.random() * 360;
    this.userS = 0.5; this.userV = 0.5;
    this.timeLeft = CONFIG.game.roundTime;
    this.result = null;
  }

  update(dt) {
    if (!this.isActive) return { done: false };
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      return this._judge();
    }
    return { done: false };
  }

  confirmCheck() {
    if (!this.isActive) return null;
    return this._judge();
  }

  _judge() {
    this.isActive = false;
    const userRGB = hsv2rgb(this.userH, this.userS, this.userV);
    const targetRGB = hsv2rgb(this.targetH, this.targetS, this.targetV);
    const diff = deltaE(userRGB, targetRGB);
    const tol = this.constructor._tol(this.level);
    const pass = diff < tol;
    const nextLevel = pass ? this.level + 1 : this.level;
    this.result = { pass, diff, tol, level: this.level, nextLevel };
    if (pass) this.level++;
    return { done: true, pass, diff, tol };
  }

  nextRound() {
    if (this.level >= CONFIG.levels.length) return false;
    this.isActive = true;
    this._newRound();
    return true;
  }

  isGameOver() { return this.result && !this.result.pass; }
  isVictory() { return this.level >= CONFIG.levels.length; }
  getLevelConfig() { return CONFIG.levels[Math.min(this.level, CONFIG.levels.length - 1)]; }

  getAccuracy() {
    const u = hsv2rgb(this.userH, this.userS, this.userV);
    const t = hsv2rgb(this.targetH, this.targetS, this.targetV);
    return Math.max(0, 1 - deltaE(u, t));
  }

  static _tol(level) {
    return CONFIG.levels[Math.min(level, CONFIG.levels.length - 1)].tolerance;
  }
}
