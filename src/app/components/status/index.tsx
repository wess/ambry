import { Group, Text, Box } from "@mantine/core"

type Props = {
  connectionName: string
  connectionType: string
  connectionColor?: string
  table?: string | null
  rowCount?: number
  executionTime?: number
}

const typeLabels: Record<string, string> = {
  postgres: "PostgreSQL",
  sqlite: "SQLite",
  mysql: "MySQL",
}

export const StatusBar = ({ connectionName, connectionType, connectionColor, table, rowCount }: Props) => (
  <Group
    gap="md"
    px="sm"
    h="100%"
    align="center"
    style={{ fontSize: 11 }}
  >
    <Group gap={6}>
      <Box
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          backgroundColor: connectionColor || "var(--mantine-color-blue-6)",
          flexShrink: 0,
        }}
      />
      <Text size="xs" c="dimmed" style={{ fontSize: 11 }}>
        {connectionName}
      </Text>
      <Text size="xs" c="dimmed" style={{ fontSize: 10, opacity: 0.5 }}>
        {typeLabels[connectionType] || connectionType}
      </Text>
    </Group>
    {table && (
      <>
        <Text size="xs" c="dimmed" style={{ fontSize: 10, opacity: 0.3 }}>·</Text>
        <Text size="xs" c="dimmed" style={{ fontSize: 11, fontFamily: "var(--mantine-font-family-monospace)" }}>
          {table}
        </Text>
      </>
    )}
    {rowCount != null && (
      <Text size="xs" c="dimmed" ml="auto" style={{ fontSize: 11, fontVariantNumeric: "tabular-nums" }}>
        {rowCount.toLocaleString()} rows
      </Text>
    )}
  </Group>
)
