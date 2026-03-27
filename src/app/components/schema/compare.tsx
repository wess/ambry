import { Modal, Stack, Select, Group, Button, Text, Badge, ScrollArea, Box, Code, CopyButton, ActionIcon, Tooltip, Loader, Center } from "@mantine/core"
import { useState } from "react"
import { GitCompare, Copy, Check, Download } from "lucide-react"
import { useConnections } from "../../hooks"
import { invoke } from "../../butter"

type SchemaDiff = {
  table: string
  type: "added" | "removed" | "modified"
  details: string
  sql: string
}

type Props = {
  opened: boolean
  onClose: () => void
  currentConnectionId: string
}

const typeColors: Record<string, string> = {
  added: "teal",
  removed: "red",
  modified: "yellow",
}

const typeLabels: Record<string, string> = {
  added: "CREATE",
  removed: "DROP",
  modified: "ALTER",
}

export const SchemaCompareModal = ({ opened, onClose, currentConnectionId }: Props) => {
  const { data: connections } = useConnections()
  const [targetId, setTargetId] = useState<string | null>(null)
  const [diffs, setDiffs] = useState<SchemaDiff[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const otherConnections = (connections ?? [])
    .filter((c) => c.id !== currentConnectionId)
    .map((c) => ({ value: c.id, label: c.name }))

  const handleCompare = async () => {
    if (!targetId) return
    setLoading(true)
    setError(null)
    try {
      // Need to connect to target first
      await invoke("connection:connect", targetId)
      const result = await butter.invoke("schema:compare", {
        sourceConnectionId: currentConnectionId,
        targetConnectionId: targetId,
      }) as SchemaDiff[]
      setDiffs(result)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const allSql = diffs?.map((d) => d.sql).join("\n\n") ?? ""

  return (
    <Modal opened={opened} onClose={onClose} title="Schema Comparison" size="xl">
      <Stack gap="sm">
        <Group grow>
          <Select
            label="Source (current)"
            value={currentConnectionId}
            data={(connections ?? []).map((c) => ({ value: c.id, label: c.name }))}
            disabled
            size="sm"
          />
          <Select
            label="Target (compare to)"
            placeholder="Select connection..."
            value={targetId}
            onChange={setTargetId}
            data={otherConnections}
            size="sm"
          />
        </Group>

        <Button
          leftSection={<GitCompare size={14} />}
          onClick={handleCompare}
          loading={loading}
          disabled={!targetId}
          size="sm"
        >
          Compare
        </Button>

        {error && <Text size="xs" c="red">{error}</Text>}

        {diffs && (
          <>
            <Group justify="space-between">
              <Group gap="xs">
                <Badge color="teal" variant="light" size="sm">
                  {diffs.filter((d) => d.type === "added").length} create
                </Badge>
                <Badge color="yellow" variant="light" size="sm">
                  {diffs.filter((d) => d.type === "modified").length} alter
                </Badge>
                <Badge color="red" variant="light" size="sm">
                  {diffs.filter((d) => d.type === "removed").length} drop
                </Badge>
              </Group>
              {diffs.length > 0 && (
                <CopyButton value={allSql}>
                  {({ copied, copy }) => (
                    <Button
                      size="compact-xs"
                      variant="light"
                      leftSection={copied ? <Check size={12} /> : <Copy size={12} />}
                      onClick={copy}
                      styles={{ root: { fontSize: 11 } }}
                    >
                      {copied ? "Copied" : "Copy All SQL"}
                    </Button>
                  )}
                </CopyButton>
              )}
            </Group>

            {diffs.length === 0 ? (
              <Center py="lg">
                <Text c="dimmed" size="sm">Schemas are identical</Text>
              </Center>
            ) : (
              <ScrollArea.Autosize mah={400}>
                <Stack gap={4}>
                  {diffs.map((diff, i) => (
                    <Box
                      key={i}
                      p={8}
                      style={{
                        backgroundColor: "var(--ambry-bg-surface)",
                        borderRadius: "var(--mantine-radius-sm)",
                        borderLeft: `3px solid var(--mantine-color-${typeColors[diff.type]}-6)`,
                      }}
                    >
                      <Group justify="space-between" mb={4}>
                        <Group gap={6}>
                          <Badge size="xs" color={typeColors[diff.type]} variant="light" radius="sm">
                            {typeLabels[diff.type]}
                          </Badge>
                          <Text size="xs" fw={600} style={{ fontFamily: "var(--mantine-font-family-monospace)", fontSize: 12 }}>
                            {diff.table}
                          </Text>
                        </Group>
                        <CopyButton value={diff.sql}>
                          {({ copied, copy }) => (
                            <Tooltip label={copied ? "Copied" : "Copy SQL"}>
                              <ActionIcon size={16} variant="subtle" color={copied ? "teal" : "gray"} onClick={copy}>
                                {copied ? <Check size={10} /> : <Copy size={10} />}
                              </ActionIcon>
                            </Tooltip>
                          )}
                        </CopyButton>
                      </Group>
                      <Text size="xs" c="dimmed" mb={4} style={{ fontSize: 11 }}>
                        {diff.details}
                      </Text>
                      <Code
                        block
                        style={{
                          fontSize: 11,
                          whiteSpace: "pre-wrap",
                          backgroundColor: "var(--ambry-bg-subtle)",
                          padding: "6px 8px",
                        }}
                      >
                        {diff.sql}
                      </Code>
                    </Box>
                  ))}
                </Stack>
              </ScrollArea.Autosize>
            )}
          </>
        )}
      </Stack>
    </Modal>
  )
}
