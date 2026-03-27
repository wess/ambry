import { Modal, Tabs, Stack, Select, Switch, NumberInput, Text, Group, SegmentedControl, TextInput } from "@mantine/core"
import { useMantineColorScheme } from "@mantine/core"
import { useState, useEffect } from "react"
import { Palette, Code, Table2, Package } from "lucide-react"
import { invoke } from "../../butter"
import { PluginsTab } from "./plugins"

type Settings = {
  theme: "light" | "dark" | "auto"
  editorFontSize: number
  editorTabSize: number
  editorWordWrap: boolean
  editorLineNumbers: boolean
  gridRowHeight: "compact" | "normal" | "comfortable"
  gridPageSize: number
  gridShowRowNumbers: boolean
  gridAlternateRows: boolean
  dateFormat: string
  nullDisplay: string
}

const defaultSettings: Settings = {
  theme: "dark",
  editorFontSize: 13,
  editorTabSize: 2,
  editorWordWrap: true,
  editorLineNumbers: true,
  gridRowHeight: "compact",
  gridPageSize: 100,
  gridShowRowNumbers: true,
  gridAlternateRows: true,
  dateFormat: "ISO 8601",
  nullDisplay: "NULL",
}

type Props = {
  opened: boolean
  onClose: () => void
  settings: Settings
  onSettingsChange: (settings: Settings) => void
}

export type { Settings }
export { defaultSettings }

export const SettingsModal = ({ opened, onClose, settings, onSettingsChange }: Props) => {
  const { setColorScheme } = useMantineColorScheme()

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    const next = { ...settings, [key]: value }
    onSettingsChange(next)
    if (key === "theme") {
      setColorScheme(value as "light" | "dark" | "auto")
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Settings" size="lg">
      <Tabs defaultValue="appearance" styles={{ tab: { fontSize: 12 } }}>
        <Tabs.List mb="sm">
          <Tabs.Tab value="appearance" leftSection={<Palette size={13} />}>Appearance</Tabs.Tab>
          <Tabs.Tab value="editor" leftSection={<Code size={13} />}>Editor</Tabs.Tab>
          <Tabs.Tab value="grid" leftSection={<Table2 size={13} />}>Data Grid</Tabs.Tab>
          <Tabs.Tab value="plugins" leftSection={<Package size={13} />}>Plugins</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="appearance">
          <Stack gap="md">
            <div>
              <Text size="sm" fw={500} mb={4}>Theme</Text>
              <SegmentedControl
                value={settings.theme}
                onChange={(v) => update("theme", v as "light" | "dark" | "auto")}
                data={[
                  { value: "light", label: "Light" },
                  { value: "dark", label: "Dark" },
                  { value: "auto", label: "System" },
                ]}
                size="sm"
              />
            </div>
            <TextInput
              label="NULL Display"
              description="How NULL values appear in the grid"
              value={settings.nullDisplay}
              onChange={(e) => update("nullDisplay", e.target.value)}
              size="sm"
              styles={{ input: { fontFamily: "var(--mantine-font-family-monospace)", fontSize: 12 } }}
            />
            <TextInput
              label="Date Format"
              description="How date values are displayed"
              value={settings.dateFormat}
              onChange={(e) => update("dateFormat", e.target.value)}
              size="sm"
            />
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="editor">
          <Stack gap="md">
            <NumberInput
              label="Font Size"
              value={settings.editorFontSize}
              onChange={(v) => update("editorFontSize", Number(v))}
              min={10}
              max={24}
              size="sm"
            />
            <NumberInput
              label="Tab Size"
              value={settings.editorTabSize}
              onChange={(v) => update("editorTabSize", Number(v))}
              min={1}
              max={8}
              size="sm"
            />
            <Switch
              label="Word Wrap"
              checked={settings.editorWordWrap}
              onChange={(e) => update("editorWordWrap", e.currentTarget.checked)}
            />
            <Switch
              label="Line Numbers"
              checked={settings.editorLineNumbers}
              onChange={(e) => update("editorLineNumbers", e.currentTarget.checked)}
            />
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="grid">
          <Stack gap="md">
            <Select
              label="Row Height"
              value={settings.gridRowHeight}
              onChange={(v) => v && update("gridRowHeight", v as "compact" | "normal" | "comfortable")}
              data={[
                { value: "compact", label: "Compact" },
                { value: "normal", label: "Normal" },
                { value: "comfortable", label: "Comfortable" },
              ]}
              size="sm"
            />
            <NumberInput
              label="Default Page Size"
              value={settings.gridPageSize}
              onChange={(v) => update("gridPageSize", Number(v))}
              min={10}
              max={10000}
              step={50}
              size="sm"
            />
            <Switch
              label="Show Row Numbers"
              checked={settings.gridShowRowNumbers}
              onChange={(e) => update("gridShowRowNumbers", e.currentTarget.checked)}
            />
            <Switch
              label="Alternate Row Colors"
              checked={settings.gridAlternateRows}
              onChange={(e) => update("gridAlternateRows", e.currentTarget.checked)}
            />
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="plugins">
          <PluginsTab />
        </Tabs.Panel>
      </Tabs>
    </Modal>
  )
}
