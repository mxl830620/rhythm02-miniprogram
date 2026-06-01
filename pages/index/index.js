/**
 * Rhythm 02 — 节拍器首页 v2.0
 * 音频引擎改用 Web Audio API（对齐 web 版架构）
 *   - wx.createWebAudioContext + 预渲染 AudioBuffer + lookahead 调度
 *   - 无文件 I/O，无 InnerAudioContext，原生音频线程处理 DSP
 */

/* 音效配置 — 完全对齐 web 版的 profiles + 扩展音色 */
const SOUND_PROFILES = {
  studio:  { accent: 1640, normal: 1120, sub: 760,  type: 'square',   dur: 0.035, Q: 7,   sweep: 0.55 },
  wood:    { accent: 920,  normal: 680,  sub: 520,  type: 'triangle', dur: 0.035, Q: 7,   sweep: 0.55 },
  rim:     { accent: 2200, normal: 1680, sub: 980,  type: 'square',   dur: 0.035, Q: 7,   sweep: 0.55 },
  soft:    { accent: 520,  normal: 420,  sub: 360,  type: 'sine',     dur: 0.08,  Q: 2.5, sweep: 0.55 },
  beep:    { accent: 1000, normal: 800,  sub: 600,  type: 'sine',     dur: 0.04,  Q: 0,   sweep: 0    },
  cowbell: { accent: 800,  normal: 560,  sub: 420,  type: 'cowbell',  dur: 0.05,  Q: 3,   sweep: 0.6  },
  clave:   { accent: 1200, normal: 900,  sub: 600,  type: 'triangle', dur: 0.03,  Q: 8,   sweep: 0.5  },
  hihat:   { accent: 0,    normal: 0,    sub: 0,    type: 'hihat',    dur: 0.04,  Q: 0,   sweep: 0    },
};
const SOUND_KEYS = ['studio', 'wood', 'rim', 'soft', 'beep', 'cowbell', 'clave', 'hihat'];
const TAP_TIMEOUT = 3500;

const METER_OPTIONS = [2, 3, 4, 5, 6, 7, 9, 12];
const SOUND_OPTIONS = [
  { v: 'studio', n: 'Studio Click' }, { v: 'wood', n: 'Wood Block' },
  { v: 'rim', n: 'Rim Shot' }, { v: 'soft', n: 'Soft Pulse' },
  { v: 'beep', n: 'Beep' }, { v: 'cowbell', n: 'Cowbell' },
  { v: 'clave', n: 'Clave' }, { v: 'hihat', n: 'Hi-Hat' }
];
const NOTE_NAMES = { 2: '二分音符', 4: '四分音符', 8: '八分音符', 16: '十六分音符', 32: '三十二分音符', 64: '六十四分音符' };
const TRAINING_LABELS = { normal: '常规', mute: '静音小节', ladder: '切分阶梯', accent: '重音反应' };

const NOTE_ICON_CLASS = {
  1:  'note-whole',
  2:  'note-half',
  4:  'note-quarter',
  8:  'note-eighth',
  16: 'note-sixteenth',
  32: 'note-sixteenth',
  64: 'note-sixteenth'
};

/* ================================================================
 *  Web Audio API 引擎（对齐 web 版架构）
 * ================================================================ */
let _audioCtx = null;       // WebAudioContext
let _masterGain = null;     // 主增益节点
let _audioBuffers = null;   // { sound: { accent: AudioBuffer, normal: AudioBuffer, sub: AudioBuffer } }

/**
 * 二阶 IIR 带通滤波器（模拟 web 版 BiquadFilterNode）
 */
function biquadBandpass(samples, sr, freq, Q) {
  const w0 = 2 * Math.PI * freq / sr;
  const sinW0 = Math.sin(w0);
  const alpha = sinW0 / (2 * Q);
  const b0 = alpha, b1 = 0, b2 = -alpha;
  const a0 = 1 + alpha, a1 = -2 * Math.cos(w0), a2 = 1 - alpha;
  const nb0 = b0 / a0, nb1 = b1 / a0, nb2 = b2 / a0;
  const na1 = a1 / a0, na2 = a2 / a0;
  const out = new Float32Array(samples.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < samples.length; i++) {
    const x0 = samples[i];
    const y0 = nb0 * x0 + nb1 * x1 + nb2 * x2 - na1 * y1 - na2 * y2;
    out[i] = y0;
    x2 = x1; x1 = x0; y2 = y1; y1 = y0;
  }
  return out;
}

