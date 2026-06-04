// Typecheck the project's own source with the project tsconfig.
// tsc follows imports into the `butter` dependency, which ships raw
// `.ts` source rather than declarations, so it surfaces diagnostics
// that originate inside node_modules. Those are not actionable here,
// so we report only diagnostics that point at our own files and fail
// the build when any of them exist.

const proc = Bun.spawnSync(["bunx", "tsc", "--noEmit", "--pretty", "false"], {
  stdout: "pipe",
  stderr: "pipe",
})

const output = proc.stdout.toString() + proc.stderr.toString()
const lines = output.split("\n")

const ownErrors = lines.filter(
  (line) => /error TS\d+/.test(line) && !line.includes("node_modules"),
)

if (ownErrors.length > 0) {
  console.error(ownErrors.join("\n"))
  console.error(`\nTypecheck failed: ${ownErrors.length} error(s) in project source.`)
  process.exit(1)
}

console.log("Typecheck passed: 0 errors in project source.")
