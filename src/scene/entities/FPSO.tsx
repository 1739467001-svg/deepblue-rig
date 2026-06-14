import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getHeightAt } from '../ocean/waves'
import { useSceneStore } from '../../state/store'
import { nightFactor } from '../sky/daylight'

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
    <>
    <MooringLines base={base} />
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
      {/* 夜间甲板工作灯 / 航行灯 / 上层建筑窗光 */}
      <FpsoNightLights len={LEN} beam={BEAM} />
    </group>
    </>
  )
}

/**
 * 系泊锚链:从船体导缆孔以悬链线垂入海床锚点(世界坐标,不随船起伏),
 * 向四周发散,呈现 FPSO 的转塔/扩展式系泊外观。
 */
function MooringLines({ base }: { base: THREE.Vector3 }) {
  const geos = useMemo(() => {
    const seabedY = -45 - base.y // 相对 base 的海床
    const fairleads: [number, number, number][] = [
      [0, 6, -55], [-11, 2, -40], [11, 2, -40],
      [-11, 2, 40], [11, 2, 40], [0, 6, 55],
    ]
    return fairleads.map((f) => {
      const fl = new THREE.Vector3(f[0], f[1], f[2])
      const out = new THREE.Vector3(f[0], 0, f[2]).normalize().multiplyScalar(130)
      const anchor = new THREE.Vector3(out.x, seabedY, out.z)
      const mid = fl.clone().lerp(anchor, 0.5).add(new THREE.Vector3(0, -16, 0)) // 悬链下垂
      const curve = new THREE.CatmullRomCurve3([fl, mid, anchor])
      return new THREE.TubeGeometry(curve, 28, 0.18, 6, false)
    })
  }, [base])
  return (
    <group position={base}>
      {geos.map((g, i) => (
        <mesh key={i} geometry={g} castShadow>
          <meshStandardMaterial color="#23262a" metalness={0.6} roughness={0.75} />
        </mesh>
      ))}
    </group>
  )
}

/**
 * FPSO 夜景灯光:甲板暖色工作灯 + 标准航行灯(左红右绿、桅顶/艉白)+ 上层建筑窗光。
 * 全部随日落点亮,加 1 盏甲板暖光点光源做照明光池。
 */
function FpsoNightLights({ len, beam }: { len: number; beam: number }) {
  const warmRefs = useRef<THREE.MeshStandardMaterial[]>([])
  const navRefs = useRef<THREE.MeshStandardMaterial[]>([])
  const deckLight = useRef<THREE.PointLight>(null!)

  // 暖色:甲板灯柱 + 上层建筑窗带
  const warm = useMemo(() => {
    const arr: { p: [number, number, number]; win?: boolean }[] = []
    // 甲板灯柱(储罐两侧)
    for (const z of [-32, -10, 12, 30]) for (const sx of [-1, 1]) arr.push({ p: [sx * (beam / 2 - 2), 8, z] })
    // 上层建筑前脸窗带(三层)+ 侧面
    const ssZ = len / 2 - 12
    for (const y of [3, 7, 10]) {
      arr.push({ p: [0, 6 + (y - 6), ssZ - 8.02], win: true })
      arr.push({ p: [9.02, 6 + (y - 6), ssZ], win: true })
      arr.push({ p: [-9.02, 6 + (y - 6), ssZ], win: true })
    }
    return arr
  }, [len, beam])

  // 航行灯:左舷红、右舷绿、桅顶白、艉白
  const nav = useMemo(
    () => [
      { p: [-beam / 2 - 0.3, 9, -len / 2 + 20] as [number, number, number], c: '#ff2a1a' },
      { p: [beam / 2 + 0.3, 9, -len / 2 + 20] as [number, number, number], c: '#1aff4a' },
      { p: [0, 24, len / 2 - 10] as [number, number, number], c: '#ffffff' },
      { p: [0, 8, len / 2 + 0.3] as [number, number, number], c: '#ffffff' },
    ],
    [len, beam],
  )

  useFrame(() => {
    const env = useSceneStore.getState().environment
    const n = nightFactor(env.timeOfDay)
    warmRefs.current.forEach((m) => { if (m) m.emissiveIntensity = n * 2.4 })
    navRefs.current.forEach((m) => { if (m) m.emissiveIntensity = n * 4 })
    if (deckLight.current) deckLight.current.intensity = n * 16
  })

  return (
    <group>
      {warm.map((w, i) => (
        <mesh key={i} position={w.p}>
          {w.win ? <boxGeometry args={[10, 0.8, 0.1]} /> : <sphereGeometry args={[0.35, 10, 10]} />}
          <meshStandardMaterial
            ref={(m) => { if (m) warmRefs.current[i] = m }}
            color="#15110a"
            emissive="#ffd596"
            emissiveIntensity={0}
          />
        </mesh>
      ))}
      {nav.map((nv, i) => (
        <mesh key={i} position={nv.p}>
          <sphereGeometry args={[0.3, 8, 8]} />
          <meshStandardMaterial
            ref={(m) => { if (m) navRefs.current[i] = m }}
            color="#050505"
            emissive={nv.c}
            emissiveIntensity={0}
          />
        </mesh>
      ))}
      <pointLight ref={deckLight} position={[0, 16, len / 2 - 16]} color="#ffdba0" distance={90} decay={1.8} intensity={0} />
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
