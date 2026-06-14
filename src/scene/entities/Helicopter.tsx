import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useSceneStore } from '../../state/store'

/**
 * 直升机:状态机 起飞 → 巡航绕场 → 降落直升机坪。
 * 旋翼用快速旋转 + 半透明盘模拟运动模糊。
 * helicopter-1.status==='offline' 时停在停机坪。
 */
const PAD = new THREE.Vector3(0, 55, 24) // 直升机坪上方
const CRUISE_RADIUS = 160
const CRUISE_HEIGHT = 90

export function Helicopter() {
  const groupRef = useRef<THREE.Group>(null!)
  const rotorRef = useRef<THREE.Mesh>(null!)
  const tailRotorRef = useRef<THREE.Group>(null!)
  const beaconRef = useRef<THREE.MeshStandardMaterial>(null!)
  const phase = useRef(0) // 0 起飞 1 巡航 2 降落
  const clock = useRef(0)

  useFrame((state, delta) => {
    const dev = useSceneStore.getState().devices['helicopter-1']
    const g = groupRef.current
    const active = dev?.status !== 'offline'

    // 旋翼始终转(待命也怠速)
    rotorRef.current.rotation.y += delta * (active ? 60 : 8)
    tailRotorRef.current.rotation.x += delta * (active ? 80 : 10)

    // 防撞红色频闪灯(约 1.3Hz 急闪),起飞后更亮
    if (beaconRef.current) {
      const strobe = Math.pow(Math.max(0, Math.sin(state.clock.elapsedTime * 8)), 16)
      beaconRef.current.emissiveIntensity = strobe * (active ? 6 : 3)
    }

    if (!active) {
      g.position.copy(PAD).setY(56)
      g.rotation.set(0, 0, 0)
      clock.current = 0
      phase.current = 0
      return
    }

    clock.current += delta
    const t = clock.current

    if (phase.current === 0) {
      // 起飞:从停机坪垂直拉升再前飞
      const k = Math.min(1, t / 6)
      g.position.lerpVectors(PAD.clone().setY(56), new THREE.Vector3(CRUISE_RADIUS, CRUISE_HEIGHT, 0), k)
      g.rotation.z = -k * 0.15
      if (k >= 1) { phase.current = 1; clock.current = 0 }
    } else if (phase.current === 1) {
      // 巡航绕场
      const a = t * 0.18
      const x = Math.cos(a) * CRUISE_RADIUS
      const z = Math.sin(a) * CRUISE_RADIUS
      g.position.set(x, CRUISE_HEIGHT + Math.sin(t * 0.5) * 4, z)
      g.rotation.y = -a + Math.PI / 2
      g.rotation.z = 0.2
      if (t > 35) { phase.current = 2; clock.current = 0 }
    } else {
      // 降落
      const k = Math.min(1, t / 7)
      const from = new THREE.Vector3(CRUISE_RADIUS, CRUISE_HEIGHT, 0)
      g.position.lerpVectors(from, PAD.clone().setY(56), k)
      g.rotation.z = 0.1 * (1 - k)
      if (k >= 1) { phase.current = 0; clock.current = 0 }
    }
  })

  return (
    <group ref={groupRef} position={[0, 56, 24]} scale={1.4}>
      {/* 机身 */}
      <mesh castShadow><capsuleGeometry args={[1.4, 4, 8, 16]} /><meshStandardMaterial color="#15314f" metalness={0.5} roughness={0.4} /></mesh>
      <mesh position={[0, 0.3, 2.4]} castShadow><sphereGeometry args={[1.3, 16, 16]} /><meshStandardMaterial color="#9fd0ff" metalness={0.1} roughness={0.1} transparent opacity={0.6} /></mesh>
      {/* 尾梁 */}
      <mesh position={[0, 0.5, -4]} rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[0.4, 0.2, 5, 10]} /><meshStandardMaterial color="#15314f" metalness={0.5} roughness={0.4} /></mesh>
      {/* 主旋翼 */}
      <mesh ref={rotorRef} position={[0, 1.8, 0]}>
        <cylinderGeometry args={[7, 7, 0.05, 24]} />
        <meshStandardMaterial color="#222" transparent opacity={0.25} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 1.7, 0]}><cylinderGeometry args={[0.2, 0.2, 0.6, 8]} /><meshStandardMaterial color="#111" /></mesh>
      {/* 尾旋翼 */}
      <group ref={tailRotorRef} position={[0.4, 0.5, -6.2]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[1.3, 1.3, 0.04, 16]} />
          <meshStandardMaterial color="#222" transparent opacity={0.3} side={THREE.DoubleSide} />
        </mesh>
      </group>
      {/* 起落橇 */}
      <mesh position={[0, -1.6, 0]}><boxGeometry args={[2.4, 0.1, 4]} /><meshStandardMaterial color="#333" /></mesh>
      {/* 机腹防撞频闪灯 */}
      <mesh position={[0, -1, 0]}>
        <sphereGeometry args={[0.22, 8, 8]} />
        <meshStandardMaterial ref={beaconRef} color="#2a0000" emissive="#ff2020" emissiveIntensity={3} />
      </mesh>
      {/* 舷灯:左红右绿 */}
      <mesh position={[-1.5, 0, 0.5]}><sphereGeometry args={[0.16, 8, 8]} /><meshStandardMaterial color="#200" emissive="#ff2a1a" emissiveIntensity={3} /></mesh>
      <mesh position={[1.5, 0, 0.5]}><sphereGeometry args={[0.16, 8, 8]} /><meshStandardMaterial color="#020" emissive="#1aff4a" emissiveIntensity={3} /></mesh>
    </group>
  )
}
