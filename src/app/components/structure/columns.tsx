import { Table, Badge, Text, Group } from "@mantine/core"
import { Key } from "lucide-react"
import type { ColumnInfo } from "../../types"

export const ColumnsTab = ({ columns }: { columns: ColumnInfo[] }) => (
  <Table highlightOnHover withColumnBorders style={{ fontSize: 12 }}>
    <Table.Thead style={{ backgroundColor: "var(--ambry-bg-subtle)" }}>
      <Table.Tr style={{ borderBottom: "1px solid var(--ambry-border)" }}>
        <Table.Th style={{ padding: "5px 10px", fontSize: 11, fontWeight: 600 }}>Name</Table.Th>
        <Table.Th style={{ padding: "5px 10px", fontSize: 11, fontWeight: 600 }}>Type</Table.Th>
        <Table.Th style={{ padding: "5px 10px", fontSize: 11, fontWeight: 600 }}>Nullable</Table.Th>
        <Table.Th style={{ padding: "5px 10px", fontSize: 11, fontWeight: 600 }}>Default</Table.Th>
        <Table.Th style={{ padding: "5px 10px", fontSize: 11, fontWeight: 600 }}>Comment</Table.Th>
      </Table.Tr>
    </Table.Thead>
    <Table.Tbody>
      {columns.map((col) => (
        <Table.Tr key={col.name}>
          <Table.Td style={{ padding: "4px 10px" }}>
            <Group gap={6} wrap="nowrap">
              {col.isPrimaryKey && (
                <Key size={11} style={{ color: "var(--mantine-color-yellow-5)", flexShrink: 0 }} />
              )}
              <Text size="xs" fw={500} style={{ fontFamily: "var(--mantine-font-family-monospace)", fontSize: 12 }}>
                {col.name}
              </Text>
            </Group>
          </Table.Td>
          <Table.Td style={{ padding: "4px 10px" }}>
            <Badge size="xs" variant="light" color="violet" radius="sm" style={{ fontSize: 10, fontWeight: 500 }}>
              {col.dataType}
            </Badge>
          </Table.Td>
          <Table.Td style={{ padding: "4px 10px" }}>
            <Text size="xs" c={col.nullable ? "dimmed" : undefined} style={{ fontSize: 11 }}>
              {col.nullable ? "yes" : "no"}
            </Text>
          </Table.Td>
          <Table.Td style={{ padding: "4px 10px" }}>
            <Text size="xs" c="dimmed" style={{ fontFamily: "var(--mantine-font-family-monospace)", fontSize: 11 }}>
              {col.defaultValue ?? "—"}
            </Text>
          </Table.Td>
          <Table.Td style={{ padding: "4px 10px" }}>
            <Text size="xs" c="dimmed" style={{ fontSize: 11 }}>{col.comment ?? "—"}</Text>
          </Table.Td>
        </Table.Tr>
      ))}
    </Table.Tbody>
  </Table>
)
