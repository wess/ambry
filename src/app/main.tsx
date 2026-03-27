import { createRoot } from "react-dom/client"
import { MantineProvider, createTheme } from "@mantine/core"
import { Notifications } from "@mantine/notifications"
import { ModalsProvider } from "@mantine/modals"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { RouterProvider } from "@tanstack/react-router"
import { router } from "./router"
import "@mantine/core/styles.css"
import "@mantine/code-highlight/styles.css"
import "@mantine/notifications/styles.css"

const theme = createTheme({
  primaryColor: "blue",
  defaultRadius: "md",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  fontFamilyMonospace:
    "'SF Mono', 'Fira Code', 'Cascadia Code', Menlo, Consolas, monospace",
  headings: {
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    fontWeight: "600",
  },
  colors: {
    dark: [
      "#C1C2C5",
      "#A6A7AB",
      "#909296",
      "#5C5F66",
      "#373A40",
      "#2C2E33",
      "#25262B",
      "#1A1B1E",
      "#141517",
      "#101113",
    ],
  },
  components: {
    ActionIcon: {
      defaultProps: {
        variant: "subtle",
        color: "gray",
      },
    },
    Button: {
      styles: {
        root: {
          fontWeight: 500,
        },
      },
    },
    Tooltip: {
      defaultProps: {
        withArrow: true,
        openDelay: 400,
      },
    },
    Modal: {
      defaultProps: {
        centered: true,
        overlayProps: {
          backgroundOpacity: 0.4,
          blur: 4,
        },
        transitionProps: {
          transition: "pop",
          duration: 150,
        },
      },
    },
  },
})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5000,
    },
  },
})

const root = document.getElementById("root")
if (root) {
  createRoot(root).render(
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <ModalsProvider>
        <Notifications position="top-right" autoClose={4000} />
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </ModalsProvider>
    </MantineProvider>,
  )
}
