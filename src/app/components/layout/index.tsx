import { AppShell } from "@mantine/core"
import { Outlet } from "@tanstack/react-router"

export const Layout = () => (
  <AppShell padding={0} style={{ height: "100vh" }}>
    <Outlet />
  </AppShell>
)
