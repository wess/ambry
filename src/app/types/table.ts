import type { FilterCondition } from "./filter"

export type TableInfo = {
  name: string
  type: "table" | "view"
  rowCount: number | null
}

export type ColumnInfo = {
  name: string
  dataType: string
  nullable: boolean
  defaultValue: string | null
  isPrimaryKey: boolean
  comment: string | null
}

export type IndexInfo = {
  name: string
  columns: string[]
  type: string
  unique: boolean
}

export type ForeignKeyInfo = {
  name: string
  columns: string[]
  referencedTable: string
  referencedColumns: string[]
  onDelete: string
  onUpdate: string
}

export type TableStructure = {
  columns: ColumnInfo[]
  indexes: IndexInfo[]
  foreignKeys: ForeignKeyInfo[]
}

export type SortColumn = {
  column: string
  direction: "asc" | "desc"
}

export type RowsRequest = {
  table: string
  page: number
  pageSize: number
  sort?: SortColumn
  filters?: FilterCondition[]
  filterLogic?: "and" | "or"
}

export type RowsResponse = {
  rows: Record<string, unknown>[]
  columns: string[]
  columnTypes: Record<string, string>
  total: number
  page: number
  pageSize: number
}
