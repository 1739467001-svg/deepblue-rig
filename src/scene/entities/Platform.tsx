import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useSceneStore } from '../../state/store'
import { nightFactor } from '../sky/daylight'
import { Flare } from '../effects/Flare'

/**
 * 程序化导管架式钻井平台:
 * 导管架(桁架腿 + 斜撑)+ 甲板模块 + 井架 + 生活楼 + 直升机坪 + 吊机。
 * 甲板面约在 y=24,导管架从海面下延伸至 deck。
 */

const STEEL = { color: '#d8b24a', metalness: 0.85, roughness: 0.55 }
const STEEL_DARK = { color: '#8a7a3a', metalness: 0.8, roughness: 0.6 }
const PAINT_RED = { color: '#b5402f', metalness: 0.4, roughness: 0.6 }
const PAINT_WHITE = { color: '#c9ccd0', metalness: 0.3, roughness: 0.55 }
const DECK_GREY = { color: '#5a6066', metalness: 0.6, roughness: 0.7 }

const DECK_Y = 24
const LEG_SPAN = 16

export function Platform() {
  return (
    <group name="platform-A">
      <Jacket />
      <Deck />
      <Derrick />
      <LivingQuarters />
      <Helipad />
      <Crane />
      <Flare position={[44, 0, -18]} deckY={DECK_Y} />
      <ObstacleLights />
      <DeckLights />
      <HelideckLights />
      <Lifeboats />
      <DeckAccess />
      <DeckProcess />
      <WindSock />
      <Waterline />
    </group>
  )
}

/** 甲板工艺细节:管廊 + 立式分离器 + 阀门手轮 + 电缆桥架 */
function DeckProcess() {
  const pipeY = [3, 3.7, 4.4, 5.1]
  const pipeColor = ['#9aa0a6', '#b5763a', '#6f7d8c', '#caa83c']
  const supX = [-14, 0, 14]
  return (
    <group position={[0, DECK_Y + 1, 13]}>
      {/* 管廊支架(门形) */}
      {supX.map((x, i) => (
        <group key={i} position={[x, 0, 0]}>
          <mesh position={[-2, 2.5, 0]}><boxGeometry args={[0.5, 5, 0.5]} /><meshStandardMaterial {...STEEL_DARK} /></mesh>
          <mesh position={[2, 2.5, 0]}><boxGeometry args={[0.5, 5, 0.5]} /><meshStandardMaterial {...STEEL_DARK} /></mesh>
          <mesh position={[0, 5.2, 0]}><boxGeometry args={[5, 0.4, 0.5]} /><meshStandardMaterial {...STEEL_DARK} /></mesh>
        </group>
      ))}
      {/* 平行工艺管线(沿 x) */}
      {pipeY.map((y, i) => (
        <mesh key={i} position={[0, y, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.3 - i * 0.03, 0.3 - i * 0.03, 32, 12]} />
          <meshStandardMaterial color={pipeColor[i]} metalness={0.6} roughness={0.5} />
        </mesh>
      ))}
      {/* 立式分离器(带半球封头) */}
      <mesh position={[10, 4, -3]} castShadow>
        <cylinderGeometry args={[1.8, 1.8, 8, 20]} />
        <meshStandardMaterial color="#8a9095" metalness={0.7} roughness={0.45} />
      </mesh>
      <mesh position={[10, 8, -3]}>
        <sphereGeometry args={[1.8, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#8a9095" metalness={0.7} roughness={0.45} />
      </mesh>
      {/* 阀门手轮 */}
      {([[-8, 3, 1.2], [4, 3.7, 1.2]] as [number, number, number][]).map((p, i) => (
        <mesh key={i} position={p} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.5, 0.06, 6, 16]} />
          <meshStandardMaterial color="#c0392b" metalness={0.4} roughness={0.5} />
        </mesh>
      ))}
      {/* 电缆桥架 */}
      <mesh position={[0, 2.2, 2.5]} rotation={[0, 0, Math.PI / 2]}>
        <boxGeometry args={[0.4, 30, 0.8]} />
        <meshStandardMaterial color="#555c66" metalness={0.5} roughness={0.6} />
      </mesh>
    </group>
  )
}

