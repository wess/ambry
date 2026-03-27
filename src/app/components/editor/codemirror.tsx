import { useRef, useEffect, useCallback } from "react"
import { EditorView, keymap, placeholder as cmPlaceholder, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from "@codemirror/view"
import { EditorState, Compartment } from "@codemirror/state"
import { sql, PostgreSQL, MySQL, SQLite, type SQLDialect } from "@codemirror/lang-sql"
import { autocompletion, closeBrackets, type CompletionContext, type Completion } from "@codemirror/autocomplete"
import { defaultKeymap, history, historyKeymap, indentWithTab, deleteLine, moveLineUp, moveLineDown, copyLineDown } from "@codemirror/commands"
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from "@codemirror/language"
import { highlightSelectionMatches, searchKeymap, search } from "@codemirror/search"
import { HighlightStyle } from "@codemirror/language"
import { tags } from "@lezer/highlight"
import { vim } from "@replit/codemirror-vim"
import type { DatabaseType } from "../../types"

const darkTheme = EditorView.theme({
  "&": {
    backgroundColor: "#141517",
    color: "#C1C2C5",
    fontSize: "13px",
    height: "100%",
  },
  ".cm-content": {
    fontFamily: "'SF Mono', 'Fira Code', Menlo, Consolas, monospace",
    padding: "8px 0",
    caretColor: "#C1C2C5",
  },
  ".cm-cursor": {
    borderLeftColor: "#C1C2C5",
  },
  ".cm-gutters": {
    backgroundColor: "#141517",
    color: "#5C5F66",
    border: "none",
    paddingRight: "8px",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "transparent",
    color: "#909296",
  },
  ".cm-activeLine": {
    backgroundColor: "#1A1B1E",
  },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
    backgroundColor: "#1971c244 !important",
  },
  ".cm-tooltip": {
    backgroundColor: "#1A1B1E",
    border: "1px solid #25262B",
    borderRadius: "4px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
  },
  ".cm-tooltip-autocomplete": {
    "& > ul": {
      fontFamily: "'SF Mono', 'Fira Code', Menlo, Consolas, monospace",
      fontSize: "12px",
    },
    "& > ul > li": {
      padding: "3px 8px",
    },
    "& > ul > li[aria-selected]": {
      backgroundColor: "#25262B",
      color: "#C1C2C5",
    },
  },
  ".cm-completionLabel": {
    color: "#C1C2C5",
  },
  ".cm-completionDetail": {
    color: "#5C5F66",
    fontStyle: "italic",
    marginLeft: "8px",
  },
  ".cm-completionMatchedText": {
    color: "#339AF0",
    textDecoration: "none",
    fontWeight: 600,
  },
  ".cm-searchMatch": {
    backgroundColor: "#e2e80033",
  },
  ".cm-panels": {
    backgroundColor: "#1A1B1E",
    borderBottom: "1px solid #25262B",
  },
  ".cm-panels input, .cm-panels button": {
    fontFamily: "inherit",
    fontSize: "12px",
  },
  ".cm-panel.cm-search": {
    padding: "6px 8px",
  },
  ".cm-panel.cm-search input": {
    backgroundColor: "#25262B",
    color: "#C1C2C5",
    border: "1px solid #373A40",
    borderRadius: "4px",
    padding: "2px 6px",
  },
  ".cm-panel.cm-search button": {
    backgroundColor: "#25262B",
    color: "#C1C2C5",
    border: "1px solid #373A40",
    borderRadius: "4px",
    padding: "2px 8px",
    cursor: "pointer",
  },
  ".cm-panel.cm-search label": {
    color: "#909296",
    fontSize: "12px",
  },
  ".cm-placeholder": {
    color: "#5C5F66",
  },
  ".cm-scroller": {
    overflow: "auto",
  },
}, { dark: true })

const darkHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: "#c678dd", fontWeight: "600" },
  { tag: tags.operatorKeyword, color: "#c678dd" },
  { tag: tags.string, color: "#98c379" },
  { tag: tags.number, color: "#d19a66" },
  { tag: tags.bool, color: "#d19a66" },
  { tag: tags.null, color: "#d19a66", fontStyle: "italic" },
  { tag: tags.comment, color: "#5c6370", fontStyle: "italic" },
  { tag: tags.operator, color: "#56b6c2" },
  { tag: tags.punctuation, color: "#abb2bf" },
  { tag: tags.typeName, color: "#e5c07b" },
  { tag: tags.className, color: "#e06c75" },
  { tag: tags.function(tags.variableName), color: "#61afef" },
  { tag: tags.propertyName, color: "#e06c75" },
  { tag: tags.variableName, color: "#e06c75" },
  { tag: tags.special(tags.string), color: "#56b6c2" },
])

