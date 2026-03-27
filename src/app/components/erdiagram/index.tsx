import { Modal, Center, Loader, Text, Stack, Group, ActionIcon, Tooltip, Box } from "@mantine/core"
import { useState, useEffect, useRef, useMemo } from "react"
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react"
import { invoke } from "../../butter"
import type { TableInfo, TableStructure, ForeignKeyInfo } from "../../types"

type TableNode = {
  name: string
  columns: { name: string; type: string; pk: boolean }[]
  x: number
  y: number
}

type Edge = {
  from: string
  fromCol: string
  to: string
  toCol: string
}

type Props = {
  opened: boolean
  onClose: () => void
  tables: TableInfo[]
  connectionId: string
}

const NODE_W = 180
const NODE_H_BASE = 28
const COL_H = 18
const PADDING = 40

const layoutNodes = (tables: TableNode[]): TableNode[] => {
  const cols = Math.ceil(Math.sqrt(tables.length))
  return tables.map((t, i) => ({
    ...t,
    x: PADDING + (i % cols) * (NODE_W + 60),
    y: PADDING + Math.floor(i / cols) * 200,
  }))
}

export const ERDiagramModal = ({ opened, onClose, tables, connectionId }: Props) => {
  const [nodes, setNodes] = useState<TableNode[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [loading, setLoading] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState<{ node: string; offsetX: number; offsetY: number } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!opened || tables.length === 0) return
    setLoading(true)
    const load = async () => {
      const allNodes: TableNode[] = []
      const allEdges: Edge[] = []

      for (const t of tables.filter((t) => t.type === "table")) {
        try {
          const structure = await invoke("table:structure", { table: t.name }) as TableStructure
          allNodes.push({
            name: t.name,
            columns: structure.columns.map((c) => ({ name: c.name, type: c.dataType, pk: c.isPrimaryKey })),
            x: 0,
            y: 0,
          })
          for (const fk of structure.foreignKeys) {
            const cols = Array.isArray(fk.columns) ? fk.columns : [fk.columns]
            const refCols = Array.isArray(fk.referencedColumns) ? fk.referencedColumns : [fk.referencedColumns]
            allEdges.push({
              from: t.name,
              fromCol: cols[0],
              to: fk.referencedTable,
              toCol: refCols[0],
            })
          }
        } catch { /* skip */ }
      }

      setNodes(layoutNodes(allNodes))
      setEdges(allEdges)
      setLoading(false)
    }
    load()
  }, [opened, tables])

  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.name, n])), [nodes])

  const getColY = (node: TableNode, colName: string): number => {
    const idx = node.columns.findIndex((c) => c.name === colName)
    return node.y + NODE_H_BASE + (idx >= 0 ? idx : 0) * COL_H + COL_H / 2
  }

  const handleMouseDown = (name: string, e: React.MouseEvent) => {
    const node = nodeMap.get(name)
    if (!node) return
    setDragging({ node: name, offsetX: e.clientX / zoom - node.x, offsetY: e.clientY / zoom - node.y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return
    setNodes((prev) => prev.map((n) =>
      n.name === dragging.node
        ? { ...n, x: e.clientX / zoom - dragging.offsetX, y: e.clientY / zoom - dragging.offsetY }
        : n
    ))
  }

  const handleMouseUp = () => setDragging(null)

  const svgWidth = Math.max(...nodes.map((n) => n.x + NODE_W + PADDING), 800)
  const svgHeight = Math.max(...nodes.map((n) => n.y + NODE_H_BASE + n.columns.length * COL_H + PADDING), 600)

  return (
    <Modal opened={opened} onClose={onClose} title="ER Diagram" size="xl" fullScreen>
      {loading ? (
        <Center h="100%"><Loader size="sm" /></Center>
      ) : nodes.length === 0 ? (
        <Center h="100%"><Text c="dimmed">No tables found</Text></Center>
      ) : (
        <Stack gap={0} h="100%">
          <Group gap="xs" px="sm" py={4} style={{ borderBottom: "1px solid var(--ambry-border)", flex: "0 0 auto" }}>
            <Tooltip label="Zoom in">
              <ActionIcon size="sm" onClick={() => setZoom((z) => Math.min(z + 0.1, 2))}><ZoomIn size={14} /></ActionIcon>
            </Tooltip>
            <Tooltip label="Zoom out">
              <ActionIcon size="sm" onClick={() => setZoom((z) => Math.max(z - 0.1, 0.3))}><ZoomOut size={14} /></ActionIcon>
            </Tooltip>
            <Tooltip label="Reset">
              <ActionIcon size="sm" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }}><Maximize2 size={14} /></ActionIcon>
            </Tooltip>
            <Text size="xs" c="dimmed" style={{ fontSize: 10 }}>{Math.round(zoom * 100)}%</Text>
            <Text size="xs" c="dimmed" ml="auto" style={{ fontSize: 10 }}>{nodes.length} tables, {edges.length} relationships</Text>
          </Group>
          <Box style={{ flex: 1, overflow: "hidden", cursor: dragging ? "grabbing" : "default" }}>
            <svg
              ref={svgRef}
              width="100%"
              height="100%"
              viewBox={`${-pan.x} ${-pan.y} ${svgWidth / zoom} ${svgHeight / zoom}`}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              style={{ userSelect: "none" }}
            >
              <defs>
                <marker id="arrow" viewBox="0 0 10 6" refX="10" refY="3" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 3 L 0 6 z" fill="var(--mantine-color-blue-5)" />
                </marker>
              </defs>

              {/* Edges */}
              {edges.map((edge, i) => {
                const from = nodeMap.get(edge.from)
                const to = nodeMap.get(edge.to)
                if (!from || !to) return null
                const x1 = from.x + NODE_W
                const y1 = getColY(from, edge.fromCol)
                const x2 = to.x
                const y2 = getColY(to, edge.toCol)
                const midX = (x1 + x2) / 2
                return (
                  <path
                    key={i}
                    d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                    fill="none"
                    stroke="var(--mantine-color-blue-5)"
                    strokeWidth={1.5}
                    opacity={0.6}
                    markerEnd="url(#arrow)"
                  />
                )
              })}

              {/* Nodes */}
              {nodes.map((node) => {
                const h = NODE_H_BASE + node.columns.length * COL_H
                return (
                  <g key={node.name} onMouseDown={(e) => handleMouseDown(node.name, e)} style={{ cursor: "grab" }}>
                    {/* Shadow */}
                    <rect x={node.x + 2} y={node.y + 2} width={NODE_W} height={h} rx={6} fill="rgba(0,0,0,0.15)" />
                    {/* Body */}
                    <rect x={node.x} y={node.y} width={NODE_W} height={h} rx={6} fill="var(--ambry-bg-surface)" stroke="var(--ambry-border)" strokeWidth={1} />
                    {/* Header */}
                    <rect x={node.x} y={node.y} width={NODE_W} height={NODE_H_BASE} rx={6} fill="var(--mantine-color-blue-6)" />
                    <rect x={node.x} y={node.y + NODE_H_BASE - 6} width={NODE_W} height={6} fill="var(--mantine-color-blue-6)" />
                    <text x={node.x + 10} y={node.y + 18} fill="white" fontSize={11} fontWeight={600} fontFamily="var(--mantine-font-family)">
                      {node.name}
                    </text>
                    {/* Columns */}
                    {node.columns.map((col, ci) => (
                      <g key={col.name}>
                        <text
                          x={node.x + 10}
                          y={node.y + NODE_H_BASE + ci * COL_H + 13}
                          fontSize={10}
                          fontFamily="var(--mantine-font-family-monospace)"
                          fill={col.pk ? "var(--mantine-color-yellow-5)" : "var(--mantine-color-text)"}
                          fontWeight={col.pk ? 600 : 400}
                        >
                          {col.pk ? "PK " : ""}{col.name}
                        </text>
                        <text
                          x={node.x + NODE_W - 8}
                          y={node.y + NODE_H_BASE + ci * COL_H + 13}
                          fontSize={9}
                          fontFamily="var(--mantine-font-family-monospace)"
                          fill="var(--mantine-color-dimmed)"
                          textAnchor="end"
                        >
                          {col.type}
                        </text>
                      </g>
                    ))}
                  </g>
                )
              })}
            </svg>
          </Box>
        </Stack>
      )}
    </Modal>
  )
}
