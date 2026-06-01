/**
 * Rhythm 02 节拍器 — 全局状态
 * 所有页面通过 getApp().globalData.state 共享节拍器配置
 */
App({
  globalData: {
    state: {
      bpm: 96,
      beatsPerBar: 4,
      beatUnit: 4,
      subdivision: 1,
      accents: ['accent', 'normal', 'normal', 'normal'],
      sound: 'studio',
      volumePercent: 100,
      swingPercent: 0,
      screenFlash: false,
      vibration: true,
      training: 'normal',
    },
    presets: []
  },

  onLaunch() {
    // 全局忽略手机静音开关
    wx.setInnerAudioOption({ obeyMuteSwitch: false, mixWithOther: true });
    this._loadState();
    this._loadPresets();
  },

  /** 更新状态并持久化 */
  saveState(patch) {
    const state = this.globalData.state;
    Object.assign(state, patch);
    wx.setStorageSync('rhythm02-state', {
      bpm: state.bpm,
      beatsPerBar: state.beatsPerBar,
      beatUnit: state.beatUnit,
      subdivision: state.subdivision,
      accents: [...state.accents],
      sound: state.sound,
      volumePercent: state.volumePercent,
      swingPercent: state.swingPercent,
      screenFlash: state.screenFlash,
      vibration: state.vibration,
      training: state.training,
    });
  },

  /** 加载本地状态 */
  _loadState() {
    const s = wx.getStorageSync('rhythm02-state');
    if (s) Object.assign(this.globalData.state, s);
  },

  /** 预设：存入 */
  addPreset(preset) {
    let list = this.globalData.presets;
    list.unshift(preset);
    if (list.length > 12) list = list.slice(0, 12);
    this.globalData.presets = list;
    this._savePresets();
  },

  /** 预设：删除 */
  removePreset(index) {
    this.globalData.presets.splice(index, 1);
    this._savePresets();
  },

  /** 加载预设列表 */
  _loadPresets() {
    this.globalData.presets = wx.getStorageSync('rhythm02-presets') || [];
  },

  _savePresets() {
    wx.setStorageSync('rhythm02-presets', this.globalData.presets);
  }
});
