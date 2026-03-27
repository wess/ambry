import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { invoke } from "../butter"

export const useExecuteQuery = () =>
  useMutation({
    mutationFn: (sql: string) => invoke("query:execute", { sql }),
  })

export const useQueryHistory = () =>
  useQuery({
    queryKey: ["query:history"],
    queryFn: () => invoke("query:history", undefined),
  })

export const useFavorites = () =>
  useQuery({
    queryKey: ["favorites"],
    queryFn: () => invoke("favorites:list", undefined),
  })

export const useSaveFavorite = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { id?: string; name: string; sql: string }) =>
      invoke("favorites:save", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["favorites"] }),
  })
}

export const useDeleteFavorite = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => invoke("favorites:delete", id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["favorites"] }),
  })
}
