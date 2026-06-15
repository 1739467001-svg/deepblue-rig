import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Sky, Stars } from '@react-three/drei'
import * as THREE from 'three'
import { useSceneStore } from '../../state/store'
import { liveWeather } from '../weather/weatherSystem'

/** 由 timeOfDay 求太阳方向(简化日轨:东升西落,正午最高) */
export function sunDirection(timeOfDay: number): THREE.Vector3 {
  // 0..24 -> 角度。6 点日出(地平线东),12 点正午(天顶偏南),18 点日落(西)
  const t = (timeOfDay - 6) / 12 // 0 at sunrise, 1 at sunset
  const elevation = Math.sin(t * Math.PI) * (Math.PI / 2.4) // 最高约 75°
  const azimuth = THREE.MathUtils.lerp(Math.PI * 0.15, Math.PI * 1.05, (timeOfDay) / 24)
  const cosE = Math.cos(elevation)
  return new THREE.Vector3(
    cosE * Math.cos(azimuth),
    Math.sin(elevation),
    cosE * Math.sin(azimuth),
  ).normalize()
}

interface Preset {
  sunColor: THREE.Color
  ambient: THREE.Color
  ambientIntensity: number
  sunIntensity: number
  fogColor: THREE.Color
}

/** 关键时段调色 */
function gradeFor(timeOfDay: number, sunY: number): Preset {
  const dawn: Preset = {
    sunColor: new THREE.Color('#ffb27a'),
    ambient: new THREE.Color('#6172a0'),
    ambientIntensity: 0.55,
    sunIntensity: 3.2,
    fogColor: new THREE.Color('#9aaecb'),
  }
  const noon: Preset = {
    sunColor: new THREE.Color('#fff4e0'),
    ambient: new THREE.Color('#bcd2e8'),
    ambientIntensity: 0.95,
    sunIntensity: 4.0,
    fogColor: new THREE.Color('#aac4d8'),
  }
  const golden: Preset = {
    sunColor: new THREE.Color('#ff8a3c'),
    ambient: new THREE.Color('#7a6a94'),
    ambientIntensity: 0.5,
    sunIntensity: 5.0,
    fogColor: new THREE.Color('#d9a071'),
  }
  const night: Preset = {
    sunColor: new THREE.Color('#46598c'),
    ambient: new THREE.Color('#1a2238'),
    ambientIntensity: 0.3,
    sunIntensity: 0.35,
    fogColor: new THREE.Color('#0a1422'),
  }

  // 依据时间在预设间插值
  if (timeOfDay < 5 || timeOfDay >= 20) return night
  if (timeOfDay < 7.5) return lerpPreset(night, dawn, (timeOfDay - 5) / 2.5)
  if (timeOfDay < 11) return lerpPreset(dawn, noon, (timeOfDay - 7.5) / 3.5)
  if (timeOfDay < 15.5) return noon
  if (timeOfDay < 18.5) return lerpPreset(noon, golden, (timeOfDay - 15.5) / 3)
  return lerpPreset(golden, night, (timeOfDay - 18.5) / 1.5)
}

function lerpPreset(a: Preset, b: Preset, t: number): Preset {
  t = THREE.MathUtils.clamp(t, 0, 1)
  return {
    sunColor: a.sunColor.clone().lerp(b.sunColor, t),
    ambient: a.ambient.clone().lerp(b.ambient, t),
    ambientIntensity: THREE.MathUtils.lerp(a.ambientIntensity, b.ambientIntensity, t),
    sunIntensity: THREE.MathUtils.lerp(a.sunIntensity, b.sunIntensity, t),
    fogColor: a.fogColor.clone().lerp(b.fogColor, t),
  }
}

/** 柔和径向辉光贴图(白心→透明),供太阳/月亮光晕共用 */
function makeGlowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.22, 'rgba(255,255,255,0.85)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
}

const _sunWorld = new THREE.Vector3()
const _white = new THREE.Color('#ffffff')

