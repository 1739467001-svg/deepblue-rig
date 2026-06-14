# 二期数据适配层(预留空壳)

一期不实现。约定接入路径:

1. NestJS 网关订阅 SCADA / IoT 平台(MQTT / OPC UA 适配器);
2. 网关将原始遥测翻译为 `DeviceState` patch,经 WebSocket 推送;
3. 前端将 `Simulator` 替换为下面的 `socketAdapter`,调用同一 `updateDeviceState`;
4. 渲染层、标注层零改动。

```ts
// 示意:二期把 mock Simulator 换成它即可
import { io } from 'socket.io-client'
import { useSceneStore } from '../state/store'
import { DeviceState } from '../state/schema'

export function connectScada(url: string) {
  const socket = io(url)
  socket.on('device:patch', (raw: unknown) => {
    const patch = DeviceState.partial().parse(raw) // 复用同一套 Zod 校验
    if (patch.id) useSceneStore.getState().updateDeviceState(patch.id, patch)
  })
  return () => socket.close()
}
```
