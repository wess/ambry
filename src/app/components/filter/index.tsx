import { Stack, Group, Button, SegmentedControl, Text } from "@mantine/core"
import { Plus, X } from "lucide-react"
import { FilterRow } from "./row"
import type { FilterCondition, FilterState } from "../../types"

type Props = {
  state: FilterState
  columns: string[]
  onChange: (state: FilterState) => void
  onApply: () => void
}

export const FilterPanel = ({ state, columns, onChange, onApply }: Props) => {
  const addCondition = () => {
    const newCondition: FilterCondition = {
      id: crypto.randomUUID(),
      column: columns[0] || "",
      operator: "=",
      value: "",
    }
    onChange({ ...state, conditions: [...state.conditions, newCondition] })
  }

  const updateCondition = (idx: number, updated: FilterCondition) => {
    const conditions = [...state.conditions]
    conditions[idx] = updated
    onChange({ ...state, conditions })
  }

  const removeCondition = (idx: number) => {
    onChange({ ...state, conditions: state.conditions.filter((_, i) => i !== idx) })
  }

  const clearAll = () => {
    onChange({ conditions: [], logic: "and" })
  }

  return (
    <Stack
      gap={6}
      px="sm"
      py={8}
      style={{
        borderBottom: "1px solid var(--ambry-border)",
        backgroundColor: "var(--ambry-bg-surface)",
        flex: "0 0 auto",
      }}
    >
      {state.conditions.map((c, i) => (
        <FilterRow
          key={c.id}
          condition={c}
          columns={columns}
          onChange={(updated) => updateCondition(i, updated)}
          onRemove={() => removeCondition(i)}
        />
      ))}
      <Group gap={6}>
        <Button
          size="compact-xs"
          variant="subtle"
          color="gray"
          leftSection={<Plus size={12} />}
          onClick={addCondition}
          styles={{ root: { fontSize: 11 } }}
        >
          Add filter
        </Button>
        {state.conditions.length > 1 && (
          <SegmentedControl
            size="xs"
            value={state.logic}
            onChange={(v) => onChange({ ...state, logic: v as "and" | "or" })}
            data={[
              { value: "and", label: "AND" },
              { value: "or", label: "OR" },
            ]}
            styles={{ root: { height: 22 }, label: { fontSize: 10, padding: "0 8px" } }}
          />
        )}
        {state.conditions.length > 0 && (
          <>
            <Button
              size="compact-xs"
              onClick={onApply}
              styles={{ root: { fontSize: 11 } }}
            >
              Apply
            </Button>
            <Button
              size="compact-xs"
              variant="subtle"
              color="gray"
              leftSection={<X size={12} />}
              onClick={clearAll}
              styles={{ root: { fontSize: 11 } }}
            >
              Clear
            </Button>
          </>
        )}
      </Group>
    </Stack>
  )
}
