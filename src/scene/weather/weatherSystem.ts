import * as THREE from 'three'
import type { Weather } from '../../state/schema'

/**
 * 天气系统:每种天气一组视觉参数,运行时向目标天气平滑插值(约 6 秒),
 * 全场(天空 / 海面 / 降水 / 闪电)读取同一份 liveWeather,保证一致且不跳变。
 */
export interface WeatherParams {
  cloudCover: number // 0..1 云层覆盖
  cloudDark: number // 0..1 云层压暗(阴/暴风雨更暗)
  fogDensity: number // 雾基准密度
  sunMul: number // 阳光衰减(被云遮挡)
  ambientMul: number // 环境光倍率
  precip: number // 降水量 0..1
  precipKind: number // 0=无/雨, 1=雪(用于粒子着色与运动)
  waveScale: number // 浪高倍率
  windMul: number // 风力倍率
  turbidity: number // 天空浑浊度
  rayleigh: number // 瑞利散射
  desaturate: number // 去饱和 0..1
  lightning: number // 闪电强度 0/1
}

export const WEATHER_PRESETS: Record<Weather, WeatherParams> = {
  clear: {
    cloudCover: 0.1, cloudDark: 0.0, fogDensity: 0.00035, sunMul: 1.0, ambientMul: 1.0,
    precip: 0, precipKind: 0, waveScale: 1.0, windMul: 1.0, turbidity: 9, rayleigh: 2.6, desaturate: 0, lightning: 0,
  },
  cloudy: {
    cloudCover: 0.5, cloudDark: 0.12, fogDensity: 0.0006, sunMul: 0.82, ambientMul: 1.05,
    precip: 0, precipKind: 0, waveScale: 1.08, windMul: 1.1, turbidity: 6, rayleigh: 2.2, desaturate: 0.12, lightning: 0,
  },
  overcast: {
    cloudCover: 0.95, cloudDark: 0.45, fogDensity: 0.0011, sunMul: 0.42, ambientMul: 1.1,
    precip: 0, precipKind: 0, waveScale: 1.14, windMul: 1.2, turbidity: 4, rayleigh: 1.4, desaturate: 0.42, lightning: 0,
  },
  fog: {
    cloudCover: 0.55, cloudDark: 0.2, fogDensity: 0.004, sunMul: 0.6, ambientMul: 1.0,
    precip: 0, precipKind: 0, waveScale: 0.92, windMul: 0.7, turbidity: 5, rayleigh: 4.5, desaturate: 0.5, lightning: 0,
  },
  rain: {
    cloudCover: 0.9, cloudDark: 0.4, fogDensity: 0.0018, sunMul: 0.38, ambientMul: 1.0,
    precip: 0.6, precipKind: 0, waveScale: 1.3, windMul: 1.4, turbidity: 4, rayleigh: 1.6, desaturate: 0.32, lightning: 0,
  },
  storm: {
    cloudCover: 1.0, cloudDark: 0.62, fogDensity: 0.0026, sunMul: 0.22, ambientMul: 0.9,
    precip: 1.0, precipKind: 0, waveScale: 1.8, windMul: 2.2, turbidity: 3, rayleigh: 1.1, desaturate: 0.4, lightning: 1,
  },
  snow: {
    cloudCover: 0.82, cloudDark: 0.3, fogDensity: 0.0022, sunMul: 0.5, ambientMul: 1.15,
    precip: 0.7, precipKind: 1, waveScale: 0.9, windMul: 0.8, turbidity: 4, rayleigh: 1.8, desaturate: 0.55, lightning: 0,
  },
}

/** 当前实时(插值后)天气参数,全场共享读取 */
export const liveWeather: WeatherParams = { ...WEATHER_PRESETS.clear }

/** 浪高全局倍率 —— 着色器与 CPU getHeightAt 共用,storm 时放大涌浪 */
export const waveScaleRef = { value: 1 }

function damp(current: number, target: number, lambda: number, dt: number) {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * dt))
}

/** 每帧推进 liveWeather 向目标天气插值(在单一驱动组件中调用) */
export function advanceWeather(target: Weather, dt: number) {
  const p = WEATHER_PRESETS[target]
  const k = 0.5 // ~ 6s 过渡
  liveWeather.cloudCover = damp(liveWeather.cloudCover, p.cloudCover, k, dt)
  liveWeather.cloudDark = damp(liveWeather.cloudDark, p.cloudDark, k, dt)
  liveWeather.fogDensity = damp(liveWeather.fogDensity, p.fogDensity, k, dt)
  liveWeather.sunMul = damp(liveWeather.sunMul, p.sunMul, k, dt)
  liveWeather.ambientMul = damp(liveWeather.ambientMul, p.ambientMul, k, dt)
  liveWeather.precip = damp(liveWeather.precip, p.precip, k, dt)
  liveWeather.precipKind = damp(liveWeather.precipKind, p.precipKind, k, dt)
  liveWeather.waveScale = damp(liveWeather.waveScale, p.waveScale, k, dt)
  liveWeather.windMul = damp(liveWeather.windMul, p.windMul, k, dt)
  liveWeather.turbidity = damp(liveWeather.turbidity, p.turbidity, k, dt)
  liveWeather.rayleigh = damp(liveWeather.rayleigh, p.rayleigh, k, dt)
  liveWeather.desaturate = damp(liveWeather.desaturate, p.desaturate, k, dt)
  liveWeather.lightning = damp(liveWeather.lightning, p.lightning, k, dt)
  waveScaleRef.value = liveWeather.waveScale
}
