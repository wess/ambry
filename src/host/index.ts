import { registerConnectionHandlers } from "./connections"
import { registerTableHandlers } from "./tables"
import { registerQueryHandlers } from "./queries"
import { registerSettingsHandlers } from "./settings"
import { registerMacroHandlers } from "./macros"
import { registerPluginHandlers } from "./plugins"

registerConnectionHandlers()
registerTableHandlers()
registerQueryHandlers()
registerSettingsHandlers()
registerMacroHandlers()
registerPluginHandlers()
