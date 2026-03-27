import { Group, ActionIcon, Tooltip, Divider, Badge, Button, Menu, Checkbox, Text, ScrollArea } from "@mantine/core"
import { Plus, Trash2, RefreshCw, Filter, Save, Undo2, Columns, Download, PanelRightOpen, Upload, Dices } from "lucide-react"

type Props = {
  onRefresh: () => void
  onInsert: () => void
  onDelete: () => void
  onToggleFilter: () => void
  filterActive: boolean
  hasSelection: boolean
  pendingChanges?: number
  onReviewChanges?: () => void
  onDiscardChanges?: () => void
  columns?: string[]
  hiddenColumns?: Set<string>
  onToggleColumn?: (col: string) => void
  onExport?: () => void
  onImportCSV?: () => void
  onGenerateData?: () => void
  onToggleInspector?: () => void
  inspectorActive?: boolean
}

export const GridToolbar = ({
  onRefresh, onInsert, onDelete, onToggleFilter,
  filterActive, hasSelection, pendingChanges = 0,
  onReviewChanges, onDiscardChanges,
  columns, hiddenColumns, onToggleColumn, onExport, onImportCSV, onGenerateData,
  onToggleInspector, inspectorActive,
}: Props) => (
  <Group
    gap={4}
    px="sm"
    py={4}
    style={{ borderBottom: "1px solid var(--ambry-border)", flex: "0 0 auto" }}
  >
    <Tooltip label="Refresh">
      <ActionIcon size="sm" onClick={onRefresh}><RefreshCw size={14} /></ActionIcon>
    </Tooltip>
    <Divider orientation="vertical" mx={2} />
    <Tooltip label="Insert row">
      <ActionIcon size="sm" onClick={onInsert}><Plus size={14} /></ActionIcon>
    </Tooltip>
    <Tooltip label="Delete selected">
      <ActionIcon size="sm" onClick={onDelete} disabled={!hasSelection}><Trash2 size={14} /></ActionIcon>
    </Tooltip>
    <Divider orientation="vertical" mx={2} />
    <Tooltip label="Toggle filters">
      <ActionIcon size="sm" onClick={onToggleFilter} variant={filterActive ? "light" : "subtle"} color={filterActive ? "blue" : "gray"}>
        <Filter size={14} />
      </ActionIcon>
    </Tooltip>

    {columns && onToggleColumn && (
      <Menu position="bottom-start" shadow="lg" withinPortal>
        <Menu.Target>
          <Tooltip label="Columns">
            <ActionIcon size="sm"><Columns size={14} /></ActionIcon>
          </Tooltip>
        </Menu.Target>
        <Menu.Dropdown>
          <ScrollArea.Autosize mah={300}>
            {columns.map((col) => (
              <Menu.Item
                key={col}
                onClick={(e) => { e.preventDefault(); onToggleColumn(col) }}
                closeMenuOnClick={false}
              >
                <Checkbox
                  size="xs"
                  checked={!hiddenColumns?.has(col)}
                  onChange={() => onToggleColumn(col)}
                  label={<Text size="xs" style={{ fontFamily: "var(--mantine-font-family-monospace)", fontSize: 11 }}>{col}</Text>}
                />
              </Menu.Item>
            ))}
          </ScrollArea.Autosize>
        </Menu.Dropdown>
      </Menu>
    )}

    {onImportCSV && (
      <Tooltip label="Import CSV">
        <ActionIcon size="sm" onClick={onImportCSV}><Upload size={14} /></ActionIcon>
      </Tooltip>
    )}
    {onGenerateData && (
      <Tooltip label="Generate mock data">
        <ActionIcon size="sm" onClick={onGenerateData}><Dices size={14} /></ActionIcon>
      </Tooltip>
    )}
    {onExport && (
      <Tooltip label="Export">
        <ActionIcon size="sm" onClick={onExport}><Download size={14} /></ActionIcon>
      </Tooltip>
    )}
    {onToggleInspector && (
      <Tooltip label="Inspector">
        <ActionIcon size="sm" onClick={onToggleInspector} variant={inspectorActive ? "light" : "subtle"} color={inspectorActive ? "blue" : "gray"}>
          <PanelRightOpen size={14} />
        </ActionIcon>
      </Tooltip>
    )}

    {pendingChanges > 0 && (
      <>
        <Divider orientation="vertical" mx={2} />
        <Badge size="sm" variant="light" color="orange" radius="sm">
          {pendingChanges} pending
        </Badge>
        <Button size="compact-xs" variant="light" leftSection={<Save size={12} />} onClick={onReviewChanges} styles={{ root: { fontSize: 11 } }}>
          Review
        </Button>
        <Tooltip label="Discard changes">
          <ActionIcon size="sm" color="red" onClick={onDiscardChanges}><Undo2 size={14} /></ActionIcon>
        </Tooltip>
      </>
    )}
  </Group>
)
