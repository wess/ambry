import { Modal, TextInput, NumberInput, Select, Group, Button, Stack, PasswordInput, ColorInput, Alert, Divider, Tabs, Switch, Textarea } from "@mantine/core"
import { useState, useEffect } from "react"
import { CheckCircle, XCircle, Link, Shield, Terminal } from "lucide-react"
import type { Connection, DatabaseType, SslMode } from "../../types"
import { useTestConnection } from "../../hooks"

type FormData = {
  name: string
  type: DatabaseType
  host: string
  port: number
  database: string
  username: string
  password: string
  color: string
  filepath: string
  sslMode: SslMode
  sslCa: string
  sslCert: string
  sslKey: string
  sshEnabled: boolean
  sshHost: string
  sshPort: number
  sshUsername: string
  sshAuthMethod: "password" | "key"
  sshPassword: string
  sshKeyPath: string
  startupCommands: string
  safeMode: "off" | "confirm" | "readonly"
  group: string
  tags: string
}

type Props = {
  opened: boolean
  onClose: () => void
  onSave: (data: any) => void
  initial?: Connection | null
}

const defaultForm: FormData = {
  name: "",
  type: "postgres",
  host: "localhost",
  port: 5432,
  database: "",
  username: "",
  password: "",
  color: "#339AF0",
  filepath: "",
  sslMode: "disabled",
  sslCa: "",
  sslCert: "",
  sslKey: "",
  sshEnabled: false,
  sshHost: "",
  sshPort: 22,
  sshUsername: "",
  sshAuthMethod: "password",
  sshPassword: "",
  sshKeyPath: "",
  startupCommands: "",
  safeMode: "off",
  group: "",
  tags: "",
}

const defaultPorts: Record<DatabaseType, number> = {
  postgres: 5432,
  mysql: 3306,
  sqlite: 0,
}