/** 风向袋:指向下风向,风大伸平、风小下垂,带轻微飘动 —— 实时读环境风场 */
function WindSock() {
  const yaw = useRef<THREE.Group>(null!)
  const sock = useRef<THREE.Group>(null!)
  useFrame((state) => {
    const env = useSceneStore.getState().environment
    // 局部 +x 经 Ry(-windDir) 映射到世界 (cos,sin) 下风向
    yaw.current.rotation.y = -env.windDirection
    const w = THREE.MathUtils.clamp(env.windSpeed / 14, 0, 1)
    const t = state.clock.elapsedTime
    sock.current.rotation.z = -1.15 * (1 - w) + Math.sin(t * 3) * 0.06
    sock.current.rotation.y = Math.sin(t * 1.7) * 0.1 * w
  })
  const segs = ['#ff7a18', '#f2f2f2', '#ff7a18', '#f2f2f2', '#ff7a18']
  return (
    <group position={[12, DECK_Y + 2, 32]}>
      {/* 立杆 */}
      <mesh position={[0, 3, 0]}><cylinderGeometry args={[0.12, 0.12, 6, 8]} /><meshStandardMaterial color="#cccccc" metalness={0.5} roughness={0.5} /></mesh>
      <group ref={yaw} position={[0, 6, 0]}>
        <group ref={sock}>
          {segs.map((c, i) => {
            const r0 = 0.6 - i * 0.09
            const r1 = 0.6 - (i + 1) * 0.09
            return (
              <mesh key={i} position={[0.6 * i + 0.3, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[r1, r0, 0.6, 12, 1, true]} />
                <meshStandardMaterial color={c} side={THREE.DoubleSide} metalness={0} roughness={0.9} />
              </mesh>
            )
          })}
        </group>
      </group>
    </group>
  )
}

/** 全封闭橙色救生艇 + 达维特吊架(挂在甲板东侧边缘) */
function Lifeboats() {
  const boats: [number, number][] = [[21, 7], [21, -7]]
  return (
    <group position={[0, DECK_Y, 0]}>
      {boats.map(([x, z], i) => (
        <group key={i} position={[x, 1, z]}>
          {/* 达维特吊架 */}
          <Beam from={new THREE.Vector3(-1, 0, -1.6)} to={new THREE.Vector3(3, 5, -1.6)} radius={0.18} mat={STEEL} />
          <Beam from={new THREE.Vector3(-1, 0, 1.6)} to={new THREE.Vector3(3, 5, 1.6)} radius={0.18} mat={STEEL} />
          <Beam from={new THREE.Vector3(3, 5, -1.6)} to={new THREE.Vector3(3, 5, 1.6)} radius={0.15} mat={STEEL} />
          {/* 吊索 */}
          <mesh position={[3, 3, -1.5]}><cylinderGeometry args={[0.04, 0.04, 4, 6]} /><meshStandardMaterial color="#1a1a1a" /></mesh>
          <mesh position={[3, 3, 1.5]}><cylinderGeometry args={[0.04, 0.04, 4, 6]} /><meshStandardMaterial color="#1a1a1a" /></mesh>
          {/* 救生艇本体 */}
          <group position={[3, 1, 0]}>
            <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
              <capsuleGeometry args={[1.1, 3.8, 6, 12]} />
              <meshStandardMaterial color="#ff7a18" metalness={0.2} roughness={0.5} />
            </mesh>
            <mesh position={[0, 0.7, 0]} castShadow>
              <boxGeometry args={[1.4, 0.7, 3]} />
              <meshStandardMaterial color="#ff8c33" metalness={0.2} roughness={0.5} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  )
}

/** 甲板通道:外侧上行楼梯 + 井架带护笼直爬梯 */
function DeckAccess() {
  return (
    <group>
      {/* 主甲板通往生活楼顶的斜梯 */}
      <Stair
        from={new THREE.Vector3(-21, DECK_Y + 0.5, -2)}
        to={new THREE.Vector3(-21, DECK_Y + 13, -10)}
      />
      {/* 井架腿上的护笼爬梯 */}
      <CagedLadder position={[6 - 5, DECK_Y + 1, 8 - 5]} height={20} />
    </group>
  )
}

/** 一段带护栏与斜梁的钢直梯(沿局部 +Z 构建,旋转对齐 from→to 方向) */
function Stair({ from, to, width = 2 }: { from: THREE.Vector3; to: THREE.Vector3; width?: number }) {
  const dir = to.clone().sub(from)
  const horiz = new THREE.Vector3(dir.x, 0, dir.z)
  const runLen = horiz.length()
  const rise = dir.y
  const yaw = Math.atan2(horiz.x, horiz.z)
  const half = width / 2
  const n = 11
  const steps: JSX.Element[] = []
  for (let i = 0; i < n; i++) {
    const f = (i + 0.5) / n
    steps.push(
      <mesh key={i} position={[0, rise * f, runLen * f]} castShadow receiveShadow>
        <boxGeometry args={[width, 0.12, 0.7]} />
        <meshStandardMaterial {...DECK_GREY} />
      </mesh>,
    )
  }
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
  return (
    <group position={from} rotation={[0, yaw, 0]}>
      {steps}
      {/* 斜梁 */}
      <Beam from={v(half, 0, 0)} to={v(half, rise, runLen)} radius={0.1} mat={STEEL_DARK} />
      <Beam from={v(-half, 0, 0)} to={v(-half, rise, runLen)} radius={0.1} mat={STEEL_DARK} />
      {/* 扶手 */}
      <Beam from={v(half, 1, 0)} to={v(half, rise + 1, runLen)} radius={0.05} mat={RAIL_MAT} />
      <Beam from={v(-half, 1, 0)} to={v(-half, rise + 1, runLen)} radius={0.05} mat={RAIL_MAT} />
    </group>
  )
}

/** 带安全护笼的垂直爬梯 */
function CagedLadder({ position, height }: { position: [number, number, number]; height: number }) {
  const rungs: JSX.Element[] = []
  const rungStep = 0.5
  const nR = Math.floor(height / rungStep)
  for (let i = 1; i < nR; i++) {
    rungs.push(
      <mesh key={`r${i}`} position={[0, i * rungStep, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.6, 6]} />
        <meshStandardMaterial {...STEEL} />
      </mesh>,
    )
  }
  const hoops: JSX.Element[] = []
  const hoopStep = 1.4
  const nH = Math.floor(height / hoopStep)
  for (let i = 2; i < nH; i++) {
    hoops.push(
      <mesh key={`h${i}`} position={[0.45, i * hoopStep, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.5, 0.03, 6, 14, Math.PI * 1.2]} />
        <meshStandardMaterial {...STEEL_DARK} />
      </mesh>,
    )
  }
  return (
    <group position={position}>
      {/* 两侧立柱 */}
      <mesh position={[0, height / 2, -0.3]}><cylinderGeometry args={[0.05, 0.05, height, 6]} /><meshStandardMaterial {...STEEL} /></mesh>
      <mesh position={[0, height / 2, 0.3]}><cylinderGeometry args={[0.05, 0.05, height, 6]} /><meshStandardMaterial {...STEEL} /></mesh>
      {rungs}
      {hoops}
    </group>
  )
}

/**
 * 甲板工作灯:夜间随日落点亮的暖色灯具(emissive + bloom)
 * 加少量真实点光源营造甲板照明光池。白天全部熄灭。
 */
function DeckLights() {
  const lampRefs = useRef<THREE.MeshStandardMaterial[]>([])
  const lightRefs = useRef<THREE.PointLight[]>([])

  // 甲板边缘 + 模块区灯柱位置(相对平台原点,甲板面 DECK_Y)
  const lamps = useMemo<[number, number, number][]>(
    () => [
      [18, DECK_Y + 6, 18], [-18, DECK_Y + 6, 18], [18, DECK_Y + 6, -18], [-18, DECK_Y + 6, -18],
      [6, DECK_Y + 10, 8], // 井架基部
      [-6, DECK_Y + 8, -6], // 工艺区
      [8, DECK_Y + 6, -6], // 泵橇旁
    ],
    [],
  )
  // 真实照明点光源(数量克制,不投影以保性能)
  const pools = useMemo<[number, number, number][]>(
    () => [[0, DECK_Y + 12, 0], [-13, DECK_Y + 10, -10], [10, DECK_Y + 8, -6]],
    [],
  )

  useFrame(() => {
    const env = useSceneStore.getState().environment
    const n = nightFactor(env.timeOfDay)
    lampRefs.current.forEach((m) => { if (m) m.emissiveIntensity = n * 4 })
    lightRefs.current.forEach((l) => { if (l) l.intensity = n * 14 })
  })

  return (
    <group>
      {lamps.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.45, 12, 12]} />
          <meshStandardMaterial
            ref={(m) => { if (m) lampRefs.current[i] = m }}
            color="#3a3320"
            emissive="#ffd98a"
            emissiveIntensity={0}
          />
        </mesh>
      ))}
      {pools.map((p, i) => (
        <pointLight
          key={i}
          ref={(l) => { if (l) lightRefs.current[i] = l }}
          position={p}
          color="#ffdba0"
          distance={70}
          decay={1.8}
          intensity={0}
        />
      ))}
    </group>
  )
}

