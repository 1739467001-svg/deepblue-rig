import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getHeightAt } from '../ocean/waves'
import { useSceneStore } from '../../state/store'
import { nightFactor } from '../sky/daylight'

/** 程序化软边泡沫贴图(尾迹用):沿长度由实到虚,横向中间实两侧虚 */
function makeWakeTexture(): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 64
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(c.width, c.height)
  // 平面绕 x 旋转 -90° 后:局部 x(u)→船宽方向,局部 y(v)→沿航迹长度。
  // v=0 端贴近船尾(最实),v=1 端为远端(淡出)——配合平面摆位让尾迹拖向船后。
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      const u = x / c.width
      const v = y / c.height
      const along = Math.pow(1 - v, 1.4) // 近船实、远端淡
      const across = Math.pow(Math.sin(u * Math.PI), 1.2) // 中间实、两舷淡
      const a = along * across
      const i = (y * c.width + x) * 4
      img.data[i] = 255
      img.data[i + 1] = 255
      img.data[i + 2] = 255
      img.data[i + 3] = Math.floor(Math.min(1, a) * 255)
    }
  }
  ctx.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(c)
  tex.needsUpdate = true
  return tex
}

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

  const wakeTex = useMemo(() => makeWakeTexture(), [])
  const wakeMat = useRef<THREE.MeshBasicMaterial>(null!)
  const wakeMesh = useRef<THREE.Mesh>(null!)
  const bowFoam = useRef<THREE.Sprite>(null!)
  const navRefs = useRef<THREE.MeshStandardMaterial[]>([])
  const speed = useRef(1)

  useFrame((state, delta) => {
    const time = state.clock.elapsedTime
    const dev = useSceneStore.getState().devices['tanker-1']
    const offline = dev?.status === 'offline'

    if (!offline) {
      // 靠泊段(t≈0.43)减速
      const t = tRef.current
      const nearBerth = Math.abs(((t % 1) - 0.43))
      const speedScale = nearBerth < 0.05 ? 0.15 : 1
      tRef.current = (t + (delta / 90) * speedScale) % 1
      speed.current = THREE.MathUtils.lerp(speed.current, speedScale, 0.04)

      const p = curve.getPointAt(tRef.current)
      const tangent = curve.getTangentAt(tRef.current)
      const g = groupRef.current

      const hF = getHeightAt(p.x + tangent.x * LEN / 2, p.z + tangent.z * LEN / 2, time)
      const hB = getHeightAt(p.x - tangent.x * LEN / 2, p.z - tangent.z * LEN / 2, time)
      g.position.set(p.x, (hF + hB) / 2 + 1.6, p.z)
      g.rotation.y = Math.atan2(tangent.x, tangent.z)
      g.rotation.x = Math.atan2(hF - hB, LEN) * 0.4
    } else {
      speed.current = THREE.MathUtils.lerp(speed.current, 0, 0.05)
    }

    // 尾迹:不透明度与长度随航速;贴图缓慢滚动模拟翻涌
    const sp = speed.current
    if (wakeMat.current) {
      wakeMat.current.opacity = 0.5 * THREE.MathUtils.smoothstep(sp, 0.05, 1)
    }
    if (wakeMesh.current) {
      wakeMesh.current.scale.set(1, 0.45 + sp * 0.55, 1)
      wakeMesh.current.visible = sp > 0.04
    }
    if (bowFoam.current) {
      const s = (6 + Math.sin(time * 4) * 1.2) * (0.4 + sp)
      bowFoam.current.scale.set(s, s * 0.6, 1)
      ;(bowFoam.current.material as THREE.SpriteMaterial).opacity = 0.5 * sp
    }
    // 航行灯随日落点亮
    const n = nightFactor(useSceneStore.getState().environment.timeOfDay)
    navRefs.current.forEach((m) => { if (m) m.emissiveIntensity = n * 4 })
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

      {/* 尾迹泡沫带(拖向船后 -z),贴近水线 */}
      <mesh ref={wakeMesh} position={[0, -1.3, -110]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={5}>
        <planeGeometry args={[16, 130]} />
        <meshBasicMaterial
          ref={wakeMat}
          map={wakeTex}
          transparent
          opacity={0.5}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* 艏波泡沫(billboard) */}
      <sprite ref={bowFoam} position={[0, -0.8, LEN / 2 + 2]} scale={[6, 4, 1]}>
        <spriteMaterial color="#eaf4f8" transparent opacity={0.4} depthWrite={false} />
      </sprite>

      {/* 航行灯:左舷红 / 右舷绿 / 桅顶白 */}
      {([
        { p: [-8, 4, LEN / 2 - 14] as [number, number, number], c: '#ff2a1a' },
        { p: [8, 4, LEN / 2 - 14] as [number, number, number], c: '#1aff4a' },
        { p: [0, 16, LEN / 2 - 8] as [number, number, number], c: '#ffffff' },
        { p: [0, 6, -LEN / 2 + 2] as [number, number, number], c: '#ffffff' },
      ]).map((nv, i) => (
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
    </group>
  )
}
