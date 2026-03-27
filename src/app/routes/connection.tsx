import { useState, useCallback, useEffect } from "react"
import { useParams, useNavigate } from "@tanstack/react-router"
import { AppShell, Tabs, Group, ActionIcon, Tooltip, Text, Box, Stack, Menu, Select } from "@mantine/core"
import { notifications } from "@mantine/notifications"
import { modals } from "@mantine/modals"
import { TableProperties, Code, ArrowLeft, Table2, Copy, Trash2, Scissors, GitCompare, Settings, Disc, Network } from "lucide-react"
import { Sidebar } from "../components/sidebar"
import { DataGrid } from "../components/grid"
import { GridToolbar } from "../components/grid/toolbar"
import { Pagination } from "../components/grid/pagination"
import { ChangeReviewModal, type PendingChange } from "../components/grid/changes"
import { InsertRowModal } from "../components/grid/insertmodal"
import { CellInspector } from "../components/grid/inspector"
import { FilterPanel } from "../components/filter"
import { SqlEditor } from "../components/editor"
import { StructureView } from "../components/structure"
import { StatusBar } from "../components/status"
import { CommandPalette } from "../components/palette"
import { SchemaCompareModal } from "../components/schema/compare"
import { ERDiagramModal } from "../components/erdiagram"
import { SettingsModal, defaultSettings, type Settings } from "../components/settings"
import { MacrosModal, type MacroStep } from "../components/macros"
import { useTables, useTableRows, useTableStructure, useConnections, useDisconnect, useDatabases, useSwitchDatabase, useFavorites } from "../hooks"
import { invoke } from "../butter"
import type { SortColumn, FilterState, RowsRequest } from "../types"

type WorkspaceTab = "data" | "query" | "structure"

