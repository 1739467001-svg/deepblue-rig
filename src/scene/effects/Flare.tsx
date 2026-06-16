import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useSceneStore } from '../../state/store'

/**
 * 火炬塔:格构臂 + 双层噪声火焰 + flicker 点光源 + GPU 烟雾粒子。
 * 火焰大小/亮度由 flare.metrics.intensity 驱动;烟雾受风向影响。
 */
export function Flare({
  position,
  deckY,
}: {
  position: [number, number, number]
  deckY: number
}) {
  const tipY = 38 // 火炬臂顶相对甲板高度
  const flameRef = useRef<THREE.Mesh>(null!)
  const flameMat = useRef<THREE.ShaderMaterial>(null!)
  const lightRef = useRef<THREE.PointLight>(null!)
  const smokeRef = useRef<THREE.Points>(null!)
  const emberRef = useRef<THREE.Points>(null!)

  const flameUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uIntensity: { value: 0.85 },
      uColorInner: { value: new THREE.Color('#fff2b0') },
      uColorMid: { value: new THREE.Color('#ff8a1e') },
      uColorOuter: { value: new THREE.Color('#d12f12') },
    }),
    [],
  )

  // 烟雾粒子
  const smoke = useMemo(() => {
    const N = 120
    const geo = new THREE.BufferGeometry()
    const pos = new Float32Array(N * 3)
    const seed = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 2
      pos[i * 3 + 1] = Math.random() * 30
      pos[i * 3 + 2] = (Math.random() - 0.5) * 2
      seed[i] = Math.random()
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    return geo
  }, [])

  const smokeUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uWind: { value: new THREE.Vector2(0.6, 0.3) },
      uIntensity: { value: 0.85 },
    }),
    [],
  )

  // 余烬粒子(明亮暖色火星,加性混合供 Bloom 拾取)
  const embers = useMemo(() => {
    const N = 70
    const geo = new THREE.BufferGeometry()
    const pos = new Float32Array(N * 3)
    const seed = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 1.5
      pos[i * 3 + 1] = Math.random() * 4
      pos[i * 3 + 2] = (Math.random() - 0.5) * 1.5
      seed[i] = Math.random()
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    return geo
  }, [])

  const emberUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uWind: { value: new THREE.Vector2(0.6, 0.3) },
      uIntensity: { value: 0.85 },
    }),
    [],
  )

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const env = useSceneStore.getState().environment
    const dev = useSceneStore.getState().devices['platform-A.flare-1']
    const on = dev?.status !== 'offline'
    const intensity = on ? (dev?.metrics.intensity ?? 0.85) : 0

    flameUniforms.uTime.value = t
    flameUniforms.uIntensity.value = intensity
    smokeUniforms.uTime.value = t
    smokeUniforms.uIntensity.value = intensity
    smokeUniforms.uWind.value.set(Math.cos(env.windDirection), Math.sin(env.windDirection)).multiplyScalar(env.windSpeed * 0.12)

    emberUniforms.uTime.value = t
    emberUniforms.uIntensity.value = intensity
    emberUniforms.uWind.value.copy(smokeUniforms.uWind.value)
    if (emberRef.current) emberRef.current.visible = intensity > 0.05

    const scale = 0.5 + intensity * 1.1
    flameRef.current.scale.set(scale * 0.7, scale, scale * 0.7)
    flameRef.current.visible = intensity > 0.02

    // flicker 点光源
    const flicker = (Math.sin(t * 21) * 0.5 + Math.sin(t * 13.3) * 0.3 + Math.sin(t * 7.1) * 0.2)
    lightRef.current.intensity = on ? (60 + flicker * 25) * intensity : 0
    lightRef.current.color.setHSL(0.06 + flicker * 0.01, 1, 0.55)
  })

  return (
    <group position={[position[0], deckY, position[2]]}>
      {/* 火炬臂(斜向伸出) */}
      <mesh position={[-3, tipY * 0.5, 2]} rotation={[0, 0, 0.35]} castShadow>
        <cylinderGeometry args={[0.5, 0.7, tipY, 10]} />
        <meshStandardMaterial color="#9a8838" metalness={0.8} roughness={0.6} />
      </mesh>
      {/* 火焰 */}
      <mesh ref={flameRef} position={[0, tipY + 4, 0]} renderOrder={10}>
        <coneGeometry args={[3, 12, 24, 24, true]} />
        <shaderMaterial
          ref={flameMat}
          uniforms={flameUniforms}
          vertexShader={FLAME_VERT}
          fragmentShader={FLAME_FRAG}
          transparent
          depthWrite={false}
          blending={THREE.NormalBlending}
          side={THREE.DoubleSide}
        />
      </mesh>
      <pointLight ref={lightRef} position={[0, tipY + 5, 0]} distance={260} decay={1.6} color="#ff8a2a" />
      {/* 烟雾 */}
      <points ref={smokeRef} position={[0, tipY + 8, 0]} geometry={smoke}>
        <shaderMaterial
          uniforms={smokeUniforms}
          vertexShader={SMOKE_VERT}
          fragmentShader={SMOKE_FRAG}
          transparent
          depthWrite={false}
          blending={THREE.NormalBlending}
        />
      </points>
      {/* 余烬火星 */}
      <points ref={emberRef} position={[0, tipY + 4, 0]} geometry={embers}>
        <shaderMaterial
          uniforms={emberUniforms}
          vertexShader={EMBER_VERT}
          fragmentShader={EMBER_FRAG}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  )
}

