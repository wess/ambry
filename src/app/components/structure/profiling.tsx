import { Table, Text, Badge, Progress, Group, Stack, Loader, Center, Box, Tooltip } from "@mantine/core"
import { useState, useEffect } from "react"
import { invoke } from "../../butter"

type ColumnProfile = {
  column: string
  dataType: string
  totalRows: number
  nullCount: number
  nullPercent: number
  distinctCount: number
  minValue: string | null
  maxValue: string | null
  avgValue: string | null
  topValues: { value: string; count: number }[]
}

type Props = {
  table: string
}

export const ProfilingTab = ({ table }: Props) => {
  const [profiles, setProfiles] = useState<ColumnProfile[] | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setProfiles(null)
    setLoading(true)
    invoke("table:profile" as any, { table })
      .then((result) => setProfiles(result as any))
      .catch(() => setProfiles([]))
      .finally(() => setLoading(false))
  }, [table])

  if (loading) return <Center p="xl"><Loader size="sm" /></Center>
  if (!profiles || profiles.length === 0) return <Text size="xs" c="dimmed" p="md">No profile data</Text>

  const totalRows = profiles[0]?.totalRows ?? 0

  return (
    <Table highlightOnHover withColumnBorders style={{ fontSize: 12 }}>
      <Table.Thead style={{ backgroundColor: "var(--ambry-bg-subtle)" }}>
        <Table.Tr style={{ borderBottom: "1px solid var(--ambry-border)" }}>
          <Table.Th style={{ padding: "5px 10px", fontSize: 11, fontWeight: 600 }}>Column</Table.Th>
          <Table.Th style={{ padding: "5px 10px", fontSize: 11, fontWeight: 600 }}>Type</Table.Th>
          <Table.Th style={{ padding: "5px 10px", fontSize: 11, fontWeight: 600 }}>Nulls</Table.Th>
          <Table.Th style={{ padding: "5px 10px", fontSize: 11, fontWeight: 600 }}>Distinct</Table.Th>
          <Table.Th style={{ padding: "5px 10px", fontSize: 11, fontWeight: 600 }}>Min</Table.Th>
          <Table.Th style={{ padding: "5px 10px", fontSize: 11, fontWeight: 600 }}>Max</Table.Th>
          <Table.Th style={{ padding: "5px 10px", fontSize: 11, fontWeight: 600 }}>Avg</Table.Th>
          <Table.Th style={{ padding: "5px 10px", fontSize: 11, fontWeight: 600, minWidth: 120 }}>Top Values</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {profiles.map((p) => (
          <Table.Tr key={p.column}>
            <Table.Td style={{ padding: "4px 10px" }}>
              <Text size="xs" fw={500} style={{ fontFamily: "var(--mantine-font-family-monospace)", fontSize: 12 }}>
                {p.column}
              </Text>
            </Table.Td>
            <Table.Td style={{ padding: "4px 10px" }}>
              <Badge size="xs" variant="light" color="violet" radius="sm" style={{ fontSize: 10 }}>
                {p.dataType}
              </Badge>
            </Table.Td>
            <Table.Td style={{ padding: "4px 10px" }}>
              <Tooltip label={`${p.nullCount.toLocaleString()} of ${totalRows.toLocaleString()}`}>
                <Stack gap={2}>
                  <Text size="xs" style={{ fontSize: 11, fontVariantNumeric: "tabular-nums" }}>
                    {p.nullPercent}%
                  </Text>
                  <Progress
                    value={p.nullPercent}
                    size={3}
                    color={p.nullPercent > 50 ? "red" : p.nullPercent > 10 ? "yellow" : "teal"}
                    radius="xl"
                  />
                </Stack>
              </Tooltip>
            </Table.Td>
            <Table.Td style={{ padding: "4px 10px" }}>
              <Text size="xs" style={{ fontSize: 11, fontVariantNumeric: "tabular-nums" }}>
                {p.distinctCount.toLocaleString()}
              </Text>
            </Table.Td>
            <Table.Td style={{ padding: "4px 10px" }}>
              <Text size="xs" c="dimmed" style={{ fontFamily: "var(--mantine-font-family-monospace)", fontSize: 11 }} truncate>
                {p.minValue ?? "—"}
              </Text>
            </Table.Td>
            <Table.Td style={{ padding: "4px 10px" }}>
              <Text size="xs" c="dimmed" style={{ fontFamily: "var(--mantine-font-family-monospace)", fontSize: 11 }} truncate>
                {p.maxValue ?? "—"}
              </Text>
            </Table.Td>
            <Table.Td style={{ padding: "4px 10px" }}>
              <Text size="xs" c="dimmed" style={{ fontFamily: "var(--mantine-font-family-monospace)", fontSize: 11 }}>
                {p.avgValue ?? "—"}
              </Text>
            </Table.Td>
            <Table.Td style={{ padding: "4px 10px" }}>
              <Group gap={3} wrap="nowrap">
                {p.topValues.slice(0, 3).map((tv, i) => (
                  <Tooltip key={i} label={`${tv.value}: ${tv.count}`}>
                    <Badge size="xs" variant="dot" color="gray" radius="sm" style={{ fontSize: 9, maxWidth: 80 }}>
                      {tv.value.length > 10 ? tv.value.slice(0, 10) + "…" : tv.value}
                    </Badge>
                  </Tooltip>
                ))}
              </Group>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  )
}
