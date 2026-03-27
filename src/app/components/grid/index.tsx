import { Table, ScrollArea, Text, TextInput, Group, Box, Badge } from "@mantine/core"
import { notifications } from "@mantine/notifications"
import { useState, useCallback, useEffect, useRef, useMemo } from "react"
import { ArrowUp, ArrowDown } from "lucide-react"
import type { SortColumn } from "../../types"

type Props = {
  columns: string[]
  rows: Record<string, unknown>[]
  sort: SortColumn | null
  onSort: (sort: SortColumn) => void
  selectedRows: Set<number>
  onSelectRows: (rows: Set<number>) => void
  onCellEdit: (rowIdx: number, column: string, value: unknown) => void
  hiddenColumns?: Set<string>
  tableName?: string
  pendingChanges?: Array<{ type: string; primaryKey: Record<string, unknown>; changes?: Record<string, unknown> }>
  foreignKeys?: Array<{ columns: string[]; referencedTable: string; referencedColumns: string[] }>
  onNavigateFK?: (table: string, column: string, value: unknown) => void
}

const formatCell = (value: unknown): string => {
  if (value === null || value === undefined) return ""
  if (typeof value === "boolean") return value ? "true" : "false"
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

const isNull = (value: unknown): boolean =>
  value === null || value === undefined

export const DataGrid = ({ columns, rows, sort, onSort, selectedRows, onSelectRows, onCellEdit, hiddenColumns, tableName, pendingChanges, foreignKeys, onNavigateFK }: Props) => {
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null)
  const [editValue, setEditValue] = useState("")
  const [colWidths, setColWidths] = useState<Record<string, number>>({})
  const [resizing, setResizing] = useState<{ col: string; startX: number; startW: number } | null>(null)

  const visibleColumns = hiddenColumns
    ? columns.filter((c) => !hiddenColumns.has(c))
    : columns

  const handleHeaderClick = (col: string) => {
    if (resizing) return
    if (sort?.column === col) {
      onSort({ column: col, direction: sort.direction === "asc" ? "desc" : "asc" })
    } else {
      onSort({ column: col, direction: "asc" })
    }
  }

  const startEdit = (rowIdx: number, col: string, value: unknown) => {
    setEditingCell({ row: rowIdx, col })
    setEditValue(isNull(value) ? "" : String(value))
  }

  const commitEdit = useCallback(() => {
    if (editingCell) {
      onCellEdit(editingCell.row, editingCell.col, editValue || null)
      setEditingCell(null)
    }
  }, [editingCell, editValue, onCellEdit])

  const cancelEdit = () => setEditingCell(null)

  // Column resize handlers
  const handleResizeStart = (col: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const startW = colWidths[col] || 150
    setResizing({ col, startX: e.clientX, startW })
  }

  useEffect(() => {
    if (!resizing) return
    const handleMove = (e: MouseEvent) => {
      const diff = e.clientX - resizing.startX
      const newW = Math.max(60, resizing.startW + diff)
      setColWidths((prev) => ({ ...prev, [resizing.col]: newW }))
    }
    const handleUp = () => setResizing(null)
    window.addEventListener("mousemove", handleMove)
    window.addEventListener("mouseup", handleUp)
    return () => {
      window.removeEventListener("mousemove", handleMove)
      window.removeEventListener("mouseup", handleUp)
    }
  }, [resizing])

  // Row click with multi-select
  const handleRowClick = (rowIdx: number, e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey) {
      // Toggle individual row
      const next = new Set(selectedRows)
      if (next.has(rowIdx)) next.delete(rowIdx)
      else next.add(rowIdx)
      onSelectRows(next)
    } else if (e.shiftKey && selectedRows.size > 0) {
      // Range select
      const anchor = Math.min(...selectedRows)
      const start = Math.min(anchor, rowIdx)
      const end = Math.max(anchor, rowIdx)
      const next = new Set<number>()
      for (let i = start; i <= end; i++) next.add(i)
      onSelectRows(next)
    } else {
      onSelectRows(new Set([rowIdx]))
    }
  }

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (editingCell) return
      const target = e.target as HTMLElement
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return

      const current = selectedRows.size > 0 ? Math.max(...selectedRows) : -1

      if (e.key === "ArrowDown" && current < rows.length - 1) {
        e.preventDefault()
        const next = current + 1
        onSelectRows(e.shiftKey ? new Set([...selectedRows, next]) : new Set([next]))
      } else if (e.key === "ArrowUp" && current > 0) {
        e.preventDefault()
        const next = current - 1
        onSelectRows(e.shiftKey ? new Set([...selectedRows, next]) : new Set([next]))
      } else if (e.key === "Escape") {
        onSelectRows(new Set())
      } else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "c" && selectedRows.size > 0 && tableName) {
        // Copy as INSERT SQL
        e.preventDefault()
        const sqls = [...selectedRows].sort().map((idx) => {
          const row = rows[idx]
          const cols = visibleColumns.map((c) => `"${c}"`).join(", ")
          const vals = visibleColumns.map((c) => {
            const v = row[c]
            if (v === null || v === undefined) return "NULL"
            if (typeof v === "number") return String(v)
            if (typeof v === "boolean") return v ? "TRUE" : "FALSE"
            return `'${String(v).replace(/'/g, "''")}'`
          }).join(", ")
          return `INSERT INTO "${tableName}" (${cols}) VALUES (${vals});`
        })
        navigator.clipboard.writeText(sqls.join("\n"))
        notifications.show({ message: `${selectedRows.size} row(s) copied as INSERT SQL`, autoClose: 1200 })
      } else if ((e.metaKey || e.ctrlKey) && e.key === "c" && selectedRows.size > 0) {
        const lines = [...selectedRows].sort().map((idx) => {
          const row = rows[idx]
          return visibleColumns.map((col) => formatCell(row[col])).join("\t")
        })
        navigator.clipboard.writeText(lines.join("\n"))
        notifications.show({ message: `${selectedRows.size} row(s) copied`, autoClose: 1200 })
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [editingCell, selectedRows, rows, visibleColumns, onSelectRows])

  // Build change lookup from pending changes
  const rowChangeType = (rowIdx: number): "update" | "delete" | null => {
    if (!pendingChanges) return null
    const row = rows[rowIdx]
    if (!row) return null
    for (const change of pendingChanges) {
      if (change.type === "delete") {
        const match = Object.entries(change.primaryKey).every(([k, v]) => row[k] === v)
        if (match) return "delete"
      }
      if (change.type === "update") {
        const match = Object.entries(change.primaryKey).every(([k, v]) => row[k] === v)
        if (match) return "update"
      }
    }
    return null
  }

  const cellChanged = (rowIdx: number, col: string): boolean => {
    if (!pendingChanges) return false
    const row = rows[rowIdx]
    if (!row) return false
    return pendingChanges.some((c) =>
      c.type === "update" && c.changes?.[col] !== undefined &&
      Object.entries(c.primaryKey).every(([k, v]) => row[k] === v)
    )
  }

  // FK column lookup
  const fkMap = useMemo(() => {
    const map = new Map<string, { referencedTable: string; referencedColumn: string }>()
    if (foreignKeys) {
      for (const fk of foreignKeys) {
        const cols = Array.isArray(fk.columns) ? fk.columns : [fk.columns]
        const refCols = Array.isArray(fk.referencedColumns) ? fk.referencedColumns : [fk.referencedColumns]
        for (let i = 0; i < cols.length; i++) {
          map.set(cols[i], { referencedTable: fk.referencedTable, referencedColumn: refCols[i] || refCols[0] })
        }
      }
    }
    return map
  }, [foreignKeys])

  if (visibleColumns.length === 0) return null

  return (
    <ScrollArea h="100%" type="auto" scrollbarSize={6} style={{ cursor: resizing ? "col-resize" : undefined }}>
      <Table
        highlightOnHover
        withColumnBorders
        style={{ fontSize: 12, borderCollapse: "collapse", tableLayout: "fixed", minWidth: "100%" }}
      >
        <Table.Thead style={{ position: "sticky", top: 0, zIndex: 2, backgroundColor: "var(--ambry-bg-subtle)" }}>
          <Table.Tr style={{ borderBottom: "1px solid var(--ambry-border)" }}>
            <Table.Th style={{ width: 40, textAlign: "right", padding: "4px 8px", color: "var(--mantine-color-dimmed)", fontSize: 10, fontWeight: 400, userSelect: "none" }}>
              #
            </Table.Th>
            {visibleColumns.map((col) => (
              <Table.Th
                key={col}
                style={{
                  width: colWidths[col] || "auto",
                  minWidth: 60,
                  cursor: "pointer",
                  userSelect: "none",
                  whiteSpace: "nowrap",
                  padding: "5px 10px",
                  fontWeight: 600,
                  fontSize: 11,
                  color: "var(--ambry-text-muted)",
                  position: "relative",
                }}
                onClick={() => handleHeaderClick(col)}
              >
                <Group gap={4} wrap="nowrap">
                  <span>{col}</span>
                  {sort?.column === col && (
                    <Box style={{ color: "var(--mantine-color-blue-4)" }}>
                      {sort.direction === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
                    </Box>
                  )}
                </Group>
                {/* Resize handle */}
                <div
                  onMouseDown={(e) => handleResizeStart(col, e)}
                  style={{
                    position: "absolute",
                    right: 0,
                    top: 0,
                    bottom: 0,
                    width: 5,
                    cursor: "col-resize",
                    zIndex: 3,
                  }}
                />
              </Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((row, rowIdx) => {
            const changeType = rowChangeType(rowIdx)
            return (
            <Table.Tr
              key={rowIdx}
              onClick={(e) => handleRowClick(rowIdx, e)}
              style={{
                cursor: "default",
                backgroundColor: selectedRows.has(rowIdx)
                  ? "var(--mantine-color-blue-light)"
                  : changeType === "delete"
                    ? "rgba(224, 49, 49, 0.08)"
                    : changeType === "update"
                      ? "rgba(255, 212, 59, 0.05)"
                      : rowIdx % 2 === 1 ? "rgba(0,0,0,0.08)" : undefined,
                textDecoration: changeType === "delete" ? "line-through" : undefined,
                opacity: changeType === "delete" ? 0.5 : undefined,
              }}
            >
              <Table.Td style={{ textAlign: "right", padding: "3px 8px", color: "var(--mantine-color-dimmed)", fontSize: 10, fontVariantNumeric: "tabular-nums", userSelect: "none", borderRight: "1px solid var(--ambry-border)" }}>
                {rowIdx + 1}
              </Table.Td>
              {visibleColumns.map((col) => (
                <Table.Td
                  key={col}
                  style={{
                    width: colWidths[col] || "auto",
                    maxWidth: colWidths[col] || 280,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    padding: "3px 10px",
                    fontFamily: "var(--mantine-font-family-monospace)",
                    borderLeft: cellChanged(rowIdx, col) ? "2px solid var(--mantine-color-yellow-6)" : undefined,
                    backgroundColor: cellChanged(rowIdx, col) ? "rgba(255, 212, 59, 0.08)" : undefined,
                    fontSize: 12,
                  }}
                  onDoubleClick={() => startEdit(rowIdx, col, row[col])}
                >
                  {editingCell?.row === rowIdx && editingCell?.col === col ? (
                    <TextInput
                      size="xs"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={commitEdit}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitEdit()
                        if (e.key === "Escape") cancelEdit()
                      }}
                      autoFocus
                      styles={{ input: { padding: "1px 4px", minHeight: "unset", height: 22, fontFamily: "var(--mantine-font-family-monospace)", fontSize: 12 } }}
                    />
                  ) : isNull(row[col]) ? (
                    <Badge size="xs" variant="outline" color="gray" radius="sm" style={{ fontWeight: 400, fontSize: 9, textTransform: "uppercase" }}>
                      null
                    </Badge>
                  ) : (
                    fkMap.has(col) && !isNull(row[col]) && onNavigateFK ? (
                      <span
                        onClick={(e) => { e.stopPropagation(); const fk = fkMap.get(col)!; onNavigateFK(fk.referencedTable, fk.referencedColumn, row[col]) }}
                        style={{ color: "var(--mantine-color-blue-4)", cursor: "pointer", textDecoration: "underline", textDecorationStyle: "dotted" }}
                      >
                        {formatCell(row[col])}
                      </span>
                    ) : (
                      <span>{formatCell(row[col])}</span>
                    )
                  )}
                </Table.Td>
              ))}
            </Table.Tr>
          )})}
        </Table.Tbody>
      </Table>
    </ScrollArea>
  )
}
