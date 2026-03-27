import { Modal, TextInput, Stack, UnstyledButton, Group, Text, Badge, Box, ScrollArea } from "@mantine/core"
import { useState, useMemo, useEffect } from "react"
import { Search, Table2, Eye, Code, Star, ArrowRight } from "lucide-react"
import type { TableInfo } from "../../types"

type PaletteItem = {
  id: string
  label: string
  description?: string
  type: "table" | "view" | "action" | "favorite"
  icon: React.ReactNode
  onSelect: () => void
}

type Props = {
  opened: boolean
  onClose: () => void
  tables: TableInfo[]
  favorites: { id: string; name: string; sql: string }[]
  onSelectTable: (name: string) => void
  onSelectFavorite: (sql: string) => void
  onAction: (action: string) => void
}

const typeColors: Record<string, string> = {
  table: "blue",
  view: "violet",
  action: "gray",
  favorite: "yellow",
}

export const CommandPalette = ({ opened, onClose, tables, favorites, onSelectTable, onSelectFavorite, onAction }: Props) => {
  const [query, setQuery] = useState("")
  const [selectedIdx, setSelectedIdx] = useState(0)

  useEffect(() => {
    if (opened) {
      setQuery("")
      setSelectedIdx(0)
    }
  }, [opened])

  const items = useMemo((): PaletteItem[] => {
    const result: PaletteItem[] = []

    for (const t of tables) {
      result.push({
        id: `table:${t.name}`,
        label: t.name,
        description: t.rowCount != null ? `${t.rowCount.toLocaleString()} rows` : undefined,
        type: t.type === "view" ? "view" : "table",
        icon: t.type === "view" ? <Eye size={14} /> : <Table2 size={14} />,
        onSelect: () => { onSelectTable(t.name); onClose() },
      })
    }

    for (const f of favorites) {
      result.push({
        id: `fav:${f.id}`,
        label: f.name,
        description: f.sql.slice(0, 60),
        type: "favorite",
        icon: <Star size={14} />,
        onSelect: () => { onSelectFavorite(f.sql); onClose() },
      })
    }

    result.push(
      { id: "action:newquery", label: "New Query Tab", type: "action", icon: <Code size={14} />, onSelect: () => { onAction("newquery"); onClose() } },
      { id: "action:export", label: "Export Table", type: "action", icon: <ArrowRight size={14} />, onSelect: () => { onAction("export"); onClose() } },
    )

    return result
  }, [tables, favorites, onSelectTable, onSelectFavorite, onAction, onClose])

  const filtered = useMemo(() => {
    if (!query.trim()) return items
    const q = query.toLowerCase()
    return items.filter((item) =>
      item.label.toLowerCase().includes(q) ||
      item.description?.toLowerCase().includes(q)
    )
  }, [items, query])

  useEffect(() => {
    setSelectedIdx(0)
  }, [query])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setSelectedIdx((prev) => Math.min(prev + 1, filtered.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setSelectedIdx((prev) => Math.max(prev - 1, 0))
    } else if (e.key === "Enter" && filtered[selectedIdx]) {
      e.preventDefault()
      filtered[selectedIdx].onSelect()
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      withCloseButton={false}
      padding={0}
      size="sm"
      styles={{
        content: { borderRadius: 12, overflow: "hidden" },
        body: { padding: 0 },
      }}
      transitionProps={{ transition: "pop", duration: 100 }}
    >
      <TextInput
        placeholder="Search tables, queries, actions..."
        leftSection={<Search size={15} />}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        autoFocus
        size="md"
        styles={{
          input: {
            border: "none",
            borderBottom: "1px solid var(--ambry-border)",
            borderRadius: 0,
            fontSize: 14,
          },
        }}
      />
      <ScrollArea.Autosize mah={350}>
        <Stack gap={0} py={4}>
          {filtered.length === 0 ? (
            <Text size="xs" c="dimmed" ta="center" py="lg">No results</Text>
          ) : (
            filtered.map((item, i) => (
              <UnstyledButton
                key={item.id}
                onClick={item.onSelect}
                px="sm"
                py={6}
                style={{
                  backgroundColor: i === selectedIdx ? "var(--ambry-border)" : undefined,
                  display: "block",
                  width: "100%",
                }}
                onMouseEnter={() => setSelectedIdx(i)}
              >
                <Group gap={8} wrap="nowrap">
                  <Box style={{ color: `var(--mantine-color-${typeColors[item.type]}-4)`, flexShrink: 0 }}>
                    {item.icon}
                  </Box>
                  <Stack gap={0} style={{ minWidth: 0, flex: 1 }}>
                    <Text size="sm" truncate fw={500}>{item.label}</Text>
                    {item.description && (
                      <Text size="xs" c="dimmed" truncate style={{ fontSize: 10, fontFamily: item.type === "favorite" ? "var(--mantine-font-family-monospace)" : undefined }}>
                        {item.description}
                      </Text>
                    )}
                  </Stack>
                  <Badge size="xs" variant="light" color={typeColors[item.type]} radius="sm" style={{ fontSize: 9, flexShrink: 0 }}>
                    {item.type}
                  </Badge>
                </Group>
              </UnstyledButton>
            ))
          )}
        </Stack>
      </ScrollArea.Autosize>
    </Modal>
  )
}
