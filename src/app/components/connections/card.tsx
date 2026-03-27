import { Card, Group, Text, Badge, ActionIcon, Menu, Stack, Box } from "@mantine/core"
import { Database, MoreVertical, Trash2, Pencil, Zap } from "lucide-react"
import type { Connection } from "../../types"

type Props = {
  connection: Connection
  onConnect: (id: string) => void
  onEdit: (connection: Connection) => void
  onDelete: (id: string) => void
  connecting?: boolean
}

const typeLabels: Record<string, string> = {
  postgres: "PostgreSQL",
  sqlite: "SQLite",
  mysql: "MySQL",
}

const typeColors: Record<string, string> = {
  postgres: "blue",
  sqlite: "teal",
  mysql: "orange",
}

export const ConnectionCard = ({ connection, onConnect, onEdit, onDelete, connecting }: Props) => {
  const accent = connection.color || `var(--mantine-color-${typeColors[connection.type] || "blue"}-6)`

  return (
    <Card
      shadow="none"
      padding="md"
      radius="md"
      withBorder
      style={{
        cursor: "pointer",
        borderColor: "var(--ambry-border)",
        position: "relative",
        overflow: "hidden",
      }}
      onClick={() => onConnect(connection.id)}
    >
      {/* Accent top bar */}
      <Box
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: accent,
          borderRadius: "var(--mantine-radius-md) var(--mantine-radius-md) 0 0",
        }}
      />

      <Stack gap="sm">
        <Group justify="space-between" wrap="nowrap">
          <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
            <Box
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: `color-mix(in srgb, ${accent} 15%, transparent)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Database size={16} style={{ color: accent }} />
            </Box>
            <Stack gap={2} style={{ minWidth: 0 }}>
              <Text size="sm" fw={600} truncate>{connection.name}</Text>
              <Text size="xs" c="dimmed" truncate>
                {connection.type === "sqlite"
                  ? connection.filepath || connection.database
                  : `${connection.host}:${connection.port}`}
              </Text>
            </Stack>
          </Group>
          <Menu position="bottom-end" withinPortal shadow="lg">
            <Menu.Target>
              <ActionIcon
                size="sm"
                onClick={(e) => e.stopPropagation()}
                style={{ opacity: 0.5 }}
              >
                <MoreVertical size={14} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<Pencil size={14} />} onClick={(e) => { e.stopPropagation(); onEdit(connection) }}>
                Edit
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item color="red" leftSection={<Trash2 size={14} />} onClick={(e) => { e.stopPropagation(); onDelete(connection.id) }}>
                Delete
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>

        <Group gap="xs">
          <Badge
            size="xs"
            variant="light"
            color={typeColors[connection.type] || "gray"}
            radius="sm"
          >
            {typeLabels[connection.type] || connection.type}
          </Badge>
          {connection.database && connection.type !== "sqlite" && (
            <Badge size="xs" variant="dot" color="gray" radius="sm">
              {connection.database}
            </Badge>
          )}
        </Group>
      </Stack>
    </Card>
  )
}
