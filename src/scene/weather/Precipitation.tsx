import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { advanceWeather, liveWeather } from './weatherSystem'
import { useSceneStore } from '../../state/store'

/**
 * 降水系统:同时驱动天气插值(advanceWeather)与雨/雪粒子。
 * - 雨:细长拉丝、快速下落、随风斜飞
 * - 雪:圆点、缓慢飘落、横向摆动
 * precipKind 在雨(0)雪(1)间插值,数量由 precip 控制。
 */
export function Precipitation() {
  const { camera } = useThree()
  const pointsRef = useRef<THREE.Points>(null!)
  const matRef = useRef<THREE.ShaderMaterial>(null!)

  const N = 9000
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const pos = new Float32Array(N * 3)
    const rnd = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 300
      pos[i * 3 + 1] = Math.random() * 180
      pos[i * 3 + 2] = (Math.random() - 0.5) * 300
      rnd[i] = Math.random()
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 1))
    return g
  }, [])

  const uniforms = useMemo(
    () => ({ uKind: { value: 0 }, uAmount: { value: 0 } }),
    [],
  )

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    const weather = useSceneStore.getState().environment.weather
    advanceWeather(weather, dt)

    const amount = liveWeather.precip
    const kind = liveWeather.precipKind
    matRef.current.uniforms.uAmount.value = amount
    matRef.current.uniforms.uKind.value = kind
    pointsRef.current.visible = amount > 0.02
    pointsRef.current.position.set(camera.position.x, 0, camera.position.z)

    if (amount <= 0.02) return
    const arr = geo.attributes.position.array as Float32Array
    const rnd = geo.attributes.aRnd.array as Float32Array
    // 雨快、雪慢
    const fallBase = THREE.MathUtils.lerp(150, 14, kind)
    const drift = THREE.MathUtils.lerp(20, 6, kind) * liveWeather.windMul
    for (let i = 0; i < N; i++) {
      const speed = fallBase * (0.7 + rnd[i] * 0.6)
      arr[i * 3 + 1] -= speed * dt
      arr[i * 3] -= drift * dt
      // 雪横向摆动
      if (kind > 0.3) arr[i * 3 + 2] += Math.sin(state.clock.elapsedTime * 1.5 + rnd[i] * 30) * dt * 4 * kind
      if (arr[i * 3 + 1] < 0) {
        arr[i * 3 + 1] = 180
        arr[i * 3] = (Math.random() - 0.5) * 300
        arr[i * 3 + 2] = (Math.random() - 0.5) * 300
      }
    }
    geo.attributes.position.needsUpdate = true
  })

  return (
    <points ref={pointsRef} geometry={geo} frustumCulled={false} renderOrder={20}>
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={VERT}
        fragmentShader={FRAG}
        transparent
        depthWrite={false}
      />
    </points>
  )
}

const VERT = /* glsl */ `
  attribute float aRnd;
  uniform float uKind;
  uniform float uAmount;
  varying float vKind;
  varying float vVis;
  void main() {
    vKind = uKind;
    // 仅渲染数量比例内的粒子(amount 越小越少)
    vVis = step(aRnd, uAmount);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    // 雪点大、雨点小
    float size = mix(2.0, 5.0, uKind);
    gl_PointSize = size * (300.0 / max(-mv.z, 1.0));
    gl_Position = projectionMatrix * mv;
  }
`

const FRAG = /* glsl */ `
  varying float vKind;
  varying float vVis;
  void main() {
    if (vVis < 0.5) discard;
    vec2 c = gl_PointCoord - 0.5;
    // 雨:竖直拉丝;雪:圆点
    float rain = smoothstep(0.5, 0.0, abs(c.x) * 6.0) * smoothstep(0.5, 0.1, abs(c.y));
    float snow = smoothstep(0.5, 0.0, length(c));
    float a = mix(rain, snow, vKind);
    vec3 col = mix(vec3(0.72, 0.8, 0.9), vec3(1.0), vKind);
    gl_FragColor = vec4(col, a * mix(0.5, 0.95, vKind));
  }
`
