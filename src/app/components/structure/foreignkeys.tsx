import { Table, Text, Badge } from "@mantine/core"
import type { ForeignKeyInfo } from "../../types"

const toArray = (v: unknown): string[] =>
  Array.isArray(v) ? v : typeof v === "string" ? [v] : []

export const ForeignKeysTab = ({ foreignKeys }: { foreignKeys: ForeignKeyInfo[] }) => (
  <Table highlightOnHover withColumnBorders style={{ fontSize: 12 }}>
    <Table.Thead style={{ backgroundColor: "var(--ambry-bg-subtle)" }}>
      <Table.Tr style={{ borderBottom: "1px solid var(--ambry-border)" }}>
        <Table.Th style={{ padding: "5px 10px", fontSize: 11, fontWeight: 600 }}>Name</Table.Th>
        <Table.Th style={{ padding: "5px 10px", fontSize: 11, fontWeight: 600 }}>Columns</Table.Th>
        <Table.Th style={{ padding: "5px 10px", fontSize: 11, fontWeight: 600 }}>References</Table.Th>
        <Table.Th style={{ padding: "5px 10px", fontSize: 11, fontWeight: 600 }}>On Delete</Table.Th>
        <Table.Th style={{ padding: "5px 10px", fontSize: 11, fontWeight: 600 }}>On Update</Table.Th>
      </Table.Tr>
    </Table.Thead>
    <Table.Tbody>
      {foreignKeys.map((fk) => (
        <Table.Tr key={fk.name}>
          <Table.Td style={{ padding: "4px 10px" }}>
            <Text size="xs" fw={500} style={{ fontFamily: "var(--mantine-font-family-monospace)", fontSize: 12 }}>
              {fk.name}
            </Text>
          </Table.Td>
          <Table.Td style={{ padding: "4px 10px" }}>
            <Text size="xs" style={{ fontFamily: "var(--mantine-font-family-monospace)", fontSize: 11 }}>
              {toArray(fk.columns).join(", ")}
            </Text>
          </Table.Td>
          <Table.Td style={{ padding: "4px 10px" }}>
            <Text size="xs" style={{ fontFamily: "var(--mantine-font-family-monospace)", fontSize: 11 }}>
              {fk.referencedTable}({toArray(fk.referencedColumns).join(", ")})
            </Text>
          </Table.Td>
          <Table.Td style={{ padding: "4px 10px" }}>
            <Badge size="xs" variant="light" color="orange" radius="sm" style={{ fontSize: 9 }}>
              {fk.onDelete}
            </Badge>
          </Table.Td>
          <Table.Td style={{ padding: "4px 10px" }}>
            <Badge size="xs" variant="light" color="orange" radius="sm" style={{ fontSize: 9 }}>
              {fk.onUpdate}
            </Badge>
          </Table.Td>
        </Table.Tr>
      ))}
    </Table.Tbody>
  </Table>
)
