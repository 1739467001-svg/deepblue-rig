import { z } from 'zod'

/** 设备运行状态 */
export const DeviceStatus = z.enum(['running', 'warning', 'fault', 'offline'])
export type DeviceStatus = z.infer<typeof DeviceStatus>

/** 设备类型 */
export const DeviceType = z.enum([
  'platform',
  'fpso',
  'flare',
  'crane',
  'pump',
  'tanker',
  'helicopter',
])
export type DeviceType = z.infer<typeof DeviceType>

/**
 * 设备状态 —— 一期 mock 与二期真实数据共用同一套校验。
 * 节点 id 与场景内模型节点命名对齐(如 "platform-A.crane-1")。
 */
export const DeviceState = z.object({
  id: z.string(),
  name: z.string(),
  type: DeviceType,
  status: DeviceStatus,
  /** 世界坐标,用于 HUD 标注锚点 */
  position: z.tuple([z.number(), z.number(), z.number()]),
  /** 连续量,驱动火焰大小、泵速、液位等 */
  metrics: z.record(z.number()),
  updatedAt: z.number(),
})
export type DeviceState = z.infer<typeof DeviceState>

/** 天气类型 —— 覆盖海上油田常见气象 */
export const Weather = z.enum([
  'clear', // 晴
  'cloudy', // 多云
  'overcast', // 阴
  'fog', // 雾
  'rain', // 雨
  'storm', // 暴风雨(强降雨 + 大浪 + 闪电)
  'snow', // 雪
])
export type Weather = z.infer<typeof Weather>

/** 环境状态 —— 单一来源驱动昼夜与天气 */
export const EnvironmentState = z.object({
  /** 0..24,驱动太阳方位/高度、天空色、灯光阈值 */
  timeOfDay: z.number().min(0).max(24),
  weather: Weather,
  /** 风向(弧度)与风力,驱动烟雾飘散、波浪方向 */
  windDirection: z.number(),
  windSpeed: z.number(),
  /** 演示模式:昼夜加速倍率(1 分钟 = 24h 时约 1440) */
  timeScale: z.number(),
})
export type EnvironmentState = z.infer<typeof EnvironmentState>

export type CameraMode = 'free' | 'cruise' | 'focus'
