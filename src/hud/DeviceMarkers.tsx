import { useState } from 'react'
import { Html } from '@react-three/drei'
import { useSceneStore } from '../state/store'
import type { DeviceState, DeviceStatus } from '../state/schema'

const STATUS_COLOR: Record<DeviceStatus, string> = {
  running: '#22e07a',
  warning: '#ffc23d',
  fault: '#ff4d4d',
  offline: '#6b7280',
}

const STATUS_LABEL: Record<DeviceStatus, string> = {
  running: '运行',
  warning: '告警',
  fault: '故障',
  offline: '离线',
}

/** 设备标注:默认小圆点,hover/点击展开卡片;距离裁剪交给 drei occlude/distanceFactor */
export function DeviceMarkers() {
  const devices = useSceneStore((s) => s.devices)
  return (
    <>
      {Object.values(devices).map((d) => (
        <Marker key={d.id} device={d} />
      ))}
    </>
  )
}

function Marker({ device }: { device: DeviceState }) {
  const [hover, setHover] = useState(false)
  const setFocused = useSceneStore((s) => s.setFocused)
  const setCameraMode = useSceneStore((s) => s.setCameraMode)
  const color = STATUS_COLOR[device.status]
  const pulsing = device.status === 'fault' || device.status === 'warning'

  return (
    <Html position={device.position} center distanceFactor={140} zIndexRange={[40, 0]} occlude={false}>
      <div
        className="select-none"
        style={{ pointerEvents: 'auto', cursor: 'pointer', transform: 'translateZ(0)' }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={() => {
          setFocused(device.id)
          setCameraMode('focus')
        }}
      >
        {/* 圆点 */}
        <div className="relative flex items-center justify-center">
          <span
            className="block rounded-full"
            style={{
              width: 12,
              height: 12,
              background: color,
              boxShadow: `0 0 10px ${color}, 0 0 4px ${color}`,
              animation: pulsing ? 'hudPulse 1s infinite' : undefined,
            }}
          />
          <span
            className="absolute rounded-full"
            style={{ width: 22, height: 22, border: `1px solid ${color}`, opacity: 0.5 }}
          />
        </div>

        {/* 卡片 */}
        {hover && (
          <div
            className="absolute left-4 top-0 min-w-[170px] rounded-md px-3 py-2 text-[11px] backdrop-blur-md"
            style={{
              background: 'rgba(8,14,22,0.82)',
              border: `1px solid ${color}`,
              boxShadow: `0 4px 24px rgba(0,0,0,0.5)`,
              color: '#e8eef5',
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium">{device.name}</span>
              <span style={{ color }} className="text-[10px]">
                ● {STATUS_LABEL[device.status]}
              </span>
            </div>
            <div className="mt-1 space-y-0.5 font-mono text-[10px] text-slate-300">
              {Object.entries(device.metrics).slice(0, 3).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <span className="text-slate-400">{k}</span>
                  <span>{typeof v === 'number' ? v.toLocaleString() : v}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Html>
  )
}
