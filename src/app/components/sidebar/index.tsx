import { Stack, TextInput, ScrollArea, Text, Box, Skeleton, Group, ActionIcon, Tooltip } from "@mantine/core"
import { useState, useMemo } from "react"
import { Search, Trash2, Scissors } from "lucide-react"
import { TableItem } from "./item"
import type { TableInfo } from "../../types"

type Props = {
  tables: TableInfo[]
  activeTable: string | null
  onSelectTable: (name: string) => void
  onContextMenu?: (table: string, e: React.MouseEvent) => void
  onBatchTruncate?: (tables: string[]) => void
  onBatchDrop?: (tables: string[]) => void
  loading: boolean
}

export const Sidebar = ({ tables, activeTable, onSelectTable, onContextMenu, onBatchTruncate, onBatchDrop, loading }: Props) => {
  const [search, setSearch] = useState("")
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set())

  const filtered = useMemo(
    () => tables.filter((t) => t.name.toLowerCase().includes(search.toLowerCase())),
    [tables, search],
  )

  const filteredTables = useMemo(() => filtered.filter((t) => t.type === "table"), [filtered])
  const filteredViews = useMemo(() => filtered.filter((t) => t.type === "view"), [filtered])

  const handleClick = (name: string, e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey) {
      // Multi-select toggle
      setSelectedTables((prev) => {
        const next = new Set(prev)
        if (next.has(name)) next.delete(name)
        else next.add(name)
        return next
      })
    } else {
      setSelectedTables(new Set())
      onSelectTable(name)
    }
  }

  const batchCount = selectedTables.size

  return (
    <Stack gap={0} h="100%">
      <Box px={8} py={6}>
        <TextInput
          placeholder="Filter tables..."
          leftSection={<Search size={13} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="xs"
          radius="md"
          styles={{
            input: {
              backgroundColor: "var(--ambry-bg-muted)",
              border: "none",
              fontSize: 12,
              height: 28,
              minHeight: 28,
            },
          }}
        />
      </Box>

      <Group px={8} pb={4} justify="space-between">
        <Text size="xs" c="dimmed" fw={500} style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Tables {!loading && `(${filteredTables.length})`}
        </Text>
        {batchCount > 0 && (
          <Group gap={2}>
            <Text size="xs" c="blue" fw={500} style={{ fontSize: 10 }}>{batchCount} selected</Text>
            {onBatchTruncate && (
              <Tooltip label={`Truncate ${batchCount} tables`}>
                <ActionIcon size={16} color="orange" variant="subtle" onClick={() => { onBatchTruncate([...selectedTables]); setSelectedTables(new Set()) }}>
                  <Scissors size={10} />
                </ActionIcon>
              </Tooltip>
            )}
            {onBatchDrop && (
              <Tooltip label={`Drop ${batchCount} tables`}>
                <ActionIcon size={16} color="red" variant="subtle" onClick={() => { onBatchDrop([...selectedTables]); setSelectedTables(new Set()) }}>
                  <Trash2 size={10} />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>
        )}
      </Group>

      <ScrollArea flex={1} scrollbarSize={4}>
        <Stack gap={1} px={6} pb={8}>
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} height={26} radius="sm" />
            ))
          ) : filtered.length === 0 ? (
            <Text size="xs" c="dimmed" ta="center" py="lg">
              {search ? "No matches" : "No tables"}
            </Text>
          ) : (
            <>
              {filteredTables.map((t) => (
                <TableItem
                  key={t.name}
                  table={t}
                  active={t.name === activeTable}
                  selected={selectedTables.has(t.name)}
                  onClick={(e) => handleClick(t.name, e)}
                  onContextMenu={onContextMenu ? (e) => onContextMenu(t.name, e) : undefined}
                />
              ))}
              {filteredViews.length > 0 && (
                <>
                  <Box px={2} pt={8} pb={2}>
                    <Text size="xs" c="dimmed" fw={500} style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Views ({filteredViews.length})
                    </Text>
                  </Box>
                  {filteredViews.map((t) => (
                    <TableItem
                      key={t.name}
                      table={t}
                      active={t.name === activeTable}
                      selected={selectedTables.has(t.name)}
                      onClick={(e) => handleClick(t.name, e)}
                      onContextMenu={onContextMenu ? (e) => onContextMenu(t.name, e) : undefined}
                    />
                  ))}
                </>
              )}
            </>
          )}
        </Stack>
      </ScrollArea>
    </Stack>
  )
}
