import { Table, Badge, Text } from "@mantine/core"
import type { IndexInfo } from "../../types"

const toArray = (v: unknown): string[] =>
  Array.isArray(v) ? v : typeof v === "string" ? [v] : []

export const IndexesTab = ({ indexes }: { indexes: IndexInfo[] }) => (
  <Table highlightOnHover withColumnBorders style={{ fontSize: 12 }}>
    <Table.Thead style={{ backgroundColor: "var(--ambry-bg-subtle)" }}>
      <Table.Tr style={{ borderBottom: "1px solid var(--ambry-border)" }}>
        <Table.Th style={{ padding: "5px 10px", fontSize: 11, fontWeight: 600 }}>Name</Table.Th>
        <Table.Th style={{ padding: "5px 10px", fontSize: 11, fontWeight: 600 }}>Columns</Table.Th>
        <Table.Th style={{ padding: "5px 10px", fontSize: 11, fontWeight: 600 }}>Type</Table.Th>
        <Table.Th style={{ padding: "5px 10px", fontSize: 11, fontWeight: 600 }}>Unique</Table.Th>
      </Table.Tr>
    </Table.Thead>
    <Table.Tbody>
      {indexes.map((idx) => (
        <Table.Tr key={idx.name}>
          <Table.Td style={{ padding: "4px 10px" }}>
            <Text size="xs" fw={500} style={{ fontFamily: "var(--mantine-font-family-monospace)", fontSize: 12 }}>
              {idx.name}
            </Text>
          </Table.Td>
          <Table.Td style={{ padding: "4px 10px" }}>
            <Text size="xs" style={{ fontFamily: "var(--mantine-font-family-monospace)", fontSize: 11 }}>
              {toArray(idx.columns).join(", ")}
            </Text>
          </Table.Td>
          <Table.Td style={{ padding: "4px 10px" }}>
            <Badge size="xs" variant="light" radius="sm" style={{ fontSize: 10 }}>{idx.type}</Badge>
          </Table.Td>
          <Table.Td style={{ padding: "4px 10px" }}>
            {idx.unique && <Badge size="xs" color="teal" variant="light" radius="sm" style={{ fontSize: 10 }}>unique</Badge>}
          </Table.Td>
        </Table.Tr>
      ))}
    </Table.Tbody>
  </Table>
)