/** 直升机坪边缘绿色航空灯(夜间常亮脉冲),提升海上平台真实感 */
function HelideckLights() {
  const refs = useRef<THREE.MeshStandardMaterial[]>([])
  const positions = useMemo<[number, number, number][]>(() => {
    const arr: [number, number, number][] = []
    const r = 10.2
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      arr.push([Math.cos(a) * r, DECK_Y + 1.6, 24 + Math.sin(a) * r])
    }
    return arr
  }, [])
  useFrame((state) => {
    const env = useSceneStore.getState().environment
    const n = nightFactor(env.timeOfDay)
    const pulse = 0.6 + Math.sin(state.clock.elapsedTime * 2.2) * 0.4
    refs.current.forEach((m) => { if (m) m.emissiveIntensity = n * 3 * pulse })
  })
  return (
    <>
      {positions.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.28, 8, 8]} />
          <meshStandardMaterial
            ref={(m) => { if (m) refs.current[i] = m }}
            color="#04120a"
            emissive="#34ff86"
            emissiveIntensity={0}
          />
        </mesh>
      ))}
    </>
  )
}

/** 导管架:4 条主腿向下外扩 + X 形斜撑 */
function Jacket() {
  const legs = useMemo(() => {
    const arr: { x: number; z: number }[] = []
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) arr.push({ x: sx * LEG_SPAN, z: sz * LEG_SPAN })
    return arr
  }, [])

  const seabedY = -45
  return (
    <group>
      {legs.map((l, i) => {
        // 腿从甲板下方斜插入海床,底部更外扩
        const topX = l.x
        const topZ = l.z
        const botX = l.x * 1.7
        const botZ = l.z * 1.7
        const top = new THREE.Vector3(topX, DECK_Y - 2, topZ)
        const bot = new THREE.Vector3(botX, seabedY, botZ)
        return <Beam key={i} from={top} to={bot} radius={1.1} mat={STEEL} />
      })}
      {/* 水平环梁 + X 斜撑(分 3 层) */}
      {[-2, -18, -34].map((y, li) => (
        <HorizontalRing key={li} y={y} scale={THREE.MathUtils.lerp(1, 1.7, (DECK_Y - 2 - y) / (DECK_Y - 2 - seabedY))} />
      ))}
      {[[-2, -18], [-18, -34]].map(([yt, yb], li) => (
        <XBracing key={li} yTop={yt} yBot={yb} />
      ))}
    </group>
  )
}

