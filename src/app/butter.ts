import type { AmbryCalls } from "./types"

export const invoke = <K extends keyof AmbryCalls>(
  action: K,
  data: AmbryCalls[K]["input"],
  opts?: { timeout?: number },
): Promise<AmbryCalls[K]["output"]> =>
  butter.invoke(action as string, data, opts) as Promise<AmbryCalls[K]["output"]>

export const listen = (action: string, handler: (data: unknown) => void) =>
  butter.on(action, handler)

export const unlisten = (action: string, handler: (data: unknown) => void) =>
  butter.off(action, handler)
