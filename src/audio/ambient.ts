/**
 * 程序化海洋氛围声景 —— 纯 Web Audio API 合成,零外部音频文件、零版权问题。
 *
 * 声层:
 *  - 海浪涌动(brown noise → 低通,慢速 LFO 调制增益模拟浪涌)
 *  - 风声(pink noise → 带通,随风力/暴风雨增强)
 *  - 雨声(white noise → 高通,随降水量淡入)
 *  - 电影感低频 pad(数个失谐振荡器 → 低通,慢速颤音)
 *
 * 全部随天气(liveWeather)与昼夜平滑联动。浏览器自动播放策略要求用户手势后
 * 才能发声,故由 HUD 开关在点击回调里启动并 resume()。
 */

export interface AmbientParams {
  /** 浪高倍率(weatherSystem.waveScale,约 0.9..1.8) */
  waveScale: number
  /** 风力倍率(liveWeather.windMul,约 0.7..2.2) */
  windMul: number
  /** 降水量 0..1 */
  precip: number
  /** 闪电(0..1),触发低频轰鸣 */
  lightning: number
  /** 昼夜 0(夜)..1(日),夜间整体更安静 */
  day: number
}

/** 生成 N 秒可循环噪声缓冲(type: white/pink/brown) */
function makeNoiseBuffer(ctx: AudioContext, seconds: number, type: 'white' | 'pink' | 'brown'): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  if (type === 'white') {
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  } else if (type === 'pink') {
    // Paul Kellet 近似 pink noise
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1
      b0 = 0.99886 * b0 + w * 0.0555179
      b1 = 0.99332 * b1 + w * 0.0750759
      b2 = 0.969 * b2 + w * 0.153852
      b3 = 0.8665 * b3 + w * 0.3104856
      b4 = 0.55 * b4 + w * 0.5329522
      b5 = -0.7616 * b5 - w * 0.016898
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11
      b6 = w * 0.115926
    }
  } else {
    // brown noise(积分白噪,低频厚重)
    let last = 0
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1
      last = (last + 0.02 * w) / 1.02
      d[i] = last * 3.5
    }
  }
  return buf
}

function loopNoise(ctx: AudioContext, buf: AudioBuffer): AudioBufferSourceNode {
  const src = ctx.createBufferSource()
  src.buffer = buf
  src.loop = true
  return src
}

export class AmbientEngine {
  private ctx: AudioContext
  private master: GainNode
  private swellGain: GainNode
  private windGain: GainNode
  private rainGain: GainNode
  private padGain: GainNode
  private nodes: AudioScheduledSourceNode[] = []
  private started = false

