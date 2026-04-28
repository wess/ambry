import { existsSync } from "node:fs"
import { platform } from "node:os"
import { join } from "node:path"

const os = platform()
if (os === "win32") process.exit(0)

const ext = os === "darwin" ? "dylib" : "so"
const nativeDir = join("node_modules", "butter", "src", "ipc", "native")
const dylib = join(nativeDir, `semhelper.${ext}`)
const src = join(nativeDir, "semhelper.c")

if (!existsSync(dylib)) {
  console.log(`Compiling butter semhelper.${ext}...`)
  const result = await Bun.$`clang -shared -o ${dylib} ${src} -fPIC`.quiet()
  if (result.exitCode !== 0) {
    console.error(result.stderr.toString())
    process.exit(1)
  }
}
