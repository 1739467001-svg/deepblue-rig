import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getHeightAt, getNormalAt } from '../ocean/waves'
import { nightFactor } from '../sky/daylight'
import { useSceneStore } from '../../state/store'

/**
 * 航标浮标:标记平台安全区,随波浪起伏并按波面法线摆动,顶部信号灯夜间闪烁。
 * 红/绿按 IALA 侧面标(左红右绿),纯几何 + 高度采样,无额外光照负担。
 */
interface BuoyDef {
  x: number
  z: number
  color: string
}

const BUOYS: BuoyDef[] = [
  { x: 70, z: 70, color: '#1aff4a' },
  { x: -70, z: 70, color: '#ff2a1a' },
  { x: 70, z: -70, color: '#ff2a1a' },
  { x: -70, z: -70, color: '#1aff4a' },
  { x: 110, z: 10, color: '#1aff4a' },
  { x: -110, z: -20, color: '#ff2a1a' },
]

export function Buoys() {
  return (
    <>
      {BUOYS.map((b, i) => (
        <Buoy key={i} def={b} seed={i * 1.7} />
      ))}
    </>
  )
}

function Buoy({ def, seed }: { def: BuoyDef; seed: number }) {
  const ref = useRef<THREE.Group>(null!)
  const lightRef = useRef<THREE.MeshStandardMaterial>(null!)
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  const q = useMemo(() => new THREE.Quaternion(), [])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const h = getHeightAt(def.x, def.z, t)
    const g = ref.current
    g.position.set(def.x, h, def.z)
    // 按波面法线倾斜(限制幅度,避免过度摇摆)
    const n = getNormalAt(def.x, def.z, t)
    n.lerp(up, 0.55).normalize()
    q.setFromUnitVectors(up, n)
    g.quaternion.slerp(q, 0.1)

    // 夜间顶灯闪烁(约 0.5Hz,与导航灯节奏一致)
    if (lightRef.current) {
      const night = nightFactor(useSceneStore.getState().environment.timeOfDay)
      const blink = Math.pow(Math.max(0, Math.sin(t * 1.5 + seed)), 6)
      lightRef.current.emissiveIntensity = night * blink * 5 + 0.3
    }
  })

  return (
    <group ref={ref}>
      {/* 水下配重(露出部分)+ 浮筒 */}
      <mesh position={[0, 0.6, 0]} castShadow>
        <cylinderGeometry args={[1.4, 1.8, 2.4, 14]} />
        <meshStandardMaterial color={def.color} metalness={0.3} roughness={0.6} />
      </mesh>
      {/* 反光带 */}
      <mesh position={[0, 1.3, 0]}>
        <cylinderGeometry args={[1.45, 1.45, 0.4, 14]} />
        <meshStandardMaterial color="#f4f4f4" metalness={0.2} roughness={0.4} />
      </mesh>
      {/* 灯架格栅 */}
      <mesh position={[0, 2.6, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 2.0, 6]} />
        <meshStandardMaterial color="#888" metalness={0.6} roughness={0.5} />
      </mesh>
      {/* 顶标灯 */}
      <mesh position={[0, 3.7, 0]}>
        <sphereGeometry args={[0.4, 12, 12]} />
        <meshStandardMaterial ref={lightRef} color={def.color} emissive={def.color} emissiveIntensity={0.3} />
      </mesh>
    </group>
  )
}
