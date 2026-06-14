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

export function SkyEnvironment() {
  const sunRef = useRef<THREE.DirectionalLight>(null!)
  const ambientRef = useRef<THREE.AmbientLight>(null!)
  const hemiRef = useRef<THREE.HemisphereLight>(null!)
  const skyRef = useRef<any>(null!)
  const { scene } = useThree()

  const sunVec = useRef(new THREE.Vector3())
  const fog = useMemo(() => new THREE.FogExp2('#aac4d8', 0.0012), [])

  useFrame(() => {
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
      {isNight && (
        <>
          <Stars radius={800} depth={120} count={4000} factor={5} saturation={0} fade speed={0.4} />
          {/* 月亮:远处自发光圆盘 + 柔光晕 */}
          <group position={[700, 520, -1100]}>
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
