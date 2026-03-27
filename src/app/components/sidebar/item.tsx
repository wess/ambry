import { Group, Text, UnstyledButton, Box } from "@mantine/core"
import { Table2, Eye } from "lucide-react"
import type { TableInfo } from "../../types"

type Props = {
  table: TableInfo
  active: boolean
  selected?: boolean
  onClick: (e: React.MouseEvent) => void
  onContextMenu?: (e: React.MouseEvent) => void
}

export const TableItem = ({ table, active, selected, onClick, onContextMenu }: Props) => (
  <UnstyledButton
    onClick={onClick}
    onContextMenu={onContextMenu}
    py={5}
    px={8}
    style={{
      borderRadius: 6,
      backgroundColor: selected
        ? "var(--mantine-color-blue-light)"
        : active
          ? "var(--ambry-border)"
          : undefined,
      width: "100%",
      display: "block",
    }}
  >
    <Group gap={8} wrap="nowrap">
      <Box style={{ color: active ? "var(--mantine-color-blue-4)" : selected ? "var(--mantine-color-blue-4)" : "var(--ambry-text-muted)", flexShrink: 0 }}>
        {table.type === "view" ? <Eye size={13} /> : <Table2 size={13} />}
      </Box>
      <Text
        size="xs"
        truncate
        flex={1}
        fw={active || selected ? 500 : 400}
        style={{ color: active || selected ? "var(--mantine-color-text)" : "var(--ambry-text-muted)" }}
      >
        {table.name}
      </Text>
      {table.rowCount != null && (
        <Text size="xs" c="dimmed" style={{ fontVariantNumeric: "tabular-nums", fontSize: 10 }}>
          {table.rowCount.toLocaleString()}
        </Text>
      )}
    </Group>
  </UnstyledButton>
)
