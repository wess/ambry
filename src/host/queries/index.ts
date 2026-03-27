import { on } from "butter"
import { getAdapter } from "../db"
import { getActiveConnectionId } from "../state"
import { addHistoryEntry, getHistory } from "./history"
import { listFavorites, saveFavorite, deleteFavorite } from "./favorites"
import { loadTabs, saveTabs } from "./tabs"

export const registerQueryHandlers = () => {
  on("query:execute", async (data: any) => {
    const connectionId = getActiveConnectionId()
    if (!connectionId) throw new Error("No active connection")
    const adapter = getAdapter(connectionId)
    const start = performance.now()
    try {
      const result = await adapter.query((data as any).sql)
      const executionTime = Math.round(performance.now() - start)
      await addHistoryEntry({
        id: crypto.randomUUID(),
        sql: (data as any).sql,
        connectionId,
        executedAt: new Date().toISOString(),
        executionTime,
        rowsAffected: result.rowsAffected,
      })
      return { ...result, executionTime }
    } catch (err: any) {
      const executionTime = Math.round(performance.now() - start)
      await addHistoryEntry({
        id: crypto.randomUUID(),
        sql: (data as any).sql,
        connectionId,
        executedAt: new Date().toISOString(),
        executionTime,
        rowsAffected: 0,
        error: err.message,
      })
      return {
        columns: [],
        columnTypes: {},
        rows: [],
        rowsAffected: 0,
        executionTime,
        error: err.message,
      }
    }
  })

  on("query:execute:multi", async (data: any) => {
    const connectionId = getActiveConnectionId()
    if (!connectionId) throw new Error("No active connection")
    const adapter = getAdapter(connectionId)
    const rawSql = (data as any).sql as string
    // Split on semicolons, but not inside strings
    const statements = rawSql.split(/;\s*\n|;\s*$/).map((s) => s.trim()).filter(Boolean)
    const results = []
    for (const stmt of statements) {
      const start = performance.now()
      try {
        const result = await adapter.query(stmt)
        const executionTime = Math.round(performance.now() - start)
        await addHistoryEntry({
          id: crypto.randomUUID(),
          sql: stmt,
          connectionId,
          executedAt: new Date().toISOString(),
          executionTime,
          rowsAffected: result.rowsAffected,
        })
        results.push({ ...result, executionTime, sql: stmt })
      } catch (err: any) {
        const executionTime = Math.round(performance.now() - start)
        await addHistoryEntry({
          id: crypto.randomUUID(),
          sql: stmt,
          connectionId,
          executedAt: new Date().toISOString(),
          executionTime,
          rowsAffected: 0,
          error: err.message,
        })
        results.push({
          columns: [],
          columnTypes: {},
          rows: [],
          rowsAffected: 0,
          executionTime,
          error: err.message,
          sql: stmt,
        })
        break // stop on first error
      }
    }
    return results
  })

  on("query:history", async () => {
    return await getHistory()
  })

  on("favorites:list", async () => {
    return await listFavorites()
  })

  on("favorites:save", async (data: any) => {
    return await saveFavorite({
      id: data.id || crypto.randomUUID(),
      name: data.name,
      sql: data.sql,
      createdAt: data.createdAt || new Date().toISOString(),
    })
  })

  on("favorites:delete", async (id: any) => {
    return await deleteFavorite(id as string)
  })

  on("tabs:load", async () => {
    return await loadTabs()
  })

  on("tabs:save", async (data: any) => {
    await saveTabs(data as any[])
    return true
  })
}