  constructor() {
    const AC = window.AudioContext || (window as any).webkitAudioContext
    this.ctx = new AC()
    const ctx = this.ctx

    this.master = ctx.createGain()
    this.master.gain.value = 0 // 起始静音,start() 时淡入
    this.master.connect(ctx.destination)

    // —— 海浪涌动 ——
    this.swellGain = ctx.createGain()
    this.swellGain.gain.value = 0.0
    const swellLP = ctx.createBiquadFilter()
    swellLP.type = 'lowpass'
    swellLP.frequency.value = 420
    const swellSrc = loopNoise(ctx, makeNoiseBuffer(ctx, 6, 'brown'))
    swellSrc.connect(swellLP).connect(this.swellGain).connect(this.master)
    // 慢速 LFO 调制浪涌起伏
    const swellLfo = ctx.createOscillator()
    swellLfo.frequency.value = 0.12
    const swellLfoGain = ctx.createGain()
    swellLfoGain.gain.value = 0.18
    swellLfo.connect(swellLfoGain).connect(this.swellGain.gain)
    this.nodes.push(swellSrc, swellLfo)

    // —— 风声 ——
    this.windGain = ctx.createGain()
    this.windGain.gain.value = 0.0
    const windBP = ctx.createBiquadFilter()
    windBP.type = 'bandpass'
    windBP.frequency.value = 700
    windBP.Q.value = 0.7
    const windSrc = loopNoise(ctx, makeNoiseBuffer(ctx, 6, 'pink'))
    windSrc.connect(windBP).connect(this.windGain).connect(this.master)
    const windLfo = ctx.createOscillator()
    windLfo.frequency.value = 0.08
    const windLfoGain = ctx.createGain()
    windLfoGain.gain.value = 0.5
    windLfo.connect(windLfoGain).connect(windBP.frequency)
    this.nodes.push(windSrc, windLfo)

    // —— 雨声 ——
    this.rainGain = ctx.createGain()
    this.rainGain.gain.value = 0.0
    const rainHP = ctx.createBiquadFilter()
    rainHP.type = 'highpass'
    rainHP.frequency.value = 1600
    const rainSrc = loopNoise(ctx, makeNoiseBuffer(ctx, 5, 'white'))
    rainSrc.connect(rainHP).connect(this.rainGain).connect(this.master)
    this.nodes.push(rainSrc)

    // —— 电影感低频 pad ——
    this.padGain = ctx.createGain()
    this.padGain.gain.value = 0.0
    const padLP = ctx.createBiquadFilter()
    padLP.type = 'lowpass'
    padLP.frequency.value = 320
    padLP.connect(this.padGain).connect(this.master)
    // A1 / E2 / A2 轻微失谐,营造空旷海上深邃感
    const freqs = [55, 82.41, 110]
    freqs.forEach((f, i) => {
      const o = ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = f
      o.detune.value = (i - 1) * 6
      const og = ctx.createGain()
      og.gain.value = i === 0 ? 0.5 : 0.28
      o.connect(og).connect(padLP)
      this.nodes.push(o)
    })
    // pad 慢速颤音
    const padLfo = ctx.createOscillator()
    padLfo.frequency.value = 0.05
    const padLfoGain = ctx.createGain()
    padLfoGain.gain.value = 0.06
    padLfo.connect(padLfoGain).connect(this.padGain.gain)
    this.nodes.push(padLfo)
  }

  /** 在用户手势回调内调用:resume + 启动所有源 + 主增益淡入 */
  async start() {
    if (this.started) {
      await this.ctx.resume()
      this.fadeMaster(0.5, 1.2)
      return
    }
    this.started = true
    await this.ctx.resume()
    const t = this.ctx.currentTime
    this.nodes.forEach((n) => n.start(t))
    this.fadeMaster(0.5, 1.5)
  }

  /** 主增益淡出后挂起(省 CPU) */
  async stop() {
    this.fadeMaster(0, 0.8)
    setTimeout(() => this.ctx.suspend().catch(() => {}), 900)
  }

  private fadeMaster(to: number, dur: number) {
    const g = this.master.gain
    const t = this.ctx.currentTime
    g.cancelScheduledValues(t)
    g.setValueAtTime(g.value, t)
    g.linearRampToValueAtTime(to, t + dur)
  }

  /** 每帧/定时调用:把各声层增益平滑逼近天气目标值 */
  update(p: AmbientParams) {
    const t = this.ctx.currentTime
    const ramp = (param: AudioParam, target: number) => {
      param.cancelScheduledValues(t)
      param.setTargetAtTime(target, t, 0.6)
    }
    const dayMul = 0.7 + 0.3 * p.day // 夜间略安静
    // 浪:基础 0.16,浪越高越厚
    ramp(this.swellGain.gain, (0.16 + (p.waveScale - 0.9) * 0.22) * dayMul)
    // 风:随风力升,暴风雨明显
    ramp(this.windGain.gain, (0.05 + Math.max(0, p.windMul - 0.7) * 0.16) * dayMul)
    // 雨:随降水量
    ramp(this.rainGain.gain, p.precip * 0.5 * dayMul)
    // pad:基础铺底,暴风雨/闪电时略增厚
    ramp(this.padGain.gain, (0.10 + p.lightning * 0.06) * dayMul)
  }

  dispose() {
    try { this.nodes.forEach((n) => { try { n.stop() } catch {} }) } catch {}
    this.ctx.close().catch(() => {})
  }
}
