import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getHeightAt } from '../ocean/waves'
import { useSceneStore } from '../../state/store'

/**
 * 穿梭油轮:沿 CatmullRom 航线巡航 → 靠近 FPSO 减速停留 → 离泊,循环。
 * 船体随浪起伏(简化:首尾两点采样)。
 */
const ROUTE = [
  new THREE.Vector3(300, 0, -160),
  new THREE.Vector3(120, 0, -60),
  new THREE.Vector3(-60, 0, 40),
  new THREE.Vector3(-120, 0, 130), // 靠近 FPSO
  new THREE.Vector3(-40, 0, 220),
  new THREE.Vector3(180, 0, 200),
  new THREE.Vector3(320, 0, 40),
]

export function Tanker() {
  const groupRef = useRef<THREE.Group>(null!)
  const curve = useMemo(() => new THREE.CatmullRomCurve3(ROUTE, true, 'catmullrom', 0.5), [])
  const tRef = useRef(0)
  const LEN = 90

  useFrame((state, delta) => {
    const time = state.clock.elapsedTime
    const dev = useSceneStore.getState().devices['tanker-1']
    if (dev?.status === 'offline') return

    // 靠泊段(t≈0.43)减速
    const t = tRef.current
    const nearBerth = Math.abs(((t % 1) - 0.43))
    const speedScale = nearBerth < 0.05 ? 0.15 : 1
    tRef.current = (t + (delta / 90) * speedScale) % 1

    const p = curve.getPointAt(tRef.current)
    const tangent = curve.getTangentAt(tRef.current)
    const g = groupRef.current

    const hF = getHeightAt(p.x + tangent.x * LEN / 2, p.z + tangent.z * LEN / 2, time)
    const hB = getHeightAt(p.x - tangent.x * LEN / 2, p.z - tangent.z * LEN / 2, time)
    g.position.set(p.x, (hF + hB) / 2 + 1.6, p.z)
    g.rotation.y = Math.atan2(tangent.x, tangent.z)
    g.rotation.x = Math.atan2(hF - hB, LEN) * 0.4
  })

  return (
    <group ref={groupRef}>
      <mesh castShadow receiveShadow position={[0, -1, 0]}>
        <boxGeometry args={[16, 6, LEN]} />
        <meshStandardMaterial color="#1f2d3a" metalness={0.5} roughness={0.6} />
      </mesh>
      <mesh castShadow position={[0, 2.5, 0]}>
        <boxGeometry args={[15, 1.2, LEN - 4]} />
        <meshStandardMaterial color="#8a3520" metalness={0.4} roughness={0.7} />
      </mesh>
      {/* 艉部上层建筑 */}
      <group position={[0, 4, LEN / 2 - 8]}>
        <mesh castShadow><boxGeometry args={[13, 10, 12]} /><meshStandardMaterial color="#d2d5d8" metalness={0.3} roughness={0.5} /></mesh>
      </group>
      {/* 甲板管线 */}
      <mesh position={[0, 3.4, -10]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.4, 0.4, 50, 8]} />
        <meshStandardMaterial color="#c8a020" metalness={0.6} roughness={0.5} />
      </mesh>
    </group>
  )
}
