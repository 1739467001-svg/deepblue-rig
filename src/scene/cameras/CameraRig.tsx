import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { useSceneStore } from '../../state/store'

/**
 * 相机系统:
 * - free:OrbitControls(限制俯角,禁止穿入海面)
 * - cruise:CatmullRom 路径 + lookAt 插值的电影运镜,循环播放
 * - focus:GSAP 风格平滑飞向设备观察位(此处用 lerp 实现,无需额外依赖)
 */

// 巡航路径:海面低空掠过 → 拉升环绕平台 → 推近火炬
const CRUISE_POINTS = [
  new THREE.Vector3(180, 12, 160),
  new THREE.Vector3(90, 30, 120),
  new THREE.Vector3(-20, 55, 150),
  new THREE.Vector3(-130, 70, 40),
  new THREE.Vector3(-80, 45, -120),
  new THREE.Vector3(60, 38, -140),
  new THREE.Vector3(150, 28, -40),
]
const CRUISE_LOOK = [
  new THREE.Vector3(0, 30, 0),
  new THREE.Vector3(0, 35, 0),
  new THREE.Vector3(0, 40, 0),
  new THREE.Vector3(-150, 8, 90),
  new THREE.Vector3(0, 45, 0),
  new THREE.Vector3(44, 64, -18),
  new THREE.Vector3(0, 35, 0),
]

const CRUISE_DURATION = 48 // 秒,走完一圈

export function CameraRig() {
  const { camera } = useThree()
  const mode = useSceneStore((s) => s.cameraMode)
  const focusedId = useSceneStore((s) => s.focusedId)
  const controlsRef = useRef<any>(null)

  const posCurve = useRef(new THREE.CatmullRomCurve3(CRUISE_POINTS, true, 'catmullrom', 0.5))
  const lookCurve = useRef(new THREE.CatmullRomCurve3(CRUISE_LOOK, true, 'catmullrom', 0.5))
  const cruiseT = useRef(0)
  const lookTarget = useRef(new THREE.Vector3(0, 30, 0))

  // 聚焦目标缓存
  const focusPos = useRef(new THREE.Vector3())
  const focusLook = useRef(new THREE.Vector3())
  const focusing = useRef(false)

  useEffect(() => {
    if (mode === 'focus' && focusedId) {
      const dev = useSceneStore.getState().devices[focusedId]
      if (dev) {
        const p = new THREE.Vector3(...dev.position)
        focusLook.current.copy(p)
        // 观察位:设备前上方
        const offset = new THREE.Vector3(28, 14, 28)
        focusPos.current.copy(p).add(offset)
        focusing.current = true
      }
    }
    // 进入海底:把相机放到导管架旁的水下机位
    if (mode === 'dive') {
      camera.position.set(46, -13, 46)
    }
  }, [mode, focusedId, camera])

  useFrame((state, delta) => {
    if (mode === 'cruise') {
      cruiseT.current = (cruiseT.current + delta / CRUISE_DURATION) % 1
      const p = posCurve.current.getPointAt(cruiseT.current)
      const l = lookCurve.current.getPointAt(cruiseT.current)
      // 防止穿入海面
      p.y = Math.max(p.y, 8)
      camera.position.lerp(p, 1 - Math.pow(0.001, delta))
      lookTarget.current.lerp(l, 1 - Math.pow(0.002, delta))
      camera.lookAt(lookTarget.current)
    } else if (mode === 'focus' && focusing.current) {
      camera.position.lerp(focusPos.current, 1 - Math.pow(0.002, delta))
      lookTarget.current.lerp(focusLook.current, 1 - Math.pow(0.002, delta))
      camera.lookAt(lookTarget.current)
      if (camera.position.distanceTo(focusPos.current) < 0.5) focusing.current = false
    } else if (mode === 'free') {
      // 平移边界:把观察点锁在主平台周边,避免相机被 pan 带到 700m+ 外的
      // 远景装饰平台旁(那些是贴地平线的低模道具,近看会露馅)
      const c = controlsRef.current
      if (c?.target) {
        const t = c.target as THREE.Vector3
        const r = Math.hypot(t.x, t.z)
        const R = 200
        if (r > R) {
          const k = R / r
          t.x *= k
          t.z *= k
        }
        t.y = THREE.MathUtils.clamp(t.y, 4, 130)
      }
    }
  })

  // free 与 dive 均用 OrbitControls;dive 放开俯仰限制以便仰望水面、贴近海床
  const orbit = mode === 'free' || mode === 'dive'
  return orbit ? (
    <OrbitControls
      ref={controlsRef}
      enablePan
      enableDamping
      dampingFactor={0.05}
      minDistance={mode === 'dive' ? 6 : 30}
      maxDistance={mode === 'dive' ? 420 : 460}
      maxPolarAngle={mode === 'dive' ? Math.PI : Math.PI / 2 - 0.04}
      target={mode === 'dive' ? [0, -18, 0] : [0, 28, 0]}
    />
  ) : null
}