/**
 * 生成原始音频采样（Float32Array）
 * 合成管线：振荡器(含频率下滑) → 带通滤波 → 增益包络 → 归一化
 */
function generateSamples(p, freq) {
  const sr = 44100;
  const dur = p.dur || 0.035;
  const totalDur = dur + 0.02;
  const frames = Math.floor(sr * totalDur);
  const raw = new Float32Array(frames);
  const accentBoost = freq === p.accent ? 1 : 0.55;
  const freqEnd = p.sweep ? Math.max(80, freq * p.sweep) : freq;

  // 第1步：振荡器（含频率下滑）
  if (p.type === 'hihat') {
    for (let i = 0; i < frames; i++) raw[i] = Math.random() * 2 - 1;
  } else if (p.type === 'cowbell') {
    const f2 = freq * 1.5;
    const fEnd2 = Math.max(80, f2 * (p.sweep || 0.6));
    for (let i = 0; i < frames; i++) {
      const t = i / sr;
      const progress = t / dur;
      const f1 = freq + (freqEnd - freq) * progress;
      const fc2 = f2 + (fEnd2 - f2) * progress;
      raw[i] = Math.sin(2 * Math.PI * f1 * t) * 0.7
             + Math.sin(2 * Math.PI * fc2 * t) * 0.5;
    }
  } else {
    let phase = 0;
    for (let i = 0; i < frames; i++) {
      const t = i / sr;
      const f = freq + (freqEnd - freq) * (t / dur);
      phase += f / sr;
      const pMod = phase % 1;
      if (p.type === 'sine') raw[i] = Math.sin(2 * Math.PI * pMod);
      else if (p.type === 'square') raw[i] = pMod < 0.5 ? 0.8 : -0.8;
      else if (p.type === 'triangle') raw[i] = pMod < 0.5 ? (4 * pMod - 1) : (3 - 4 * pMod);
      else raw[i] = Math.sin(2 * Math.PI * pMod);
    }
  }

  // 第2步：带通滤波
  let filtered = raw;
  if (p.Q && p.Q > 0 && freq > 0) {
    filtered = biquadBandpass(raw, sr, freq, p.Q);
  }

  // 第3步：增益包络（4ms 起振 + 指数衰减）
  const attackFrames = Math.floor(0.004 * sr);
  for (let i = 0; i < frames; i++) {
    const t = i / sr;
    let gain;
    if (i < attackFrames) {
      gain = 0.0001 + (0.72 * accentBoost - 0.0001) * (i / attackFrames);
    } else if (t < dur) {
      const decayProgress = (t - 0.004) / (dur - 0.004);
      gain = 0.72 * accentBoost * Math.pow(0.0001 / (0.72 * accentBoost), decayProgress);
    } else {
      gain = 0.0001;
    }
    filtered[i] *= gain;
  }

  // 第4步：放大 + 归一化
  const AMP_FACTOR = 8;
  for (let i = 0; i < frames; i++) filtered[i] *= AMP_FACTOR;
  let peak = 0;
  for (let i = 0; i < frames; i++) peak = Math.max(peak, Math.abs(filtered[i]));
  const norm = peak > 0 ? 1.0 / peak : 1;
  const result = new Float32Array(frames);
  for (let i = 0; i < frames; i++) result[i] = Math.max(-1, Math.min(1, filtered[i] * norm));
  return { samples: result, sampleRate: sr };
}

/**
 * 初始化 Web Audio API 引擎
 */
