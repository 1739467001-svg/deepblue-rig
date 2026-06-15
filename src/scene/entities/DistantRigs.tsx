import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { nightFactor } from '../sky/daylight'
import { useSceneStore } from '../../state/store'

/**
 * 远景平台:地平线方向若干低模导管架平台,体现"油田"规模而非孤岛。
 * 火炬尖与航空障碍灯夜间发光,经 Bloom 化作远处灯塔般的光点;
 * 全静态,低面数,被大气透视雾自然融入天际。
 */
interface RigDef {
  pos: [number, number, number]
  rot: number
  scale: number
}

// 置于海面网格(随相机 ~900 半径)内,落在水面上、贴近地平线
const RIGS: RigDef[] = [
  { pos: [520, 0, -580], rot: 0.5, scale: 1.7 },
  { pos: [-660, 0, -320], rot: -0.7, scale: 1.4 },
  { pos: [450, 0, 620], rot: 2.2, scale: 1.5 },
  { pos: [-540, 0, 560], rot: 1.2, scale: 1.1 },
]

export function DistantRigs() {
  return (
    <>
      {RIGS.map((r, i) => (
        <DistantRig key={i} def={r} seed={i * 2.3} />
      ))}
    </>
  )
}

const STEEL = { color: '#7d6f49', metalness: 0.6, roughness: 0.7 }
const DECK = { color: '#566069', metalness: 0.5, roughness: 0.75 }

function DistantRig({ def, seed }: { def: RigDef; seed: number }) {
  const flareMat = useRef<THREE.MeshStandardMaterial>(null!)
  const redMat = useRef<THREE.MeshStandardMaterial>(null!)
  const winMat = useRef<THREE.MeshStandardMaterial>(null!)

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const n = nightFactor(useSceneStore.getState().environment.timeOfDay)
    if (flareMat.current) {
      const flick = 0.78 + Math.sin(t * 6 + seed) * 0.22
      flareMat.current.emissiveIntensity = (1.3 + n * 4) * flick
    }
    if (redMat.current) {
      const blink = Math.pow(Math.max(0, Math.sin(t * 1.6 + seed)), 8)
      redMat.current.emissiveIntensity = n * blink * 6
    }
    if (winMat.current) winMat.current.emissiveIntensity = n * 1.6
  })

  const legs: [number, number][] = [[-8, -8], [8, -8], [8, 8], [-8, 8]]
  return (
    <group position={def.pos} rotation={[0, def.rot, 0]} scale={def.scale}>
      {/* 导管架腿(向下外扩入水) */}
      {legs.map(([x, z], i) => {
        const top = new THREE.Vector3(x, 20, z)
        const bot = new THREE.Vector3(x * 1.5, -34, z * 1.5)
        const dir = bot.clone().sub(top)
        const len = dir.length()
        const mid = top.clone().add(bot).multiplyScalar(0.5)
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize())
        return (
          <mesh key={i} position={mid} quaternion={q}>
            <cylinderGeometry args={[1, 1.4, len, 6]} />
            <meshStandardMaterial {...STEEL} />
          </mesh>
        )
      })}
      {/* 甲板模块 */}
      <mesh position={[0, 21, 0]} castShadow>
        <boxGeometry args={[28, 6, 28]} />
        <meshStandardMaterial {...DECK} />
      </mesh>
      {/* 生活楼 + 窗光 */}
      <mesh position={[-9, 28, -8]} castShadow>
        <boxGeometry args={[10, 8, 9]} />
        <meshStandardMaterial color="#c4c8cc" metalness={0.3} roughness={0.55} />
      </mesh>
      <mesh position={[-9, 28, -3.45]}>
        <boxGeometry args={[9, 5, 0.1]} />
        <meshStandardMaterial ref={winMat} color="#10171f" emissive="#ffd28a" emissiveIntensity={0} />
      </mesh>
      {/* 井架塔 */}
      <mesh position={[6, 38, 6]}>
        <cylinderGeometry args={[1.2, 4, 30, 6]} />
        <meshStandardMaterial {...STEEL} />
      </mesh>
      {/* 航空障碍灯(井架顶) */}
      <mesh position={[6, 54, 6]}>
        <sphereGeometry args={[0.8, 8, 8]} />
        <meshStandardMaterial ref={redMat} color="#3a0000" emissive="#ff1a1a" emissiveIntensity={0} />
      </mesh>
      {/* 火炬臂 + 火焰 */}
      <mesh position={[20, 30, -10]} rotation={[0, 0, 0.5]}>
        <cylinderGeometry args={[0.6, 0.9, 36, 6]} />
        <meshStandardMaterial color="#6a5f3a" metalness={0.6} roughness={0.7} />
      </mesh>
      <mesh position={[28, 44, -10]}>
        <coneGeometry args={[2.6, 8, 12]} />
        <meshStandardMaterial ref={flareMat} color="#ff6a1e" emissive="#ff8a2a" emissiveIntensity={1.3} toneMapped={false} />
      </mesh>
    </group>
  )
}
