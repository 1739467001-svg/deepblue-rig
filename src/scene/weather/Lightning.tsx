import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { liveWeather } from './weatherSystem'

/**
 * 暴风雨闪电:随机间隔触发一次多段闪光(主闪 + 余闪),
 * 用一盏高强度方向光 + 天空整体提亮模拟。仅在 storm(lightning>0.5)时活跃。
 */
export function Lightning() {
  const lightRef = useRef<THREE.DirectionalLight>(null!)
  const timer = useRef(2 + Math.random() * 4)
  const flash = useRef(0)
  const flashSeq = useRef<number[]>([])

  useFrame((state, delta) => {
    const active = liveWeather.lightning > 0.5
    if (!active) {
      flash.current = 0
      lightRef.current.intensity = 0
      timer.current = 1.5 + Math.random() * 4
      return
    }

    timer.current -= delta
    if (timer.current <= 0 && flashSeq.current.length === 0) {
      // 触发一次闪电:2~4 段忽明忽暗
      const n = 2 + Math.floor(Math.random() * 3)
      flashSeq.current = []
      for (let i = 0; i < n; i++) flashSeq.current.push(0.04 + Math.random() * 0.08)
      timer.current = 3 + Math.random() * 6
      // 随机方位
      const a = Math.random() * Math.PI * 2
      lightRef.current.position.set(Math.cos(a) * 400, 300, Math.sin(a) * 400)
    }

    // 播放闪光序列
    if (flashSeq.current.length > 0) {
      flash.current -= delta
      if (flash.current <= 0) {
        const next = flashSeq.current.shift()!
        flash.current = next
        lightRef.current.intensity = lightRef.current.intensity > 1 ? 0 : 7
      }
    } else {
      lightRef.current.intensity = THREE.MathUtils.lerp(lightRef.current.intensity, 0, 0.4)
    }
  })

  return <directionalLight ref={lightRef} color="#cdd6ff" intensity={0} />
}