export const ConnectionWorkspacePage = () => {
  const { id } = useParams({ from: "/connection/$id" })
  const navigate = useNavigate()
  const { data: connections } = useConnections()
  const disconnectMutation = useDisconnect()
  const { data: tables, isLoading: tablesLoading, refetch: refetchTables } = useTables(id)
  const { data: databases } = useDatabases(id)
  const switchDbMutation = useSwitchDatabase()

  const connection = connections?.find((c) => c.id === id)
  const accent = connection?.color || "var(--mantine-color-blue-6)"

  const [activeTable, setActiveTable] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("data")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(100)
  const [sort, setSort] = useState<SortColumn | null>(null)
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())
  const [showFilters, setShowFilters] = useState(false)
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set())
  const [filterState, setFilterState] = useState<FilterState>({ conditions: [], logic: "and" })
  const [appliedFilters, setAppliedFilters] = useState<FilterState>({ conditions: [], logic: "and" })
  const [contextMenu, setContextMenu] = useState<{ table: string; x: number; y: number } | null>(null)
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([])
  const [showReview, setShowReview] = useState(false)
  const [showInsert, setShowInsert] = useState(false)
  const [showPalette, setShowPalette] = useState(false)
  const [showInspector, setShowInspector] = useState(false)
  const [showSchemaCompare, setShowSchemaCompare] = useState(false)
  const [showERDiagram, setShowERDiagram] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState<Settings>(defaultSettings)

  // Load settings on mount
  useEffect(() => {
    butter.invoke("settings:load").then((saved: any) => {
      if (saved) setSettings({ ...defaultSettings, ...saved })
    }).catch(() => {})
  }, [])

  const [showMacros, setShowMacros] = useState(false)
  const [macroRecording, setMacroRecording] = useState(false)
  const [recordedSteps, setRecordedSteps] = useState<MacroStep[]>([])

  const recordStep = (step: MacroStep) => {
    if (macroRecording) setRecordedSteps((prev) => [...prev, step])
  }

  const handleMacroReplay = async (steps: MacroStep[]) => {
    for (const step of steps) {
      try {
        if (step.action === "query") {
          await invoke("query:execute", { sql: step.params.sql })
        } else if (step.action === "navigate") {
          handleSelectTable(step.params.table)
        }
      } catch { /* continue */ }
    }
    refetchRows()
  }

  const handleSettingsChange = (next: Settings) => {
    setSettings(next)
    butter.invoke("settings:save", next).catch(() => {})
  }
  const [committing, setCommitting] = useState(false)

  const { data: favorites } = useFavorites()

  // Cmd+P for command palette
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "p") {
        e.preventDefault()
        setShowPalette(true)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  const rowsRequest: RowsRequest | null = activeTable
    ? {
        table: activeTable,
        page,
        pageSize,
        sort: sort ?? undefined,
        filters: appliedFilters.conditions.length > 0 ? appliedFilters.conditions : undefined,
        filterLogic: appliedFilters.conditions.length > 0 ? appliedFilters.logic : undefined,
      }
    : null
  const { data: rowsData, refetch: refetchRows } = useTableRows(rowsRequest)
  const { data: activeStructure } = useTableStructure(activeTable)

  // Drag-and-drop SQL file import
  useEffect(() => {
    const handler = async (data: unknown) => {
      const files = data as { name: string; path: string }[]
      for (const file of files) {
        if (!file.path || !file.name.endsWith(".sql")) continue
        try {
          const result = await invoke("import:sql", { path: file.path } as any) as any
          if (result.success) {
            refetchRows()
            refetchTables()
            notifications.show({ message: `Executed ${file.name}`, color: "teal", autoClose: 2000 })
          } else {
            notifications.show({ title: `Failed: ${file.name}`, message: result.error, color: "red" })
          }
        } catch (err: any) {
          notifications.show({ title: "Import failed", message: err.message, color: "red" })
        }
      }
    }
    butter.on("drop:files", handler)
    return () => butter.off("drop:files", handler)
  }, [refetchRows, refetchTables])

  const handleNavigateFK = (refTable: string, refColumn: string, value: unknown) => {
    // Navigate to the referenced table and apply a filter for the FK value
    setActiveTable(refTable)
    setPage(1)
    setSort(null)
    setSelectedRows(new Set())
    setHiddenColumns(new Set())
    const filterCondition = {
      id: crypto.randomUUID(),
      column: refColumn,
      operator: "=" as const,
      value: String(value),
    }
    const newFilter = { conditions: [filterCondition], logic: "and" as const }
    setFilterState(newFilter)
    setAppliedFilters(newFilter)
    setShowFilters(true)
    setActiveTab("data")
  }

  const handleSelectTable = (name: string) => {
    setActiveTable(name)
    setPage(1)
    setSort(null)
    setSelectedRows(new Set())
    setHiddenColumns(new Set())
    setFilterState({ conditions: [], logic: "and" })
    setAppliedFilters({ conditions: [], logic: "and" })
    setActiveTab("data")
  }

  const handleApplyFilters = () => {
    setAppliedFilters({ ...filterState })
    setPage(1)
  }

  const handleCellEdit = useCallback((rowIdx: number, column: string, value: unknown) => {
    if (!activeTable || !rowsData) return
    const row = rowsData.rows[rowIdx]
    setPendingChanges((prev) => [...prev, {
      type: "update",
      table: activeTable,
      primaryKey: { ...row },
      changes: { [column]: value },
    }])
  }, [activeTable, rowsData])

  const handleInsert = () => {
    if (!activeTable) return
    setShowInsert(true)
  }

  const handleInsertRow = async (row: Record<string, unknown>) => {
    if (!activeTable) return
    try {
      await invoke("row:insert", { table: activeTable, row })
      refetchRows()
      notifications.show({ message: "Row inserted", color: "teal", autoClose: 1500 })
    } catch (err: any) {
      notifications.show({ title: "Insert failed", message: err.message, color: "red" })
    }
  }

  const handleDelete = () => {
    if (!activeTable || selectedRows.size === 0 || !rowsData) return
    const newChanges = [...selectedRows].map((idx) => ({
      type: "delete" as const,
      table: activeTable,
      primaryKey: { ...rowsData.rows[idx] },
    }))
    setPendingChanges((prev) => [...prev, ...newChanges])
    setSelectedRows(new Set())
  }

  const handleUndo = () => {
    setPendingChanges((prev) => prev.slice(0, -1))
  }

  const toggleColumn = (col: string) => {
    setHiddenColumns((prev) => {
      const next = new Set(prev)
      if (next.has(col)) next.delete(col)
      else next.add(col)
      return next
    })
  }

  const handleImportCSV = async () => {
    if (!activeTable) return
    try {
      const { dialog } = await import("butter/dialog")
      const result = await dialog.open({
        prompt: "Import CSV",
        filters: [{ name: "CSV Files", extensions: ["csv", "tsv", "txt"] }],
      })
      if (result.cancelled || result.paths.length === 0) return
      const importResult = await invoke("import:csvfile" as any, { table: activeTable, path: result.paths[0] }) as any
      refetchRows()
      refetchTables()
      if (importResult.error) {
        notifications.show({ title: "Partial import", message: `${importResult.inserted}/${importResult.total} rows. ${importResult.error}`, color: "orange" })
      } else {
        notifications.show({ message: `${importResult.inserted} rows imported into ${activeTable}`, color: "teal", autoClose: 3000 })
      }
    } catch (err: any) {
      notifications.show({ title: "Import failed", message: err.message, color: "red" })
    }
  }

  // Clipboard paste import (Cmd+V with TSV/CSV data)
  useEffect(() => {
    const handler = async (e: ClipboardEvent) => {
      if (!activeTable) return
      const target = e.target as HTMLElement
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.closest(".cm-editor")) return

      const text = e.clipboardData?.getData("text/plain")
      if (!text || !text.includes("\t") && !text.includes(",")) return

      e.preventDefault()
      const delimiter = text.includes("\t") ? "\t" : ","
      try {
        const result = await invoke("import:csv", { table: activeTable, csv: text, delimiter })
        refetchRows()
        if (result.error) {
          notifications.show({ title: "Partial import", message: `${result.inserted}/${result.total} rows. ${result.error}`, color: "orange" })
        } else {
          notifications.show({ message: `${result.inserted} rows imported`, color: "teal", autoClose: 2000 })
        }
      } catch (err: any) {
        notifications.show({ title: "Paste import failed", message: err.message, color: "red" })
      }
    }
    window.addEventListener("paste", handler)
    return () => window.removeEventListener("paste", handler)
  }, [activeTable, refetchRows])

  const handleExport = async () => {
    if (!activeTable) return
    try {
      const { dialog } = await import("butter/dialog")
      const dialogResult = await dialog.save({
        defaultName: `${activeTable}.csv`,
        prompt: "Export",
        filters: [
          { name: "CSV", extensions: ["csv"] },
          { name: "JSON", extensions: ["json"] },
          { name: "SQL", extensions: ["sql"] },
        ],
      })

      if (dialogResult.cancelled || !dialogResult.path) return
      const filePath = dialogResult.path

      // Determine format from file extension
      const ext = filePath.split(".").pop()?.toLowerCase() ?? "csv"
      const format = ext === "json" ? "json" : ext === "sql" ? "sql" : "csv"

      const result = await invoke("export:file", {
        table: activeTable,
        format,
        filename: filePath.split("/").pop() || defaultName,
        path: filePath,
        options: { includeHeaders: true, delimiter: ",", nullAs: "" },
      })
      if (!result.path) return
      notifications.show({
        title: "Export complete",
        message: `${result.rows} rows saved to ${result.path}`,
        color: "teal",
        autoClose: 4000,
      })
    } catch (err: any) {
      notifications.show({ title: "Export failed", message: err.message, color: "red" })
    }
  }

  const handleCommitChanges = async () => {
    setCommitting(true)
    try {
      for (const change of pendingChanges) {
        switch (change.type) {
          case "update":
            await invoke("row:update", { table: change.table, primaryKey: change.primaryKey, changes: change.changes! })
            break
          case "insert":
            await invoke("row:insert", { table: change.table, row: change.row ?? {} })
            break
          case "delete":
            await invoke("row:delete", { table: change.table, primaryKey: change.primaryKey })
            break
        }
      }
      setPendingChanges([])
      setShowReview(false)
      refetchRows()
      notifications.show({ message: `${pendingChanges.length} change(s) committed`, color: "teal", autoClose: 2000 })
    } catch (err: any) {
      notifications.show({ title: "Commit failed", message: err.message, color: "red" })
    } finally {
      setCommitting(false)
    }
  }

  const handleDiscardChanges = () => {
    setPendingChanges([])
    setShowReview(false)
    notifications.show({ message: "Changes discarded", autoClose: 1500 })
  }

  const handleTableContextMenu = (table: string, e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenu({ table, x: e.clientX, y: e.clientY })
  }

  const handleTruncateTable = (table: string) => {
    setContextMenu(null)
    modals.openConfirmModal({
      title: "Truncate Table",
      children: `This will delete ALL rows from "${table}". This cannot be undone.`,
      labels: { confirm: "Truncate", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        try {
          await invoke("query:execute", { sql: `TRUNCATE TABLE "${table}"` })
          refetchRows()
          refetchTables()
          notifications.show({ message: `Table "${table}" truncated`, color: "teal" })
        } catch (err: any) {
          notifications.show({ title: "Truncate failed", message: err.message, color: "red" })
        }
      },
    })
  }

  const handleDropTable = (table: string) => {
    setContextMenu(null)
    modals.openConfirmModal({
      title: "Drop Table",
      children: `This will permanently drop "${table}" and all its data. This cannot be undone.`,
      labels: { confirm: "Drop", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        try {
          await invoke("query:execute", { sql: `DROP TABLE "${table}"` })
          if (activeTable === table) setActiveTable(null)
          refetchTables()
          notifications.show({ message: `Table "${table}" dropped`, color: "teal" })
        } catch (err: any) {
          notifications.show({ title: "Drop failed", message: err.message, color: "red" })
        }
      },
    })
  }

  const handleCopyTableName = (table: string) => {
    setContextMenu(null)
    navigator.clipboard.writeText(table)
    notifications.show({ message: "Copied to clipboard", autoClose: 1500 })
  }

  const handleBatchTruncate = (tableNames: string[]) => {
    modals.openConfirmModal({
      title: `Truncate ${tableNames.length} Tables`,
      children: `This will delete ALL rows from: ${tableNames.join(", ")}. This cannot be undone.`,
      labels: { confirm: "Truncate All", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        for (const t of tableNames) {
          try {
            await invoke("query:execute", { sql: `TRUNCATE TABLE "${t}"` })
          } catch { /* continue */ }
        }
        refetchRows()
        refetchTables()
        notifications.show({ message: `${tableNames.length} tables truncated`, color: "teal" })
      },
    })
  }

  const handleBatchDrop = (tableNames: string[]) => {
    modals.openConfirmModal({
      title: `Drop ${tableNames.length} Tables`,
      children: `This will permanently drop: ${tableNames.join(", ")}. This cannot be undone.`,
      labels: { confirm: "Drop All", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        for (const t of tableNames) {
          try {
            await invoke("query:execute", { sql: `DROP TABLE "${t}"` })
          } catch { /* continue */ }
        }
        if (activeTable && tableNames.includes(activeTable)) setActiveTable(null)
        refetchTables()
        notifications.show({ message: `${tableNames.length} tables dropped`, color: "teal" })
      },
    })
  }

  const handleBack = async () => {
    await disconnectMutation.mutateAsync(id)
    navigate({ to: "/" })
  }

  return (
    <>
    <AppShell
      navbar={{ width: 220, breakpoint: 0 }}
      footer={{ height: 28 }}
      padding={0}
      style={{ height: "100vh" }}
    >
      <AppShell.Navbar
        style={{
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          borderRight: "1px solid var(--ambry-border)",
          backgroundColor: "var(--ambry-bg-surface)",
        }}
      >
        {/* Sidebar header */}
        <Group
          gap={8}
          px="sm"
          py={8}
          style={{
            borderBottom: "1px solid var(--ambry-border)",
            flex: "0 0 auto",
          }}
        >
          <Tooltip label="Back to connections">
            <ActionIcon size="sm" onClick={handleBack}>
              <ArrowLeft size={14} />
            </ActionIcon>
          </Tooltip>
          <Box
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: accent,
              flexShrink: 0,
            }}
          />
          <Text size="xs" fw={500} truncate flex={1}>{connection?.name ?? "Connection"}</Text>
          <Tooltip label="Macros">
            <ActionIcon
              size="sm"
              onClick={() => setShowMacros(true)}
              style={{ flexShrink: 0 }}
              color={macroRecording ? "red" : "gray"}
              variant={macroRecording ? "light" : "subtle"}
            >
              <Disc size={13} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Settings">
            <ActionIcon size="sm" onClick={() => setShowSettings(true)} style={{ flexShrink: 0 }}>
              <Settings size={13} />
            </ActionIcon>
          </Tooltip>
        </Group>

        {/* Database switcher */}
        {databases && databases.length > 1 && connection?.type !== "sqlite" && (
          <Box px="sm" py={4} style={{ borderBottom: "1px solid var(--ambry-border)", flex: "0 0 auto" }}>
            <Select
              size="xs"
              value={connection?.database}
              onChange={async (v) => {
                if (v && v !== connection?.database) {
                  await switchDbMutation.mutateAsync({ connectionId: id, database: v })
                }
              }}
              data={databases}
              styles={{ input: { fontSize: 11, fontFamily: "var(--mantine-font-family-monospace)", height: 26, minHeight: 26 } }}
            />
          </Box>
        )}

        <div style={{ flex: 1, overflow: "hidden" }}>
          <Sidebar
            tables={tables ?? []}
            activeTable={activeTable}
            onSelectTable={handleSelectTable}
            onContextMenu={handleTableContextMenu}
            onBatchTruncate={handleBatchTruncate}
            onBatchDrop={handleBatchDrop}
            loading={tablesLoading}
          />
        </div>
      </AppShell.Navbar>

      {/* Table context menu */}
      {contextMenu && (
        <Menu
          opened
          onClose={() => setContextMenu(null)}
          position="right-start"
          shadow="lg"
          withinPortal
        >
          <Menu.Dropdown style={{ position: "fixed", left: contextMenu.x, top: contextMenu.y }}>
            <Menu.Item leftSection={<Copy size={14} />} onClick={() => handleCopyTableName(contextMenu.table)}>
              Copy Name
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item leftSection={<Scissors size={14} />} color="orange" onClick={() => handleTruncateTable(contextMenu.table)}>
              Truncate
            </Menu.Item>
            <Menu.Item leftSection={<Trash2 size={14} />} color="red" onClick={() => handleDropTable(contextMenu.table)}>
              Drop
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      )}

      <AppShell.Main style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
        <Tabs
          value={activeTab}
          onChange={(v) => setActiveTab(v as WorkspaceTab)}
          style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}
          variant="default"
          styles={{
            root: {
              display: "flex",
              flexDirection: "column",
              flex: 1,
              overflow: "hidden",
            },
            list: {
              borderBottom: "1px solid var(--ambry-border)",
              backgroundColor: "var(--ambry-bg-surface)",
              gap: 0,
              flexWrap: "nowrap",
            },
            tab: {
              fontSize: 12,
              fontWeight: 500,
              padding: "7px 16px",
              color: "var(--ambry-text-muted)",
              borderRadius: 0,
              border: "none",
              borderBottom: "2px solid transparent",
              marginBottom: -1,
              transition: "color 100ms, border-color 100ms, background-color 100ms",
            },
          }}
          classNames={{
            tab: "ambry-tab",
          }}
        >
          <Tabs.List>
            <Tabs.Tab value="data" leftSection={<Table2 size={13} />}>Data</Tabs.Tab>
            <Tabs.Tab value="query" leftSection={<Code size={13} />}>Query</Tabs.Tab>
            {activeTable && (
              <Tabs.Tab value="structure" leftSection={<TableProperties size={13} />}>Structure</Tabs.Tab>
            )}
            {activeTable && (
              <Group gap="xs" ml="auto" mr="sm" style={{ alignSelf: "center" }}>
                <Text size="xs" c="dimmed">{activeTable}</Text>
                <Tooltip label="Compare schemas">
                  <ActionIcon size="sm" onClick={() => setShowSchemaCompare(true)}>
                    <GitCompare size={13} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="ER diagram">
                  <ActionIcon size="sm" onClick={() => setShowERDiagram(true)}>
                    <Network size={13} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            )}
          </Tabs.List>

          <Tabs.Panel value="data" flex={1} style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {activeTable ? (
              <>
                <GridToolbar
                  onRefresh={() => refetchRows()}
                  onInsert={handleInsert}
                  onDelete={handleDelete}
                  onToggleFilter={() => setShowFilters(!showFilters)}
                  filterActive={showFilters}
                  hasSelection={selectedRows.size > 0}
                  pendingChanges={pendingChanges.length}
                  onReviewChanges={() => setShowReview(true)}
                  onDiscardChanges={handleDiscardChanges}
                  columns={rowsData?.columns}
                  hiddenColumns={hiddenColumns}
                  onToggleColumn={toggleColumn}
                  onExport={handleExport}
                  onImportCSV={handleImportCSV}
                  onGenerateData={async () => {
                    if (!activeTable) return
                    try {
                      const result = await invoke("table:mockdata" as any, { table: activeTable, count: 50 }) as any
                      refetchRows()
                      if (result.error) {
                        notifications.show({ title: "Partial generation", message: `${result.inserted}/${result.total} rows. ${result.error}`, color: "orange" })
                      } else {
                        notifications.show({ message: `${result.inserted} mock rows generated`, color: "teal", autoClose: 2000 })
                      }
                    } catch (err: any) {
                      notifications.show({ title: "Generation failed", message: err.message, color: "red" })
                    }
                  }}
                  onToggleInspector={() => setShowInspector(!showInspector)}
                  inspectorActive={showInspector}
                />
                {showFilters && (
                  <FilterPanel
                    state={filterState}
                    columns={rowsData?.columns ?? []}
                    onChange={setFilterState}
                    onApply={handleApplyFilters}
                  />
                )}
                <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>
                  <div style={{ flex: 1, overflow: "hidden" }}>
                    <DataGrid
                      columns={rowsData?.columns ?? []}
                      rows={rowsData?.rows ?? []}
                      sort={sort}
                      onSort={setSort}
                      selectedRows={selectedRows}
                      onSelectRows={setSelectedRows}
                      onCellEdit={handleCellEdit}
                      hiddenColumns={hiddenColumns}
                      tableName={activeTable ?? undefined}
                      pendingChanges={pendingChanges}
                      foreignKeys={activeStructure?.foreignKeys}
                      onNavigateFK={handleNavigateFK}
                    />
                  </div>
                  {showInspector && selectedRows.size > 0 && rowsData && (
                    <CellInspector
                      row={rowsData.rows[Math.max(...selectedRows)] ?? null}
                      columns={rowsData.columns}
                      columnTypes={rowsData.columnTypes}
                      onClose={() => setShowInspector(false)}
                    />
                  )}
                </div>
                <Pagination
                  page={page}
                  pageSize={pageSize}
                  total={rowsData?.total ?? 0}
                  onPageChange={setPage}
                  onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}
                />
              </>
            ) : (
              <Stack align="center" justify="center" flex={1} gap={4}>
                <Table2 size={32} style={{ color: "var(--mantine-color-dimmed)" }} />
                <Text size="sm" c="dimmed">Select a table</Text>
              </Stack>
            )}
          </Tabs.Panel>

          <Tabs.Panel value="query" flex={1} style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <SqlEditor connectionId={id} tables={tables?.map((t) => t.name)} dbType={connection?.type} />
          </Tabs.Panel>

          {activeTable && (
            <Tabs.Panel value="structure" flex={1} style={{ overflow: "hidden" }}>
              <StructureView table={activeTable} />
            </Tabs.Panel>
          )}
        </Tabs>
      </AppShell.Main>

      <AppShell.Footer style={{ borderTop: "1px solid var(--ambry-border)", backgroundColor: "var(--ambry-bg-surface)" }}>
        <StatusBar
          connectionName={connection?.name ?? id}
          connectionType={connection?.type ?? "unknown"}
          connectionColor={accent}
          table={activeTable}
          rowCount={rowsData?.total}
        />
      </AppShell.Footer>
    </AppShell>

    <ChangeReviewModal
      opened={showReview}
      onClose={() => setShowReview(false)}
      changes={pendingChanges}
      onCommit={handleCommitChanges}
      onDiscard={handleDiscardChanges}
      committing={committing}
    />

    {activeTable && (
      <InsertRowModal
        opened={showInsert}
        onClose={() => setShowInsert(false)}
        onInsert={handleInsertRow}
        table={activeTable}
      />
    )}

    <CommandPalette
      opened={showPalette}
      onClose={() => setShowPalette(false)}
      tables={tables ?? []}
      favorites={favorites ?? []}
      onSelectTable={handleSelectTable}
      onSelectFavorite={(sql) => { setActiveTab("query"); setShowPalette(false) }}
      onAction={(action) => {
        if (action === "newquery") setActiveTab("query")
        if (action === "export") handleExport()
      }}
    />

    <SchemaCompareModal
      opened={showSchemaCompare}
      onClose={() => setShowSchemaCompare(false)}
      currentConnectionId={id}
    />

    <ERDiagramModal
      opened={showERDiagram}
      onClose={() => setShowERDiagram(false)}
      tables={tables ?? []}
      connectionId={id}
    />

    <SettingsModal
      opened={showSettings}
      onClose={() => setShowSettings(false)}
      settings={settings}
      onSettingsChange={handleSettingsChange}
    />

    <MacrosModal
      opened={showMacros}
      onClose={() => setShowMacros(false)}
      onReplay={handleMacroReplay}
      recording={macroRecording}
      onStartRecording={() => { setMacroRecording(true); setRecordedSteps([]) }}
      onStopRecording={() => setMacroRecording(false)}
      recordedSteps={recordedSteps}
    />
    </>
  )
}