function initWebAudio(volumePercent) {
  try {
    if (typeof wx.createWebAudioContext !== 'function') return false;
    _audioCtx = wx.createWebAudioContext();
    _masterGain = _audioCtx.createGain();
    _masterGain.gain.value = (volumePercent || 100) / 100;
    _masterGain.connect(_audioCtx.destination);

    _audioBuffers = {};
    for (const sound of SOUND_KEYS) {
      _audioBuffers[sound] = {};
      const p = SOUND_PROFILES[sound];
      for (const lv of ['accent', 'normal', 'sub']) {
        const { samples, sampleRate } = generateSamples(p, p[lv]);
        const buf = _audioCtx.createBuffer(1, samples.length, sampleRate);
        buf.getChannelData(0).set(samples);
        _audioBuffers[sound][lv] = buf;
      }
    }
    return true;
  } catch (e) {
    _audioCtx = null;
    _masterGain = null;
    _audioBuffers = null;
    return false;
  }
}

function destroyWebAudio() {
  if (_masterGain) { try { _masterGain.disconnect(); } catch (e) {} }
  if (_audioCtx) { try { _audioCtx.close(); } catch (e) {} }
  _audioCtx = null;
  _masterGain = null;
  _audioBuffers = null;
}

/* ================================================================
 *  UI 辅助函数
 * ================================================================ */

function weightPosFromBpm(bpm) {
  const progress = (bpm - 30) / (260 - 30);
  return 86 - progress * 68;
}

function getSubdivisionValues(beatUnit) {
  const base = [1, 2, 3, 4];
  if (beatUnit <= 8) base.push(8);
  return base;
}

function buildUnitOptionsData() {
  return [2, 4, 8, 16].map(bu => {
    const denom = bu;
    const iconClass = NOTE_ICON_CLASS[denom] || 'note-sixteenth';
    const flagCount = denom >= 8 ? (denom >= 16 ? 2 : 1) : 0;
    return {
      v: bu,
      n: NOTE_NAMES[bu] || `${bu}分音符`,
      iconClass,
      flagCount,
      isHalf: denom === 2
    };
  });
}

function buildSubOptionsData(beatUnit) {
  return getSubdivisionValues(beatUnit).map(sub => {
    const isTriplet = sub === 3;
    const denom = isTriplet ? beatUnit : beatUnit * sub;
    const iconClass = NOTE_ICON_CLASS[denom] || 'note-sixteenth';
    const flagCount = denom >= 8 ? (denom >= 16 ? 2 : 1) : 0;
    let label;
    const bn = NOTE_NAMES[beatUnit] || `${beatUnit}分音符`;
    if (sub === 1) label = bn;
    else if (sub === 3) label = `${bn}三连音`;
    else label = NOTE_NAMES[denom] || `${denom}分音符`;
    return { v: sub, label, iconClass, flagCount, isTriplet, isHalf: denom === 2 };
  });
}

/* ================================================================
 *  Page 定义
 * ================================================================ */