function HorizontalRing({ y, scale }: { y: number; scale: number }) {
  const s = LEG_SPAN * scale
  const corners = [
    new THREE.Vector3(-s, y, -s),
    new THREE.Vector3(s, y, -s),
    new THREE.Vector3(s, y, s),
    new THREE.Vector3(-s, y, s),
  ]
  return (
    <>
      {corners.map((c, i) => (
        <Beam key={i} from={c} to={corners[(i + 1) % 4]} radius={0.6} mat={STEEL_DARK} />
      ))}
    </>
  )
}

function XBracing({ yTop, yBot }: { yTop: number; yBot: number }) {
  const st = scaleAt(yTop)
  const sb = scaleAt(yBot)
  const faces: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3][] = []
  const top = [
    new THREE.Vector3(-LEG_SPAN * st, yTop, -LEG_SPAN * st),
    new THREE.Vector3(LEG_SPAN * st, yTop, -LEG_SPAN * st),
    new THREE.Vector3(LEG_SPAN * st, yTop, LEG_SPAN * st),
    new THREE.Vector3(-LEG_SPAN * st, yTop, LEG_SPAN * st),
  ]
  const bot = [
    new THREE.Vector3(-LEG_SPAN * sb, yBot, -LEG_SPAN * sb),
    new THREE.Vector3(LEG_SPAN * sb, yBot, -LEG_SPAN * sb),
    new THREE.Vector3(LEG_SPAN * sb, yBot, LEG_SPAN * sb),
    new THREE.Vector3(-LEG_SPAN * sb, yBot, LEG_SPAN * sb),
  ]
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4
    faces.push([top[i], bot[j], bot[i], top[j]])
  }
  return (
    <>
      {faces.map((f, i) => (
        <group key={i}>
          <Beam from={f[0]} to={f[1]} radius={0.45} mat={STEEL_DARK} />
          <Beam from={f[2]} to={f[3]} radius={0.45} mat={STEEL_DARK} />
        </group>
      ))}
    </>
  )
}

