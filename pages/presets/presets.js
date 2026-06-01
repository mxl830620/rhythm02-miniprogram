/**
 * Rhythm 02 — 预设管理 v0.8
 */
const SOUND_L = {
  studio: 'Studio Click', wood: 'Wood Block',
  rim: 'Rim Shot', soft: 'Soft Pulse',
  beep: 'Beep', cowbell: 'Cowbell',
  clave: 'Clave', hihat: 'Hi-Hat'
};
const SUB_L = { 1: '一', 2: '二', 3: '三连音', 4: '四', 8: '八' };

Page({
  data: {
    presets: [],
    showForm: false,
    newName: ''
  },

  onShow() {
    this._refresh();
    wx.showTabBar({ animation: false });
  },

  _refresh() {
    const presets = getApp().globalData.presets.map(p => ({
      ...p,
      soundLabel: SOUND_L[p.sound] || p.sound,
      subdivLabel: SUB_L[p.subdivision] ? `${SUB_L[p.subdivision]}等分` : `${p.subdivision}等分`
    }));
    this.setData({ presets });
  },

  quickSave() {
    const gs = getApp().globalData.state;
    getApp().addPreset({
      name: `预设 ${getApp().globalData.presets.length + 1}`,
      bpm: gs.bpm, beatsPerBar: gs.beatsPerBar, beatUnit: gs.beatUnit,
      subdivision: gs.subdivision, accents: [...gs.accents],
      sound: gs.sound, volume: gs.volumePercent,
      swing: gs.swingPercent, training: gs.training
    });
    this._refresh();
    wx.showToast({ title: '已保存', icon: 'success', duration: 1200 });
  },

  toggleForm() {
    this.setData({ showForm: !this.data.showForm, newName: '' });
  },
  onNameInput(e) { this.setData({ newName: e.detail.value }); },
  confirmSave() {
    const name = this.data.newName.trim();
    if (!name) { wx.showToast({ title: '请输入名称', icon: 'none' }); return; }
    const gs = getApp().globalData.state;
    getApp().addPreset({
      name, bpm: gs.bpm, beatsPerBar: gs.beatsPerBar, beatUnit: gs.beatUnit,
      subdivision: gs.subdivision, accents: [...gs.accents],
      sound: gs.sound, volume: gs.volumePercent,
      swing: gs.swingPercent, training: gs.training
    });
    this.setData({ showForm: false, newName: '' });
    this._refresh();
    wx.showToast({ title: '已保存', icon: 'success', duration: 1200 });
  },

  load(e) {
    const p = getApp().globalData.presets[Number(e.currentTarget.dataset.i)];
    if (!p) return;
    getApp().saveState({
      bpm: p.bpm, beatsPerBar: p.beatsPerBar, beatUnit: p.beatUnit,
      subdivision: p.subdivision, accents: p.accents || [],
      sound: p.sound, volumePercent: p.volume || 100,
      swingPercent: p.swing || 0, training: p.training || 'normal'
    });
    wx.showToast({ title: '已切换', icon: 'success', duration: 1000 });
  },

  remove(e) {
    const i = Number(e.currentTarget.dataset.i);
    wx.showModal({
      title: '删除预设',
      content: '确定要删除这个预设吗？',
      confirmColor: '#ff542a',
      success: (res) => {
        if (res.confirm) {
          getApp().removePreset(i);
          this._refresh();
        }
      }
    });
  }
});
