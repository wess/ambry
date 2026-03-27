import { Tabs, Center, Loader, Text, Stack } from "@mantine/core"
import { Columns, Hash, Link, FileCode, BarChart3 } from "lucide-react"
import { ColumnsTab } from "./columns"
import { IndexesTab } from "./indexes"
import { ForeignKeysTab } from "./foreignkeys"
import { DdlTab } from "./ddl"
import { ProfilingTab } from "./profiling"
import { useTableStructure, useTableDdl } from "../../hooks"

type Props = {
  table: string
}

export const StructureView = ({ table }: Props) => {
  const { data: structure, isLoading } = useTableStructure(table)
  const { data: ddl } = useTableDdl(table)

  if (isLoading) {
    return (
      <Center p="xl">
        <Stack align="center" gap={4}>
          <Loader size="sm" />
          <Text size="xs" c="dimmed">Loading structure...</Text>
        </Stack>
      </Center>
    )
  }
  if (!structure) return null

  return (
    <Tabs
      defaultValue="columns"
      style={{ height: "100%", display: "flex", flexDirection: "column" }}
      styles={{
        list: {
          borderBottom: "1px solid var(--ambry-border)",
          gap: 0,
        },
        tab: {
          fontSize: 11,
          fontWeight: 500,
          padding: "5px 12px",
        },
      }}
    >
      <Tabs.List>
        <Tabs.Tab value="columns" leftSection={<Columns size={13} />}>
          Columns ({structure.columns.length})
        </Tabs.Tab>
        <Tabs.Tab value="indexes" leftSection={<Hash size={13} />}>
          Indexes ({structure.indexes.length})
        </Tabs.Tab>
        <Tabs.Tab value="foreignkeys" leftSection={<Link size={13} />}>
          Foreign Keys ({structure.foreignKeys.length})
        </Tabs.Tab>
        <Tabs.Tab value="ddl" leftSection={<FileCode size={13} />}>DDL</Tabs.Tab>
        <Tabs.Tab value="profile" leftSection={<BarChart3 size={13} />}>Profile</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="columns" flex={1} style={{ overflow: "auto" }}>
        <ColumnsTab columns={structure.columns} />
      </Tabs.Panel>
      <Tabs.Panel value="indexes" flex={1} style={{ overflow: "auto" }}>
        <IndexesTab indexes={structure.indexes} />
      </Tabs.Panel>
      <Tabs.Panel value="foreignkeys" flex={1} style={{ overflow: "auto" }}>
        <ForeignKeysTab foreignKeys={structure.foreignKeys} />
      </Tabs.Panel>
      <Tabs.Panel value="ddl" flex={1} style={{ overflow: "auto" }}>
        <DdlTab ddl={ddl ?? ""} />
      </Tabs.Panel>
      <Tabs.Panel value="profile" flex={1} style={{ overflow: "auto" }}>
        <ProfilingTab table={table} />
      </Tabs.Panel>
    </Tabs>
  )
}
