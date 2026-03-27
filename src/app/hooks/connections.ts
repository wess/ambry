import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { invoke } from "../butter"

export const useConnections = () =>
  useQuery({
    queryKey: ["connections"],
    queryFn: () => invoke("connection:list", undefined),
  })

export const useSaveConnection = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => invoke("connection:save", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["connections"] }),
  })
}

export const useDeleteConnection = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => invoke("connection:delete", id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["connections"] }),
  })
}

export const useTestConnection = () =>
  useMutation({
    mutationFn: (data: any) => invoke("connection:test", data),
  })

export const useConnect = () =>
  useMutation({
    mutationFn: (id: string) => invoke("connection:connect", id),
  })

export const useDisconnect = () =>
  useMutation({
    mutationFn: (id: string) => invoke("connection:disconnect", id),
  })
