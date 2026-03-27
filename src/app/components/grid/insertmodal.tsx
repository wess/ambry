import { Modal, Stack, TextInput, NumberInput, Checkbox, Group, Button, Text, Badge, ScrollArea, ActionIcon, Tooltip, Menu, Box } from "@mantine/core"
import { useState, useEffect } from "react"
import { Clock, Calendar, Hash, Sparkles, RotateCcw } from "lucide-react"
import { useTableStructure } from "../../hooks"
import type { ColumnInfo } from "../../types"

type Props = {
  opened: boolean
  onClose: () => void
  onInsert: (row: Record<string, unknown>) => void
  table: string
}

const isNumericType = (t: string) =>
  /int|serial|float|double|decimal|numeric|real|money|bigint|smallint/i.test(t)

const isBooleanType = (t: string) =>
  /bool/i.test(t)

const isDateType = (t: string) =>
  /date|time|timestamp/i.test(t)

const isJsonType = (t: string) =>
  /json/i.test(t)

const nowIso = () => new Date().toISOString()
const todayIso = () => new Date().toISOString().split("T")[0]
const uuid = () => crypto.randomUUID()

type FieldValue = {
  value: string
  isNull: boolean
  useDefault: boolean
}

const defaultFieldValue = (col: ColumnInfo): FieldValue => ({
  value: "",
  isNull: false,
  useDefault: col.defaultValue !== null,
})

