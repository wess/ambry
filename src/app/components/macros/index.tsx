import { Modal, Stack, Text, Group, Button, ActionIcon, Tooltip, TextInput, ScrollArea, Box, Badge, Menu, UnstyledButton, NumberInput } from "@mantine/core"
import { useState, useEffect } from "react"
import { Play, Trash2, Download, Upload, Plus, Circle, Square, MoreVertical, Pencil } from "lucide-react"
import { notifications } from "@mantine/notifications"

type MacroStep = {
  action: "query" | "navigate" | "switchdb"
  params: Record<string, string>
}

type Macro = {
  id: string
  name: string
  steps: MacroStep[]
  parameters?: string[]
  shortcut?: string
  createdAt: string
}

type Props = {
  opened: boolean
  onClose: () => void
  onReplay: (steps: MacroStep[], params?: Record<string, string>) => void
  recording: boolean
  onStartRecording: () => void
  onStopRecording: () => void
  recordedSteps: MacroStep[]
}

export type { MacroStep, Macro }

const stepLabel = (step: MacroStep): string => {
  switch (step.action) {
    case "query": return step.params.sql?.slice(0, 50) || "Query"
    case "navigate": return `Go to ${step.params.table}`
    case "switchdb": return `Switch to ${step.params.database}`
    default: return step.action
  }
}

const stepColor: Record<string, string> = {
  query: "blue",
  navigate: "teal",
  switchdb: "violet",
}

