import { useState, useEffect } from "react"
import { useNavigate } from "@tanstack/react-router"
import { notifications } from "@mantine/notifications"
import { ConnectionList } from "../components/connections/list"
import { ConnectionForm } from "../components/connections/form"
import { useConnections, useSaveConnection, useDeleteConnection, useConnect } from "../hooks"
import type { Connection } from "../types"
import { modals } from "@mantine/modals"

export const ConnectionListPage = () => {
  const navigate = useNavigate()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Connection | null>(null)
  const [connectingId, setConnectingId] = useState<string | null>(null)

  const { data: connections, isLoading } = useConnections()
  const saveMutation = useSaveConnection()
  const deleteMutation = useDeleteConnection()
  const connectMutation = useConnect()

  // Keyboard shortcut: N to open new connection form
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "n" && !e.metaKey && !e.ctrlKey && !formOpen) {
        const target = e.target as HTMLElement
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return
        e.preventDefault()
        setEditing(null)
        setFormOpen(true)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [formOpen])

  const handleConnect = async (id: string) => {
    try {
      setConnectingId(id)
      await connectMutation.mutateAsync(id)
      navigate({ to: "/connection/$id", params: { id } })
    } catch (err: any) {
      notifications.show({ title: "Connection failed", message: err.message, color: "red" })
    } finally {
      setConnectingId(null)
    }
  }

  const handleEdit = (conn: Connection) => {
    setEditing(conn)
    setFormOpen(true)
  }

  const handleNew = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const handleSave = async (data: any) => {
    await saveMutation.mutateAsync(data)
    setFormOpen(false)
    setEditing(null)
  }

  const handleDelete = (id: string) => {
    const conn = connections?.find((c) => c.id === id)
    modals.openConfirmModal({
      title: "Delete Connection",
      children: `Are you sure you want to delete "${conn?.name || "this connection"}"? This cannot be undone.`,
      labels: { confirm: "Delete", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: () => deleteMutation.mutateAsync(id),
    })
  }

  return (
    <>
      <ConnectionList
        connections={connections ?? []}
        loading={isLoading}
        onConnect={handleConnect}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onNew={handleNew}
        connectingId={connectingId}
      />
      <ConnectionForm
        opened={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null) }}
        onSave={handleSave}
        initial={editing}
      />
    </>
  )
}
