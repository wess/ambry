import { spawn, type Subprocess } from "bun"
import type { SshConfig } from "../db/types"

type Tunnel = {
  process: Subprocess
  localPort: number
}

const activeTunnels = new Map<string, Tunnel>()

const getRandomPort = (): number =>
  Math.floor(Math.random() * (65535 - 49152) + 49152)

export const openTunnel = async (
  connectionId: string,
  ssh: SshConfig,
  remoteHost: string,
  remotePort: number,
): Promise<number> => {
  // Close existing tunnel for this connection
  await closeTunnel(connectionId)

  const localPort = getRandomPort()

  const args = [
    "-N", "-L", `${localPort}:${remoteHost}:${remotePort}`,
    "-p", String(ssh.port),
    "-o", "StrictHostKeyChecking=no",
    "-o", "ExitOnForwardFailure=yes",
  ]

  if (ssh.authMethod === "key" && ssh.keyPath) {
    args.push("-i", ssh.keyPath)
  }

  args.push(`${ssh.username}@${ssh.host}`)

  const proc = spawn(["ssh", ...args], {
    stdout: "ignore",
    stderr: "pipe",
  })

  // Wait a bit for the tunnel to establish
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => resolve(), 2000)
    proc.exited.then((code) => {
      clearTimeout(timeout)
      if (code !== 0) {
        reject(new Error(`SSH tunnel exited with code ${code}`))
      }
    })
  })

  activeTunnels.set(connectionId, { process: proc, localPort })
  return localPort
}

export const closeTunnel = async (connectionId: string): Promise<void> => {
  const tunnel = activeTunnels.get(connectionId)
  if (tunnel) {
    tunnel.process.kill()
    activeTunnels.delete(connectionId)
  }
}

export const hasTunnel = (connectionId: string): boolean =>
  activeTunnels.has(connectionId)

export const getTunnelPort = (connectionId: string): number | null => {
  const tunnel = activeTunnels.get(connectionId)
  return tunnel?.localPort ?? null
}