export const MacrosModal = ({ opened, onClose, onReplay, recording, onStartRecording, onStopRecording, recordedSteps }: Props) => {
  const [macros, setMacros] = useState<Macro[]>([])
  const [saveName, setSaveName] = useState("")
  const [saving, setSaving] = useState(false)
  const [replayCount, setReplayCount] = useState(1)

  const loadMacros = async () => {
    try {
      const result = await butter.invoke("macros:list") as Macro[]
      setMacros(result ?? [])
    } catch { /* */ }
  }

  useEffect(() => {
    if (opened) loadMacros()
  }, [opened])

  const handleSave = async () => {
    if (!saveName.trim() || recordedSteps.length === 0) return
    try {
      await butter.invoke("macros:save", { name: saveName, steps: recordedSteps })
      setSaveName("")
      setSaving(false)
      onStopRecording()
      loadMacros()
      notifications.show({ message: "Macro saved", color: "teal", autoClose: 1500 })
    } catch (err: any) {
      notifications.show({ title: "Save failed", message: err.message, color: "red" })
    }
  }

  const handleDelete = async (id: string) => {
    await butter.invoke("macros:delete", id)
    loadMacros()
  }

  const handleExport = async (id: string) => {
    try {
      const json = await butter.invoke("macros:export", id) as string
      await navigator.clipboard.writeText(json)
      notifications.show({ message: "Macro copied to clipboard", autoClose: 1500 })
    } catch { /* */ }
  }

  const handleImport = async () => {
    try {
      const text = await navigator.clipboard.readText()
      await butter.invoke("macros:import", text)
      loadMacros()
      notifications.show({ message: "Macro imported", color: "teal", autoClose: 1500 })
    } catch (err: any) {
      notifications.show({ title: "Import failed", message: err.message, color: "red" })
    }
  }

  const handleReplay = (macro: Macro) => {
    for (let i = 0; i < replayCount; i++) {
      onReplay(macro.steps)
    }
    notifications.show({ message: `Playing "${macro.name}"${replayCount > 1 ? ` x${replayCount}` : ""}`, autoClose: 1500 })
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Macros" size="md">
      <Stack gap="sm">
        {/* Recording controls */}
        <Group gap="xs">
          {recording ? (
            <>
              <Button
                size="compact-sm"
                color="red"
                leftSection={<Square size={12} />}
                onClick={onStopRecording}
                styles={{ root: { fontSize: 11 } }}
              >
                Stop ({recordedSteps.length} steps)
              </Button>
              {recordedSteps.length > 0 && !saving && (
                <Button
                  size="compact-sm"
                  variant="light"
                  onClick={() => setSaving(true)}
                  styles={{ root: { fontSize: 11 } }}
                >
                  Save
                </Button>
              )}
            </>
          ) : (
            <Button
              size="compact-sm"
              color="red"
              variant="light"
              leftSection={<Circle size={12} />}
              onClick={onStartRecording}
              styles={{ root: { fontSize: 11 } }}
            >
              Record
            </Button>
          )}
          <Button
            size="compact-sm"
            variant="subtle"
            color="gray"
            leftSection={<Upload size={12} />}
            onClick={handleImport}
            styles={{ root: { fontSize: 11 } }}
          >
            Import
          </Button>
          <NumberInput
            size="xs"
            value={replayCount}
            onChange={(v) => setReplayCount(Number(v) || 1)}
            min={1}
            max={100}
            w={60}
            styles={{ input: { fontSize: 11, height: 24, minHeight: 24, textAlign: "center" } }}
          />
          <Text size="xs" c="dimmed" style={{ fontSize: 10 }}>repeats</Text>
        </Group>

        {saving && (
          <Group gap="xs">
            <TextInput
              size="xs"
              placeholder="Macro name"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave() }}
              autoFocus
              flex={1}
              styles={{ input: { fontSize: 11 } }}
            />
            <Button size="compact-xs" onClick={handleSave} disabled={!saveName.trim()} styles={{ root: { fontSize: 11 } }}>Save</Button>
            <Button size="compact-xs" variant="subtle" color="gray" onClick={() => setSaving(false)} styles={{ root: { fontSize: 11 } }}>Cancel</Button>
          </Group>
        )}

        {/* Recorded steps preview */}
        {recording && recordedSteps.length > 0 && (
          <Box style={{ backgroundColor: "var(--ambry-bg-surface)", borderRadius: "var(--mantine-radius-sm)", padding: 8 }}>
            <Text size="xs" c="dimmed" fw={500} mb={4} style={{ fontSize: 10 }}>Recorded Steps</Text>
            <Stack gap={2}>
              {recordedSteps.map((step, i) => (
                <Group key={i} gap={4}>
                  <Badge size="xs" color={stepColor[step.action] || "gray"} variant="light" radius="sm" style={{ fontSize: 9 }}>{step.action}</Badge>
                  <Text size="xs" truncate style={{ fontSize: 10, fontFamily: "var(--mantine-font-family-monospace)" }}>{stepLabel(step)}</Text>
                </Group>
              ))}
            </Stack>
          </Box>
        )}

        {/* Saved macros */}
        <ScrollArea.Autosize mah={300}>
          <Stack gap={2}>
            {macros.length === 0 ? (
              <Text size="xs" c="dimmed" ta="center" py="md">No saved macros</Text>
            ) : (
              macros.map((macro) => (
                <UnstyledButton
                  key={macro.id}
                  py={6}
                  px={8}
                  style={{ borderRadius: 6, display: "block", width: "100%" }}
                >
                  <Group justify="space-between" wrap="nowrap">
                    <Stack gap={1} style={{ minWidth: 0 }}>
                      <Text size="xs" fw={500} truncate style={{ fontSize: 12 }}>{macro.name}</Text>
                      <Text size="xs" c="dimmed" style={{ fontSize: 10 }}>{macro.steps.length} steps</Text>
                    </Stack>
                    <Group gap={4} style={{ flexShrink: 0 }}>
                      <Tooltip label="Replay">
                        <ActionIcon size="sm" color="blue" variant="light" onClick={() => handleReplay(macro)}>
                          <Play size={12} />
                        </ActionIcon>
                      </Tooltip>
                      <Menu position="bottom-end" shadow="md">
                        <Menu.Target>
                          <ActionIcon size="sm"><MoreVertical size={12} /></ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item leftSection={<Download size={12} />} onClick={() => handleExport(macro.id)} style={{ fontSize: 11 }}>Export</Menu.Item>
                          <Menu.Divider />
                          <Menu.Item color="red" leftSection={<Trash2 size={12} />} onClick={() => handleDelete(macro.id)} style={{ fontSize: 11 }}>Delete</Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Group>
                  </Group>
                </UnstyledButton>
              ))
            )}
          </Stack>
        </ScrollArea.Autosize>
      </Stack>
    </Modal>
  )
}
