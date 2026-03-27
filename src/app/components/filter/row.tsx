import { Group, Select, TextInput, ActionIcon } from "@mantine/core"
import { X } from "lucide-react"
import type { FilterCondition, FilterOperator } from "../../types"

type Props = {
  condition: FilterCondition
  columns: string[]
  onChange: (updated: FilterCondition) => void
  onRemove: () => void
}

const operators: { value: FilterOperator; label: string }[] = [
  { value: "=", label: "=" },
  { value: "!=", label: "≠" },
  { value: "contains", label: "contains" },
  { value: "not_contains", label: "not contains" },
  { value: "starts_with", label: "starts with" },
  { value: "ends_with", label: "ends with" },
  { value: ">", label: ">" },
  { value: "<", label: "<" },
  { value: ">=", label: "≥" },
  { value: "<=", label: "≤" },
  { value: "is_null", label: "is null" },
  { value: "is_not_null", label: "is not null" },
  { value: "in", label: "in" },
  { value: "between", label: "between" },
]

const noValueOps = new Set<string>(["is_null", "is_not_null"])

export const FilterRow = ({ condition, columns, onChange, onRemove }: Props) => (
  <Group gap={4} wrap="nowrap">
    <Select
      size="xs"
      value={condition.column}
      onChange={(v) => v && onChange({ ...condition, column: v })}
      data={columns}
      placeholder="Column"
      w={140}
      styles={{ input: { fontSize: 11, fontFamily: "var(--mantine-font-family-monospace)" } }}
    />
    <Select
      size="xs"
      value={condition.operator}
      onChange={(v) => v && onChange({ ...condition, operator: v as FilterOperator })}
      data={operators}
      w={120}
      styles={{ input: { fontSize: 11 } }}
    />
    {!noValueOps.has(condition.operator) && (
      <TextInput
        size="xs"
        value={condition.value}
        onChange={(e) => onChange({ ...condition, value: e.target.value })}
        placeholder="Value"
        flex={1}
        styles={{ input: { fontSize: 11, fontFamily: "var(--mantine-font-family-monospace)" } }}
      />
    )}
    {condition.operator === "between" && (
      <TextInput
        size="xs"
        value={condition.value2 || ""}
        onChange={(e) => onChange({ ...condition, value2: e.target.value })}
        placeholder="Value 2"
        flex={1}
        styles={{ input: { fontSize: 11, fontFamily: "var(--mantine-font-family-monospace)" } }}
      />
    )}
    <ActionIcon size="xs" onClick={onRemove}><X size={13} /></ActionIcon>
  </Group>
)
