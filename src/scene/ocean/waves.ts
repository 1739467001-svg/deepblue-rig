import * as THREE from 'three'
import { waveScaleRef } from '../weather/weatherSystem'

/**
 * Gerstner 波参数 —— GPU(顶点着色器)与 CPU(getHeightAt)共用同一组,
 * 保证浮体起伏与可见波面严格一致。
 * 仅保留较大的涌浪用于几何位移(避免高频波在网格上欠采样产生硬质刻面),
 * 细碎波纹由片元着色器的程序化法线扰动表现。
 */
export interface GerstnerWave {
  dir: [number, number]
  wavelength: number
  amplitude: number
  steepness: number
  speed: number
}

/** 4 组主涌浪,方向发散,陡度适中以保持平滑波形。 */
export const WAVES: GerstnerWave[] = [
  { dir: [1.0, 0.22], wavelength: 120, amplitude: 1.7, steepness: 0.42, speed: 5.6 },
  { dir: [0.7, 0.72], wavelength: 72, amplitude: 1.05, steepness: 0.36, speed: 4.4 },
  { dir: [-0.35, 0.94], wavelength: 44, amplitude: 0.55, steepness: 0.32, speed: 3.6 },
  { dir: [0.92, -0.4], wavelength: 26, amplitude: 0.3, steepness: 0.28, speed: 2.9 },
]

const NUM = WAVES.length
/** 着色器中固定数组长度,必须与 GLSL 内的 `[MAX_WAVES]` 一致 */
export const MAX_WAVES = 8

/**
 * 打包成 uniform 数组供着色器使用。
 * 数组长度必须严格等于 GLSL 声明的 MAX_WAVES,否则 three 上传 uniform 时
 * 会对未定义槽位调用 .toArray() 抛错并中断整帧渲染。
 */
export function packWaveUniforms() {
  const dir: THREE.Vector2[] = []
  const params: THREE.Vector4[] = [] // wavelength, amplitude, steepness, speed
  for (let i = 0; i < MAX_WAVES; i++) {
    const w = WAVES[i]
    if (w) {
      dir.push(new THREE.Vector2(w.dir[0], w.dir[1]).normalize())
      params.push(new THREE.Vector4(w.wavelength, w.amplitude, w.steepness, w.speed))
    } else {
      dir.push(new THREE.Vector2(1, 0))
      params.push(new THREE.Vector4(1, 0, 0, 0))
    }
  }
  return { dir, params, count: NUM }
}

/**
 * CPU 端高度采样 —— 与着色器同公式。
 * 返回该 (x,z) 处水面的世界 y 高度(含波幅)。
 */
export function getHeightAt(x: number, z: number, time: number): number {
  let sx = x
  let sz = z
  for (let iter = 0; iter < 2; iter++) {
    let dx = 0
    let dz = 0
    for (const w of WAVES) {
      const d = normalize2(w.dir)
      const k = (2 * Math.PI) / w.wavelength
      const q = w.steepness / (k * w.amplitude * NUM)
      const phase = k * (d[0] * sx + d[1] * sz) + w.speed * k * time
      const c = Math.cos(phase)
      dx += q * w.amplitude * d[0] * c
      dz += q * w.amplitude * d[1] * c
    }
    sx = x - dx
    sz = z - dz
  }
  let y = 0
  for (const w of WAVES) {
    const d = normalize2(w.dir)
    const k = (2 * Math.PI) / w.wavelength
    const phase = k * (d[0] * sx + d[1] * sz) + w.speed * k * time
    y += w.amplitude * Math.sin(phase)
  }
  // 与海面着色器同步:风暴天气放大浪高
  return y * waveScaleRef.value
}

/** 估算法线(用于浮体姿态) */
export function getNormalAt(x: number, z: number, time: number): THREE.Vector3 {
  const e = 1.0
  const hL = getHeightAt(x - e, z, time)
  const hR = getHeightAt(x + e, z, time)
  const hD = getHeightAt(x, z - e, time)
  const hU = getHeightAt(x, z + e, time)
  return new THREE.Vector3(hL - hR, 2 * e, hD - hU).normalize()
}

function normalize2(d: [number, number]): [number, number] {
  const l = Math.hypot(d[0], d[1]) || 1
  return [d[0] / l, d[1] / l]
}
