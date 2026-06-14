import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getHeightAt, getNormalAt } from '../ocean/waves'
import { useSceneStore } from '../../state/store'

/**
 * FPSO 浮式储油船:船体随浪起伏(4 点采样拟合 pitch/roll/heave),
 * 甲板储罐/火炬臂/卸油臂/舷灯,系泊缆 CatmullRom + Tube。
 */
export function FPSO() {
  const groupRef = useRef<THREE.Group>(null!)
  const dev = useSceneStore.getState().devices['fpso-1']
  const base = useMemo(() => new THREE.Vector3(...dev.position), [])
  const LEN = 110
  const BEAM = 22

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const g = groupRef.current
    // 四角采样海面(船体长轴沿 z)
    const cx = base.x
    const cz = base.z
    const hF = getHeightAt(cx, cz - LEN / 2, t)
    const hB = getHeightAt(cx, cz + LEN / 2, t)
    const hL = getHeightAt(cx - BEAM / 2, cz, t)
    const hR = getHeightAt(cx + BEAM / 2, cz, t)
    const heave = (hF + hB + hL + hR) / 4
    g.position.set(cx, heave + 2.2, cz)
    // pitch(绕 x)与 roll(绕 z),大船幅度较小
    g.rotation.x = Math.atan2(hF - hB, LEN) * 0.5
    g.rotation.z = Math.atan2(hL - hR, BEAM) * 0.5
    g.rotation.y = 0.15
  })

  return (
    <group ref={groupRef}>
      {/* 船体 */}
      <mesh castShadow receiveShadow position={[0, -1, 0]}>
        <boxGeometry args={[BEAM, 7, LEN]} />
        <meshStandardMaterial color="#7a1f22" metalness={0.5} roughness={0.6} />
      </mesh>
      {/* 干舷上层甲板 */}
      <mesh castShadow receiveShadow position={[0, 3, 0]}>
        <boxGeometry args={[BEAM - 1, 1.5, LEN - 2]} />
        <meshStandardMaterial color="#3a4a3f" metalness={0.4} roughness={0.8} />
      </mesh>
      {/* 储罐阵列 */}
      {[-30, -15, 0, 15, 30].map((z, i) => (
        <mesh key={i} castShadow position={[0, 6.5, z]}>
          <cylinderGeometry args={[5.5, 5.5, 4, 24]} />
          <meshStandardMaterial color="#b8bcc0" metalness={0.6} roughness={0.45} />
        </mesh>
      ))}
      {/* 上层建筑(船艉生活楼) */}
      <group position={[0, 6, LEN / 2 - 12]}>
        <mesh castShadow><boxGeometry args={[BEAM - 4, 12, 16]} /><meshStandardMaterial color="#d2d5d8" metalness={0.3} roughness={0.5} /></mesh>
        <mesh position={[0, 9, 0]} castShadow><boxGeometry args={[6, 8, 6]} /><meshStandardMaterial color="#c0c4c8" metalness={0.3} roughness={0.5} /></mesh>
      </group>
      {/* 船艏火炬臂 */}
      <mesh position={[0, 12, -LEN / 2 + 6]} rotation={[0.4, 0, 0]} castShadow>
        <cylinderGeometry args={[0.5, 0.7, 24, 8]} />
        <meshStandardMaterial color="#8a7a3a" metalness={0.7} roughness={0.6} />
      </mesh>
      {/* 卸油臂(船舯舷侧) */}
      <mesh position={[BEAM / 2 + 2, 8, 0]} rotation={[0, 0, -0.5]} castShadow>
        <cylinderGeometry args={[0.6, 0.6, 14, 8]} />
        <meshStandardMaterial color="#c8a020" metalness={0.6} roughness={0.5} />
      </mesh>
      {/* 舷灯 */}
      <MooringLight position={[0, 18, LEN / 2 - 4]} />
    </group>
  )
}

function MooringLight({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.MeshStandardMaterial>(null!)
  useFrame((state) => {
    if (ref.current) ref.current.emissiveIntensity = 2 + Math.sin(state.clock.elapsedTime * 2) * 0.5
  })
  return (
    <mesh position={position}>
      <sphereGeometry args={[0.4, 12, 12]} />
      <meshStandardMaterial ref={ref} color="#fff" emissive="#fff5d0" emissiveIntensity={2} />
    </mesh>
  )
}
