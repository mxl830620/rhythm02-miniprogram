/**
 * Rhythm 02 — 节拍与音色设置 v0.8
 * 修复：切分选项动态生成 + 音符图标数据
 */
const METERS = [2, 3, 4, 5, 6, 7, 9, 12];
const SOUNDS = [
  { v: 'studio', n: 'Studio Click' }, { v: 'wood', n: 'Wood Block' },
  { v: 'rim', n: 'Rim Shot' }, { v: 'soft', n: 'Soft Pulse' },
  { v: 'beep', n: 'Beep' }, { v: 'cowbell', n: 'Cowbell' },
  { v: 'clave', n: 'Clave' }, { v: 'hihat', n: 'Hi-Hat' }
];
const NOTE_NAMES = { 2: '二分音符', 4: '四分音符', 8: '八分音符', 16: '十六分音符', 32: '三十二分音符', 64: '六十四分音符' };
const NOTE_ICON_CLASS = {
  1: 'note-whole', 2: 'note-half', 4: 'note-quarter',
  8: 'note-eighth', 16: 'note-sixteenth', 32: 'note-sixteenth', 64: 'note-sixteenth'
};

/** 动态切分选项（参照 web 版 getSubdivisionOptions） */
function getSubdivisionValues(beatUnit) {
  const base = [1, 2, 3, 4];
  if (beatUnit <= 8) base.push(8);
  return base;
}

function buildUnitOptionsData() {
  return [2, 4, 8, 16].map(bu => ({
    v: bu,
    n: NOTE_NAMES[bu] || `${bu}分音符`,
    iconClass: NOTE_ICON_CLASS[bu] || 'note-sixteenth',
    flagCount: bu >= 8 ? (bu >= 16 ? 2 : 1) : 0,
    isHalf: bu === 2
  }));
}

function buildSubOptionsData(beatUnit) {
  return getSubdivisionValues(beatUnit).map(sub => {
    const isTriplet = sub === 3;
    const denom = isTriplet ? beatUnit : beatUnit * sub;
    const iconClass = NOTE_ICON_CLASS[denom] || 'note-sixteenth';
    const flagCount = denom >= 8 ? (denom >= 16 ? 2 : 1) : 0;
    const bn = NOTE_NAMES[beatUnit] || `${beatUnit}分音符`;
    let label;
    if (sub === 1) label = bn;
    else if (sub === 3) label = `${bn}三连音`;
    else label = NOTE_NAMES[denom] || `${denom}分音符`;
    return { v: sub, label, iconClass, flagCount, isTriplet, isHalf: denom === 2 };
  });
}

Page({
  data: {
    beatsPerBar: 4, beatUnit: 4, subdivision: 1,
    accents: [], sound: 'studio', volumePercent: 100,
    meterOpts: METERS,
    unitOpts: [], subOpts: [],
    soundOpts: SOUNDS,
  },

  onLoad() { this._fullSync(); },
  onShow() {
    this._fullSync();
  },

  _fullSync() {
    const gs = getApp().globalData.state;
    // 切分有效性校验
    const valid = getSubdivisionValues(gs.beatUnit);
    let sub = gs.subdivision;
    if (!valid.includes(sub)) {
      sub = 1;
      getApp().saveState({ subdivision: 1 });
    }
    this.setData({
      beatsPerBar: gs.beatsPerBar, beatUnit: gs.beatUnit,
      subdivision: sub, accents: [...gs.accents],
      sound: gs.sound, volumePercent: gs.volumePercent,
      unitOpts: buildUnitOptionsData(),
      subOpts: buildSubOptionsData(gs.beatUnit)
    });
  },

  _save(patch) {
    getApp().saveState(patch);
    this._fullSync();
  },

  // 拍号
  setMeter(e) { this._save({ beatsPerBar: Number(e.currentTarget.dataset.v) }); },

  setUnit(e) {
    const bu = Number(e.currentTarget.dataset.v);
    const valid = getSubdivisionValues(bu);
    const patch = { beatUnit: bu };
    if (!valid.includes(this.data.subdivision)) patch.subdivision = 1;
    this._save(patch);
  },

  // 切分
  setSub(e) { this._save({ subdivision: Number(e.currentTarget.dataset.v) }); },

  // 重音
  cycleAccent(e) {
    const i = Number(e.currentTarget.dataset.i);
    const order = ['accent', 'normal', 'mute'];
    const cur = this.data.accents[i] || 'normal';
    const next = order[(order.indexOf(cur) + 1) % order.length];
    const accents = [...this.data.accents];
    accents[i] = next;
    this._save({ accents });
  },

  // 音色 / 音量
  setSound(e) { this._save({ sound: e.currentTarget.dataset.v }); },
  onVolume(e) {
    const v = Number(e.detail.value);
    this.setData({ volumePercent: v });
    getApp().saveState({ volumePercent: v });
  },
});
