import { ScrollArea, Box } from "@mantine/core"

export const DdlTab = ({ ddl }: { ddl: string }) => (
  <ScrollArea h="100%" p="sm" scrollbarSize={4}>
    <Box
      style={{
        fontFamily: "var(--mantine-font-family-monospace)",
        fontSize: 12,
        lineHeight: 1.6,
        whiteSpace: "pre-wrap",
        color: "var(--mantine-color-text)",
        padding: 12,
        backgroundColor: "var(--ambry-bg-surface)",
        borderRadius: "var(--mantine-radius-md)",
      }}
    >
      {ddl}
    </Box>
  </ScrollArea>
)