function scaleAt(y: number) {
  const seabedY = -45
  return THREE.MathUtils.lerp(1, 1.7, (DECK_Y - 2 - y) / (DECK_Y - 2 - seabedY))
}

/** 甲板:主甲板板 + 边梁 + 栏杆 + 设备模块 */
function Deck() {
  return (
    <group position={[0, DECK_Y, 0]}>
      {/* 主甲板 */}
      <mesh castShadow receiveShadow position={[0, 0, 0]}>
        <boxGeometry args={[42, 2, 42]} />
        <meshStandardMaterial {...DECK_GREY} />
      </mesh>
      {/* 下层模块甲板 */}
      <mesh castShadow receiveShadow position={[0, -6, 0]}>
        <boxGeometry args={[36, 1.2, 36]} />
        <meshStandardMaterial {...STEEL_DARK} />
      </mesh>
      {/* 工艺模块(管汇/分离器近似) */}
      <ProcessModules />
      {/* 注水泵设备 */}
      <PumpSkid />
      {/* 栏杆 */}
      <Railings half={21} y={1.6} />
    </group>
  )
}

function ProcessModules() {
  return (
    <group position={[-6, 4, -6]}>
      {[0, 1, 2].map((i) => (
        <mesh key={i} castShadow receiveShadow position={[i * 7 - 7, 0, 0]}>
          <cylinderGeometry args={[2.2, 2.2, 7, 20]} />
          <meshStandardMaterial color="#8a9095" metalness={0.7} roughness={0.45} />
        </mesh>
      ))}
      {/* 管廊 */}
      <mesh castShadow position={[0, 4.5, 6]}>
        <boxGeometry args={[22, 0.8, 1.4]} />
        <meshStandardMaterial {...STEEL} />
      </mesh>
    </group>
  )
}

/** 注水泵橇,status=fault 时停转并变红 */
function PumpSkid() {
  const rotorRef = useRef<THREE.Group>(null!)
  const ledRef = useRef<THREE.MeshStandardMaterial>(null!)
  useFrame((state, delta) => {
    const pump = useSceneStore.getState().devices['platform-A.pump-1']
    if (!pump) return
    const running = pump.status === 'running' || pump.status === 'warning'
    const rpm = (pump.metrics.rpm ?? 1480) / 1480
    if (running) rotorRef.current.rotation.z += delta * 6 * rpm
    if (ledRef.current) {
      const col =
        pump.status === 'fault' ? '#ff3030' :
        pump.status === 'warning' ? '#ffc23d' :
        pump.status === 'offline' ? '#444' : '#22e07a'
      ledRef.current.emissive.set(col)
      const pulse = pump.status === 'fault'
        ? (Math.sin(state.clock.elapsedTime * 12) * 0.5 + 0.5)
        : pump.status === 'warning'
        ? (Math.sin(state.clock.elapsedTime * 5) * 0.4 + 0.6)
        : 1
      ledRef.current.emissiveIntensity = pulse * 3
    }
  })
  return (
    <group position={[8, 2.6, -6]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[5, 3, 3]} />
        <meshStandardMaterial color="#3f6fae" metalness={0.5} roughness={0.5} />
      </mesh>
      <group ref={rotorRef} position={[0, 0, 1.7]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[1.1, 1.1, 0.6, 16]} />
          <meshStandardMaterial color="#d8d8d8" metalness={0.8} roughness={0.3} />
        </mesh>
        {/* 叶片标记,旋转可见 */}
        <mesh position={[0, 0, 0.35]}>
          <boxGeometry args={[2, 0.15, 0.05]} />
          <meshStandardMaterial color="#222" metalness={0.5} roughness={0.5} />
        </mesh>
      </group>
      {/* 状态灯 */}
      <mesh position={[0, 2, 0]}>
        <sphereGeometry args={[0.35, 16, 16]} />
        <meshStandardMaterial ref={ledRef} color="#111" emissive="#22e07a" emissiveIntensity={3} />
      </mesh>
    </group>
  )
}

