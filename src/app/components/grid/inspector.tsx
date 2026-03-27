import { Stack, Text, Group, Box, ScrollArea, TextInput, Badge, ActionIcon, Tooltip, CopyButton } from "@mantine/core"
import { X, Copy, Check } from "lucide-react"
import { useState, useMemo } from "react"

type Props = {
  row: Record<string, unknown> | null
  columns: string[]
  columnTypes?: Record<string, string>
  onClose: () => void
}

const formatValue = (v: unknown): string => {
  if (v === null || v === undefined) return "NULL"
  if (typeof v === "object") return JSON.stringify(v, null, 2)
  return String(v)
}

export const CellInspector = ({ row, columns, columnTypes, onClose }: Props) => {
  const [search, setSearch] = useState("")

  const filtered = useMemo(
    () => columns.filter((c) => c.toLowerCase().includes(search.toLowerCase())),
    [columns, search],
  )

  if (!row) return null

  return (
    <Box
      style={{
        width: 280,
        borderLeft: "1px solid var(--ambry-border)",
        backgroundColor: "var(--ambry-bg-surface)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <Group px="sm" py={6} justify="space-between" style={{ borderBottom: "1px solid var(--ambry-border)", flex: "0 0 auto" }}>
        <Text size="xs" fw={500} style={{ fontSize: 11 }}>Inspector</Text>
        <ActionIcon size="xs" onClick={onClose}><X size={13} /></ActionIcon>
      </Group>
      <Box px={8} py={4}>
        <TextInput
          size="xs"
          placeholder="Filter columns..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          styles={{ input: { fontSize: 11, height: 24, minHeight: 24, border: "none", backgroundColor: "var(--ambry-bg-muted)" } }}
        />
      </Box>
      <ScrollArea flex={1} scrollbarSize={4}>
        <Stack gap={0} px={8} pb={8}>
          {filtered.map((col) => {
            const value = row[col]
            const isNull = value === null || value === undefined
            const display = formatValue(value)
            const type = columnTypes?.[col]

            return (
              <Box
                key={col}
                py={6}
                style={{ borderBottom: "1px solid var(--ambry-bg-muted)" }}
              >
                <Group gap={4} mb={2} justify="space-between" wrap="nowrap">
                  <Group gap={4} wrap="nowrap" style={{ minWidth: 0 }}>
                    <Text size="xs" fw={600} truncate style={{ fontSize: 11, fontFamily: "var(--mantine-font-family-monospace)" }}>
                      {col}
                    </Text>
                    {type && (
                      <Badge size="xs" variant="light" color="violet" radius="sm" style={{ fontSize: 8, flexShrink: 0 }}>
                        {type}
                      </Badge>
                    )}
                  </Group>
                  <CopyButton value={display}>
                    {({ copied, copy }) => (
                      <Tooltip label={copied ? "Copied" : "Copy"}>
                        <ActionIcon size={14} variant="subtle" color={copied ? "teal" : "gray"} onClick={copy}>
                          {copied ? <Check size={10} /> : <Copy size={10} />}
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </CopyButton>
                </Group>
                {isNull ? (
                  <Badge size="xs" variant="outline" color="gray" radius="sm" style={{ fontWeight: 400, fontSize: 9 }}>
                    NULL
                  </Badge>
                ) : typeof value === "object" ? (
                  <Text
                    size="xs"
                    style={{
                      fontFamily: "var(--mantine-font-family-monospace)",
                      fontSize: 11,
                      lineHeight: 1.4,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                      backgroundColor: "var(--ambry-bg-subtle)",
                      borderRadius: 4,
                      padding: "4px 6px",
                      maxHeight: 150,
                      overflow: "auto",
                    }}
                  >
                    {display}
                  </Text>
                ) : (
                  <Text
                    size="xs"
                    style={{
                      fontFamily: "var(--mantine-font-family-monospace)",
                      fontSize: 11,
                      lineHeight: 1.4,
                      wordBreak: "break-all",
                    }}
                  >
                    {display}
                  </Text>
                )}
              </Box>
            )
          })}
        </Stack>
      </ScrollArea>
    </Box>
  )
}
