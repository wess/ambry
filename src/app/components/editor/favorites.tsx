import { Stack, Text, UnstyledButton, Group, ActionIcon, TextInput, Button, Box } from "@mantine/core"
import { Star, Trash2, Plus } from "lucide-react"
import { useState } from "react"
import { useFavorites, useSaveFavorite, useDeleteFavorite } from "../../hooks"

type Props = {
  onSelect: (sql: string) => void
  currentSql: string
}

export const FavoritesPanel = ({ onSelect, currentSql }: Props) => {
  const { data: favorites, isLoading } = useFavorites()
  const saveMutation = useSaveFavorite()
  const deleteMutation = useDeleteFavorite()
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState("")

  const handleSave = async () => {
    if (!name.trim() || !currentSql.trim()) return
    await saveMutation.mutateAsync({ name: name.trim(), sql: currentSql })
    setName("")
    setSaving(false)
  }

  return (
    <Stack gap={0} h="100%">
      <Box px={8} py={6} style={{ borderBottom: "1px solid var(--ambry-border)" }}>
        {saving ? (
          <Stack gap={4}>
            <TextInput
              size="xs"
              placeholder="Query name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setSaving(false) }}
              autoFocus
              styles={{ input: { fontSize: 11 } }}
            />
            <Group gap={4}>
              <Button size="compact-xs" onClick={handleSave} disabled={!name.trim()} styles={{ root: { fontSize: 10 } }}>Save</Button>
              <Button size="compact-xs" variant="subtle" color="gray" onClick={() => setSaving(false)} styles={{ root: { fontSize: 10 } }}>Cancel</Button>
            </Group>
          </Stack>
        ) : (
          <Button
            size="compact-xs"
            variant="subtle"
            color="gray"
            leftSection={<Plus size={12} />}
            onClick={() => setSaving(true)}
            disabled={!currentSql.trim()}
            fullWidth
            styles={{ root: { fontSize: 11 } }}
          >
            Save current query
          </Button>
        )}
      </Box>
      <Stack gap={1} p={6} style={{ flex: 1, overflow: "auto" }}>
        {isLoading ? (
          <Text size="xs" c="dimmed" ta="center" py="md">Loading...</Text>
        ) : !favorites || favorites.length === 0 ? (
          <Stack align="center" justify="center" py="lg" gap={4}>
            <Star size={18} style={{ color: "var(--mantine-color-dimmed)" }} />
            <Text size="xs" c="dimmed">No saved queries</Text>
          </Stack>
        ) : (
          favorites.map((fav) => (
            <UnstyledButton
              key={fav.id}
              onClick={() => onSelect(fav.sql)}
              py={5}
              px={8}
              style={{ borderRadius: 6, display: "block", width: "100%" }}
            >
              <Group justify="space-between" wrap="nowrap">
                <Stack gap={1} style={{ minWidth: 0 }}>
                  <Text size="xs" fw={500} truncate style={{ fontSize: 11 }}>{fav.name}</Text>
                  <Text size="xs" c="dimmed" lineClamp={1} style={{ fontFamily: "var(--mantine-font-family-monospace)", fontSize: 10 }}>
                    {fav.sql}
                  </Text>
                </Stack>
                <ActionIcon
                  size={16}
                  variant="subtle"
                  color="red"
                  onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(fav.id) }}
                  style={{ opacity: 0.4, flexShrink: 0 }}
                >
                  <Trash2 size={10} />
                </ActionIcon>
              </Group>
            </UnstyledButton>
          ))
        )}
      </Stack>
    </Stack>
  )
}
