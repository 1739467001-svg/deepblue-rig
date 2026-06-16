import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { liveWeather } from './weatherSystem'
import { sunDirection } from '../sky/SkyEnvironment'
import { useSceneStore } from '../../state/store'

/**
 * 程序化云层:高空大穹顶(向下凹的内表面),FBM 噪声生成云团,
 * 受天气 cloudCover/cloudDark 与风向驱动飘移,被太阳染色。
 * 完全本地生成,不依赖外部贴图。跟随相机,营造无限天幕。
 */
export function CloudLayer() {
  const meshRef = useRef<THREE.Mesh>(null!)
  const matRef = useRef<THREE.ShaderMaterial>(null!)

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uCover: { value: 0.1 },
      uDark: { value: 0 },
      uWind: { value: new THREE.Vector2(1, 0) },
      uSunDir: { value: new THREE.Vector3(0.5, 0.4, 0.5) },
      uSunColor: { value: new THREE.Color('#ffe7c2') },
      uSkyTint: { value: new THREE.Color('#aac4d8') },
      uOpacity: { value: 1 },
      uDay: { value: 1 },
    }),
    [],
  )

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const env = useSceneStore.getState().environment
    const u = matRef.current.uniforms
    u.uTime.value = t
    u.uCover.value = liveWeather.cloudCover
    u.uDark.value = liveWeather.cloudDark
    const dir = sunDirection(env.timeOfDay)
    u.uSunDir.value.copy(dir)
    u.uWind.value.set(Math.cos(env.windDirection), Math.sin(env.windDirection)).multiplyScalar(env.windSpeed * 0.04 * liveWeather.windMul)
    // 昼夜染色
    const day = THREE.MathUtils.clamp((dir.y + 0.08) / 0.4, 0, 1)
    u.uSunColor.value.set('#ffe7c2').lerp(new THREE.Color('#2a3450'), 1 - day)
    u.uSkyTint.value.set('#aac4d8').lerp(new THREE.Color('#0c1424'), 1 - day)
    u.uDay.value = day
    // 跟随相机
    meshRef.current.position.set(state.camera.position.x, 0, state.camera.position.z)
  })

  return (
    <mesh ref={meshRef} frustumCulled={false} renderOrder={-1}>
      {/* 大穹顶,只渲染内表面,延伸至近地平线 */}
      <sphereGeometry args={[3600, 64, 32, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={VERT}
        fragmentShader={FRAG}
        side={THREE.BackSide}
        transparent
        depthWrite={false}
        fog={false}
      />
    </mesh>
  )
}

const VERT = /* glsl */ `
  varying vec3 vWorldDir;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldDir = normalize(position);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`

const FRAG = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform float uCover;
  uniform float uDark;
  uniform vec2 uWind;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uSkyTint;
  uniform float uDay;
  varying vec3 vWorldDir;

  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
  float noise(vec2 p){
    vec2 i=floor(p), f=fract(p);
    float a=hash(i), b=hash(i+vec2(1,0)), c=hash(i+vec2(0,1)), d=hash(i+vec2(1,1));
    vec2 u=f*f*(3.0-2.0*f);
    return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
  }
  float fbm(vec2 p){
    float v=0.0, a=0.55;
    for(int i=0;i<6;i++){ v+=a*noise(p); p=p*2.02+vec2(31.0,17.0); a*=0.5; }
    return v;
  }

  void main(){
    vec3 d = normalize(vWorldDir);
    // 仰角:接近天顶 d.y≈1,接近地平 d.y≈0
    float elev = clamp(d.y, 0.0, 1.0);
    if (elev < 0.02) discard;

    // 将方向投影到"云平面"坐标(随仰角伸展,地平线处云被拉远)
    vec2 uv = d.xz / (d.y + 0.18) * 0.9;
    uv += uWind * uTime;

    float n = fbm(uv * 1.4);
    n += 0.4 * fbm(uv * 3.1 + 5.0);

    // 覆盖度阈值:cover 越高,云越满(高覆盖时密度抬升趋于满天)
    float thr = mix(1.1, 0.05, uCover);
    float density = smoothstep(thr, thr + mix(0.5, 0.18, uCover), n);

    // 体积感:噪声高处受光、低处自阴影
    float lit = smoothstep(thr - 0.1, thr + 0.6, n);
    vec3 sunC = uSunColor;
    // 整体明暗由 uDark 主导:晴/多云亮白云,阴/暴风雨暗灰云
    vec3 lightCloud = mix(vec3(0.96,0.97,1.0), uSkyTint * 1.1, 0.25);
    vec3 darkCloud = vec3(0.26, 0.29, 0.35);
    vec3 cloudBase = mix(lightCloud, darkCloud, uDark);
    vec3 col = mix(cloudBase * 0.5, cloudBase, lit);

    // 朝阳一侧云缘镶金边(暴风雨时减弱)
    float sunAlign = clamp(dot(d, normalize(uSunDir)) * 0.5 + 0.5, 0.0, 1.0);
    col += sunC * pow(sunAlign, 6.0) * lit * 0.5 * (1.0 - uDark * 0.8);

    // 仅在贴近地平线极窄处淡出,避免硬边;其余高度保持铺满
    float horizonFade = smoothstep(0.0, 0.05, elev);
    // 重度天气(高覆盖)给一层不透明灰幕,铺满至地平线压住明亮天空
    float overcastFloor = smoothstep(0.78, 1.0, uCover) * 0.95;
    float alpha = max(overcastFloor, clamp(density * (0.55 + 0.6 * uCover), 0.0, 1.0));
    alpha *= horizonFade;

    if (alpha < 0.01) discard;
    // 夜间整体压暗云层:避免半夜亮白云吊起 Bloom、与暗海面形成刺眼黑白地平线
    col *= mix(0.22, 1.0, uDay);
    gl_FragColor = vec4(col, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`
