import { Stack, Text, UnstyledButton, Group, Badge, ScrollArea, Box } from "@mantine/core"
import { Clock, AlertCircle } from "lucide-react"
import { useQueryHistory } from "../../hooks"

type Props = {
  onSelect: (sql: string) => void
}

const formatTime = (iso: string): string => {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()

  if (diff < 60_000) return "just now"
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

export const QueryHistory = ({ onSelect }: Props) => {
  const { data: history, isLoading } = useQueryHistory()

  if (isLoading) {
    return <Text size="xs" c="dimmed" p="sm">Loading history...</Text>
  }

  if (!history || history.length === 0) {
    return (
      <Stack align="center" justify="center" p="lg" gap={4}>
        <Clock size={20} style={{ color: "var(--mantine-color-dimmed)" }} />
        <Text size="xs" c="dimmed">No query history</Text>
      </Stack>
    )
  }

  return (
    <ScrollArea h="100%" scrollbarSize={4}>
      <Stack gap={1} p={6}>
        {history.map((entry) => (
          <UnstyledButton
            key={entry.id}
            onClick={() => onSelect(entry.sql)}
            py={6}
            px={8}
            style={{
              borderRadius: 6,
              display: "block",
              width: "100%",
            }}
          >
            <Group gap={6} justify="space-between" mb={2}>
              <Text size="xs" c="dimmed" style={{ fontSize: 10 }}>
                {formatTime(entry.executedAt)}
              </Text>
              <Group gap={4}>
                {entry.error ? (
                  <Badge size="xs" color="red" variant="light" radius="sm">error</Badge>
                ) : (
                  <Badge size="xs" color="dark" variant="light" radius="sm" style={{ fontSize: 9 }}>
                    {entry.executionTime}ms
                  </Badge>
                )}
              </Group>
            </Group>
            <Text
              size="xs"
              lineClamp={2}
              style={{
                fontFamily: "var(--mantine-font-family-monospace)",
                fontSize: 11,
                color: entry.error ? "var(--mantine-color-red-4)" : "var(--mantine-color-text)",
                lineHeight: 1.4,
              }}
            >
              {entry.sql}
            </Text>
          </UnstyledButton>
        ))}
      </Stack>
    </ScrollArea>
  )
}