export function SkyEnvironment() {
  const sunRef = useRef<THREE.DirectionalLight>(null!)
  const ambientRef = useRef<THREE.AmbientLight>(null!)
  const hemiRef = useRef<THREE.HemisphereLight>(null!)
  const skyRef = useRef<any>(null!)
  const { scene } = useThree()

  const glowTex = useMemo(() => makeGlowTexture(), [])
  const sunCore = useRef<THREE.Sprite>(null!)
  const sunGlow = useRef<THREE.Sprite>(null!)

  const sunVec = useRef(new THREE.Vector3())
  const fog = useMemo(() => new THREE.FogExp2('#aac4d8', 0.0012), [])

  useFrame((state) => {
    const env = useSceneStore.getState().environment
    const dir = sunDirection(env.timeOfDay)
    sunVec.current.copy(dir)
    const preset = gradeFor(env.timeOfDay, dir.y)
    const w = liveWeather // 实时插值后的天气参数

    // 雾密度(天气主导)与去饱和
    const fogDensity = w.fogDensity
    const sunMul = w.sunMul

    // 太阳光:低角度(黄金时刻)仍保持较强暖光;被云层按 sunMul 衰减
    const sunPos = dir.clone().multiplyScalar(800)
    sunRef.current.position.copy(sunPos)
    sunRef.current.color.copy(preset.sunColor)
    const elevFactor = THREE.MathUtils.clamp((dir.y + 0.06) / 0.35, 0.0, 1.0)
    sunRef.current.intensity = preset.sunIntensity * elevFactor * sunMul

    // 环境光(阴天/雪天漫射更强)
    ambientRef.current.color.copy(preset.ambient)
    ambientRef.current.intensity = preset.ambientIntensity * w.ambientMul
    hemiRef.current.intensity = preset.ambientIntensity * 0.6 * w.ambientMul
    hemiRef.current.color.copy(preset.sunColor)
    hemiRef.current.groundColor.set('#0a1a22')

    // 雾:阴/雾/雨/雪天去饱和并偏向天气灰
    const fogColor = preset.fogColor.clone()
    const grey = new THREE.Color('#9aa6ad').lerp(new THREE.Color('#1a2230'), 1 - elevFactor)
    fogColor.lerp(grey, w.desaturate)
    fog.color.copy(fogColor)
    fog.density = fogDensity
    scene.fog = fog
    scene.background = fogColor.clone().lerp(new THREE.Color('#7fa8c8'), 0.3 * (1 - w.desaturate))

    // drei Sky:太阳位置 + 天气驱动的浑浊度/散射(平滑过渡)
    if (skyRef.current?.material) {
      const u = skyRef.current.material.uniforms
      u.sunPosition.value.copy(dir)
      if (u.turbidity) u.turbidity.value = w.turbidity
      if (u.rayleigh) u.rayleigh.value = w.rayleigh
    }

    // 太阳本体 + 光晕:置于相机前方太阳方向,随高度淡入、被云层(sunMul)削弱
    _sunWorld.copy(dir).multiplyScalar(4000).add(state.camera.position)
    const visible = dir.y > -0.04
    const elev = THREE.MathUtils.clamp((dir.y + 0.02) / 0.16, 0, 1)
    const op = elev * sunMul
    const core = sunCore.current
    const glow = sunGlow.current
    if (core && glow) {
      core.position.copy(_sunWorld)
      glow.position.copy(_sunWorld)
      core.visible = visible
      glow.visible = visible
      const cm = core.material as THREE.SpriteMaterial
      const gm = glow.material as THREE.SpriteMaterial
      cm.opacity = visible ? op : 0
      gm.opacity = visible ? op * 0.55 : 0
      cm.color.copy(preset.sunColor).lerp(_white, 0.55)
      gm.color.copy(preset.sunColor)
    }
  })

  const env = useSceneStore((s) => s.environment)
  const isNight = env.timeOfDay < 5.5 || env.timeOfDay >= 19.5

  return (
    <>
      <Sky
        ref={skyRef}
        distance={45000}
        sunPosition={[0.4, 0.3, 0.4]}
        turbidity={9}
        rayleigh={2.6}
        mieCoefficient={0.005}
        mieDirectionalG={0.93}
      />

      {/* 太阳光晕(大)+ 本体(小),toneMapped 关以保持高亮供 Bloom 拾取;
          作为透明对象默认在不透明体之后绘制 —— 既叠在天空上,又被近处结构遮挡 */}
      <sprite ref={sunGlow} scale={[1100, 1100, 1]}>
        <spriteMaterial map={glowTex} color="#ffd9a0" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} fog={false} />
      </sprite>
      <sprite ref={sunCore} scale={[260, 260, 1]}>
        <spriteMaterial map={glowTex} color="#fff3d6" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} fog={false} />
      </sprite>

      {isNight && (
        <>
          <Stars radius={800} depth={120} count={4000} factor={5} saturation={0} fade speed={0.4} />
          {/* 月亮:远处自发光圆盘 + 球形柔光晕 + billboard 大光晕 */}
          <group position={[700, 520, -1100]}>
            <sprite scale={[520, 520, 1]}>
              <spriteMaterial map={glowTex} color="#aebfe0" transparent opacity={0.5} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} fog={false} />
            </sprite>
            <mesh>
              <sphereGeometry args={[42, 32, 32]} />
              <meshBasicMaterial color="#eef2ff" toneMapped={false} />
            </mesh>
            <mesh>
              <sphereGeometry args={[78, 32, 32]} />
              <meshBasicMaterial color="#a9c0e8" transparent opacity={0.22} depthWrite={false} toneMapped={false} />
            </mesh>
          </group>
        </>
      )}

      <directionalLight
        ref={sunRef}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={1}
        shadow-camera-far={1200}
        shadow-camera-left={-220}
        shadow-camera-right={220}
        shadow-camera-top={220}
        shadow-camera-bottom={-220}
        shadow-bias={-0.0004}
      />
      <ambientLight ref={ambientRef} />
      <hemisphereLight ref={hemiRef} />
    </>
  )
}