Page({
  data: {
    bpm: 96, isPlaying: false,
    beatsPerBar: 4, beatUnit: 4, subdivision: 1,
    sound: 'studio', volumePercent: 100,
    training: 'normal', accents: [],
    accentTarget: '-', barsPlayed: 0,
    activeBeat: 0, beatPulse: false,
    flashVisible: false, tapAccuracy: 0,
    beatUnitLabel: '四分音符', meterLabel: '4/4',
    beatCells: [], trainingLabel: '常规',
    editingBpm: false,
    showSettings: false,
    swingSide: false,
    armStyle: '',
    weightPosition: 66.0,
    meterOpts: METER_OPTIONS,
    unitOpts: [],
    soundOpts: SOUND_OPTIONS,
    subOpts: [],
  },

  // 调度状态（使用 audioCtx.currentTime，单位秒）
  _curBeat: 0, _curSub: 0,
  _nextTickTime: 0,   // 下一个 tick 的音频时间（秒）
  _timer: null,        // setInterval id
  _uiTimers: [],       // setTimeout ids for UI updates
  _muteBar: false, _muteCount: 0, _ladderIdx: 0,

  // ====== 生命周期 ======
  onLoad() {
    this._fullSync();
  },
  onShow() {
    this._sync();
    this._fullUI();
  },
  onHide() {
    if (this.data.isPlaying) this._stop();
  },
  onUnload() {
    this._stop();
    destroyWebAudio();
  },

  _sync() {
    const gs = getApp().globalData.state;
    const wp = weightPosFromBpm(gs.bpm);
    this.setData({
      bpm: gs.bpm, beatsPerBar: gs.beatsPerBar, beatUnit: gs.beatUnit,
      subdivision: gs.subdivision, accents: [...gs.accents],
      sound: gs.sound, volumePercent: gs.volumePercent,
      training: gs.training,
      armStyle: this._arm(false, 0, false, wp),
      weightPosition: wp.toFixed(1)
    });
    if (_masterGain) _masterGain.gain.value = gs.volumePercent / 100;
  },

  _fullSync() {
    this._sync();
    this._fullUI();
  },

  _fullUI() {
    this._buildCells();
    this._labels();
    this._buildOptionData();
  },

  // ====== 音频引擎（Web Audio API） ======
  _ensureAudio() {
    if (_audioCtx) return true;
    const ok = initWebAudio(this.data.volumePercent);
    if (!ok) {
      wx.showToast({ title: '音频初始化失败', icon: 'none', duration: 2000 });
    }
    return ok;
  },

  _playClick(time, level) {
    if (!_audioCtx || level === 'mute') return;
    const buffer = _audioBuffers?.[this.data.sound]?.[level];
    if (!buffer) return;
    const source = _audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(_masterGain);
    source.start(time);
  },

  // ====== 调度器（lookahead 模式，对齐 web 版 scheduleTicks） ======
  _schedule() {
    if (!_audioCtx) return;
    const now = _audioCtx.currentTime;
    const lookahead = now + 0.12; // 120ms 预调度窗口

    while (this._nextTickTime < lookahead) {
      const scheduledBeat = this._curBeat;
      const scheduledSub = this._curSub;
      const isMainBeat = scheduledSub === 0;
      const lv = this._getAccent(scheduledBeat);

      this._playClick(this._nextTickTime, isMainBeat ? lv : 'sub');

      const delayMs = Math.max(0, (this._nextTickTime - now) * 1000);
      const tid = setTimeout(() => {
        if (isMainBeat) {
          this._renderBeat(scheduledBeat, lv);
        }
      }, delayMs);
      this._uiTimers.push(tid);

      const spb = 60 / this.data.bpm;
      let stepSec = spb / this.data.subdivision;
      if (this.data.swingPercent > 0 && this.data.subdivision === 2) {
        const sw = this.data.swingPercent / 100 * 0.45;
        stepSec *= this._curSub === 0 ? (1 + sw) : (1 - sw);
      }
      this._nextTickTime += stepSec;
      this._curSub++;
      if (this._curSub >= this.data.subdivision) {
        this._curSub = 0;
        this._curBeat++;
        if (this._curBeat >= this.data.beatsPerBar) {
          this._curBeat = 0;
          this._onBar();
        }
      }
    }

    if (this._uiTimers.length > 200) {
      this._uiTimers = [];
    }
  },

  _renderBeat(beat, lv) {
    const visible = beat + 1;
    const dur = 60 / this.data.bpm;
    const nextSide = !this.data.swingSide;
    const wp = weightPosFromBpm(this.data.bpm);
    this.setData({
      activeBeat: visible, beatPulse: true,
      swingSide: nextSide,
      armStyle: this._arm(nextSide, dur, true, wp),
      weightPosition: wp.toFixed(1)
    });
    const tid = setTimeout(() => this.setData({ beatPulse: false }), 120);
    this._uiTimers.push(tid);
    if (this.data.screenFlash) this._flash(lv === 'accent');
    if (this.data.vibration) {
      wx.vibrateShort({ type: lv === 'accent' ? 'long' : 'short' });
    }
  },

  _getAccent(beat) {
    if (this.data.training === 'mute') return this._muteBar ? 'mute' : (this.data.accents[beat] || 'normal');
    if (this.data.training === 'accent') return beat === this.data.accentTarget - 1 ? 'accent' : 'mute';
    return this.data.accents[beat] || 'normal';
  },

  _onBar() {
    const bars = this.data.barsPlayed + 1;
    this.setData({ barsPlayed: bars });
    if (this.data.training === 'mute') {
      this._muteCount++;
      this._muteBar = (this._muteCount % 4 === 0);
      if (this._muteCount >= 4) this._muteCount = 0;
    } else if (this.data.training === 'ladder') {
      this._ladderIdx = (this._ladderIdx + 1) % 4;
      this.setData({ subdivision: [1, 2, 3, 4][this._ladderIdx] });
    } else if (this.data.training === 'accent') {
      this.setData({ accentTarget: Math.floor(Math.random() * this.data.beatsPerBar) + 1 });
    }
  },

  _flash(heavy) {
    this.setData({ flashVisible: true });
    const tid = setTimeout(() => this.setData({ flashVisible: false }), heavy ? 80 : 45);
    this._uiTimers.push(tid);
  },

  _arm(side, dur, playing, wp) {
    const deg = playing ? (side ? 18 : -18) : 0;
    return `transform:rotate(${deg}deg);transition:transform ${dur}s cubic-bezier(0.42,0.0,0.58,1.0)`;
  },

  // ====== 播放控制 ======
  _start() {
    if (this.data.isPlaying) return;
    if (!this._ensureAudio()) return;

    if (_audioCtx.state === 'suspended') {
      _audioCtx.resume().then(() => this._doStart());
    } else {
      this._doStart();
    }
  },

  _doStart() {
    this._curBeat = 0;
    this._curSub = 0;
    this._nextTickTime = _audioCtx.currentTime + 0.05;
    this._muteBar = false;
    this._muteCount = 0;
    this._ladderIdx = 0;
    this._uiTimers = [];
    this._timer = setInterval(() => this._schedule(), 25);

    const dur = 60 / this.data.bpm;
    const wp = weightPosFromBpm(this.data.bpm);
    this.setData({
      isPlaying: true, barsPlayed: 0, activeBeat: 0, accentTarget: '-',
      swingSide: false,
      armStyle: this._arm(false, dur, true, wp),
      weightPosition: wp.toFixed(1)
    });
  },

  _stop() {
    if (!this.data.isPlaying) return;
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    this._uiTimers.forEach(tid => { try { clearTimeout(tid); } catch (e) {} });
    this._uiTimers = [];
    if (_masterGain) _masterGain.gain.value = 0;

    const wp = weightPosFromBpm(this.data.bpm);
    this.setData({
      isPlaying: false, activeBeat: 0, beatPulse: false,
      armStyle: this._arm(this.data.swingSide, 0, false, wp),
      weightPosition: wp.toFixed(1)
    });

    setTimeout(() => {
      if (_masterGain && !this.data.isPlaying) {
        _masterGain.gain.value = this.data.volumePercent / 100;
      }
    }, 200);
  },

  onToggle() { this.data.isPlaying ? this._stop() : this._start(); },

  // ====== BPM ======
  onTap() {
    const now = Date.now();
    let times = (this.data.tapTimes || []).filter(t => now - t < TAP_TIMEOUT);
    times.push(now);
    let acc = 0;
    if (times.length >= 2) {
      const ivs = times.slice(1).map((t, i) => t - times[i]);
      const avg = ivs.reduce((a, b) => a + b, 0) / ivs.length;
      acc = Math.max(0, Math.round((1 - Math.sqrt(ivs.reduce((s, v) => s + (v - avg) ** 2, 0) / ivs.length) / avg) * 100));
      const nb = Math.round(60000 / avg);
      if (nb >= 30 && nb <= 260) {
        const wp = weightPosFromBpm(nb);
        this.setData({ bpm: nb, tapTimes: times, tapAccuracy: acc,
          weightPosition: wp.toFixed(1), armStyle: this._arm(this.data.swingSide, 0, this.data.isPlaying, wp) });
        getApp().saveState({ bpm: nb }); return;
      }
    }
    this.setData({ tapTimes: times, tapAccuracy: acc });
  },
  onBpmStep(e) {
    const v = Math.max(30, Math.min(260, this.data.bpm + Number(e.currentTarget.dataset.delta)));
    const wp = weightPosFromBpm(v);
    this.setData({ bpm: v, weightPosition: wp.toFixed(1),
      armStyle: this._arm(this.data.swingSide, 0, this.data.isPlaying, wp) });
    getApp().saveState({ bpm: v });
  },
  onBpmSlider(e) {
    const v = Number(e.detail.value);
    const wp = weightPosFromBpm(v);
    this.setData({ bpm: v, weightPosition: wp.toFixed(1),
      armStyle: this._arm(this.data.swingSide, 0, this.data.isPlaying, wp) });
    getApp().saveState({ bpm: v });
  },
  onBpmTap() { this.setData({ editingBpm: true }); },
  onBpmEdit(e) {
    const v = Math.max(30, Math.min(260, Number(e.detail.value) || 96));
    const wp = weightPosFromBpm(v);
    this.setData({ bpm: v, weightPosition: wp.toFixed(1),
      armStyle: this._arm(this.data.swingSide, 0, this.data.isPlaying, wp) });
    getApp().saveState({ bpm: v });
    this.setData({ editingBpm: false });
  },
  closeBpmEdit() { this.setData({ editingBpm: false }); },

  // ====== 快捷保存 ======
  onQuickSave() {
    const gs = getApp().globalData.state;
    getApp().addPreset({
      name: `预设 ${getApp().globalData.presets.length + 1}`,
      bpm: gs.bpm, beatsPerBar: gs.beatsPerBar, beatUnit: gs.beatUnit,
      subdivision: gs.subdivision, accents: [...gs.accents],
      sound: gs.sound, volume: gs.volumePercent,
      swing: gs.swingPercent, training: gs.training
    });
    wx.showToast({ title: '已保存', icon: 'success', duration: 1200 });
  },

  // ================================================
  //  内嵌设置面板
  // ================================================

  onToggleSettings() {
    this.setData({ showSettings: !this.data.showSettings });
  },
  onCloseSettings() {
    this.setData({ showSettings: false });
  },
  preventClose() {},

  _apply(patch) {
    this.setData(patch);
    const g = {};
    Object.keys(patch).forEach(k => { g[k] = this.data[k]; });
    getApp().saveState(g);
  },

  // --- 拍号 ---
  onSetMeter(e) {
    const nb = Number(e.currentTarget.dataset.v);
    const accents = Array.from({ length: nb }, (_, i) => this.data.accents[i] || (i === 0 ? 'accent' : 'normal'));
    if (accents[0] === 'mute') accents[0] = 'accent';
    this._apply({ beatsPerBar: nb, accents });
    this._fullUI();
  },

  onSetBeatUnit(e) {
    const bu = Number(e.currentTarget.dataset.v);
    this._apply({ beatUnit: bu });
    const valid = getSubdivisionValues(bu);
    let sub = this.data.subdivision;
    if (!valid.includes(sub)) sub = 1;
    if (sub !== this.data.subdivision) this._apply({ subdivision: sub });
    this._fullUI();
  },

  // --- 切分 ---
  onSetSub(e) {
    const sub = Number(e.currentTarget.dataset.v);
    this._apply({ subdivision: sub });
    this._fullUI();
  },

  _buildOptionData() {
    const bu = this.data.beatUnit;
    this.setData({
      unitOpts: buildUnitOptionsData(),
      subOpts: buildSubOptionsData(bu)
    });
  },

  // --- 重音 ---
  onCycleAccent(e) {
    const i = Number(e.currentTarget.dataset.i);
    const order = ['accent', 'normal', 'mute'];
    const cur = this.data.accents[i] || 'normal';
    const next = order[(order.indexOf(cur) + 1) % order.length];
    const accents = [...this.data.accents];
    accents[i] = next;
    this._apply({ accents });
    this._buildCells();
  },

  // --- 音色 ---
  onSetSound(e) {
    this._apply({ sound: e.currentTarget.dataset.v });
  },

  // ====== UI ======
  _buildCells() {
    const cells = [];
    for (let i = 0; i < this.data.beatsPerBar; i++) {
      cells.push({ accent: this.data.accents[i] === 'accent', mute: this.data.accents[i] === 'mute' });
    }
    this.setData({ beatCells: cells });
  },
  _labels() {
    this.setData({
      beatUnitLabel: NOTE_NAMES[this.data.beatUnit] || `${this.data.beatUnit}分音符`,
      meterLabel: `${this.data.beatsPerBar}/${this.data.beatUnit}`,
      trainingLabel: TRAINING_LABELS[this.data.training] || '常规'
    });
  }
});