/** 井架:格构塔 */
function Derrick() {
  const h = 38
  const base = 6
  const topW = 2.2
  const segs = 8
  const beams: JSX.Element[] = []
  let key = 0
  for (let s = 0; s < segs; s++) {
    const y0 = (s / segs) * h
    const y1 = ((s + 1) / segs) * h
    const w0 = THREE.MathUtils.lerp(base, topW, s / segs)
    const w1 = THREE.MathUtils.lerp(base, topW, (s + 1) / segs)
    const c0 = corners(w0, y0)
    const c1 = corners(w1, y1)
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4
      beams.push(<Beam key={key++} from={c0[i]} to={c1[i]} radius={0.28} mat={STEEL} />)
      beams.push(<Beam key={key++} from={c0[i]} to={c0[j]} radius={0.2} mat={STEEL_DARK} />)
      beams.push(<Beam key={key++} from={c0[i]} to={c1[j]} radius={0.16} mat={STEEL_DARK} />)
    }
  }
  return (
    <group position={[6, DECK_Y + 1, 8]}>
      {beams}
      {/* 顶部天车 */}
      <mesh position={[0, h, 0]} castShadow>
        <boxGeometry args={[topW + 1, 1.4, topW + 1]} />
        <meshStandardMaterial {...PAINT_RED} />
      </mesh>
    </group>
  )

  function corners(w: number, y: number) {
    return [
      new THREE.Vector3(-w, y, -w),
      new THREE.Vector3(w, y, -w),
      new THREE.Vector3(w, y, w),
      new THREE.Vector3(-w, y, w),
    ]
  }
}

/** 生活楼:多层白色舱室块 + 窗带,夜间窗内暖光逐扇点亮(模拟有人房间) */
function LivingQuarters() {
  // 四面窗带,每层一条;夜间发光,带每扇独立"占用"亮度与轻微闪烁
  const winRefs = useRef<THREE.MeshStandardMaterial[]>([])
  const seeds = useMemo(() => Array.from({ length: 12 }, () => Math.random()), [])

  useFrame((state) => {
    const env = useSceneStore.getState().environment
    const n = nightFactor(env.timeOfDay)
    const t = state.clock.elapsedTime
    winRefs.current.forEach((m, i) => {
      if (!m) return
      const s = seeds[i] ?? 0.5
      // 约 30% 房间"无人"(暗),其余暖光,偶有荧光灯般的极轻微闪动
      const occupied = s > 0.3 ? 1 : 0.12
      const flicker = 0.92 + Math.sin(t * (1.5 + s * 3) + s * 20) * 0.08
      m.emissiveIntensity = n * occupied * 2.2 * flicker
    })
  })

  const faces: { pos: [number, number, number]; rot: [number, number, number]; w: number }[] = [
    { pos: [0, 0, 6.05], rot: [0, 0, 0], w: 12 },
    { pos: [0, 0, -6.05], rot: [0, Math.PI, 0], w: 12 },
    { pos: [7.05, 0, 0], rot: [0, Math.PI / 2, 0], w: 10 },
    { pos: [-7.05, 0, 0], rot: [0, -Math.PI / 2, 0], w: 10 },
  ]
  let idx = 0
  return (
    <group position={[-13, DECK_Y + 1, -10]}>
      <mesh castShadow receiveShadow position={[0, 6, 0]}>
        <boxGeometry args={[14, 12, 12]} />
        <meshStandardMaterial {...PAINT_WHITE} />
      </mesh>
      {faces.map((f, fi) =>
        [3, 6.5, 10].map((y) => {
          const i = idx++
          return (
            <mesh key={`${fi}-${y}`} position={[f.pos[0], y, f.pos[2]]} rotation={f.rot}>
              <boxGeometry args={[f.w, 0.9, 0.1]} />
              <meshStandardMaterial
                ref={(m) => { if (m) winRefs.current[i] = m }}
                color="#10171f"
                emissive="#ffd28a"
                emissiveIntensity={0}
                metalness={0.2}
                roughness={0.2}
              />
            </mesh>
          )
        }),
      )}
    </group>
  )
}

