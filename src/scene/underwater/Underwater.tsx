import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { getHeightAt } from '../ocean/waves'

/**
 * 水下视角(PRD P3 海底彩蛋):
 * 相机俯冲穿过水面时,UnderwaterController 按入水深度平滑切换到"水下态"——
 * 蓝绿散射雾(越深越暗越绿)+ 太阳光柱 + 悬浮颗粒 + 海床 + 立管/海底管线 + 水下天花板。
 * 全部以 underwater.factor(0 水面上 / 1 完全水下)统一驱动,无外部 HDRI、无自定义着色器。
 */
export const underwater = { factor: 0 }

const TEAL = new THREE.Color('#0e6b78')
const DEEP = new THREE.Color('#052a34')
const SEABED_Y = -45
const _tmp = new THREE.Vector3()

export function Underwater() {
  return (
    <>
      <UnderwaterController />
      <WaterCeiling />
      <GodRays />
      <MarineSnow />
      <Seabed />
      <SubseaPipes />
    </>
  )
}

/** 入水检测 + 水下雾/背景接管(置于 SkyEnvironment 之后,每帧最后覆盖以胜出) */
function UnderwaterController() {
  const { scene, camera } = useThree()
  const fog = useMemo(() => new THREE.FogExp2(0x0e6b78, 0.03), [])
  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    const surf = getHeightAt(camera.position.x, camera.position.z, t)
    const depth = surf - camera.position.y // >0 表示在水面下
    const target = THREE.MathUtils.clamp(depth / 2, 0, 1)
    underwater.factor = THREE.MathUtils.damp(underwater.factor, target, 6, dt)
    const f = underwater.factor
    if (depth > -1 && f > 0.01) {
      const depthN = THREE.MathUtils.clamp(-camera.position.y / 45, 0, 1)
      const col = TEAL.clone().lerp(DEEP, depthN)
      fog.color.copy(col)
      fog.density = THREE.MathUtils.lerp(0.006, 0.055, f)
      scene.fog = fog
      scene.background = col
    }
  })
  return null
}

/** 水下天花板:水面下方一层半透蓝幕,从下方看即"海面背面" */
function WaterCeiling() {
  const ref = useRef<THREE.Mesh>(null!)
  const mat = useRef<THREE.MeshBasicMaterial>(null!)
  useFrame((state) => {
    const c = state.camera.position
    ref.current.position.set(c.x, -0.4, c.z)
    const f = underwater.factor
    ref.current.visible = f > 0.02
    if (mat.current) mat.current.opacity = 0.55 * f
  })
  return (
    <mesh ref={ref} rotation-x={Math.PI / 2} renderOrder={2}>
      <planeGeometry args={[2400, 2400]} />
      <meshBasicMaterial ref={mat} color="#1b7e8c" transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} fog />
    </mesh>
  )
}

/** 太阳光柱:数根竖直渐变光幕,加性混合,绕 Y 朝向相机 */
function GodRays() {
  const group = useRef<THREE.Group>(null!)
  const mats = useRef<THREE.MeshBasicMaterial[]>([])
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 64
    c.height = 128
    const ctx = c.getContext('2d')!
    const img = ctx.createImageData(c.width, c.height)
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        const v = 1 - y / c.height // 顶部(近水面)最亮
        const u = x / c.width
        const along = Math.pow(v, 1.5)
        const across = Math.pow(Math.sin(u * Math.PI), 2.0)
        const i = (y * c.width + x) * 4
        img.data[i] = 210; img.data[i + 1] = 235; img.data[i + 2] = 255
        img.data[i + 3] = Math.floor(along * across * 255)
      }
    }
    ctx.putImageData(img, 0, 0)
    return new THREE.CanvasTexture(c)
  }, [])

  const shafts = useMemo(
    () => [
      { x: -8, z: -6, w: 10, tilt: 0.12 },
      { x: 6, z: -10, w: 14, tilt: -0.08 },
      { x: 12, z: 4, w: 8, tilt: 0.1 },
      { x: -14, z: 8, w: 12, tilt: -0.14 },
      { x: 0, z: 14, w: 9, tilt: 0.06 },
    ],
    [],
  )

  useFrame((state) => {
    const c = state.camera.position
    group.current.position.set(c.x, 0, c.z)
    const f = underwater.factor
    group.current.visible = f > 0.02
    if (f <= 0.02) return
    const flick = 0.8 + Math.sin(state.clock.elapsedTime * 0.6) * 0.2
    mats.current.forEach((m) => { if (m) m.opacity = 0.16 * f * flick })
    // 每片光幕绕自身朝向相机水平方位,使其始终可见
    group.current.children.forEach((ch) => {
      ch.lookAt(c.x, ch.getWorldPosition(_tmp).y, c.z)
    })
  })

  return (
    <group ref={group}>
      {shafts.map((s, i) => (
        <mesh key={i} position={[s.x, -18, s.z]} rotation={[0, 0, s.tilt]}>
          <planeGeometry args={[s.w, 40]} />
          <meshBasicMaterial
            ref={(m) => { if (m) mats.current[i] = m }}
            map={tex}
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
            fog={false}
          />
        </mesh>
      ))}
    </group>
  )
}

