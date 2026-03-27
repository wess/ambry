import { createRouter, createRootRoute, createRoute, createHashHistory } from "@tanstack/react-router"
import { Layout } from "./components/layout"
import { ConnectionListPage } from "./routes"
import { ConnectionWorkspacePage } from "./routes/connection"

const rootRoute = createRootRoute({
  component: Layout,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: ConnectionListPage,
})

const connectionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/connection/$id",
  component: ConnectionWorkspacePage,
})

const routeTree = rootRoute.addChildren([indexRoute, connectionRoute])

const hashHistory = createHashHistory()

export const router = createRouter({ routeTree, history: hashHistory })

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}