/** 直升机坪:带 H 标记的圆台,挑出甲板 */
function Helipad() {
  return (
    <group position={[0, DECK_Y + 1, 24]}>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[11, 11, 1, 40]} />
        <meshStandardMaterial color="#3a4a3f" metalness={0.2} roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.55, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[9.3, 10, 48]} />
        <meshStandardMaterial color="#e8e8e8" side={THREE.DoubleSide} />
      </mesh>
      {/* H 字母 */}
      <group position={[0, 0.56, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <mesh position={[-2.5, 0, 0]}><boxGeometry args={[1.1, 7, 0.1]} /><meshStandardMaterial color="#fff" /></mesh>
        <mesh position={[2.5, 0, 0]}><boxGeometry args={[1.1, 7, 0.1]} /><meshStandardMaterial color="#fff" /></mesh>
        <mesh><boxGeometry args={[5, 1.1, 0.1]} /><meshStandardMaterial color="#fff" /></mesh>
      </group>
      {/* 支撑挑梁 */}
      <Beam from={new THREE.Vector3(0, -0.5, -8)} to={new THREE.Vector3(0, -6, -14)} radius={0.5} mat={STEEL} />
    </group>
  )
}

/** 吊机:塔身 + 可回转吊臂 + 单摆吊钩 */
function Crane() {
  const slewRef = useRef<THREE.Group>(null!)
  const hookRef = useRef<THREE.Group>(null!)
  useFrame((state) => {
    const t = state.clock.elapsedTime
    const dev = useSceneStore.getState().devices['platform-A.crane-1']
    const active = dev?.status !== 'offline' && dev?.status !== 'fault'
    if (active) {
      slewRef.current.rotation.y = Math.sin(t * 0.12) * THREE.MathUtils.degToRad(15)
      hookRef.current.rotation.z = Math.sin(t * 0.9) * 0.06
    }
  })
  return (
    <group position={[-14, DECK_Y + 1, 10]}>
      {/* 基座 */}
      <mesh castShadow><cylinderGeometry args={[2, 2.4, 4, 16]} /><meshStandardMaterial {...PAINT_RED} /></mesh>
      <group ref={slewRef} position={[0, 4, 0]}>
        {/* 机房 */}
        <mesh castShadow position={[-1.5, 1, 0]}><boxGeometry args={[4, 3, 3]} /><meshStandardMaterial {...PAINT_RED} /></mesh>
        {/* 吊臂 */}
        <group position={[0, 1.5, 0]} rotation={[0, 0, THREE.MathUtils.degToRad(28)]}>
          <Beam from={new THREE.Vector3(0, 0, -0.8)} to={new THREE.Vector3(26, 0, -0.8)} radius={0.22} mat={STEEL} />
          <Beam from={new THREE.Vector3(0, 0, 0.8)} to={new THREE.Vector3(26, 0, 0.8)} radius={0.22} mat={STEEL} />
          <Beam from={new THREE.Vector3(0, 1.2, 0)} to={new THREE.Vector3(26, -0.2, 0)} radius={0.16} mat={STEEL_DARK} />
        </group>
        {/* 吊钩(从臂端垂下) */}
        <group ref={hookRef} position={[22.5, 13, 0]}>
          <mesh position={[0, -5, 0]}><cylinderGeometry args={[0.05, 0.05, 10, 6]} /><meshStandardMaterial color="#222" /></mesh>
          <mesh position={[0, -10, 0]}><boxGeometry args={[0.6, 1, 0.6]} /><meshStandardMaterial {...STEEL} /></mesh>
        </group>
      </group>
    </group>
  )
}