const parseConnectionUrl = (url: string): Partial<FormData> | null => {
  try {
    const trimmed = url.trim()
    if (!trimmed.includes("://")) return null

    // sqlite:// is special
    if (trimmed.startsWith("sqlite://") || trimmed.startsWith("sqlite:")) {
      const path = trimmed.replace(/^sqlite:\/\//, "").replace(/^sqlite:/, "")
      return { type: "sqlite", filepath: path }
    }

    const parsed = new URL(trimmed)
    const proto = parsed.protocol.replace(":", "")
    const type: DatabaseType | null =
      proto === "postgres" || proto === "postgresql" ? "postgres" :
      proto === "mysql" || proto === "mariadb" ? "mysql" : null

    if (!type) return null

    return {
      type,
      host: parsed.hostname || "localhost",
      port: parsed.port ? Number(parsed.port) : defaultPorts[type],
      database: parsed.pathname.replace(/^\//, "") || "",
      username: decodeURIComponent(parsed.username || ""),
      password: decodeURIComponent(parsed.password || ""),
    }
  } catch {
    return null
  }
}

export const ConnectionForm = ({ opened, onClose, onSave, initial }: Props) => {
  const [form, setForm] = useState<FormData>(defaultForm)
  const [urlInput, setUrlInput] = useState("")
  const testMutation = useTestConnection()

  useEffect(() => {
    if (initial) {
      setForm({
        name: initial.name,
        type: initial.type,
        host: initial.host,
        port: initial.port,
        database: initial.database,
        username: initial.username,
        password: initial.password,
        color: initial.color || "#339AF0",
        filepath: initial.filepath || "",
        sslMode: initial.ssl?.mode || "disabled",
        sslCa: initial.ssl?.ca || "",
        sslCert: initial.ssl?.cert || "",
        sslKey: initial.ssl?.key || "",
        sshEnabled: initial.ssh?.enabled || false,
        sshHost: initial.ssh?.host || "",
        sshPort: initial.ssh?.port || 22,
        sshUsername: initial.ssh?.username || "",
        sshAuthMethod: initial.ssh?.authMethod || "password",
        sshPassword: initial.ssh?.password || "",
        sshKeyPath: initial.ssh?.keyPath || "",
        startupCommands: initial.startupCommands || "",
        safeMode: initial.safeMode || "off",
        group: initial.group || "",
        tags: initial.tags?.join(", ") || "",
      })
    } else {
      setForm(defaultForm)
    }
    setUrlInput("")
    testMutation.reset()
  }, [initial, opened])

  const update = <K extends keyof FormData>(key: K, value: FormData[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const handleTypeChange = (type: string | null) => {
    if (!type) return
    const t = type as DatabaseType
    update("type", t)
    update("port", defaultPorts[t])
  }

  const handleUrlPaste = () => {
    const parsed = parseConnectionUrl(urlInput)
    if (parsed) {
      setForm((f) => ({ ...f, ...parsed }))
      setUrlInput("")
    }
  }

  const buildSaveData = () => {
    const data: any = {
      id: initial?.id,
      name: form.name,
      type: form.type,
      host: form.host,
      port: form.port,
      database: form.database,
      username: form.username,
      password: form.password,
      color: form.color,
      filepath: form.filepath,
      startupCommands: form.startupCommands || undefined,
      safeMode: form.safeMode !== "off" ? form.safeMode : undefined,
      group: form.group || undefined,
      tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : undefined,
    }
    if (form.sslMode !== "disabled") {
      data.ssl = {
        mode: form.sslMode,
        ca: form.sslCa || undefined,
        cert: form.sslCert || undefined,
        key: form.sslKey || undefined,
      }
    }
    if (form.sshEnabled) {
      data.ssh = {
        enabled: true,
        host: form.sshHost,
        port: form.sshPort,
        username: form.sshUsername,
        authMethod: form.sshAuthMethod,
        password: form.sshPassword || undefined,
        keyPath: form.sshKeyPath || undefined,
      }
    }
    return data
  }

  const isSqlite = form.type === "sqlite"
  const monoInput = { input: { fontFamily: "var(--mantine-font-family-monospace)" } }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={initial ? "Edit Connection" : "New Connection"}
      size="lg"
    >
      <Tabs defaultValue="general" styles={{ tab: { fontSize: 12 } }}>
        <Tabs.List mb="sm">
          <Tabs.Tab value="general">General</Tabs.Tab>
          {!isSqlite && <Tabs.Tab value="ssl" leftSection={<Shield size={12} />}>SSL</Tabs.Tab>}
          {!isSqlite && <Tabs.Tab value="ssh" leftSection={<Terminal size={12} />}>SSH</Tabs.Tab>}
        </Tabs.List>

        <Tabs.Panel value="general">
          <Stack gap="sm">
            {/* URL paste */}
            {!initial && (
              <Group gap="xs" wrap="nowrap">
                <TextInput
                  size="xs"
                  placeholder="Paste connection URL (postgres://, mysql://, sqlite://)"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  flex={1}
                  leftSection={<Link size={12} />}
                  styles={monoInput}
                  onKeyDown={(e) => { if (e.key === "Enter") handleUrlPaste() }}
                />
                <Button size="xs" variant="light" onClick={handleUrlPaste} disabled={!urlInput.trim()}>
                  Parse
                </Button>
              </Group>
            )}

            <Group grow>
              <TextInput label="Name" placeholder="My Database" value={form.name} onChange={(e) => update("name", e.target.value)} required />
              <Select
                label="Type"
                data={[
                  { value: "postgres", label: "PostgreSQL" },
                  { value: "mysql", label: "MySQL / MariaDB" },
                  { value: "sqlite", label: "SQLite" },
                ]}
                value={form.type}
                onChange={handleTypeChange}
              />
            </Group>

            {isSqlite ? (
              <TextInput label="File Path" placeholder="/path/to/database.db" value={form.filepath} onChange={(e) => update("filepath", e.target.value)} required styles={monoInput} />
            ) : (
              <>
                <Group grow>
                  <TextInput label="Host" placeholder="localhost" value={form.host} onChange={(e) => update("host", e.target.value)} styles={monoInput} />
                  <NumberInput label="Port" value={form.port} onChange={(v) => update("port", Number(v))} styles={monoInput} />
                </Group>
                <TextInput label="Database" placeholder="mydb" value={form.database} onChange={(e) => update("database", e.target.value)} required styles={monoInput} />
                <Group grow>
                  <TextInput label="Username" placeholder="postgres" value={form.username} onChange={(e) => update("username", e.target.value)} />
                  <PasswordInput label="Password" placeholder="••••••••" value={form.password} onChange={(e) => update("password", e.target.value)} />
                </Group>
              </>
            )}

            <ColorInput
              label="Accent Color"
              value={form.color}
              onChange={(v) => update("color", v)}
              swatches={["#339AF0", "#22B8CF", "#20C997", "#51CF66", "#FCC419", "#FF922B", "#F06595", "#CC5DE8", "#845EF7"]}
            />

            <Select
              label="Safe Mode"
              description="Protect against accidental writes"
              data={[
                { value: "off", label: "Off — no restrictions" },
                { value: "confirm", label: "Confirm — prompt before writes" },
                { value: "readonly", label: "Read-only — block all writes" },
              ]}
              value={form.safeMode}
              onChange={(v) => v && update("safeMode", v as "off" | "confirm" | "readonly")}
            />

            <Group grow>
              <TextInput
                label="Group"
                placeholder="Production, Staging, Local..."
                value={form.group}
                onChange={(e) => update("group", e.target.value)}
                size="sm"
              />
              <TextInput
                label="Tags"
                placeholder="backend, analytics (comma separated)"
                value={form.tags}
                onChange={(e) => update("tags", e.target.value)}
                size="sm"
              />
            </Group>

            <Textarea
              label="Startup Commands"
              placeholder="SET timezone = 'UTC';"
              description="SQL to run automatically on connect (one statement per line)"
              value={form.startupCommands}
              onChange={(e) => update("startupCommands", e.target.value)}
              autosize
              minRows={2}
              maxRows={4}
              styles={{ input: { fontFamily: "var(--mantine-font-family-monospace)", fontSize: 12 } }}
            />
          </Stack>
        </Tabs.Panel>

        {!isSqlite && (
          <Tabs.Panel value="ssl">
            <Stack gap="sm">
              <Select
                label="SSL Mode"
                data={[
                  { value: "disabled", label: "Disabled" },
                  { value: "required", label: "Required" },
                  { value: "verify-ca", label: "Verify CA" },
                  { value: "verify-identity", label: "Verify Identity" },
                ]}
                value={form.sslMode}
                onChange={(v) => v && update("sslMode", v as SslMode)}
              />
              {form.sslMode !== "disabled" && (
                <>
                  <TextInput label="CA Certificate Path" placeholder="/path/to/ca.pem" value={form.sslCa} onChange={(e) => update("sslCa", e.target.value)} styles={monoInput} />
                  <TextInput label="Client Certificate Path" placeholder="/path/to/client-cert.pem" value={form.sslCert} onChange={(e) => update("sslCert", e.target.value)} styles={monoInput} />
                  <TextInput label="Client Key Path" placeholder="/path/to/client-key.pem" value={form.sslKey} onChange={(e) => update("sslKey", e.target.value)} styles={monoInput} />
                </>
              )}
            </Stack>
          </Tabs.Panel>
        )}

        {!isSqlite && (
          <Tabs.Panel value="ssh">
            <Stack gap="sm">
              <Switch
                label="Enable SSH Tunnel"
                checked={form.sshEnabled}
                onChange={(e) => update("sshEnabled", e.currentTarget.checked)}
              />
              {form.sshEnabled && (
                <>
                  <Group grow>
                    <TextInput label="SSH Host" placeholder="bastion.example.com" value={form.sshHost} onChange={(e) => update("sshHost", e.target.value)} styles={monoInput} />
                    <NumberInput label="SSH Port" value={form.sshPort} onChange={(v) => update("sshPort", Number(v))} styles={monoInput} />
                  </Group>
                  <TextInput label="SSH Username" placeholder="ubuntu" value={form.sshUsername} onChange={(e) => update("sshUsername", e.target.value)} />
                  <Select
                    label="Auth Method"
                    data={[
                      { value: "password", label: "Password" },
                      { value: "key", label: "Private Key" },
                    ]}
                    value={form.sshAuthMethod}
                    onChange={(v) => v && update("sshAuthMethod", v as "password" | "key")}
                  />
                  {form.sshAuthMethod === "password" ? (
                    <PasswordInput label="SSH Password" value={form.sshPassword} onChange={(e) => update("sshPassword", e.target.value)} />
                  ) : (
                    <TextInput label="Private Key Path" placeholder="~/.ssh/id_rsa" value={form.sshKeyPath} onChange={(e) => update("sshKeyPath", e.target.value)} styles={monoInput} />
                  )}
                </>
              )}
            </Stack>
          </Tabs.Panel>
        )}
      </Tabs>

      {testMutation.data && (
        <Alert
          color={testMutation.data.ok ? "teal" : "red"}
          icon={testMutation.data.ok ? <CheckCircle size={16} /> : <XCircle size={16} />}
          radius="md"
          mt="sm"
        >
          {testMutation.data.ok ? `Connected — ${testMutation.data.version}` : testMutation.data.error}
        </Alert>
      )}

      <Divider my="sm" />

      <Group justify="space-between">
        <Button variant="default" size="sm" onClick={() => testMutation.mutate(buildSaveData() as any)} loading={testMutation.isPending}>
          Test
        </Button>
        <Group gap="xs">
          <Button variant="subtle" size="sm" color="gray" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={() => onSave(buildSaveData())}>
            {initial ? "Save" : "Create"}
          </Button>
        </Group>
      </Group>
    </Modal>
  )
}
