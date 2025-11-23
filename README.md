# Midi Visitor

![License](https://img.shields.io/badge/license-GPLv3-blue.svg)
![React](https://img.shields.io/badge/React-18-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![Vite](https://img.shields.io/badge/Vite-Fast-blue)

[English](#english) | [简体中文](#简体中文)

![App Screenshot](./public/screenshot_01.png)

---

## English

**Midi Visitor** is a **highly customizable**, minimalist MIDI visualization tool built with React and TypeScript.

It runs entirely in the browser—no file uploads to servers required—transforming MIDI files into fluid animations with support for highly customizable modern visual styles.

[Custom Theme Showcase](#themes)

### Live Demo
[https://arpo35.github.io/Midi-visitor/](https://arpo35.github.io/Midi-visitor/)

### Key Features

#### 1. Advanced Appearance Customization
*   **Background Engine**: Supports solid colors, customizable linear gradients (angle/stops), and local image uploads as backgrounds.
*   **Glassmorphism System**: Provides fine-grained control over the "window" effect, including background blur, opacity, corner radius, and shadow diffusion.
*   **Theme Control**: Comprehensive color management for notes, playheads, overlays, and UI borders.

#### 2. Flexible Layout & Rendering
*   **Dual View Modes**: Seamless switching between Horizontal (Piano Roll) and Vertical (Waterfall) scrolling directions.
*   **Viewport Management**: Independently adjustable top, bottom, left, and right margins to create a "floating" effect within the screen, ideal for screen recording or post-production compositing.
*   **Geometry Control**:
    *   **Note Thickness**: Adjust the weight of visual elements.
    *   **Speed Scaling**: Compress or expand visual content along the time axis.
    *   **Pitch Stretch**: Adjust vertical/horizontal spacing between notes to fit different screen aspect ratios.

#### 3. Track Management
*   **Selective Rendering**: Parses track metadata (instrument names, note counts) and allows independent enabling or disabling of specific tracks to optimize visual presentation.

### Local Deployment

```bash
git clone https://github.com/ARPO35/Midi-visitor.git
cd Midi-visitor
npm install
npm run dev
```

---

## 简体中文

**Midi Visitor** 是一个基于 React 和 TypeScript 构建的 **高度可自定义** 的极简主义 MIDI 可视化工具。

它完全在浏览器端运行，无需上传文件到服务器，即可将 MIDI 文件转化为流畅的动画，并支持高度自定义的现代视觉风格。

[自定义主题展示](#themes)

### 在线演示
[https://arpo35.github.io/Midi-visitor/](https://arpo35.github.io/Midi-visitor/)

### 主要功能

#### 1. 高级外观定制
*   **背景引擎**：支持纯色、自定义线性渐变（角度/色标）以及本地图片上传作为背景。
*   **拟态风格系统 (Glassmorphism)**：提供对“视窗”效果的精细控制，包括背景模糊度、透明度、圆角半径以及阴影扩散程度。
*   **主题控制**：对音符、播放头、遮罩层及 UI 边框进行全面的色彩管理。

#### 2. 灵活的布局与渲染
*   **双视图模式**：支持横向（钢琴卷帘）和纵向（瀑布流）两种滚动方向的无缝切换。
*   **视口管理**：可独立调整上、下、左、右的边距，实现可视化区域在屏幕中的“悬浮”效果，便于录屏或后期合成。
*   **几何控制**：
    *   **音符厚度**：调整视觉元素的粗细。
    *   **速度缩放**：沿时间轴压缩或拉伸视觉内容。
    *   **音高拉伸**：调整音符间的垂直/水平间距以适配不同的屏幕比例。

#### 3. 轨道管理
*   **选择性渲染**：解析轨道元数据（乐器名称、音符数量），并可独立启用或关闭特定轨道，以优化视觉呈现。

### 本地部署

```bash
git clone https://github.com/ARPO35/Midi-visitor.git
cd Midi-visitor
npm install
npm run dev
```

---

## Themes
![App Screenshot](./public/screenshot_01.png)
![App Screenshot](./public/screenshot_02.png)
![App Screenshot](./public/screenshot_03.png)
![App Screenshot](./public/screenshot_04.png)
![App Screenshot](./public/screenshot_05.png)

## License
Distributed under the GNU General Public License v3.0 (GPLv3). See `LICENSE` for more information.