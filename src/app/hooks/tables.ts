import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { invoke } from "../butter"
import type { RowsRequest } from "../types"

export const useTables = (connectionId: string | null) =>
  useQuery({
    queryKey: ["tables", connectionId],
    queryFn: () => invoke("tables:list", connectionId!),
    enabled: !!connectionId,
  })

export const useTableRows = (request: RowsRequest | null) =>
  useQuery({
    queryKey: ["table:rows", request],
    queryFn: () => invoke("table:rows", request!),
    enabled: !!request,
  })

export const useTableStructure = (table: string | null) =>
  useQuery({
    queryKey: ["table:structure", table],
    queryFn: () => invoke("table:structure", { table: table! }),
    enabled: !!table,
  })

export const useTableDdl = (table: string | null) =>
  useQuery({
    queryKey: ["table:ddl", table],
    queryFn: () => invoke("table:ddl", { table: table! }),
    enabled: !!table,
  })

export const useDatabases = (connectionId: string | null) =>
  useQuery({
    queryKey: ["databases", connectionId],
    queryFn: () => invoke("databases:list", connectionId!),
    enabled: !!connectionId,
  })

export const useSwitchDatabase = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { connectionId: string; database: string }) =>
      invoke("database:switch", data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["tables", vars.connectionId] })
      qc.invalidateQueries({ queryKey: ["databases", vars.connectionId] })
    },
  })
}
