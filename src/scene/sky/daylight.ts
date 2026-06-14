import * as THREE from 'three'
import { sunDirection } from './SkyEnvironment'

/**
 * 夜间因子:0 = 白昼,1 = 全黑夜,黄昏/黎明平滑过渡。
 * 由太阳高度驱动,全场灯光(平台甲板灯、舷灯、窗光)共用,
 * 保证人工照明随日落统一点亮、随日出统一熄灭。
 */
export function nightFactor(timeOfDay: number): number {
  const y = sunDirection(timeOfDay).y
  // 太阳高度 0.10 以上为白天,-0.06 以下为深夜,中间过渡
  return THREE.MathUtils.clamp((0.1 - y) / 0.16, 0, 1)
}
