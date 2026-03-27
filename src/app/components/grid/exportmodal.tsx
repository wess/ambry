import { Modal, Stack, Select, TextInput, Group, Button, Text, Checkbox, Badge } from "@mantine/core"
import { useState, useEffect } from "react"
import { Download } from "lucide-react"

type ExportFormat = "csv" | "json" | "sql"

type Props = {
  opened: boolean
  onClose: () => void
  onExport: (opts: ExportOptions) => void
  table: string | null
  rowCount: number
}

export type ExportOptions = {
  format: ExportFormat
  filename: string
  includeHeaders: boolean
  delimiter: string
  nullAs: string
}

const extensions: Record<ExportFormat, string> = {
  csv: ".csv",
  json: ".json",
  sql: ".sql",
}

export const ExportModal = ({ opened, onClose, onExport, table, rowCount }: Props) => {
  const [format, setFormat] = useState<ExportFormat>("csv")
  const [filename, setFilename] = useState(table ? `${table}` : "export")
  const [includeHeaders, setIncludeHeaders] = useState(true)
  const [delimiter, setDelimiter] = useState(",")
  const [nullAs, setNullAs] = useState("")

  useEffect(() => {
    if (opened && table) setFilename(table)
  }, [opened, table])

  const fullFilename = `${filename}${extensions[format]}`

  const handleExport = () => {
    onExport({ format, filename: fullFilename, includeHeaders, delimiter, nullAs })
    onClose()
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Export Data" size="md">
      <Stack gap="sm">
        <Group gap="xs" mb={4}>
          <Badge variant="light" size="sm">{table || "query results"}</Badge>
          <Text size="xs" c="dimmed">{rowCount.toLocaleString()} rows</Text>
        </Group>

        <Select
          label="Format"
          data={[
            { value: "csv", label: "CSV — Comma Separated Values" },
            { value: "json", label: "JSON — JavaScript Object Notation" },
            { value: "sql", label: "SQL — INSERT Statements" },
          ]}
          value={format}
          onChange={(v) => {
            if (v) setFormat(v as ExportFormat)
          }}
        />

        <TextInput
          label="Default filename"
          value={filename}
          onChange={(e) => setFilename(e.target.value)}
          rightSection={<Text size="xs" c="dimmed" style={{ fontSize: 10 }}>{extensions[format]}</Text>}
          description="You'll choose the save location in the next step"
          styles={{ input: { fontFamily: "var(--mantine-font-family-monospace)", fontSize: 12 } }}
        />

        {format === "csv" && (
          <>
            <Checkbox
              size="xs"
              label="Include column headers"
              checked={includeHeaders}
              onChange={(e) => setIncludeHeaders(e.currentTarget.checked)}
            />
            <Select
              label="Delimiter"
              size="xs"
              data={[
                { value: ",", label: "Comma (,)" },
                { value: "\t", label: "Tab (\\t)" },
                { value: ";", label: "Semicolon (;)" },
                { value: "|", label: "Pipe (|)" },
              ]}
              value={delimiter}
              onChange={(v) => v && setDelimiter(v)}
            />
            <TextInput
              label="NULL value"
              size="xs"
              placeholder="(empty string)"
              value={nullAs}
              onChange={(e) => setNullAs(e.target.value)}
              description="How to represent NULL values in the export"
              styles={{ input: { fontFamily: "var(--mantine-font-family-monospace)", fontSize: 12 } }}
            />
          </>
        )}

        <Group justify="flex-end" mt="md" gap="xs">
          <Button variant="subtle" color="gray" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" leftSection={<Download size={14} />} onClick={handleExport}>
            Choose location & export
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