export const InsertRowModal = ({ opened, onClose, onInsert, table }: Props) => {
  const { data: structure } = useTableStructure(opened ? table : null)
  const [fields, setFields] = useState<Record<string, FieldValue>>({})

  useEffect(() => {
    if (structure && opened) {
      const initial: Record<string, FieldValue> = {}
      for (const col of structure.columns) {
        initial[col.name] = defaultFieldValue(col)
      }
      setFields(initial)
    }
  }, [structure, opened])

  const updateField = (name: string, patch: Partial<FieldValue>) => {
    setFields((prev) => ({ ...prev, [name]: { ...prev[name], ...patch } }))
  }

  const handleSubmit = () => {
    if (!structure) return

    const row: Record<string, unknown> = {}
    for (const col of structure.columns) {
      const field = fields[col.name]
      if (!field || field.useDefault) continue
      if (field.isNull) {
        row[col.name] = null
        continue
      }
      const v = field.value.trim()
      if (!v && col.nullable) continue
      if (!v) continue

      if (isNumericType(col.dataType)) {
        row[col.name] = Number(v)
      } else if (isBooleanType(col.dataType)) {
        row[col.name] = v === "true" || v === "1" || v === "t"
      } else {
        row[col.name] = v
      }
    }

    onInsert(row)
    onClose()
  }

  const columns = structure?.columns ?? []

  return (
    <Modal opened={opened} onClose={onClose} title={`Insert into ${table}`} size="lg">
      <ScrollArea.Autosize mah="60vh">
        <Stack gap={8} pr="xs">
          {columns.map((col) => {
            const field = fields[col.name] ?? { value: "", isNull: false, useDefault: false }
            const disabled = field.isNull || field.useDefault

            return (
              <Box key={col.name} style={{ borderBottom: "1px solid var(--ambry-bg-muted)", paddingBottom: 8 }}>
                <Group gap={6} mb={4} justify="space-between">
                  <Group gap={6}>
                    <Text size="xs" fw={600} style={{ fontFamily: "var(--mantine-font-family-monospace)", fontSize: 12 }}>
                      {col.name}
                    </Text>
                    <Badge size="xs" variant="light" color="violet" radius="sm" style={{ fontSize: 9 }}>
                      {col.dataType}
                    </Badge>
                    {col.isPrimaryKey && (
                      <Badge size="xs" color="yellow" variant="light" radius="sm" style={{ fontSize: 9 }}>PK</Badge>
                    )}
                    {col.nullable && (
                      <Badge size="xs" color="gray" variant="outline" radius="sm" style={{ fontSize: 9 }}>nullable</Badge>
                    )}
                  </Group>
                  <Group gap={4}>
                    {col.nullable && (
                      <Tooltip label={field.isNull ? "Set value" : "Set NULL"}>
                        <Button
                          size="compact-xs"
                          variant={field.isNull ? "light" : "subtle"}
                          color={field.isNull ? "orange" : "gray"}
                          onClick={() => updateField(col.name, { isNull: !field.isNull, useDefault: false })}
                          styles={{ root: { fontSize: 9, height: 20, padding: "0 6px" } }}
                        >
                          NULL
                        </Button>
                      </Tooltip>
                    )}
                    {col.defaultValue !== null && (
                      <Tooltip label={`Default: ${col.defaultValue}`}>
                        <Button
                          size="compact-xs"
                          variant={field.useDefault ? "light" : "subtle"}
                          color={field.useDefault ? "blue" : "gray"}
                          onClick={() => updateField(col.name, { useDefault: !field.useDefault, isNull: false })}
                          styles={{ root: { fontSize: 9, height: 20, padding: "0 6px" } }}
                        >
                          DEFAULT
                        </Button>
                      </Tooltip>
                    )}

                    {/* Quick value shortcuts */}
                    <Menu position="bottom-end" shadow="md">
                      <Menu.Target>
                        <Tooltip label="Quick fill">
                          <ActionIcon size={18} variant="subtle" color="gray">
                            <Sparkles size={11} />
                          </ActionIcon>
                        </Tooltip>
                      </Menu.Target>
                      <Menu.Dropdown>
                        {isDateType(col.dataType) && (
                          <>
                            <Menu.Item
                              leftSection={<Clock size={12} />}
                              onClick={() => updateField(col.name, { value: nowIso(), isNull: false, useDefault: false })}
                              style={{ fontSize: 11 }}
                            >
                              Now (timestamp)
                            </Menu.Item>
                            <Menu.Item
                              leftSection={<Calendar size={12} />}
                              onClick={() => updateField(col.name, { value: todayIso(), isNull: false, useDefault: false })}
                              style={{ fontSize: 11 }}
                            >
                              Today (date)
                            </Menu.Item>
                          </>
                        )}
                        <Menu.Item
                          leftSection={<Hash size={12} />}
                          onClick={() => updateField(col.name, { value: uuid(), isNull: false, useDefault: false })}
                          style={{ fontSize: 11 }}
                        >
                          UUID
                        </Menu.Item>
                        {isNumericType(col.dataType) && (
                          <Menu.Item
                            leftSection={<RotateCcw size={12} />}
                            onClick={() => updateField(col.name, { value: "0", isNull: false, useDefault: false })}
                            style={{ fontSize: 11 }}
                          >
                            Zero
                          </Menu.Item>
                        )}
                        {isBooleanType(col.dataType) && (
                          <>
                            <Menu.Item onClick={() => updateField(col.name, { value: "true", isNull: false, useDefault: false })} style={{ fontSize: 11 }}>
                              true
                            </Menu.Item>
                            <Menu.Item onClick={() => updateField(col.name, { value: "false", isNull: false, useDefault: false })} style={{ fontSize: 11 }}>
                              false
                            </Menu.Item>
                          </>
                        )}
                        {isJsonType(col.dataType) && (
                          <>
                            <Menu.Item onClick={() => updateField(col.name, { value: "{}", isNull: false, useDefault: false })} style={{ fontSize: 11 }}>
                              Empty object {"{}"}
                            </Menu.Item>
                            <Menu.Item onClick={() => updateField(col.name, { value: "[]", isNull: false, useDefault: false })} style={{ fontSize: 11 }}>
                              Empty array {"[]"}
                            </Menu.Item>
                          </>
                        )}
                      </Menu.Dropdown>
                    </Menu>
                  </Group>
                </Group>

                {field.isNull ? (
                  <Text size="xs" c="dimmed" fs="italic" py={4} px={8} style={{ backgroundColor: "var(--ambry-bg-subtle)", borderRadius: 4 }}>
                    NULL
                  </Text>
                ) : field.useDefault ? (
                  <Text size="xs" c="dimmed" py={4} px={8} style={{ backgroundColor: "var(--ambry-bg-subtle)", borderRadius: 4, fontFamily: "var(--mantine-font-family-monospace)", fontSize: 11 }}>
                    {col.defaultValue}
                  </Text>
                ) : isBooleanType(col.dataType) ? (
                  <Checkbox
                    size="xs"
                    checked={field.value === "true" || field.value === "1"}
                    onChange={(e) => updateField(col.name, { value: e.currentTarget.checked ? "true" : "false" })}
                    label={field.value === "true" || field.value === "1" ? "true" : "false"}
                    mt={2}
                  />
                ) : isNumericType(col.dataType) ? (
                  <TextInput
                    size="xs"
                    value={field.value}
                    onChange={(e) => updateField(col.name, { value: e.target.value })}
                    placeholder={col.nullable ? "NULL" : "0"}
                    type="number"
                    styles={{ input: { fontFamily: "var(--mantine-font-family-monospace)", fontSize: 12 } }}
                  />
                ) : (
                  <TextInput
                    size="xs"
                    value={field.value}
                    onChange={(e) => updateField(col.name, { value: e.target.value })}
                    placeholder={col.nullable ? "NULL" : ""}
                    styles={{ input: { fontFamily: "var(--mantine-font-family-monospace)", fontSize: 12 } }}
                  />
                )}
              </Box>
            )
          })}
        </Stack>
      </ScrollArea.Autosize>

      <Group justify="flex-end" mt="md" gap="xs">
        <Button variant="subtle" color="gray" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" onClick={handleSubmit}>Insert Row</Button>
      </Group>
    </Modal>
  )
}
