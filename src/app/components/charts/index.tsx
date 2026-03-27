import { Modal, Stack, Group, Select, Text, Box, SegmentedControl, ScrollArea } from "@mantine/core"
import { useState, useMemo } from "react"
import type { QueryResult } from "../../types"

type ChartType = "bar" | "line" | "pie"

type Props = {
  opened: boolean
  onClose: () => void
  result: QueryResult | null
}

const COLORS = [
  "var(--mantine-color-blue-5)",
  "var(--mantine-color-teal-5)",
  "var(--mantine-color-orange-5)",
  "var(--mantine-color-violet-5)",
  "var(--mantine-color-pink-5)",
  "var(--mantine-color-yellow-5)",
  "var(--mantine-color-cyan-5)",
  "var(--mantine-color-red-5)",
  "var(--mantine-color-green-5)",
  "var(--mantine-color-indigo-5)",
]

const isNumeric = (v: unknown): v is number => typeof v === "number" || (typeof v === "string" && !isNaN(Number(v)) && v.trim() !== "")

const BarChart = ({ labels, values, maxVal }: { labels: string[]; values: number[]; maxVal: number }) => {
  const barW = Math.max(20, Math.min(60, 500 / labels.length))
  const h = 250
  const chartW = labels.length * (barW + 8) + 40

  return (
    <svg width={chartW} height={h + 40} style={{ overflow: "visible" }}>
      {values.map((v, i) => {
        const barH = maxVal > 0 ? (v / maxVal) * h : 0
        const x = 30 + i * (barW + 8)
        return (
          <g key={i}>
            <rect x={x} y={h - barH} width={barW} height={barH} fill={COLORS[i % COLORS.length]} rx={3} />
            <text x={x + barW / 2} y={h - barH - 5} textAnchor="middle" fontSize={9} fill="var(--mantine-color-text)">{v}</text>
            <text x={x + barW / 2} y={h + 14} textAnchor="middle" fontSize={8} fill="var(--mantine-color-dimmed)" transform={`rotate(30 ${x + barW / 2} ${h + 14})`}>
              {labels[i].length > 12 ? labels[i].slice(0, 12) + "..." : labels[i]}
            </text>
          </g>
        )
      })}
      <line x1={28} y1={0} x2={28} y2={h} stroke="var(--ambry-border)" strokeWidth={1} />
      <line x1={28} y1={h} x2={chartW} y2={h} stroke="var(--ambry-border)" strokeWidth={1} />
    </svg>
  )
}

const LineChart = ({ labels, values, maxVal }: { labels: string[]; values: number[]; maxVal: number }) => {
  const w = 500
  const h = 250
  const stepX = labels.length > 1 ? (w - 40) / (labels.length - 1) : 0

  const points = values.map((v, i) => ({
    x: 30 + i * stepX,
    y: maxVal > 0 ? h - (v / maxVal) * h : h,
  }))

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ")

  return (
    <svg width={w} height={h + 40} style={{ overflow: "visible" }}>
      <path d={pathD} fill="none" stroke="var(--mantine-color-blue-5)" strokeWidth={2} />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={3} fill="var(--mantine-color-blue-5)" />
          <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize={9} fill="var(--mantine-color-text)">{values[i]}</text>
        </g>
      ))}
      <line x1={28} y1={0} x2={28} y2={h} stroke="var(--ambry-border)" strokeWidth={1} />
      <line x1={28} y1={h} x2={w} y2={h} stroke="var(--ambry-border)" strokeWidth={1} />
    </svg>
  )
}

const PieChart = ({ labels, values }: { labels: string[]; values: number[] }) => {
  const total = values.reduce((s, v) => s + v, 0)
  if (total === 0) return null
  const r = 100
  const cx = 120
  const cy = 120
  let angle = -Math.PI / 2

  const slices = values.map((v, i) => {
    const sweep = (v / total) * Math.PI * 2
    const x1 = cx + r * Math.cos(angle)
    const y1 = cy + r * Math.sin(angle)
    const x2 = cx + r * Math.cos(angle + sweep)
    const y2 = cy + r * Math.sin(angle + sweep)
    const large = sweep > Math.PI ? 1 : 0
    const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`
    angle += sweep
    return { path, color: COLORS[i % COLORS.length], label: labels[i], pct: Math.round((v / total) * 100) }
  })

  return (
    <Group gap="lg" align="flex-start">
      <svg width={240} height={240}>
        {slices.map((s, i) => (
          <path key={i} d={s.path} fill={s.color} stroke="var(--ambry-bg-surface)" strokeWidth={2} />
        ))}
      </svg>
      <Stack gap={4}>
        {slices.map((s, i) => (
          <Group key={i} gap={6}>
            <Box style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: s.color, flexShrink: 0 }} />
            <Text size="xs" style={{ fontSize: 11 }}>{s.label} ({s.pct}%)</Text>
          </Group>
        ))}
      </Stack>
    </Group>
  )
}

export const ChartModal = ({ opened, onClose, result }: Props) => {
  const [chartType, setChartType] = useState<ChartType>("bar")
  const [labelCol, setLabelCol] = useState<string | null>(null)
  const [valueCol, setValueCol] = useState<string | null>(null)

  const columns = result?.columns ?? []
  const rows = result?.rows ?? []

  const numericCols = useMemo(() => columns.filter((c) => rows.some((r) => isNumeric(r[c]))), [columns, rows])
  const labelCols = useMemo(() => columns.filter((c) => !numericCols.includes(c) || true), [columns, numericCols])

  const effectiveLabel = labelCol || labelCols[0] || columns[0]
  const effectiveValue = valueCol || numericCols[0] || columns[1]

  const labels = rows.map((r) => String(r[effectiveLabel] ?? ""))
  const values = rows.map((r) => {
    const v = r[effectiveValue]
    return isNumeric(v) ? Number(v) : 0
  })
  const maxVal = Math.max(...values, 1)

  return (
    <Modal opened={opened} onClose={onClose} title="Chart" size="lg">
      <Stack gap="sm">
        <Group gap="sm">
          <SegmentedControl
            size="xs"
            value={chartType}
            onChange={(v) => setChartType(v as ChartType)}
            data={[
              { value: "bar", label: "Bar" },
              { value: "line", label: "Line" },
              { value: "pie", label: "Pie" },
            ]}
          />
          <Select size="xs" label="Labels" value={effectiveLabel} onChange={setLabelCol} data={columns} w={150} />
          <Select size="xs" label="Values" value={effectiveValue} onChange={setValueCol} data={columns} w={150} />
        </Group>

        {rows.length === 0 ? (
          <Text c="dimmed" size="sm" ta="center" py="lg">No data to chart</Text>
        ) : (
          <ScrollArea>
            <Box py="md" px="sm">
              {chartType === "bar" && <BarChart labels={labels} values={values} maxVal={maxVal} />}
              {chartType === "line" && <LineChart labels={labels} values={values} maxVal={maxVal} />}
              {chartType === "pie" && <PieChart labels={labels} values={values} />}
            </Box>
          </ScrollArea>
        )}
      </Stack>
    </Modal>
  )
}