const lightTheme = EditorView.theme({
  "&": {
    backgroundColor: "#ffffff",
    color: "#212529",
    fontSize: "13px",
    height: "100%",
  },
  ".cm-content": {
    fontFamily: "'SF Mono', 'Fira Code', Menlo, Consolas, monospace",
    padding: "8px 0",
    caretColor: "#212529",
  },
  ".cm-cursor": { borderLeftColor: "#212529" },
  ".cm-gutters": {
    backgroundColor: "#ffffff",
    color: "#adb5bd",
    border: "none",
    paddingRight: "8px",
  },
  ".cm-activeLineGutter": { backgroundColor: "transparent", color: "#495057" },
  ".cm-activeLine": { backgroundColor: "#f8f9fa" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
    backgroundColor: "#d0ebff !important",
  },
  ".cm-tooltip": {
    backgroundColor: "#ffffff",
    border: "1px solid #dee2e6",
    borderRadius: "4px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
  },
  ".cm-tooltip-autocomplete": {
    "& > ul": { fontFamily: "'SF Mono', 'Fira Code', Menlo, Consolas, monospace", fontSize: "12px" },
    "& > ul > li": { padding: "3px 8px" },
    "& > ul > li[aria-selected]": { backgroundColor: "#e7f5ff", color: "#212529" },
  },
  ".cm-completionLabel": { color: "#212529" },
  ".cm-completionDetail": { color: "#868e96", fontStyle: "italic", marginLeft: "8px" },
  ".cm-completionMatchedText": { color: "#1c7ed6", textDecoration: "none", fontWeight: 600 },
  ".cm-searchMatch": { backgroundColor: "#fff3bf" },
  ".cm-panels": { backgroundColor: "#f8f9fa", borderBottom: "1px solid #dee2e6" },
  ".cm-panels input, .cm-panels button": { fontFamily: "inherit", fontSize: "12px" },
  ".cm-panel.cm-search": { padding: "6px 8px" },
  ".cm-panel.cm-search input": {
    backgroundColor: "#ffffff", color: "#212529", border: "1px solid #ced4da", borderRadius: "4px", padding: "2px 6px",
  },
  ".cm-panel.cm-search button": {
    backgroundColor: "#f8f9fa", color: "#212529", border: "1px solid #ced4da", borderRadius: "4px", padding: "2px 8px", cursor: "pointer",
  },
  ".cm-panel.cm-search label": { color: "#868e96", fontSize: "12px" },
  ".cm-placeholder": { color: "#adb5bd" },
  ".cm-scroller": { overflow: "auto" },
}, { dark: false })

const lightHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: "#7048e8", fontWeight: "600" },
  { tag: tags.operatorKeyword, color: "#7048e8" },
  { tag: tags.string, color: "#2b8a3e" },
  { tag: tags.number, color: "#e67700" },
  { tag: tags.bool, color: "#e67700" },
  { tag: tags.null, color: "#e67700", fontStyle: "italic" },
  { tag: tags.comment, color: "#868e96", fontStyle: "italic" },
  { tag: tags.operator, color: "#0c8599" },
  { tag: tags.punctuation, color: "#495057" },
  { tag: tags.typeName, color: "#e67700" },
  { tag: tags.className, color: "#c92a2a" },
  { tag: tags.function(tags.variableName), color: "#1c7ed6" },
  { tag: tags.propertyName, color: "#c92a2a" },
  { tag: tags.variableName, color: "#c92a2a" },
  { tag: tags.special(tags.string), color: "#0c8599" },
])

const sqlSnippets: Completion[] = [
  { label: "sel", displayLabel: "SELECT * FROM", apply: "SELECT * FROM ", type: "keyword", boost: 10 },
  { label: "selw", displayLabel: "SELECT * FROM ... WHERE", apply: "SELECT * FROM  WHERE ", type: "keyword", boost: 10 },
  { label: "selc", displayLabel: "SELECT COUNT(*) FROM", apply: "SELECT COUNT(*) FROM ", type: "keyword", boost: 10 },
  { label: "ins", displayLabel: "INSERT INTO ... VALUES", apply: "INSERT INTO  () VALUES ();", type: "keyword", boost: 10 },
  { label: "upd", displayLabel: "UPDATE ... SET ... WHERE", apply: "UPDATE  SET  WHERE ;", type: "keyword", boost: 10 },
  { label: "del", displayLabel: "DELETE FROM ... WHERE", apply: "DELETE FROM  WHERE ;", type: "keyword", boost: 10 },
  { label: "crt", displayLabel: "CREATE TABLE", apply: "CREATE TABLE  (\n  id SERIAL PRIMARY KEY,\n  \n);", type: "keyword", boost: 10 },
  { label: "alt", displayLabel: "ALTER TABLE", apply: "ALTER TABLE  ADD COLUMN ;", type: "keyword", boost: 10 },
  { label: "drp", displayLabel: "DROP TABLE", apply: "DROP TABLE IF EXISTS ;", type: "keyword", boost: 10 },
  { label: "idx", displayLabel: "CREATE INDEX", apply: "CREATE INDEX  ON  ();", type: "keyword", boost: 10 },
  { label: "jn", displayLabel: "JOIN ... ON", apply: "JOIN  ON . = .;", type: "keyword", boost: 10 },
  { label: "lj", displayLabel: "LEFT JOIN ... ON", apply: "LEFT JOIN  ON . = .;", type: "keyword", boost: 10 },
  { label: "grp", displayLabel: "GROUP BY ... HAVING", apply: "GROUP BY  HAVING ;", type: "keyword", boost: 10 },
  { label: "ord", displayLabel: "ORDER BY ... LIMIT", apply: "ORDER BY  DESC LIMIT 100;", type: "keyword", boost: 10 },
  { label: "cte", displayLabel: "WITH ... AS (CTE)", apply: "WITH  AS (\n  SELECT \n)\nSELECT * FROM ;", type: "keyword", boost: 10 },
  { label: "exist", displayLabel: "WHERE EXISTS", apply: "WHERE EXISTS (SELECT 1 FROM  WHERE );", type: "keyword", boost: 10 },
  { label: "case", displayLabel: "CASE WHEN", apply: "CASE\n  WHEN  THEN \n  ELSE \nEND", type: "keyword", boost: 10 },
]