/** 航空障碍灯:红色脉冲 emissive */
function ObstacleLights() {
  const refs = useRef<THREE.MeshStandardMaterial[]>([])
  const positions: [number, number, number][] = [
    [6, DECK_Y + 40, 8],   // 井架顶
    [-13, DECK_Y + 13, -10], // 生活楼顶
    [44, 64, -18],          // 火炬塔顶附近
  ]
  useFrame((state) => {
    const t = state.clock.elapsedTime
    refs.current.forEach((m, i) => {
      if (!m) return
      const phase = i * 1.1
      const blink = Math.pow(Math.max(0, Math.sin(t * 1.6 + phase)), 8)
      m.emissiveIntensity = blink * 6
    })
  })
  return (
    <>
      {positions.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.5, 12, 12]} />
          <meshStandardMaterial
            ref={(m) => { if (m) refs.current[i] = m }}
            color="#3a0000"
            emissive="#ff1a1a"
            emissiveIntensity={3}
          />
        </mesh>
      ))}
    </>
  )
}

/** 导管架水线浪花(billboard 精灵环) */
function Waterline() {
  const ref = useRef<THREE.Group>(null!)
  useFrame((state) => {
    if (ref.current) {
      const s = 1 + Math.sin(state.clock.elapsedTime * 1.5) * 0.08
      ref.current.scale.set(s, 1, s)
    }
  })
  return (
    <group ref={ref}>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <sprite key={`${sx}${sz}`} position={[sx * LEG_SPAN * 1.05, 0.5, sz * LEG_SPAN * 1.05]} scale={[7, 4, 1]}>
            <spriteMaterial color="#eaf4f8" opacity={0.5} transparent depthWrite={false} />
          </sprite>
        )),
      )}
    </group>
  )
}

const RAIL_MAT = { color: '#d8b24a', metalness: 0.7, roughness: 0.5 }
function Railings({ half, y }: { half: number; y: number }) {
  const posts: JSX.Element[] = []
  const step = 4
  let k = 0
  for (let i = -half; i <= half; i += step) {
    for (const edge of ['n', 's', 'e', 'w'] as const) {
      let p: [number, number, number]
      if (edge === 'n') p = [i, y, -half]
      else if (edge === 's') p = [i, y, half]
      else if (edge === 'e') p = [half, y, i]
      else p = [-half, y, i]
      posts.push(
        <mesh key={k++} position={p}>
          <cylinderGeometry args={[0.08, 0.08, 1.6, 6]} />
          <meshStandardMaterial {...RAIL_MAT} />
        </mesh>,
      )
    }
  }
  // 横向扶手
  const rails: JSX.Element[] = []
  for (const ry of [y + 0.7, y]) {
    rails.push(<Beam key={`n${ry}`} from={new THREE.Vector3(-half, ry + 0.8, -half)} to={new THREE.Vector3(half, ry + 0.8, -half)} radius={0.06} mat={RAIL_MAT} />)
    rails.push(<Beam key={`s${ry}`} from={new THREE.Vector3(-half, ry + 0.8, half)} to={new THREE.Vector3(half, ry + 0.8, half)} radius={0.06} mat={RAIL_MAT} />)
    rails.push(<Beam key={`e${ry}`} from={new THREE.Vector3(half, ry + 0.8, -half)} to={new THREE.Vector3(half, ry + 0.8, half)} radius={0.06} mat={RAIL_MAT} />)
    rails.push(<Beam key={`w${ry}`} from={new THREE.Vector3(-half, ry + 0.8, -half)} to={new THREE.Vector3(-half, ry + 0.8, half)} radius={0.06} mat={RAIL_MAT} />)
  }
  return <>{posts}{rails}</>
}

/** 在两点间放置一根圆柱梁 */
function Beam({
  from,
  to,
  radius,
  mat,
}: {
  from: THREE.Vector3
  to: THREE.Vector3
  radius: number
  mat: { color: string; metalness: number; roughness: number }
}) {
  const { position, quaternion, length } = useMemo(() => {
    const dir = new THREE.Vector3().subVectors(to, from)
    const length = dir.length()
    const position = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5)
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir.clone().normalize(),
    )
    return { position, quaternion, length }
  }, [from, to])
  return (
    <mesh position={position} quaternion={quaternion} castShadow receiveShadow>
      <cylinderGeometry args={[radius, radius, length, 8]} />
      <meshStandardMaterial {...mat} />
    </mesh>
  )
}
