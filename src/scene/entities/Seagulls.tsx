import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * 海鸥群:程序化简易海鸥,沿各自椭圆航线低速盘旋,翅膀正弦扇动,
 * 机头朝向飞行切线。纯几何 + 动画,无贴图无光照负担,为海面增添生气。
 */
interface Gull {
  cx: number
  cz: number
  rx: number
  rz: number
  height: number
  speed: number
  phase: number
  flap: number
  scale: number
}

export function Seagulls({ count = 9 }: { count?: number }) {
  const birds = useMemo<Gull[]>(() => {
    const arr: Gull[] = []
    for (let i = 0; i < count; i++) {
      arr.push({
        cx: (Math.random() - 0.5) * 240,
        cz: (Math.random() - 0.5) * 240,
        rx: 40 + Math.random() * 120,
        rz: 40 + Math.random() * 120,
        height: 30 + Math.random() * 70,
        speed: 0.06 + Math.random() * 0.06,
        phase: Math.random() * Math.PI * 2,
        flap: 6 + Math.random() * 5,
        scale: 0.8 + Math.random() * 0.7,
      })
    }
    return arr
  }, [count])

  return (
    <>
      {birds.map((b, i) => (
        <Bird key={i} g={b} />
      ))}
    </>
  )
}

const WING = { color: '#eef2f5', metalness: 0.0, roughness: 0.9 }
const TIP = { color: '#3a4250', metalness: 0.0, roughness: 0.9 }

function Bird({ g }: { g: Gull }) {
  const ref = useRef<THREE.Group>(null!)
  const lWing = useRef<THREE.Group>(null!)
  const rWing = useRef<THREE.Group>(null!)
  const prev = useRef(new THREE.Vector3())

  useFrame((state) => {
    const t = state.clock.elapsedTime * g.speed + g.phase
    const x = g.cx + Math.cos(t) * g.rx
    const z = g.cz + Math.sin(t) * g.rz
    const y = g.height + Math.sin(t * 1.7) * 5
    const grp = ref.current
    // 朝向飞行方向
    const cur = new THREE.Vector3(x, y, z)
    const dir = cur.clone().sub(prev.current)
    prev.current.copy(cur)
    grp.position.set(x, y, z)
    if (dir.lengthSq() > 1e-4) grp.rotation.y = Math.atan2(dir.x, dir.z)

    // 翅膀扇动(滑翔时偶尔展平)
    const glide = Math.sin(t * 0.5) > 0.6 ? 0.15 : 1
    const a = Math.sin(state.clock.elapsedTime * g.flap + g.phase) * 0.7 * glide
    lWing.current.rotation.z = a
    rWing.current.rotation.z = -a
  })

  return (
    <group ref={ref} scale={g.scale}>
      {/* 身体 */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <capsuleGeometry args={[0.18, 1.1, 4, 8]} />
        <meshStandardMaterial {...WING} />
      </mesh>
      {/* 左翼(从根部张开,翼尖深色) */}
      <group ref={lWing}>
        <mesh position={[-1.1, 0, 0]}>
          <boxGeometry args={[2.2, 0.06, 0.7]} />
          <meshStandardMaterial {...WING} />
        </mesh>
        <mesh position={[-2.1, 0, -0.1]}>
          <boxGeometry args={[0.5, 0.05, 0.4]} />
          <meshStandardMaterial {...TIP} />
        </mesh>
      </group>
      {/* 右翼 */}
      <group ref={rWing}>
        <mesh position={[1.1, 0, 0]}>
          <boxGeometry args={[2.2, 0.06, 0.7]} />
          <meshStandardMaterial {...WING} />
        </mesh>
        <mesh position={[2.1, 0, -0.1]}>
          <boxGeometry args={[0.5, 0.05, 0.4]} />
          <meshStandardMaterial {...TIP} />
        </mesh>
      </group>
    </group>
  )
}
