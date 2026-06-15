import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { packWaveUniforms } from './waves'
import { sunDirection } from '../sky/SkyEnvironment'
import { useSceneStore } from '../../state/store'
import { waveScaleRef } from '../weather/weatherSystem'

const SKY_DAY = new THREE.Color('#9fc6e8')
const SKY_NIGHT = new THREE.Color('#0c1626')

/**
 * Gerstner 多波海面。
 * - 顶点着色器:大涌浪真实顶点位移 + 解析法线
 * - 片元着色器:程序化高频细节法线、菲涅尔天空反射、太阳镜面闪烁(glitter)、
 *   深浅水色渐变、次表面散射近似、波峰白沫、大气透视雾
 * 网格采用较小平面 + 高细分并跟随相机,保证近处波形平滑不刻面。
 */
export function Ocean() {
  const matRef = useRef<THREE.ShaderMaterial>(null!)
  const meshRef = useRef<THREE.Mesh>(null!)

  const { dir, params, count } = useMemo(() => packWaveUniforms(), [])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uWaveDir: { value: dir },
      uWaveParams: { value: params },
      uWaveCount: { value: count },
      uSunDir: { value: new THREE.Vector3(0.5, 0.4, 0.5).normalize() },
      uSunColor: { value: new THREE.Color('#ffdca8') },
      uShallowColor: { value: new THREE.Color('#2a8fa8') },
      uDeepColor: { value: new THREE.Color('#03212f') },
      uSkyColor: { value: new THREE.Color('#9fc6e8') },
      uHorizonColor: { value: new THREE.Color('#c9d8e4') },
      uFoamColor: { value: new THREE.Color('#eaf4f8') },
      uCameraPos: { value: new THREE.Vector3() },
      uFogColor: { value: new THREE.Color('#b3c6d4') },
      uFogDensity: { value: 0.00045 },
      uDayFactor: { value: 1 },
      uWaveScale: { value: 1 },
    }),
    [dir, params, count],
  )

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const env = useSceneStore.getState().environment
    const u = matRef.current.uniforms
    u.uTime.value = t
    u.uCameraPos.value.copy(state.camera.position)
    u.uSunDir.value.copy(sunDirection(env.timeOfDay))
    u.uWaveScale.value = waveScaleRef.value
    // 大气透视与太阳色跟随环境(昼夜/天气),保证海面与天空氛围一致
    const fog = state.scene.fog as THREE.FogExp2 | null
    if (fog && fog.color) {
      u.uFogColor.value.copy(fog.color)
      u.uFogDensity.value = Math.min(fog.density * 1.1, 0.004)
      // 地平线反射 = 大气色,天空环境一致
      u.uHorizonColor.value.copy(fog.color)
    }
    // 昼夜亮度因子:太阳高度驱动,夜晚海面应当压暗,反射暗色天空
    const sunY = u.uSunDir.value.y
    const day = THREE.MathUtils.clamp((sunY + 0.08) / 0.4, 0.0, 1.0)
    u.uDayFactor.value = day
    // 天顶反射色:白天亮蓝,夜晚深海军蓝
    u.uSkyColor.value.copy(SKY_DAY).lerp(SKY_NIGHT, 1 - day)
    // 黄金时刻/夜晚的太阳高光染色
    const h = env.timeOfDay
    if (h < 5 || h >= 20) u.uSunColor.value.set('#9fb0d8')
    else if (h >= 16 && h < 19.5) u.uSunColor.value.set('#ff9a4e')
    else u.uSunColor.value.set('#ffe7c2')
    // 海面跟随相机水平移动,营造无限海面
    meshRef.current.position.x = state.camera.position.x
    meshRef.current.position.z = state.camera.position.z
  })

  return (
    <mesh ref={meshRef} rotation-x={-Math.PI / 2} frustumCulled={false} renderOrder={0}>
      {/* 较小平面 + 高细分:近处约 4m/格,波形平滑 */}
      <planeGeometry args={[1800, 1800, 420, 420]} />
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={VERT}
        fragmentShader={FRAG}
        fog={false}
      />
    </mesh>
  )
}

const VERT = /* glsl */ `
  uniform float uTime;
  uniform vec2 uWaveDir[8];
  uniform vec4 uWaveParams[8];
  uniform int uWaveCount;
  uniform float uWaveScale;

  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vFoam;
  varying float vViewDist;

  const float PI = 3.141592653589793;

  void main() {
    // 平面默认在局部 xy,绕 x 旋转后:局部 x→世界 x,局部 y→世界 -z,局部 z→世界 y
    float wx = position.x;
    float wz = position.y;
    vec3 tangent = vec3(1.0, 0.0, 0.0);
    vec3 binormal = vec3(0.0, 0.0, 1.0);
    vec3 disp = vec3(0.0);
    float foam = 0.0;

    for (int i = 0; i < 8; i++) {
      if (i >= uWaveCount) break;
      vec2 d = normalize(uWaveDir[i]);
      float wavelength = uWaveParams[i].x;
      float amplitude  = uWaveParams[i].y;
      float steepness  = uWaveParams[i].z;
      float speed      = uWaveParams[i].w;

      float k = 2.0 * PI / wavelength;
      float q = steepness / (k * amplitude * float(uWaveCount));
      float phase = k * dot(d, vec2(wx, wz)) + speed * k * uTime;
      float c = cos(phase);
      float s = sin(phase);

      disp.x += q * amplitude * d.x * c;
      disp.y += q * amplitude * d.y * c;
      disp.z += amplitude * uWaveScale * s;

      float wa = k * amplitude * uWaveScale;
      tangent.x += -q * d.x * d.x * wa * s;
      tangent.y += -q * d.x * d.y * wa * s;
      tangent.z += d.x * wa * c;
      binormal.x += -q * d.x * d.y * wa * s;
      binormal.y += -q * d.y * d.y * wa * s;
      binormal.z += d.y * wa * c;

      foam += max(0.0, c) * steepness * (amplitude / 1.6);
    }

    vec3 pos = position + disp;
    vec3 n = normalize(cross(binormal, tangent));
    vNormal = normalize(mat3(modelMatrix) * n);
    vFoam = smoothstep(0.75, 1.35, foam);

    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPos = worldPos.xyz;
    vec4 mvPos = viewMatrix * worldPos;
    vViewDist = -mvPos.z;
    gl_Position = projectionMatrix * mvPos;
  }
`

