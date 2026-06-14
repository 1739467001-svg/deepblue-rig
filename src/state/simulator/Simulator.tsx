import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useSceneStore } from '../store'

/**
 * Mock 状态模拟器(一期):
 * - 连续量随机扰动(泵压、火炬强度、产量)
 * - 剧情脚本:45s 注水泵 warning → 60s 升级 fault + 镜头聚焦 → 90s 恢复
 * - 昼夜按 timeScale 推进
 * 与渲染解耦:simulating=false 时场景静态可用。
 */

interface ScriptStep {
  at: number
  run: () => void
  label: string
}

export function Simulator() {
  const elapsed = useRef(0)
  const fired = useRef<Set<number>>(new Set())
  const noiseT = useRef(0)

  const script = useRef<ScriptStep[]>([])

  useEffect(() => {
    const {
      updateDeviceState,
      setCameraMode,
      setFocused,
    } = useSceneStore.getState()

    script.current = [
      {
        at: 45,
        label: '注水泵告警',
        run: () => updateDeviceState('platform-A.pump-1', { status: 'warning', metrics: { pressure: 4.6, rpm: 1620 } }),
      },
      {
        at: 60,
        label: '注水泵故障 + 镜头聚焦',
        run: () => {
          updateDeviceState('platform-A.pump-1', { status: 'fault', metrics: { pressure: 6.1, rpm: 0 } })
          setFocused('platform-A.pump-1')
          setCameraMode('focus')
        },
      },
      {
        at: 78,
        label: '镜头转火炬',
        run: () => {
          setFocused('platform-A.flare-1')
        },
      },
      {
        at: 90,
        label: '注水泵恢复 + 回到巡航',
        run: () => {
          updateDeviceState('platform-A.pump-1', { status: 'running', metrics: { pressure: 3.2, rpm: 1480 } })
          setFocused(null)
          setCameraMode('cruise')
        },
      },
      {
        at: 110,
        label: '直升机起飞',
        run: () => updateDeviceState('helicopter-1', { status: 'running', metrics: { altitude: 90 } }),
      },
    ]
  }, [])

  useFrame((state, delta) => {
    const store = useSceneStore.getState()
    if (!store.simulating) return

    // 昼夜推进
    const env = store.environment
    if (env.timeScale > 0) {
      store.setTimeOfDay(env.timeOfDay + (delta * env.timeScale) / 3600)
    }

    // 剧情脚本
    elapsed.current += delta
    for (const step of script.current) {
      if (!fired.current.has(step.at) && elapsed.current >= step.at) {
        fired.current.add(step.at)
        step.run()
      }
    }
    // 循环重置(135s 一轮)
    if (elapsed.current > 135) {
      elapsed.current = 0
      fired.current.clear()
    }

    // 连续量扰动(每 ~0.5s)
    noiseT.current += delta
    if (noiseT.current > 0.5) {
      noiseT.current = 0
      const flare = store.devices['platform-A.flare-1']
      if (flare && flare.status !== 'offline') {
        const base = 0.82
        store.updateDeviceState('platform-A.flare-1', {
          metrics: {
            ...flare.metrics,
            intensity: clamp(base + (Math.random() - 0.5) * 0.25, 0.45, 1),
          },
        })
      }
      const plat = store.devices['platform-A']
      if (plat) {
        store.updateDeviceState('platform-A', {
          metrics: {
            output: Math.round(8700 + (Math.random() - 0.5) * 400),
            wellPressure: +(32.4 + (Math.random() - 0.5) * 1.5).toFixed(1),
          },
        })
      }
    }
  })

  return null
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}
