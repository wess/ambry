import { Stack, Group, Button, Text, ActionIcon, Tooltip, Box, ScrollArea, useMantineColorScheme } from "@mantine/core"
import { useState, useEffect, useCallback, useRef } from "react"
import { Play, History, PanelRightClose, Star, WrapText, FolderOpen, BarChart3 } from "lucide-react"
import { format as formatSql } from "sql-formatter"
import { CodeMirrorEditor } from "./codemirror"
import { QueryResults } from "./results"
import { QueryHistory } from "./history"
import { FavoritesPanel } from "./favorites"
import { QueryTabBar, type QueryTab } from "./tabs"
import { ChartModal } from "../charts"
import { useExecuteQuery } from "../../hooks"
import { invoke } from "../../butter"
import type { QueryResult, DatabaseType } from "../../types"

type Props = {
  connectionId?: string
  tables?: string[]
  dbType?: DatabaseType
}

const createTab = (index: number): QueryTab => ({
  id: crypto.randomUUID(),
  title: `Query ${index}`,
  sql: "",
})

type TabState = {
  sql: string
  result: QueryResult | null
  multiResults?: (QueryResult & { sql: string })[]
}

export const SqlEditor = ({ connectionId, tables, dbType }: Props) => {
  const [tabs, setTabs] = useState<QueryTab[]>([createTab(1)])
  const [activeTabId, setActiveTabId] = useState(tabs[0].id)
  const [tabStates, setTabStates] = useState<Record<string, TabState>>({
    [tabs[0].id]: { sql: "", result: null },
  })
  const [schema, setSchema] = useState<Record<string, string[]>>({})
  const [rightPanel, setRightPanel] = useState<"history" | "favorites" | null>(null)
  const [tabsLoaded, setTabsLoaded] = useState(false)
  const [vimMode, setVimMode] = useState(false)
  const [showChart, setShowChart] = useState(false)
  const { colorScheme } = useMantineColorScheme()
  const resolvedScheme = colorScheme === "auto" ? "dark" : colorScheme
  const executeMutation = useExecuteQuery()

  const activeState = tabStates[activeTabId] ?? { sql: "", result: null }
  const sqlRef = useRef(activeState.sql)
  sqlRef.current = activeState.sql

  // Load persisted tabs on mount
  useEffect(() => {
    const load = async () => {
      try {
        const saved = await invoke("tabs:load", undefined) as { id: string; title: string; sql: string }[]
        if (saved && saved.length > 0) {
          const loadedTabs = saved.map((t) => ({ id: t.id, title: t.title, sql: t.sql }))
          setTabs(loadedTabs)
          setActiveTabId(loadedTabs[0].id)
          const states: Record<string, TabState> = {}
          for (const t of loadedTabs) states[t.id] = { sql: t.sql, result: null }
          setTabStates(states)
        }
      } catch { /* first run, no saved tabs */ }
      setTabsLoaded(true)
    }
    load()
  }, [])

  // Auto-save tabs on changes (debounced)
  useEffect(() => {
    if (!tabsLoaded) return
    const timeout = setTimeout(() => {
      const data = tabs.map((t) => ({ id: t.id, title: t.title, sql: tabStates[t.id]?.sql ?? "" }))
      invoke("tabs:save", data as any).catch(() => {})
    }, 1000)
    return () => clearTimeout(timeout)
  }, [tabs, tabStates, tabsLoaded])

  useEffect(() => {
    if (!tables || tables.length === 0) return
    const load = async () => {
      const s: Record<string, string[]> = {}
      for (const table of tables) {
        try {
          const structure = await invoke("table:structure", { table })
          s[table] = structure.columns.map((c) => c.name)
        } catch { /* skip */ }
      }
      setSchema(s)
    }
    load()
  }, [tables])

  const updateTabState = (id: string, patch: Partial<TabState>) => {
    setTabStates((prev) => ({ ...prev, [id]: { ...(prev[id] ?? { sql: "", result: null }), ...patch } }))
  }

  const handleSqlChange = (sql: string) => {
    updateTabState(activeTabId, { sql })
  }

  const handleExecute = useCallback(async () => {
    const current = sqlRef.current
    if (!current.trim()) return
    // Check if multiple statements
    const stmts = current.split(/;\s*\n|;\s*$/).map((s) => s.trim()).filter(Boolean)
    if (stmts.length > 1) {
      const results = await invoke("query:execute:multi", { sql: current }) as (QueryResult & { sql: string })[]
      const last = results[results.length - 1] ?? null
      updateTabState(activeTabId, { result: last, multiResults: results })
    } else {
      const res = await executeMutation.mutateAsync(current)
      updateTabState(activeTabId, { result: res, multiResults: undefined })
    }
  }, [executeMutation, activeTabId])

  const handleExplain = useCallback(async () => {
    const current = sqlRef.current
    if (!current.trim()) return
    const prefix = dbType === "mysql" ? "EXPLAIN " : "EXPLAIN ANALYZE "
    const res = await executeMutation.mutateAsync(prefix + current)
    updateTabState(activeTabId, { result: res })
  }, [executeMutation, activeTabId, dbType])

  const handleAddTab = () => {
    const newTab = createTab(tabs.length + 1)
    setTabs((prev) => [...prev, newTab])
    setTabStates((prev) => ({ ...prev, [newTab.id]: { sql: "", result: null } }))
    setActiveTabId(newTab.id)
  }

  const handleCloseTab = (id: string) => {
    if (tabs.length <= 1) return
    const newTabs = tabs.filter((t) => t.id !== id)
    setTabs(newTabs)
    if (activeTabId === id) {
      setActiveTabId(newTabs[newTabs.length - 1].id)
    }
    setTabStates((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  const handleOpenFile = async () => {
    try {
      const { dialog } = await import("butter/dialog")
      const result = await dialog.open({
        prompt: "Open SQL File",
        filters: [{ name: "SQL Files", extensions: ["sql"] }],
      })
      if (result.cancelled || result.paths.length === 0) return
      // Read file content via a host call
      const content = await butter.invoke("file:read", { path: result.paths[0] }) as string
      if (content) {
        const newTab = createTab(tabs.length + 1)
        newTab.title = result.paths[0].split("/").pop() || newTab.title
        setTabs((prev) => [...prev, newTab])
        setTabStates((prev) => ({ ...prev, [newTab.id]: { sql: content, result: null } }))
        setActiveTabId(newTab.id)
      }
    } catch { /* cancelled or error */ }
  }

  const handleHistorySelect = (sql: string) => {
    updateTabState(activeTabId, { sql })
  }

  return (
    <Stack gap={0} h="100%" style={{ overflow: "hidden" }}>
      <QueryTabBar
        tabs={tabs}
        activeId={activeTabId}
        onSelect={setActiveTabId}
        onClose={handleCloseTab}
        onAdd={handleAddTab}
      />
      <Group gap={0} style={{ flex: 1, overflow: "hidden" }} align="stretch" wrap="nowrap">
        <Stack gap={0} style={{ flex: 1, overflow: "hidden" }}>
          <div style={{
            flex: "0 0 200px",
            overflow: "hidden",
            borderBottom: "1px solid var(--ambry-border)",
          }}>
            <CodeMirrorEditor
              key={activeTabId}
              value={activeState.sql}
              onChange={handleSqlChange}
              onExecute={handleExecute}
              dbType={dbType}
              schema={schema}
              vimMode={vimMode}
              colorScheme={resolvedScheme}
            />
          </div>
          <Group
            gap="xs"
            px="sm"
            py={4}
            justify="space-between"
            style={{ flex: "0 0 auto", borderBottom: "1px solid var(--ambry-border)" }}
          >
            <Group gap="xs">
              <Button
                size="compact-xs"
                leftSection={<Play size={12} />}
                onClick={handleExecute}
                loading={executeMutation.isPending}
                styles={{ root: { fontSize: 11, height: 24 } }}
              >
                Run
              </Button>
              <Text size="xs" c="dimmed" style={{ fontSize: 10 }}>⌘↵</Text>
              <Tooltip label="Explain">
                <Button
                  size="compact-xs"
                  variant="subtle"
                  color="gray"
                  onClick={handleExplain}
                  loading={executeMutation.isPending}
                  styles={{ root: { fontSize: 11, height: 24 } }}
                >
                  Explain
                </Button>
              </Tooltip>
              <Tooltip label="Format SQL">
                <ActionIcon
                  size="sm"
                  onClick={() => {
                    try {
                      const lang = dbType === "mysql" ? "mysql" : dbType === "sqlite" ? "sqlite" : "postgresql"
                      const formatted = formatSql(activeState.sql, { language: lang, tabWidth: 2, keywordCase: "upper" })
                      updateTabState(activeTabId, { sql: formatted })
                    } catch { /* ignore format errors */ }
                  }}
                >
                  <WrapText size={13} />
                </ActionIcon>
              </Tooltip>
            </Group>
            <Group gap="xs">
              {activeState.multiResults ? (
                <Text size="xs" c="dimmed" style={{ fontSize: 11, fontVariantNumeric: "tabular-nums" }}>
                  {activeState.multiResults.length} statements · {activeState.multiResults.reduce((s, r) => s + r.executionTime, 0)}ms
                </Text>
              ) : activeState.result && (
                <Text size="xs" c="dimmed" style={{ fontSize: 11, fontVariantNumeric: "tabular-nums" }}>
                  {activeState.result.error
                    ? "Error"
                    : `${activeState.result.rows.length} rows · ${activeState.result.executionTime}ms`}
                </Text>
              )}
              <Tooltip label="Chart results">
                <ActionIcon
                  size="sm"
                  onClick={() => setShowChart(true)}
                  disabled={!activeState.result || activeState.result.rows.length === 0}
                >
                  <BarChart3 size={13} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Open SQL file">
                <ActionIcon size="sm" onClick={handleOpenFile}>
                  <FolderOpen size={13} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label={vimMode ? "Disable Vim" : "Enable Vim"}>
                <ActionIcon
                  size="sm"
                  onClick={() => setVimMode(!vimMode)}
                  variant={vimMode ? "light" : "subtle"}
                  color={vimMode ? "teal" : "gray"}
                  styles={{ root: { fontSize: 10, fontWeight: 600, fontFamily: "var(--mantine-font-family-monospace)" } }}
                >
                  <Text size="xs" style={{ fontSize: 9, fontWeight: 700 }}>VI</Text>
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Favorites">
                <ActionIcon
                  size="sm"
                  onClick={() => setRightPanel(rightPanel === "favorites" ? null : "favorites")}
                  variant={rightPanel === "favorites" ? "light" : "subtle"}
                  color={rightPanel === "favorites" ? "yellow" : "gray"}
                >
                  <Star size={13} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="History">
                <ActionIcon
                  size="sm"
                  onClick={() => setRightPanel(rightPanel === "history" ? null : "history")}
                  variant={rightPanel === "history" ? "light" : "subtle"}
                  color={rightPanel === "history" ? "blue" : "gray"}
                >
                  <History size={13} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>
          <div style={{ flex: 1, overflow: "hidden" }}>
            {activeState.multiResults ? (
              <Stack gap={0} h="100%" style={{ overflow: "auto" }}>
                {activeState.multiResults.map((r, i) => (
                  <Box key={i} style={{ borderBottom: "1px solid var(--ambry-border)" }}>
                    <Group gap="xs" px="sm" py={3} style={{ backgroundColor: "var(--ambry-bg-surface)" }}>
                      <Text size="xs" fw={500} style={{ fontSize: 10 }}>Statement {i + 1}</Text>
                      <Text size="xs" c="dimmed" style={{ fontSize: 10, fontFamily: "var(--mantine-font-family-monospace)" }} truncate>
                        {r.sql?.slice(0, 60)}
                      </Text>
                      <Text size="xs" c={r.error ? "red" : "dimmed"} ml="auto" style={{ fontSize: 10 }}>
                        {r.error ? "Error" : `${r.rows.length} rows · ${r.executionTime}ms`}
                      </Text>
                    </Group>
                    <QueryResults result={r} />
                  </Box>
                ))}
              </Stack>
            ) : (
              <QueryResults result={activeState.result} />
            )}
          </div>
        </Stack>

        {rightPanel && (
          <Box
            style={{
              width: 260,
              borderLeft: "1px solid var(--ambry-border)",
              backgroundColor: "var(--ambry-bg-surface)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <Group px="sm" py={6} justify="space-between" style={{ borderBottom: "1px solid var(--ambry-border)", flex: "0 0 auto" }}>
              <Text size="xs" fw={500} style={{ fontSize: 11 }}>
                {rightPanel === "history" ? "History" : "Favorites"}
              </Text>
              <ActionIcon size="xs" onClick={() => setRightPanel(null)}>
                <PanelRightClose size={13} />
              </ActionIcon>
            </Group>
            <div style={{ flex: 1, overflow: "hidden" }}>
              {rightPanel === "history" ? (
                <QueryHistory onSelect={handleHistorySelect} />
              ) : (
                <FavoritesPanel onSelect={handleHistorySelect} currentSql={activeState.sql} />
              )}
            </div>
          </Box>
        )}
      </Group>

      <ChartModal
        opened={showChart}
        onClose={() => setShowChart(false)}
        result={activeState.result}
      />
    </Stack>
  )
}