const FRAG = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uShallowColor;
  uniform vec3 uDeepColor;
  uniform vec3 uSkyColor;
  uniform vec3 uHorizonColor;
  uniform vec3 uFoamColor;
  uniform vec3 uCameraPos;
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  uniform float uDayFactor;
  uniform float uWaveScale;

  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vFoam;
  varying float vViewDist;

  // 值噪声 + fbm,用于细节法线扰动
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
  float noise(vec2 p){
    vec2 i=floor(p), f=fract(p);
    float a=hash(i), b=hash(i+vec2(1,0)), c=hash(i+vec2(0,1)), d=hash(i+vec2(1,1));
    vec2 u=f*f*(3.0-2.0*f);
    return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
  }
  float fbmH(vec2 p){
    float v=0.0, a=0.5;
    for(int i=0;i<4;i++){ v+=a*noise(p); p=p*2.0+vec2(17.0,9.0); a*=0.5; }
    return v;
  }

  void main() {
    vec3 N = normalize(vNormal);
    if (N.y < 0.0) N = -N;
    vec3 V = normalize(uCameraPos - vWorldPos);

    // —— 高频细节法线:两层滚动噪声梯度,随距离衰减避免远处噪点 ——
    float detailFade = clamp(1.0 - vViewDist / 600.0, 0.0, 1.0);
    vec2 p1 = vWorldPos.xz * 0.18 + vec2(uTime * 0.6, uTime * 0.35);
    vec2 p2 = vWorldPos.xz * 0.07 - vec2(uTime * 0.25, uTime * 0.4);
    float e = 0.35;
    float hC = fbmH(p1) * 0.6 + fbmH(p2);
    float hX = fbmH(p1 + vec2(e,0.0)) * 0.6 + fbmH(p2 + vec2(e,0.0));
    float hZ = fbmH(p1 + vec2(0.0,e)) * 0.6 + fbmH(p2 + vec2(0.0,e));
    vec3 detailN = normalize(vec3(hC - hX, 1.0, hC - hZ));
    N = normalize(mix(N, normalize(N + vec3(detailN.x, 0.0, detailN.z) * 1.6), detailFade));

    // —— 菲涅尔 ——
    float fres = pow(clamp(1.0 - max(dot(N, V), 0.0), 0.0, 1.0), 5.0);
    fres = mix(0.02, 1.0, fres);

    // —— 水体色:依据视角深浅过渡 ——
    float facing = clamp(dot(N, V), 0.0, 1.0);
    vec3 waterColor = mix(uShallowColor, uDeepColor, pow(facing, 0.6));

    // —— 天空反射:按反射向量高度在地平线/天顶间过渡 ——
    vec3 R = reflect(-V, N);
    float skyT = clamp(R.y * 1.2, 0.0, 1.0);
    vec3 skyRefl = mix(uHorizonColor, uSkyColor, skyT);

    // —— 太阳镜面 + 闪烁拉丝 ——
    vec3 H = normalize(uSunDir + V);
    float ndh = max(dot(N, H), 0.0);
    float spec = pow(ndh, 380.0) * 4.0;          // 紧致高光
    float glitter = pow(ndh, 60.0) * 0.5;        // 海面碎光
    vec3 sun = uSunColor * (spec + glitter);

    // —— 次表面散射:逆光波峰泛绿光 ——
    float back = pow(clamp(dot(V, -uSunDir) * 0.5 + 0.5, 0.0, 1.0), 3.0);
    vec3 sss = vec3(0.06, 0.42, 0.38) * back * 0.45;

    vec3 col = mix(waterColor + sss, skyRefl, fres);
    col += sun;

    // 夜晚整体压暗水体(保留太阳/月光高光),避免反射残留导致海面发白
    float nightDim = mix(0.18, 1.0, uDayFactor);
    col *= nightDim;

    // —— 白沫(波峰 + 细节高点),夜晚减弱 ——
    // 风浪联动:浪越高(uWaveScale)波峰碎白沫越密,暴风雨时海面碎白成片
    float rough = clamp((uWaveScale - 0.95) / 0.85, 0.0, 1.0);
    float whitecap = smoothstep(0.55, 1.0, vFoam) + smoothstep(1.2, 1.5, hC) * detailFade;
    float foam = clamp(vFoam + smoothstep(1.1, 1.45, hC) * detailFade * 0.5 + whitecap * (0.12 + rough * 0.7), 0.0, 1.0);
    foam *= mix(0.35, 1.0, uDayFactor);
    col = mix(col, uFoamColor * mix(0.4, 1.0, uDayFactor), foam);

    // —— 大气透视 ——
    float fog = 1.0 - exp(-uFogDensity * vViewDist);
    col = mix(col, uFogColor, clamp(fog, 0.0, 1.0));

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`
