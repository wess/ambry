import { SimpleGrid, Center, Stack, Text, Button, Loader, Group, Box, Kbd, Badge } from "@mantine/core"
import { Plus, Database } from "lucide-react"
import { useMemo } from "react"
import { ConnectionCard } from "./card"
import type { Connection } from "../../types"

type Props = {
  connections: Connection[]
  loading: boolean
  onConnect: (id: string) => void
  onEdit: (connection: Connection) => void
  onDelete: (id: string) => void
  onNew: () => void
  connectingId?: string | null
}

export const ConnectionList = ({ connections, loading, onConnect, onEdit, onDelete, onNew, connectingId }: Props) => {
  const grouped = useMemo((): [string, Connection[]][] => {
    const groups = new Map<string, Connection[]>()
    for (const conn of connections) {
      const g = conn.group || "Connections"
      const list = groups.get(g) ?? []
      list.push(conn)
      groups.set(g, list)
    }
    return [...groups.entries()]
  }, [connections])

  if (loading) {
    return (
      <Center h="100vh">
        <Stack align="center" gap="sm">
          <Loader size="sm" />
          <Text size="sm" c="dimmed">Loading connections...</Text>
        </Stack>
      </Center>
    )
  }

  return (
    <Stack h="100vh" style={{ overflow: "auto" }}>
      <Stack align="center" gap={4} pt={60} pb="md">
        <Box
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: "var(--mantine-color-blue-light)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 8,
          }}
        >
          <Database size={24} style={{ color: "var(--mantine-color-blue-6)" }} />
        </Box>
        <Text size="lg" fw={700} style={{ letterSpacing: "-0.02em" }}>Ambry</Text>
        <Text size="xs" c="dimmed">Open-source database client</Text>
      </Stack>

      <Center>
        <Button
          leftSection={<Plus size={15} />}
          onClick={onNew}
          variant="light"
          size="sm"
          radius="md"
        >
          New Connection
        </Button>
      </Center>

      {connections.length === 0 ? (
        <Center flex={1} pb={100}>
          <Stack align="center" gap="xs">
            <Text c="dimmed" size="sm">No connections yet</Text>
            <Text c="dimmed" size="xs">
              Press <Kbd size="xs">N</Kbd> or click above to get started
            </Text>
          </Stack>
        </Center>
      ) : (
        <Box px="xl" pb="xl" pt="md" style={{ maxWidth: 900, margin: "0 auto", width: "100%" }}>
          {grouped.map(([group, conns]) => (
            <Box key={group} mb="md">
              {grouped.length > 1 && (
                <Text size="xs" c="dimmed" fw={500} mb={6} style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {group}
                </Text>
              )}
              <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm">
                {conns.map((conn) => (
                  <ConnectionCard
                    key={conn.id}
                    connection={conn}
                    onConnect={onConnect}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    connecting={connectingId === conn.id}
                  />
                ))}
              </SimpleGrid>
            </Box>
          ))}
        </Box>
      )}
    </Stack>
  )
}