/** 悬浮颗粒(marine snow):始终环绕相机,缓慢下沉并循环 */
function MarineSnow() {
  const ref = useRef<THREE.Points>(null!)
  const mat = useRef<THREE.PointsMaterial>(null!)
  const N = 1400
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const pos = new Float32Array(N * 3)
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 90
      pos[i * 3 + 1] = (Math.random() - 0.5) * 70
      pos[i * 3 + 2] = (Math.random() - 0.5) * 90
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    return g
  }, [])

  useFrame((state, dt) => {
    const c = state.camera.position
    ref.current.position.set(c.x, c.y, c.z)
    const f = underwater.factor
    ref.current.visible = f > 0.02
    if (mat.current) mat.current.opacity = 0.5 * f
    if (f <= 0.02) return
    const arr = geo.attributes.position.array as Float32Array
    const d = Math.min(dt, 0.05)
    for (let i = 0; i < N; i++) {
      arr[i * 3 + 1] -= d * 1.6
      arr[i * 3] += Math.sin(state.clock.elapsedTime * 0.4 + i) * d * 0.3
      if (arr[i * 3 + 1] < -35) arr[i * 3 + 1] = 35
    }
    geo.attributes.position.needsUpdate = true
  })

  return (
    <points ref={ref} geometry={geo} frustumCulled={false}>
      <pointsMaterial ref={mat} color="#cfe2e2" size={0.18} sizeAttenuation transparent opacity={0} depthWrite={false} />
    </points>
  )
}

/** 海床:跟随相机的大平面 + 若干礁石(世界固定,作移动参照) */
function Seabed() {
  const plane = useRef<THREE.Mesh>(null!)
  const rocks = useRef<THREE.Group>(null!)
  useFrame((state) => {
    const c = state.camera.position
    plane.current.position.x = c.x
    plane.current.position.z = c.z
    const vis = underwater.factor > 0.02
    plane.current.visible = vis
    rocks.current.visible = vis
  })
  const rockDefs = useMemo(
    () =>
      Array.from({ length: 10 }, () => ({
        p: [(Math.random() - 0.5) * 300, SEABED_Y + 1, (Math.random() - 0.5) * 300] as [number, number, number],
        s: 1.5 + Math.random() * 4,
        r: Math.random() * Math.PI,
      })),
    [],
  )
  return (
    <>
      <mesh ref={plane} rotation-x={-Math.PI / 2} position={[0, SEABED_Y, 0]} receiveShadow>
        <planeGeometry args={[3000, 3000]} />
        <meshStandardMaterial color="#26424a" roughness={1} metalness={0} />
      </mesh>
      <group ref={rocks}>
        {rockDefs.map((r, i) => (
          <mesh key={i} position={r.p} rotation={[r.r, r.r * 1.3, 0]} scale={r.s} castShadow>
            <dodecahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color="#1f3035" roughness={1} metalness={0} flatShading />
          </mesh>
        ))}
      </group>
    </>
  )
}

/** 生产立管 + 海底管线:从平台基座垂入海床并沿海床通向 FPSO 方向 */
function SubseaPipes() {
  const group = useRef<THREE.Group>(null!)
  useFrame(() => { group.current.visible = underwater.factor > 0.02 })
  return (
    <group ref={group}>
      {/* 平台基座立管(由水面下垂至海床) */}
      {([[-6, -6], [6, -6], [0, 6]] as [number, number][]).map(([x, z], i) => (
        <mesh key={i} position={[x, (SEABED_Y - 2) / 2, z]}>
          <cylinderGeometry args={[0.7, 0.7, -SEABED_Y - 2 + 4, 12]} />
          <meshStandardMaterial color="#3a3f44" metalness={0.6} roughness={0.6} />
        </mesh>
      ))}
      {/* 海底输油管线:平台 → FPSO 方向 */}
      <Pipe from={new THREE.Vector3(0, SEABED_Y + 1, 0)} to={new THREE.Vector3(-150, SEABED_Y + 1, 90)} radius={1.1} />
      {/* 通向远处的支线 */}
      <Pipe from={new THREE.Vector3(0, SEABED_Y + 1, 0)} to={new THREE.Vector3(260, SEABED_Y + 1, -120)} radius={0.9} />
    </group>
  )
}

function Pipe({ from, to, radius }: { from: THREE.Vector3; to: THREE.Vector3; radius: number }) {
  const { position, quaternion, length } = useMemo(() => {
    const dir = new THREE.Vector3().subVectors(to, from)
    const length = dir.length()
    const position = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5)
    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize())
    return { position, quaternion, length }
  }, [from, to])
  return (
    <mesh position={position} quaternion={quaternion}>
      <cylinderGeometry args={[radius, radius, length, 12]} />
      <meshStandardMaterial color="#33383d" metalness={0.6} roughness={0.65} />
    </mesh>
  )
}
