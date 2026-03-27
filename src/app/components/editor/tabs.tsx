import { Group, ActionIcon, Tooltip, Text, UnstyledButton, ScrollArea, Box } from "@mantine/core"
import { Plus, X } from "lucide-react"

export type QueryTab = {
  id: string
  title: string
  sql: string
}

type Props = {
  tabs: QueryTab[]
  activeId: string
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onAdd: () => void
}

export const QueryTabBar = ({ tabs, activeId, onSelect, onClose, onAdd }: Props) => (
  <Group
    gap={0}
    wrap="nowrap"
    style={{
      borderBottom: "1px solid var(--ambry-border)",
      backgroundColor: "var(--ambry-bg-surface)",
      flex: "0 0 auto",
      minHeight: 30,
    }}
  >
    <ScrollArea type="never" style={{ flex: 1 }}>
      <Group gap={0} wrap="nowrap">
        {tabs.map((tab) => (
          <UnstyledButton
            key={tab.id}
            onClick={() => onSelect(tab.id)}
            style={{
              padding: "4px 8px 4px 12px",
              fontSize: 11,
              fontWeight: tab.id === activeId ? 500 : 400,
              color: tab.id === activeId ? "var(--mantine-color-text)" : "var(--ambry-text-muted)",
              backgroundColor: tab.id === activeId ? "var(--ambry-bg-subtle)" : "transparent",
              borderRight: "1px solid var(--ambry-border)",
              display: "flex",
              alignItems: "center",
              gap: 4,
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            <Text size="xs" style={{ fontSize: 11 }}>{tab.title}</Text>
            {tabs.length > 1 && (
              <ActionIcon
                size={14}
                variant="subtle"
                color="gray"
                onClick={(e) => { e.stopPropagation(); onClose(tab.id) }}
                style={{ opacity: 0.5 }}
              >
                <X size={10} />
              </ActionIcon>
            )}
          </UnstyledButton>
        ))}
      </Group>
    </ScrollArea>
    <Tooltip label="New query tab">
      <ActionIcon size="sm" mx={4} onClick={onAdd}>
        <Plus size={13} />
      </ActionIcon>
    </Tooltip>
  </Group>
)
