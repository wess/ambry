export type QueryResult = {
  columns: string[]
  columnTypes: Record<string, string>
  rows: Record<string, unknown>[]
  rowsAffected: number
  executionTime: number
  error?: string
}

export type QueryHistoryEntry = {
  id: string
  sql: string
  connectionId: string
  executedAt: string
  executionTime: number
  rowsAffected: number
  error?: string
}

export type Favorite = {
  id: string
  name: string
  sql: string
  createdAt: string
}