const FLAME_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  varying vec2 vUv;
  varying float vH;

  // 简易噪声
  float hash(vec2 p){
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  float noise(vec2 p){
    vec2 i=floor(p), f=fract(p);
    float a=hash(i), b=hash(i+vec2(1,0)), c=hash(i+vec2(0,1)), d=hash(i+vec2(1,1));
    vec2 u=f*f*(3.0-2.0*f);
    return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
  }

  void main(){
    vUv = uv;
    vH = uv.y;
    vec3 p = position;
    // 沿高度扭曲 + 顶部收窄
    float n = noise(vec2(uv.x*4.0, uv.y*3.0 - uTime*2.5));
    float sway = (n - 0.5) * (1.0 - uv.y) * 2.0;
    p.x += sway * (0.6 + uIntensity);
    p.z += (noise(vec2(uv.y*3.0 + uTime*2.0, uv.x*4.0)) - 0.5) * (1.0 - uv.y) * 1.5;
    p.xz *= (1.0 - uv.y * 0.6);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`

const FLAME_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  uniform vec3 uColorInner;
  uniform vec3 uColorMid;
  uniform vec3 uColorOuter;
  varying vec2 vUv;
  varying float vH;

  float hash(vec2 p){
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  float noise(vec2 p){
    vec2 i=floor(p), f=fract(p);
    float a=hash(i), b=hash(i+vec2(1,0)), c=hash(i+vec2(0,1)), d=hash(i+vec2(1,1));
    vec2 u=f*f*(3.0-2.0*f);
    return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
  }
  float fbm(vec2 p){
    float v=0.0, a=0.5;
    for(int i=0;i<4;i++){ v+=a*noise(p); p*=2.0; a*=0.5; }
    return v;
  }

  void main(){
    float n = fbm(vec2(vUv.x*5.0, vUv.y*5.0 - uTime*3.0));
    // 中心更亮,边缘衰减
    float radial = 1.0 - abs(vUv.x - 0.5) * 2.0;
    float body = radial * (1.0 - vH);
    float flame = smoothstep(0.12, 0.95, body * (0.55 + n * 0.85));
    flame *= (0.4 + uIntensity);

    // 颜色按火焰强度分层:外焰橙红 → 中焰橙黄 → 内焰亮黄(白核仅出现在最炽热处)
    vec3 col = mix(uColorOuter, uColorMid, smoothstep(0.0, 0.45, flame));
    col = mix(col, uColorInner, smoothstep(0.55, 0.95, flame) * (1.0 - vH * 0.4));
    // 仅根部最炽热处趋白
    float core = smoothstep(0.9, 1.0, flame) * (1.0 - vH);
    col = mix(col, vec3(1.0, 0.96, 0.82), core * 0.6);

    float alpha = flame * (1.0 - smoothstep(0.65, 1.0, vH));
    if (alpha < 0.02) discard;
    // 适度提亮供 Bloom 拾取,但避免整体过曝成白
    gl_FragColor = vec4(col * (1.0 + uIntensity * 0.8), alpha);
  }
`

const SMOKE_VERT = /* glsl */ `
  uniform float uTime;
  uniform vec2 uWind;
  uniform float uIntensity;
  attribute float aSeed;
  varying float vAlpha;
  varying float vSeed;

  void main(){
    vSeed = aSeed;
    float life = mod(uTime * (0.25 + aSeed * 0.15) + aSeed * 10.0, 1.0);
    vec3 p = position;
    float rise = life * 40.0;
    p.y = rise;
    // 上升中受风偏移并发散
    p.x += uWind.x * rise * (0.8 + aSeed) + sin(aSeed * 30.0 + uTime) * life * 4.0;
    p.z += uWind.y * rise * (0.8 + aSeed) + cos(aSeed * 22.0 + uTime) * life * 4.0;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = (40.0 + life * 120.0) * uIntensity / max(-mv.z, 1.0) * 60.0;
    gl_Position = projectionMatrix * mv;
    vAlpha = (1.0 - life) * life * 4.0 * uIntensity;
  }
`

const SMOKE_FRAG = /* glsl */ `
  varying float vAlpha;
  varying float vSeed;
  void main(){
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float soft = smoothstep(0.5, 0.1, d);
    vec3 col = mix(vec3(0.12), vec3(0.28), vSeed);
    gl_FragColor = vec4(col, soft * vAlpha * 0.5);
  }
`

const EMBER_VERT = /* glsl */ `
  uniform float uTime;
  uniform vec2 uWind;
  uniform float uIntensity;
  attribute float aSeed;
  varying float vAlpha;
  varying float vSeed;

  void main(){
    vSeed = aSeed;
    // 比烟雾更快、生命更短,火星窜起后熄灭
    float life = mod(uTime * (0.9 + aSeed * 0.7) + aSeed * 12.0, 1.0);
    vec3 p = position;
    float rise = life * 22.0;
    p.y = rise;
    p.x += uWind.x * rise * 0.5 + sin(aSeed * 40.0 + uTime * 6.0) * life * 2.0;
    p.z += uWind.y * rise * 0.5 + cos(aSeed * 33.0 + uTime * 6.0) * life * 2.0;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = (4.0 + aSeed * 4.0) * uIntensity / max(-mv.z, 1.0) * 60.0;
    gl_Position = projectionMatrix * mv;
    // 先亮后熄
    vAlpha = pow(1.0 - life, 1.5) * uIntensity;
  }
`

const EMBER_FRAG = /* glsl */ `
  varying float vAlpha;
  varying float vSeed;
  void main(){
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float soft = smoothstep(0.5, 0.0, d);
    // 暖色火星:黄白核 → 橙红尾
    vec3 col = mix(vec3(1.0, 0.55, 0.15), vec3(1.0, 0.9, 0.6), vSeed);
    gl_FragColor = vec4(col, soft * vAlpha);
  }
`
