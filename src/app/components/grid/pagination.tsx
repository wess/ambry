import { Group, Text, ActionIcon, Select } from "@mantine/core"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"

type Props = {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

export const Pagination = ({ page, pageSize, total, onPageChange, onPageSizeChange }: Props) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const start = total > 0 ? (page - 1) * pageSize + 1 : 0
  const end = Math.min(page * pageSize, total)

  return (
    <Group
      gap="sm"
      px="sm"
      py={3}
      style={{
        borderTop: "1px solid var(--ambry-border)",
        flex: "0 0 auto",
      }}
    >
      <Text size="xs" c="dimmed" style={{ fontVariantNumeric: "tabular-nums", fontSize: 11 }}>
        {total > 0 ? `${start}–${end} of ${total.toLocaleString()}` : "No rows"}
      </Text>
      <Group gap={2} ml="auto">
        <ActionIcon size="xs" disabled={page <= 1} onClick={() => onPageChange(1)}>
          <ChevronsLeft size={13} />
        </ActionIcon>
        <ActionIcon size="xs" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft size={13} />
        </ActionIcon>
        <Text size="xs" c="dimmed" mx={4} style={{ fontVariantNumeric: "tabular-nums", fontSize: 11 }}>
          {page} / {totalPages}
        </Text>
        <ActionIcon size="xs" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          <ChevronRight size={13} />
        </ActionIcon>
        <ActionIcon size="xs" disabled={page >= totalPages} onClick={() => onPageChange(totalPages)}>
          <ChevronsRight size={13} />
        </ActionIcon>
      </Group>
      <Select
        size="xs"
        value={String(pageSize)}
        onChange={(v) => v && onPageSizeChange(Number(v))}
        data={["25", "50", "100", "250", "500", "1000"]}
        w={72}
        styles={{
          input: { fontSize: 11, height: 22, minHeight: 22, paddingLeft: 6, paddingRight: 20 },
        }}
      />
    </Group>
  )
}
