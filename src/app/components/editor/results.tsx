import { Table, ScrollArea, Text, Alert, Stack, Badge, Box } from "@mantine/core"
import { AlertCircle, CheckCircle } from "lucide-react"
import type { QueryResult } from "../../types"

type Props = {
  result: QueryResult | null
}

const isNull = (v: unknown) => v === null || v === undefined

export const QueryResults = ({ result }: Props) => {
  if (!result) {
    return (
      <Stack align="center" justify="center" h="100%" gap={4}>
        <Text size="xs" c="dimmed">Run a query to see results</Text>
      </Stack>
    )
  }

  if (result.error) {
    return (
      <Box p="sm">
        <Alert
          color="red"
          icon={<AlertCircle size={15} />}
          radius="md"
          styles={{
            message: { fontFamily: "var(--mantine-font-family-monospace)", fontSize: 12 },
          }}
        >
          {result.error}
        </Alert>
      </Box>
    )
  }

  if (result.columns.length === 0) {
    return (
      <Box p="sm">
        <Alert
          color="teal"
          icon={<CheckCircle size={15} />}
          radius="md"
        >
          Query executed. {result.rowsAffected} row(s) affected.
        </Alert>
      </Box>
    )
  }

  return (
    <ScrollArea h="100%" type="auto" scrollbarSize={6}>
      <Table
        highlightOnHover
        withColumnBorders
        style={{ fontSize: 12, borderCollapse: "collapse" }}
      >
        <Table.Thead style={{ position: "sticky", top: 0, zIndex: 1, backgroundColor: "var(--ambry-bg-subtle)" }}>
          <Table.Tr style={{ borderBottom: "1px solid var(--ambry-border)" }}>
            {result.columns.map((col) => (
              <Table.Th
                key={col}
                style={{
                  whiteSpace: "nowrap",
                  padding: "5px 10px",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--ambry-text-muted)",
                }}
              >
                {col}
              </Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {result.rows.map((row, i) => (
            <Table.Tr key={i}>
              {result.columns.map((col) => (
                <Table.Td
                  key={col}
                  style={{
                    maxWidth: 280,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    padding: "3px 10px",
                    fontFamily: "var(--mantine-font-family-monospace)",
                    fontSize: 12,
                  }}
                >
                  {isNull(row[col]) ? (
                    <Badge size="xs" variant="outline" color="gray" radius="sm" style={{ fontWeight: 400, fontSize: 9 }}>
                      null
                    </Badge>
                  ) : typeof row[col] === "object" ? (
                    <Text size="xs" c="dimmed" style={{ fontFamily: "var(--mantine-font-family-monospace)", fontSize: 12 }}>
                      {JSON.stringify(row[col])}
                    </Text>
                  ) : (
                    String(row[col])
                  )}
                </Table.Td>
              ))}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </ScrollArea>
  )
}
