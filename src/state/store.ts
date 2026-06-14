import { create } from 'zustand'
import type {
  CameraMode,
  DeviceState,
  EnvironmentState,
  Weather,
} from './schema'

/**
 * 场景不读数据,只读状态。
 * Mock 模拟器(一期)与 WebSocket 网关(二期)都只调用 updateDeviceState。
 */

interface SceneStore {
  devices: Record<string, DeviceState>
  environment: EnvironmentState
  cameraMode: CameraMode
  focusedId: string | null
  /** 性能档:high/medium/low,影响后处理与粒子量 */
  quality: 'high' | 'medium' | 'low'
  /** 模拟器开关 */
  simulating: boolean

  // —— 统一事件入口 ——
  updateDeviceState: (id: string, patch: Partial<DeviceState>) => void
  setEnvironment: (patch: Partial<EnvironmentState>) => void
  setWeather: (weather: Weather) => void
  setTimeOfDay: (t: number) => void
  setCameraMode: (mode: CameraMode) => void
  setFocused: (id: string | null) => void
  setQuality: (q: 'high' | 'medium' | 'low') => void
  setSimulating: (on: boolean) => void
}

const now = () => performance.now()

/** 初始设备布局 —— position 与场景模型节点对齐 */
const initialDevices: Record<string, DeviceState> = {
  'platform-A': {
    id: 'platform-A',
    name: '主钻井平台 A',
    type: 'platform',
    status: 'running',
    position: [0, 30, 0],
    metrics: { output: 8700, wellPressure: 32.4 },
    updatedAt: now(),
  },
  'platform-A.flare-1': {
    id: 'platform-A.flare-1',
    name: '火炬塔',
    type: 'flare',
    status: 'running',
    position: [44, 62, -18],
    metrics: { intensity: 0.85, flow: 1200 },
    updatedAt: now(),
  },
  'platform-A.crane-1': {
    id: 'platform-A.crane-1',
    name: '甲板吊机',
    type: 'crane',
    status: 'running',
    position: [-14, 30, 10],
    metrics: { load: 12.5, slew: 0 },
    updatedAt: now(),
  },
  'platform-A.pump-1': {
    id: 'platform-A.pump-1',
    name: '注水泵 1#',
    type: 'pump',
    status: 'running',
    position: [8, 26, -6],
    metrics: { pressure: 3.2, rpm: 1480 },
    updatedAt: now(),
  },
  'fpso-1': {
    id: 'fpso-1',
    name: 'FPSO 浮式储油船',
    type: 'fpso',
    status: 'running',
    position: [-150, 4, 90],
    metrics: { storage: 0.64, output: 5400 },
    updatedAt: now(),
  },
  'tanker-1': {
    id: 'tanker-1',
    name: '穿梭油轮',
    type: 'tanker',
    status: 'running',
    position: [260, 3, -120],
    metrics: { speed: 6.5 },
    updatedAt: now(),
  },
  'helicopter-1': {
    id: 'helicopter-1',
    name: '直升机 B-7701',
    type: 'helicopter',
    status: 'offline',
    position: [0, 34, 22],
    metrics: { altitude: 0 },
    updatedAt: now(),
  },
}

export const useSceneStore = create<SceneStore>((set) => ({
  devices: initialDevices,
  environment: {
    timeOfDay: 17.5, // 黄金时刻,默认最出片
    weather: 'clear',
    windDirection: Math.PI * 0.25,
    windSpeed: 6,
    timeScale: 1,
  },
  cameraMode: 'cruise',
  focusedId: null,
  quality: 'high',
  simulating: true,

  updateDeviceState: (id, patch) =>
    set((s) => {
      const prev = s.devices[id]
      if (!prev) return s
      return {
        devices: {
          ...s.devices,
          [id]: { ...prev, ...patch, updatedAt: now() },
        },
      }
    }),

  setEnvironment: (patch) =>
    set((s) => ({ environment: { ...s.environment, ...patch } })),

  setWeather: (weather) =>
    set((s) => ({ environment: { ...s.environment, weather } })),

  setTimeOfDay: (t) =>
    set((s) => ({
      environment: { ...s.environment, timeOfDay: ((t % 24) + 24) % 24 },
    })),

  setCameraMode: (cameraMode) => set({ cameraMode }),
  setFocused: (focusedId) => set({ focusedId }),
  setQuality: (quality) => set({ quality }),
  setSimulating: (simulating) => set({ simulating }),
}))

/** 设备健康总览(绿/黄/红/离线计数) */
export function selectHealthSummary(s: SceneStore) {
  const counts = { running: 0, warning: 0, fault: 0, offline: 0 }
  for (const d of Object.values(s.devices)) counts[d.status]++
  return counts
}
