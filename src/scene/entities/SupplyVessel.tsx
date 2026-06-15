import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getHeightAt } from '../ocean/waves'
import { nightFactor } from '../sky/daylight'
import { useSceneStore } from '../../state/store'

/**
 * 平台供应船(OSV):在平台旁动态定位(DP)守候作业 —— 缓慢偏航、随浪起伏,
 * 前置驾驶室 + 开阔后货运甲板载货,夜间甲板工作灯与航行灯点亮。
 * 站位略有漂移以呈现 DP 微调感。
 */
const STATION = new THREE.Vector3(64, 0, 58) // 平台东北侧守候位
const LEN = 58
const BEAM = 14

export function SupplyVessel() {
  const g = useRef<THREE.Group>(null!)
  const navRefs = useRef<THREE.MeshStandardMaterial[]>([])
  const deckRefs = useRef<THREE.MeshStandardMaterial[]>([])
  const deckLight = useRef<THREE.PointLight>(null!)

  useFrame((state) => {
    const t = state.clock.elapsedTime
    // DP 站位微漂移
    const cx = STATION.x + Math.sin(t * 0.07) * 3
    const cz = STATION.z + Math.cos(t * 0.05) * 3
    const hF = getHeightAt(cx, cz - LEN / 2, t)
    const hB = getHeightAt(cx, cz + LEN / 2, t)
    const hL = getHeightAt(cx - BEAM / 2, cz, t)
    const hR = getHeightAt(cx + BEAM / 2, cz, t)
    const heave = (hF + hB + hL + hR) / 4
    const g0 = g.current
    g0.position.set(cx, heave + 1.4, cz)
    g0.rotation.x = Math.atan2(hF - hB, LEN) * 0.6
    g0.rotation.z = Math.atan2(hL - hR, BEAM) * 0.6
    g0.rotation.y = 0.7 + Math.sin(t * 0.05) * 0.3 // 缓慢摆头

    const n = nightFactor(useSceneStore.getState().environment.timeOfDay)
    navRefs.current.forEach((m) => { if (m) m.emissiveIntensity = n * 4 })
    deckRefs.current.forEach((m) => { if (m) m.emissiveIntensity = n * 2.6 })
    if (deckLight.current) deckLight.current.intensity = n * 12
  })

  return (
    <group ref={g}>
      {/* 船体 */}
      <mesh castShadow receiveShadow position={[0, -0.5, 0]}>
        <boxGeometry args={[BEAM, 4, LEN]} />
        <meshStandardMaterial color="#1d3a52" metalness={0.5} roughness={0.6} />
      </mesh>
      {/* 干舷货运甲板 */}
      <mesh position={[0, 1.6, 3]}>
        <boxGeometry args={[BEAM - 1, 0.6, LEN - 8]} />
        <meshStandardMaterial color="#3a4a3f" metalness={0.4} roughness={0.85} />
      </mesh>
      {/* 前置驾驶室(偏船首 -z) */}
      <group position={[0, 2, -LEN / 2 + 9]}>
        <mesh castShadow><boxGeometry args={[BEAM - 2, 6, 10]} /><meshStandardMaterial color="#dfe3e6" metalness={0.3} roughness={0.5} /></mesh>
        <mesh position={[0, 4.6, 0.5]} castShadow><boxGeometry args={[BEAM - 5, 3.2, 5]} /><meshStandardMaterial color="#c8ccd0" metalness={0.3} roughness={0.5} /></mesh>
        {/* 驾驶室窗带 */}
        <mesh position={[0, 4.6, 3.1]}>
          <boxGeometry args={[BEAM - 6, 1.4, 0.1]} />
          <meshStandardMaterial ref={(m) => { if (m) deckRefs.current[0] = m }} color="#0e151c" emissive="#bcd2ff" emissiveIntensity={0} />
        </mesh>
        {/* 桅杆 */}
        <mesh position={[0, 8.4, 0]}><cylinderGeometry args={[0.16, 0.16, 5, 6]} /><meshStandardMaterial color="#9a9a9a" metalness={0.5} roughness={0.5} /></mesh>
      </group>

      {/* 后货运甲板货物:集装箱 + 立式管卷 */}
      <mesh position={[-3, 2.6, 10]} castShadow><boxGeometry args={[5, 2.6, 6]} /><meshStandardMaterial color="#b5532f" metalness={0.3} roughness={0.7} /></mesh>
      <mesh position={[3.2, 2.6, 18]} castShadow><boxGeometry args={[5, 2.6, 6]} /><meshStandardMaterial color="#2f6fb5" metalness={0.3} roughness={0.7} /></mesh>
      <mesh position={[0, 2.4, 1]} rotation={[0, 0, Math.PI / 2]} castShadow><cylinderGeometry args={[1.1, 1.1, 7, 16]} /><meshStandardMaterial color="#caa83c" metalness={0.5} roughness={0.5} /></mesh>

      {/* 后甲板折臂吊机 */}
      <group position={[BEAM / 2 - 2, 2, 24]}>
        <mesh castShadow><cylinderGeometry args={[0.6, 0.8, 3, 10]} /><meshStandardMaterial color="#caa83c" metalness={0.5} roughness={0.5} /></mesh>
        <mesh position={[-3, 2.5, 0]} rotation={[0, 0, 0.5]} castShadow><boxGeometry args={[8, 0.4, 0.4]} /><meshStandardMaterial color="#caa83c" metalness={0.5} roughness={0.5} /></mesh>
      </group>

      {/* 甲板工作灯(灯具 emissive)+ 照明点光源 */}
      {([[-5, 7, -LEN / 2 + 14], [5, 7, -LEN / 2 + 14], [0, 9, 6]] as [number, number, number][]).map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.32, 8, 8]} />
          <meshStandardMaterial ref={(m) => { if (m) deckRefs.current[i + 1] = m }} color="#15110a" emissive="#ffe0a0" emissiveIntensity={0} />
        </mesh>
      ))}
      <pointLight ref={deckLight} position={[0, 8, 12]} color="#ffe0a8" distance={60} decay={1.8} intensity={0} />

      {/* 航行灯:左红 / 右绿 / 桅顶白 / 艉白 */}
      {([
        { p: [-BEAM / 2 + 0.5, 4, -LEN / 2 + 9] as [number, number, number], c: '#ff2a1a' },
        { p: [BEAM / 2 - 0.5, 4, -LEN / 2 + 9] as [number, number, number], c: '#1aff4a' },
        { p: [0, 12.5, -LEN / 2 + 9] as [number, number, number], c: '#ffffff' },
        { p: [0, 3, LEN / 2 - 1] as [number, number, number], c: '#ffffff' },
      ]).map((nv, i) => (
        <mesh key={i} position={nv.p}>
          <sphereGeometry args={[0.26, 8, 8]} />
          <meshStandardMaterial ref={(m) => { if (m) navRefs.current[i] = m }} color="#050505" emissive={nv.c} emissiveIntensity={0} />
        </mesh>
      ))}
    </group>
  )
}
