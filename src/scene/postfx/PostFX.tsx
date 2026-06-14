import {
  EffectComposer,
  Bloom,
  Vignette,
  SSAO,
  ToneMapping,
  SMAA,
} from '@react-three/postprocessing'
import { BlendFunction, ToneMappingMode } from 'postprocessing'
import { useSceneStore } from '../../state/store'

/**
 * 后处理管线:SSAO → Bloom → Vignette → ACES ToneMapping。
 * 按画质档降级:low/medium 关 SSAO,保 Bloom + ToneMapping。
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
    </EffectComposer>
  )
}
