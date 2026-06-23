import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useSceneStore } from '../state/store'
import { liveWeather } from '../scene/weather/weatherSystem'
import { sunDirection } from '../scene/sky/SkyEnvironment'
import { AmbientEngine } from './ambient'

/**
 * 背景氛围音控制器(无渲染输出)。
 * 监听 store.audioOn:开启时惰性创建 AmbientEngine 并随天气/昼夜更新;关闭时淡出挂起。
 * 引擎在用户点击(audioOn 置真)后才启动,符合浏览器自动播放策略。
 */
export function AudioControl() {
  const audioOn = useSceneStore((s) => s.audioOn)
  const engineRef = useRef<AmbientEngine | null>(null)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    if (audioOn) {
      if (!engineRef.current) {
        try {
          engineRef.current = new AmbientEngine()
        } catch {
          return // 浏览器不支持 Web Audio 时静默降级
        }
      }
      engineRef.current.start()
      // 定时把天气/昼夜参数推给引擎(平滑联动,无需每帧)
      const tick = () => {
        const env = useSceneStore.getState().environment
        const day = THREE.MathUtils.clamp((sunDirection(env.timeOfDay).y + 0.08) / 0.4, 0, 1)
        engineRef.current?.update({
          waveScale: liveWeather.waveScale,
          windMul: liveWeather.windMul,
          precip: liveWeather.precip,
          lightning: liveWeather.lightning,
          day,
        })
      }
      tick()
      timerRef.current = window.setInterval(tick, 500)
    } else {
      engineRef.current?.stop()
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    }
    return () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    }
  }, [audioOn])

  // 卸载时彻底释放
  useEffect(() => () => { engineRef.current?.dispose() }, [])

  return null
}
