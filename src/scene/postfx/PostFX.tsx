import {
  EffectComposer,
  Bloom,
  Vignette,
  SSAO,
  ToneMapping,
  SMAA,
  HueSaturation,
  BrightnessContrast,
} from '@react-three/postprocessing'
import { BlendFunction, ToneMappingMode } from 'postprocessing'
import { useSceneStore } from '../../state/store'

/**
 * 后处理管线:SSAO → Bloom → Vignette → ACES ToneMapping → 色彩分级。
 * 按画质档降级:low/medium 关 SSAO,保 Bloom + ToneMapping。
 * 末端色彩分级(对比度/饱和度微调)统一画面,提升电影出片感。
 */
export function PostFX() {
  const quality = useSceneStore((s) => s.quality)
  const high = quality === 'high'
  const medium = quality !== 'low'

  return (
    <EffectComposer multisampling={high ? 4 : 0} enableNormalPass={high}>
      {high ? (
        <SSAO
          blendFunction={BlendFunction.MULTIPLY}
          samples={16}
          radius={8}
          intensity={22}
          luminanceInfluence={0.6}
          color={0x000000 as any}
          worldDistanceThreshold={1000}
          worldDistanceFalloff={1000}
          worldProximityThreshold={6}
          worldProximityFalloff={6}
        />
      ) : (
        <></>
      )}
      {!high ? <SMAA /> : <></>}
      <Bloom
        mipmapBlur
        luminanceThreshold={0.82}
        luminanceSmoothing={0.2}
        intensity={medium ? 1.2 : 0.8}
        radius={0.7}
      />
      <Vignette eskil={false} offset={0.18} darkness={0.7} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      {/* 末端电影级色彩分级:轻微提对比 + 提饱和,深海蓝更通透、暖调更出片 */}
      <BrightnessContrast brightness={0.0} contrast={0.1} />
      <HueSaturation saturation={0.12} hue={0.0} />
    </EffectComposer>
  )
}
