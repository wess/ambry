import type { Menu } from "butter/types"

const menu: Menu = [
  {
    label: "File",
    items: [
      { label: "New Connection", action: "connection:new", shortcut: "CmdOrCtrl+N" },
      { separator: true },
      { label: "Quit", action: "quit", shortcut: "CmdOrCtrl+Q" },
    ],
  },
  {
    label: "Edit",
    items: [
      { label: "Undo", action: "undo", shortcut: "CmdOrCtrl+Z" },
      { label: "Redo", action: "redo", shortcut: "CmdOrCtrl+Shift+Z" },
      { separator: true },
      { label: "Cut", action: "cut", shortcut: "CmdOrCtrl+X" },
      { label: "Copy", action: "copy", shortcut: "CmdOrCtrl+C" },
      { label: "Paste", action: "paste", shortcut: "CmdOrCtrl+V" },
      { label: "Select All", action: "select-all", shortcut: "CmdOrCtrl+A" },
    ],
  },
  {
    label: "Query",
    items: [
      { label: "Execute Query", action: "query:run", shortcut: "CmdOrCtrl+Enter" },
    ],
  },
]

export default menu
