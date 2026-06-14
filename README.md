# DeepBlue Rig · 海上油田数字孪生视觉模拟

用游戏级渲染技术构建一座"活着的"海上油田。一期专注电影级视觉呈现,由 mock 状态模拟器驱动;二期通过预留的状态驱动架构平滑接入真实 SCADA 数据。

## 运行

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # 生产构建
npm run preview    # 预览生产构建
```

> 注:若 `npm install` 报 `_cacache` 权限/EEXIST 错误,是本机 npm 缓存损坏所致,可用
> `npm_config_cache=/tmp/npmcache npm install` 绕过,或 `npm cache clean --force`。

## 技术栈

React 18 · Vite 5 · TypeScript · Three.js (R3F 8 + drei) · @react-three/postprocessing · Zustand · Zod · Tailwind CSS

> PRD 建议 React 19 / Tailwind v4;为渲染稳定性实际采用经充分验证的 React 18 + R3F 8 组合。

## 架构:渲染层 — 状态层 — 数据适配层

**核心原则:场景不读数据,只读状态。** 一期 mock 模拟器与二期 WebSocket 网关都只调用同一入口
`updateDeviceState(id, patch)`,渲染层零重构。

```
src/
├── scene/                 渲染层(只消费状态,负责"好看")
│   ├── ocean/             Gerstner 多波海面 shader + getHeightAt 高度采样
│   ├── sky/               天空、太阳方位、昼夜调色、雾
│   ├── entities/          Platform / FPSO / Tanker / Helicopter
│   ├── effects/           Flare(火炬)
│   ├── weather/           天气系统(预设插值 / 云层 / 雨雪 / 闪电)
│   ├── postfx/            SSAO → Bloom → Vignette → ACES 后处理管线
│   └── cameras/           自由 / 巡航(电影运镜)/ 聚焦
├── state/                 状态层
│   ├── schema.ts          Zod DeviceState / EnvironmentState
│   ├── store.ts           Zustand store + updateDeviceState 统一入口
│   └── simulator/         mock 模拟器 + 剧情脚本
├── hud/                   设备标注(drei Html)+ 全局 HUD 控制面板
└── adapters/              二期 WebSocket 数据适配(预留空壳,见 README)
```

## 已实现(对照 PRD)

- **P0 基底**:Gerstner 多波海面(菲涅尔反射 / 太阳闪烁 / 程序化细节法线 / 波峰白沫 / 大气透视)、
  太阳方位驱动的天空与昼夜调色、程序化导管架钻井平台(井架 / 甲板 / 生活楼 / 直升机坪 / 吊机 / 栏杆)、
  后处理管线、程序化环境贴图(无外部 HDRI 依赖)。
- **P1 细节 + 状态机制**:火炬燃烧(双层噪声火焰 + flicker 点光源 + GPU 烟雾)、FPSO(随浪起伏 + 储罐 + 火炬臂)、
  航空障碍灯、可回转吊机、水线浪花;Zustand 状态层 + Zod 校验 + mock 模拟器(45s 告警→60s 故障聚焦→90s 恢复剧情)。
- **P2 动态氛围**:昼夜循环(可加速演示)、**七种天气**(晴 / 多云 / 阴 / 雾 / 雨 / 暴风雨 / 雪,
  6 秒平滑过渡不跳变)、程序化体积感云层(FBM 噪声穹顶,随风飘移、被太阳染色、按覆盖度铺满天幕)、
  暴风雨闪电与放大涌浪、雨/雪粒子、穿梭油轮航线巡航靠泊、直升机起降状态机、相机自由/巡航/聚焦三模式。
- **HUD**:左上时间/天气、右上设备健康总览、底部控制面板、设备点击聚焦标注卡片。
- **降级**:画质高/中/低三档(中低关 SSAO 保 Bloom)。

## 状态驱动映射

| status | 视觉表现 |
|---|---|
| running | 指示灯绿色,动画正常速率 |
| warning | 指示灯黄色脉冲 |
| fault | 指示灯红色急闪 + 设备停转 |
| offline | 设备去饱和压暗,动画停止 |

`metrics` 驱动连续量:火焰大小(`flare.intensity`)、泵机转速(`pump.rpm`)等。

## 二期接入

将 `Simulator` 替换为 `adapters/` 中的 socket 订阅,调用同一 `updateDeviceState`,渲染层与标注层零改动。
详见 `src/adapters/README.md`。