const snippetCompletion = (context: CompletionContext) => {
  const word = context.matchBefore(/\w+/)
  if (!word || word.from === word.to) return null
  return {
    from: word.from,
    options: sqlSnippets,
    filter: true,
  }
}

const dialectMap: Record<string, SQLDialect> = {
  postgres: PostgreSQL,
  mysql: MySQL,
  sqlite: SQLite,
}

type Props = {
  value: string
  onChange: (value: string) => void
  onExecute: () => void
  dbType?: DatabaseType
  schema?: Record<string, string[]>
  vimMode?: boolean
  colorScheme?: "light" | "dark"
}

export const CodeMirrorEditor = ({ value, onChange, onExecute, dbType, schema, vimMode, colorScheme = "dark" }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const sqlCompartment = useRef(new Compartment())
  const vimCompartment = useRef(new Compartment())
  const themeCompartment = useRef(new Compartment())
  const onChangeRef = useRef(onChange)
  const onExecuteRef = useRef(onExecute)

  onChangeRef.current = onChange
  onExecuteRef.current = onExecute

  const executeKeymap = useCallback(() => keymap.of([{
    key: "Mod-Enter",
    run: () => {
      onExecuteRef.current()
      return true
    },
  }]), [])

  useEffect(() => {
    if (!containerRef.current) return

    const dialect = dialectMap[dbType ?? "postgres"] ?? PostgreSQL
    const sqlExt = sql({
      dialect,
      schema: schema ?? {},
      upperCaseKeywords: true,
    })

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        history(),
        closeBrackets(),
        bracketMatching(),
        autocompletion({ defaultKeymap: true, override: [snippetCompletion] }),
        search({ top: true }),
        highlightSelectionMatches(),
        sqlCompartment.current.of(sqlExt),
        vimCompartment.current.of(vimMode ? vim() : []),
        themeCompartment.current.of([
          colorScheme === "dark" ? darkTheme : lightTheme,
          syntaxHighlighting(colorScheme === "dark" ? darkHighlight : lightHighlight),
        ]),
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...searchKeymap,
          indentWithTab,
          { key: "Mod-Shift-k", run: deleteLine },
          { key: "Alt-ArrowUp", run: moveLineUp },
          { key: "Alt-ArrowDown", run: moveLineDown },
          { key: "Mod-Shift-d", run: copyLineDown },
        ]),
        EditorState.allowMultipleSelections.of(true),
        executeKeymap(),
        cmPlaceholder("SELECT * FROM ..."),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString())
          }
        }),
        EditorView.lineWrapping,
      ],
    })

    const view = new EditorView({
      state,
      parent: containerRef.current,
    })

    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [])

  // Toggle color scheme
  useEffect(() => {
    if (!viewRef.current) return
    viewRef.current.dispatch({
      effects: themeCompartment.current.reconfigure([
        colorScheme === "dark" ? darkTheme : lightTheme,
        syntaxHighlighting(colorScheme === "dark" ? darkHighlight : lightHighlight),
      ]),
    })
  }, [colorScheme])

  // Toggle vim mode
  useEffect(() => {
    if (!viewRef.current) return
    viewRef.current.dispatch({
      effects: vimCompartment.current.reconfigure(vimMode ? vim() : []),
    })
  }, [vimMode])

  // Update schema completions when they change
  useEffect(() => {
    if (!viewRef.current) return
    const dialect = dialectMap[dbType ?? "postgres"] ?? PostgreSQL
    viewRef.current.dispatch({
      effects: sqlCompartment.current.reconfigure(
        sql({ dialect, schema: schema ?? {}, upperCaseKeywords: true })
      ),
    })
  }, [schema, dbType])

  // Sync external value changes (only if different from editor)
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      })
    }
  }, [value])

  return (
    <div
      ref={containerRef}
      style={{ height: "100%", overflow: "hidden" }}
    />
  )
}
