import { getWindow, setWindow } from "butter"
import { version } from "../../package.json"
import { registerConnectionHandlers } from "./connections"
import { registerTableHandlers } from "./tables"
import { registerQueryHandlers } from "./queries"
import { registerSettingsHandlers } from "./settings"
import { registerMacroHandlers } from "./macros"
import { registerPluginHandlers } from "./plugins"

// Show the app version in the title bar, e.g. "Ambry v1.0.7". The version is
// inlined from package.json at compile time (bun embeds the JSON import).
setWindow({ title: `${getWindow().title} v${version}` })

registerConnectionHandlers()
registerTableHandlers()
registerQueryHandlers()
registerSettingsHandlers()
registerMacroHandlers()
registerPluginHandlers()
