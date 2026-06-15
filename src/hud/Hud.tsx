import { useEffect, useState } from 'react'
import { useSceneStore, selectHealthSummary } from '../state/store'
import type { CameraMode, Weather } from '../state/schema'

const WEATHER_LABEL: Record<Weather, string> = {
  clear: '晴',
  cloudy: '多云',
  overcast: '阴',
  fog: '雾',
  rain: '雨',
  storm: '暴风雨',
  snow: '雪',
}

const CAMERA_LABEL: Record<CameraMode, string> = {
  free: '自由',
  cruise: '巡航',
  focus: '聚焦',
  dive: '海底',
}

function fmtTime(t: number) {
  const h = Math.floor(t)
  const m = Math.floor((t - h) * 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** 全局 HUD DOM 浮层(在 Canvas 之外) */
export function Hud() {
  const env = useSceneStore((s) => s.environment)
  const health = useSceneStore(selectHealthSummary)
  const cameraMode = useSceneStore((s) => s.cameraMode)
  const quality = useSceneStore((s) => s.quality)
  const simulating = useSceneStore((s) => s.simulating)
  const setCameraMode = useSceneStore((s) => s.setCameraMode)
  const setWeather = useSceneStore((s) => s.setWeather)
  const setTimeOfDay = useSceneStore((s) => s.setTimeOfDay)
  const setEnvironment = useSceneStore((s) => s.setEnvironment)
  const setQuality = useSceneStore((s) => s.setQuality)
  const setSimulating = useSceneStore((s) => s.setSimulating)
  const setFocused = useSceneStore((s) => s.setFocused)

  const [, force] = useState(0)
  // 让时间显示随帧刷新
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 250)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="pointer-events-none absolute inset-0 z-50 font-sans">
      {/* 左上:时间 / 天气 */}
      <div className="absolute left-5 top-5 rounded-lg border border-white/10 bg-black/35 px-4 py-3 backdrop-blur-md">
        <div className="text-[10px] uppercase tracking-widest text-cyan-300/70">DeepBlue Rig · 海上油田数字孪生</div>
        <div className="mt-1 flex items-end gap-3">
          <span className="font-mono text-3xl font-semibold tabular-nums">{fmtTime(env.timeOfDay)}</span>
          <span className="pb-1 text-sm text-slate-300">{WEATHER_LABEL[env.weather]}</span>
        </div>
        <div className="mt-1 text-[10px] text-slate-400">
          风向 {Math.round((env.windDirection * 180) / Math.PI)}° · 风力 {env.windSpeed.toFixed(0)} m/s
        </div>
      </div>

      {/* 右上:设备健康总览 */}
      <div className="absolute right-5 top-5 rounded-lg border border-white/10 bg-black/35 px-4 py-3 backdrop-blur-md">
        <div className="mb-1.5 text-[10px] uppercase tracking-widest text-slate-400">设备健康</div>
        <div className="flex gap-4 font-mono text-sm">
          <Stat color="#22e07a" label="运行" n={health.running} />
          <Stat color="#ffc23d" label="告警" n={health.warning} />
          <Stat color="#ff4d4d" label="故障" n={health.fault} />
          <Stat color="#6b7280" label="离线" n={health.offline} />
        </div>
      </div>

      {/* 底部:控制面板 */}
      <div className="pointer-events-auto absolute bottom-5 left-1/2 flex -translate-x-1/2 flex-wrap items-center justify-center gap-3 rounded-xl border border-white/10 bg-black/45 px-4 py-3 backdrop-blur-md">
        {/* 相机模式 */}
        <Group label="相机">
          {(['cruise', 'free', 'focus', 'dive'] as CameraMode[]).map((m) => (
            <Btn key={m} active={cameraMode === m} onClick={() => { setCameraMode(m); if (m !== 'focus') setFocused(null) }}>
              {CAMERA_LABEL[m]}
            </Btn>
          ))}
        </Group>

        {/* 天气 */}
        <Group label="天气">
          {(['clear', 'cloudy', 'overcast', 'fog', 'rain', 'storm', 'snow'] as Weather[]).map((w) => (
            <Btn key={w} active={env.weather === w} onClick={() => setWeather(w)}>
              {WEATHER_LABEL[w]}
            </Btn>
          ))}
        </Group>

        {/* 时间 */}
        <Group label="时段">
          <Btn active={Math.abs(env.timeOfDay - 6.5) < 1} onClick={() => setTimeOfDay(6.5)}>黎明</Btn>
          <Btn active={Math.abs(env.timeOfDay - 12) < 1} onClick={() => setTimeOfDay(12)}>正午</Btn>
          <Btn active={Math.abs(env.timeOfDay - 17.5) < 1} onClick={() => setTimeOfDay(17.5)}>黄金</Btn>
          <Btn active={env.timeOfDay >= 20 || env.timeOfDay < 5} onClick={() => setTimeOfDay(22)}>夜晚</Btn>
        </Group>

        {/* 昼夜加速 */}
        <Group label="昼夜">
          <Btn active={env.timeScale === 0} onClick={() => setEnvironment({ timeScale: 0 })}>暂停</Btn>
          <Btn active={env.timeScale === 1} onClick={() => setEnvironment({ timeScale: 1 })}>1×</Btn>
          <Btn active={env.timeScale === 1440} onClick={() => setEnvironment({ timeScale: 1440 })}>演示</Btn>
        </Group>

        {/* 画质 / 模拟器 */}
        <Group label="画质">
          {(['high', 'medium', 'low'] as const).map((q) => (
            <Btn key={q} active={quality === q} onClick={() => setQuality(q)}>
              {q === 'high' ? '高' : q === 'medium' ? '中' : '低'}
            </Btn>
          ))}
        </Group>
        <Group label="模拟">
          <Btn active={simulating} onClick={() => setSimulating(!simulating)}>
            {simulating ? '运行中' : '已停'}
          </Btn>
        </Group>
      </div>
    </div>
  )
}

function Stat({ color, label, n }: { color: string; label: string; n: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
      <span className="text-slate-300">{label}</span>
      <span className="tabular-nums">{n}</span>
    </div>
  )
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-slate-400">{label}</span>
      <div className="flex gap-1">{children}</div>
    </div>
  )
}

function Btn({ active, onClick, children }: { active?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded px-2.5 py-1 text-xs transition ${
        active
          ? 'bg-cyan-400/90 text-slate-900 shadow-[0_0_12px_rgba(34,211,238,0.5)]'
          : 'bg-white/5 text-slate-200 hover:bg-white/15'
      }`}
    >
      {children}
    </button>
  )
}
