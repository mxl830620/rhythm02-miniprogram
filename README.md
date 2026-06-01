<!--
  节奏 02 · Rhythm 02
  微信小程序节拍器 — 仿真机械节拍器 UI + 实时 DSP 音频合成
-->

<p align="center">
  <img src="https://img.shields.io/badge/platform-WeChat%20Mini%20Program-07C160?logo=wechat" alt="WeChat" />
  <img src="https://img.shields.io/badge/SDK-3.15.2-blue" alt="SDK" />
  <img src="https://img.shields.io/badge/vanilla-no%20npm%20%2F%20no%20framework-ff69b4" alt="vanilla" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="license" />
</p>

# 节奏 02 · Rhythm 02

**「节拍搭子」** — 一款运行在微信小程序中的专业节拍器。仿真机械节拍器交互、实时 DSP 音频合成、预设管理与练习模式，面向乐手练习场景。

<p align="center">
  <em>🎵 30–260 BPM · 8 种音色 · 12 种拍号组合 · TAP 测速 · 4 种练习模式</em>
</p>

---

## ✨ 功能

### 🎛️ 核心节拍器

| 功能 | 说明 |
|------|------|
| **BPM** | 30–260，支持滑块拖拽、±1/±5 步进、直接输入 |
| **TAP 测速** | 连续点击自动计算 BPM，附带稳定性百分比 |
| **拍号** | 2, 3, 4, 5, 6, 7, 9, 12 拍 |
| **音符时值** | 二分 / 四分 / 八分 / 十六分音符 |
| **细分** | 1, 2, 3, 4 等分（短时值下支持 8 等分 + 三连音） |
| **重音编辑** | 每拍独立设置 🟢 重音 / ⚪ 普通 / 🔇 静音 |
| **音量** | 0–100%，与系统音量独立 |
| **摆动 Swing** | 0–45% 偏移，模拟摇摆律动 |

### 🔊 音色引擎（8 种）

| 音色 | 波形 | 调谐 (重音/普通/弱拍) |
|------|------|----------------------|
| **Studio Click** | 方波 | 1640 / 1120 / 760 Hz |
| **Wood Block** | 三角波 | 920 / 680 / 520 Hz |
| **Rim Shot** | 方波 | 2200 / 1680 / 980 Hz |
| **Soft Pulse** | 正弦波 | 520 / 420 / 360 Hz |
| **Beep** | 正弦波 | 1000 / 800 / 600 Hz |
| **Cowbell** | 双频叠加 | 800 / 560 / 420 Hz |
| **Clave** | 三角波 | 1200 / 900 / 600 Hz |
| **Hi-Hat** | 白噪声 | — |

> 所有音色在 JS 端实时合成（振荡器 → IIR 带通滤波 → 包络 → 归一化），通过 `wx.createWebAudioContext` 播放，无需任何音频文件。

### 🏋️ 练习模式

- **常规** — 标准节拍器
- **静音小节** — 每 4 小节静音 1 小节，训练内在节奏感
- **切分阶梯** — 每小节递增细分数量，逐步增加难度
- **重音反应** — 随机节拍作为目标重音，需准确响应

### 💾 预设管理

- 一键保存当前全部设置（BPM、拍号、细分、重音、音色）
- 自定义命名预设（最多 12 个）
- 点击加载 / 滑动删除
- `wx.setStorageSync` 本地持久化

---

## 🏗️ 技术架构

```
rhythm02-miniprogram/
├── app.js              # 全局状态 + 预设持久化
├── app.json            # 路由 / TabBar / 窗口配置
├── app.wxss            # 全局样式变量（暗色主题）
├── custom-tab-bar/     # 自定义底部导航栏
├── assets/tabbar/      # TabBar 图标
└── pages/
    ├── index/          # 🎛️ 节拍器主页（底部抽屉设置面板）
    ├── settings/       # ⚙️  独立设置页（拍号/细分/重音/音色/音量）
    ├── training/       # 🏋️ 训练模式（开发中）
    └── presets/        # 💾 预设列表 + 保存/加载/删除
```

| 层 | 技术 |
|----|------|
| **框架** | 原生 WXML / WXSS / JS，零依赖 |
| **音频引擎** | `wx.createWebAudioContext` — Web Audio API 风格接口  <br>DSP 管线：振荡器 → IIR 带通滤波 → 增益包络 → 归一化 |
| **持久化** | `wx.getStorageSync` / `wx.setStorageSync` |
| **振动** | `wx.vibrateShort`（重音/普通两种模式） |
| **触觉** | 屏幕闪光叠加层（80ms 重音 / 45ms 普通） |
| **UI** | 仿真机械节拍器摆锤动画 + 暗色主题（`#0f1724`） |

---

## 🚀 快速开始

### 前置要求

- [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)（最新稳定版）
- 微信小程序 AppID（测试可用"游客模式"）

### 运行

```bash
# 1. 克隆仓库
git clone https://github.com/<你的用户名>/rhythm02-miniprogram.git

# 2. 打开微信开发者工具
#    导入项目 → 选择仓库根目录 → 填入 AppID（或选"游客模式"）

# 3. 编译运行
#    开发者工具会自动编译并在模拟器中预览
#    真机调试：点击工具栏「预览」→ 手机扫码
```

> ⚠️ **音频功能建议在真机上测试**。模拟器的 WebAudio 实现与真机存在差异。

### 验证完整性

```bash
# 文件存在性
test -f app.json && test -f app.js && test -f app.wxss
test -f pages/index/index.wxml && test -f pages/index/index.js
test -f pages/settings/settings.wxml && test -f pages/settings/settings.js
test -f pages/training/training.wxml && test -f pages/training/training.js
test -f pages/presets/presets.wxml && test -f pages/presets/presets.js
test -f project.config.json

# JSON 格式
python3 -m json.tool app.json > /dev/null
python3 -m json.tool project.config.json > /dev/null

# JS 语法
node --check app.js
node --check pages/index/index.js

# API 使用
grep -q 'wx.setStorageSync' app.js
grep -q 'wx.createWebAudioContext' pages/index/index.js
grep -q 'wx.vibrateShort' pages/index/index.js
```

---

## ⚠️ 已知限制

- **WebAudioContext 兼容性**：`wx.createWebAudioContext` 需要基础库 ≥ 2.25.0，部分旧版本微信可能回退到 `InnerAudioContext` 方案
- **振动精度**：`wx.vibrateShort` 仅支持 `'short'` / `'long'` 两档，无法毫秒级精确控制
- **屏幕闪光**：基于 View 叠加层实现，固定持续时长（80ms / 45ms），刷新率依赖系统
- **无 Web API 联动**：不支持浏览器端的 `torch`（闪光灯）、`requestAnimationFrame` 精确调度
- **单包结构**：未配置分包加载
- **语言**：当前仅支持中文

---

## 📋 路线图

- [ ] 训练模式完整实现（静音小节 / 切分阶梯 / 重音反应）
- [ ] 自定义音色（用户可调频率 / 波形 / 包络）
- [ ] 多语言支持（en / ja / ko）
- [ ] 节拍历史记录与统计
- [ ] 云端预设同步

---

## 📄 License

MIT © 2025