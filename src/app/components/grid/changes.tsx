import { Modal, Stack, Text, Group, Button, ScrollArea, Box, Badge } from "@mantine/core"
import { Save, Undo2 } from "lucide-react"

export type PendingChange = {
  type: "update" | "insert" | "delete"
  table: string
  primaryKey: Record<string, unknown>
  changes?: Record<string, unknown>
  row?: Record<string, unknown>
}

const escapeValue = (v: unknown): string => {
  if (v === null) return "NULL"
  if (typeof v === "number") return String(v)
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE"
  return `'${String(v).replace(/'/g, "''")}'`
}

const buildWhere = (pk: Record<string, unknown>): string =>
  Object.entries(pk)
    .map(([k, v]) => v === null ? `"${k}" IS NULL` : `"${k}" = ${escapeValue(v)}`)
    .join(" AND ")

export const generateSql = (change: PendingChange): string => {
  switch (change.type) {
    case "update": {
      const setClauses = Object.entries(change.changes ?? {})
        .map(([k, v]) => `"${k}" = ${escapeValue(v)}`)
        .join(", ")
      return `UPDATE "${change.table}" SET ${setClauses} WHERE ${buildWhere(change.primaryKey)};`
    }
    case "delete":
      return `DELETE FROM "${change.table}" WHERE ${buildWhere(change.primaryKey)};`
    case "insert": {
      const row = change.row ?? {}
      const keys = Object.keys(row)
      if (keys.length === 0) return `INSERT INTO "${change.table}" DEFAULT VALUES;`
      const cols = keys.map((k) => `"${k}"`).join(", ")
      const vals = keys.map((k) => escapeValue(row[k])).join(", ")
      return `INSERT INTO "${change.table}" (${cols}) VALUES (${vals});`
    }
    default:
      return ""
  }
}

type ReviewModalProps = {
  opened: boolean
  onClose: () => void
  changes: PendingChange[]
  onCommit: () => void
  onDiscard: () => void
  committing: boolean
}

const typeColors: Record<string, string> = {
  update: "blue",
  insert: "teal",
  delete: "red",
}

export const ChangeReviewModal = ({ opened, onClose, changes, onCommit, onDiscard, committing }: ReviewModalProps) => (
  <Modal opened={opened} onClose={onClose} title="Review Changes" size="lg">
    <Stack gap="sm">
      <Group gap="xs">
        <Badge size="sm" variant="light" color="blue">{changes.filter((c) => c.type === "update").length} updates</Badge>
        <Badge size="sm" variant="light" color="teal">{changes.filter((c) => c.type === "insert").length} inserts</Badge>
        <Badge size="sm" variant="light" color="red">{changes.filter((c) => c.type === "delete").length} deletes</Badge>
      </Group>

      <ScrollArea.Autosize mah={400}>
        <Stack gap={4}>
          {changes.map((change, i) => (
            <Box
              key={i}
              p={8}
              style={{
                backgroundColor: "var(--ambry-bg-surface)",
                borderRadius: "var(--mantine-radius-sm)",
                borderLeft: `3px solid var(--mantine-color-${typeColors[change.type] || "gray"}-6)`,
              }}
            >
              <Text
                size="xs"
                style={{
                  fontFamily: "var(--mantine-font-family-monospace)",
                  fontSize: 11,
                  lineHeight: 1.5,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                }}
              >
                {generateSql(change)}
              </Text>
            </Box>
          ))}
        </Stack>
      </ScrollArea.Autosize>

      <Group justify="space-between" mt="xs">
        <Button
          variant="subtle"
          color="red"
          size="sm"
          leftSection={<Undo2 size={14} />}
          onClick={onDiscard}
        >
          Discard All
        </Button>
        <Group gap="xs">
          <Button variant="default" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            leftSection={<Save size={14} />}
            onClick={onCommit}
            loading={committing}
          >
            Commit {changes.length} change{changes.length !== 1 ? "s" : ""}
          </Button>
        </Group>
      </Group>
    </Stack>
  </Modal>
)
