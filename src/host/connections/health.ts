import { getAdapter, isConnected } from "../db"

const healthIntervals = new Map<string, ReturnType<typeof setInterval>>()
const healthStatus = new Map<string, "healthy" | "degraded" | "disconnected">()

export const startHealthCheck = (connectionId: string, intervalMs = 30000) => {
  stopHealthCheck(connectionId)
  healthStatus.set(connectionId, "healthy")

  const check = async () => {
    if (!isConnected(connectionId)) {
      healthStatus.set(connectionId, "disconnected")
      return
    }
    try {
      const adapter = getAdapter(connectionId)
      await adapter.query("SELECT 1")
      healthStatus.set(connectionId, "healthy")
    } catch {
      healthStatus.set(connectionId, "degraded")
    }
  }

  const interval = setInterval(check, intervalMs)
  healthIntervals.set(connectionId, interval)
}

export const stopHealthCheck = (connectionId: string) => {
  const interval = healthIntervals.get(connectionId)
  if (interval) {
    clearInterval(interval)
    healthIntervals.delete(connectionId)
  }
  healthStatus.delete(connectionId)
}

export const getHealthStatus = (connectionId: string): "healthy" | "degraded" | "disconnected" =>
  healthStatus.get(connectionId) ?? "disconnected"
