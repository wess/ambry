import { Stack, Text, Group, Switch, Badge, Box, Button, ScrollArea, UnstyledButton, ActionIcon, Tooltip, Loader, Center, Tabs } from "@mantine/core"
import { useState, useEffect } from "react"
import { Download, Trash2, Package, Globe } from "lucide-react"
import { notifications } from "@mantine/notifications"

type InstalledPlugin = {
  name: string
  version: string
  description: string
  type: "driver" | "export" | "theme"
  author?: string
  enabled: boolean
}

type RegistryPlugin = {
  name: string
  version: string
  description: string
  type: "driver" | "export" | "theme"
  author?: string
}

const typeColors: Record<string, string> = {
  driver: "blue",
  export: "teal",
  theme: "violet",
}

export const PluginsTab = () => {
  const [installed, setInstalled] = useState<InstalledPlugin[]>([])
  const [registry, setRegistry] = useState<RegistryPlugin[]>([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [inst, reg] = await Promise.all([
        butter.invoke("plugins:list") as Promise<InstalledPlugin[]>,
        butter.invoke("plugins:registry") as Promise<RegistryPlugin[]>,
      ])
      setInstalled(inst ?? [])
      setRegistry(reg ?? [])
    } catch { /* */ }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleToggle = async (name: string, enabled: boolean) => {
    await butter.invoke("plugins:toggle", { name, enabled })
    setInstalled((prev) => prev.map((p) => p.name === name ? { ...p, enabled } : p))
  }

  const handleInstall = async (plugin: RegistryPlugin) => {
    try {
      await butter.invoke("plugins:install", plugin)
      notifications.show({ message: `Installed ${plugin.name}`, color: "teal", autoClose: 2000 })
      load()
    } catch (err: any) {
      notifications.show({ title: "Install failed", message: err.message, color: "red" })
    }
  }

  const handleUninstall = async (name: string) => {
    await butter.invoke("plugins:uninstall", { name })
    notifications.show({ message: `Uninstalled ${name}`, autoClose: 2000 })
    load()
  }

  const installedNames = new Set(installed.map((p) => p.name))

  if (loading) return <Center p="xl"><Loader size="sm" /></Center>

  return (
    <Tabs defaultValue="installed" styles={{ tab: { fontSize: 11 } }}>
      <Tabs.List mb="sm">
        <Tabs.Tab value="installed" leftSection={<Package size={12} />}>
          Installed ({installed.length})
        </Tabs.Tab>
        <Tabs.Tab value="browse" leftSection={<Globe size={12} />}>
          Browse
        </Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="installed">
        <ScrollArea.Autosize mah={300}>
          <Stack gap={4}>
            {installed.length === 0 ? (
              <Text size="xs" c="dimmed" ta="center" py="md">No plugins installed</Text>
            ) : (
              installed.map((p) => (
                <Group key={p.name} justify="space-between" py={6} px={8} style={{ borderBottom: "1px solid var(--ambry-border-subtle)" }}>
                  <Stack gap={1}>
                    <Group gap={6}>
                      <Text size="xs" fw={500} style={{ fontSize: 12 }}>{p.name}</Text>
                      <Badge size="xs" color={typeColors[p.type] || "gray"} variant="light" radius="sm" style={{ fontSize: 9 }}>{p.type}</Badge>
                      <Text size="xs" c="dimmed" style={{ fontSize: 10 }}>v{p.version}</Text>
                    </Group>
                    <Text size="xs" c="dimmed" style={{ fontSize: 10 }}>{p.description}</Text>
                  </Stack>
                  <Group gap={6}>
                    <Switch size="xs" checked={p.enabled} onChange={(e) => handleToggle(p.name, e.currentTarget.checked)} />
                    <Tooltip label="Uninstall">
                      <ActionIcon size="sm" color="red" variant="subtle" onClick={() => handleUninstall(p.name)}>
                        <Trash2 size={12} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Group>
              ))
            )}
          </Stack>
        </ScrollArea.Autosize>
      </Tabs.Panel>

      <Tabs.Panel value="browse">
        <ScrollArea.Autosize mah={300}>
          <Stack gap={4}>
            {registry.map((p) => (
              <Group key={p.name} justify="space-between" py={6} px={8} style={{ borderBottom: "1px solid var(--ambry-border-subtle)" }}>
                <Stack gap={1}>
                  <Group gap={6}>
                    <Text size="xs" fw={500} style={{ fontSize: 12 }}>{p.name}</Text>
                    <Badge size="xs" color={typeColors[p.type] || "gray"} variant="light" radius="sm" style={{ fontSize: 9 }}>{p.type}</Badge>
                    <Text size="xs" c="dimmed" style={{ fontSize: 10 }}>v{p.version}</Text>
                  </Group>
                  <Text size="xs" c="dimmed" style={{ fontSize: 10 }}>{p.description}</Text>
                </Stack>
                {installedNames.has(p.name) ? (
                  <Badge size="xs" variant="light" color="teal" style={{ fontSize: 9 }}>Installed</Badge>
                ) : (
                  <Button
                    size="compact-xs"
                    variant="light"
                    leftSection={<Download size={10} />}
                    onClick={() => handleInstall(p)}
                    styles={{ root: { fontSize: 10 } }}
                  >
                    Install
                  </Button>
                )}
              </Group>
            ))}
          </Stack>
        </ScrollArea.Autosize>
      </Tabs.Panel>
    </Tabs>
  )
}
