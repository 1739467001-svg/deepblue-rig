import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { AdaptiveDpr, AdaptiveEvents, Environment, Lightformer } from '@react-three/drei'
import * as THREE from 'three'

import { Ocean } from './scene/ocean/Ocean'
import { SkyEnvironment } from './scene/sky/SkyEnvironment'
import { Platform } from './scene/entities/Platform'
import { FPSO } from './scene/entities/FPSO'
import { Tanker } from './scene/entities/Tanker'
import { Helicopter } from './scene/entities/Helicopter'
import { Seagulls } from './scene/entities/Seagulls'
import { Buoys } from './scene/entities/Buoys'
import { DistantRigs } from './scene/entities/DistantRigs'
import { SupplyVessel } from './scene/entities/SupplyVessel'
import { CloudLayer } from './scene/weather/CloudLayer'
import { Precipitation } from './scene/weather/Precipitation'
import { Lightning } from './scene/weather/Lightning'
import { PostFX } from './scene/postfx/PostFX'
import { CameraRig } from './scene/cameras/CameraRig'
import { Underwater } from './scene/underwater/Underwater'
import { Simulator } from './state/simulator/Simulator'
import { DeviceMarkers } from './hud/DeviceMarkers'
import { Hud } from './hud/Hud'

export default function App() {
  return (
    <>
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{
          antialias: false,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
        }}
        camera={{ position: [120, 55, 120], fov: 48, near: 0.5, far: 8000 }}
      >
        <Suspense fallback={null}>
          {/* 程序化环境贴图用于 PBR 反射 —— 完全本地生成,不依赖外部 HDRI */}
          <Environment resolution={256} frames={1}>
            <Lightformer form="rect" intensity={2.6} color="#cfe2f2" scale={[120, 50, 1]} position={[0, 40, -80]} />
            <Lightformer form="circle" intensity={8} color="#ffd29a" scale={[24, 24, 1]} position={[60, 26, -50]} />
            <Lightformer form="rect" intensity={0.8} color="#0b2433" scale={[200, 60, 1]} position={[0, -30, 60]} rotation={[Math.PI / 2, 0, 0]} />
          </Environment>

          <SkyEnvironment />
          <CloudLayer />
          <Ocean />

          <DistantRigs />
          <Platform />
          <FPSO />
          <Tanker />
          <SupplyVessel />
          <Helicopter />
          <Seagulls />
          <Buoys />

          <Precipitation />
          <Lightning />
          <Underwater />
          <DeviceMarkers />

          <CameraRig />
          <Simulator />

          <PostFX />

          <AdaptiveDpr pixelated />
          <AdaptiveEvents />
        </Suspense>
      </Canvas>

      <Hud />
    </>
  )
}
