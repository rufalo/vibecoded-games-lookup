# Starts the field-guide static server (scripts/serve.mjs) in the background with no window,
# unless it is already running. The server listens on http://127.0.0.1:8210/ only;
# The live site is GitHub Pages; this is only for local previews.

$ErrorActionPreference = 'Stop'
$serve = Join-Path $PSScriptRoot 'serve.mjs'

$running = Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -like '*vibecoded-games-lookup*serve.mjs*' }
if ($running) {
  "Already running (pid $($running.ProcessId -join ', ')): http://127.0.0.1:8210/"
  return
}

$node = (Get-Command node -ErrorAction Stop).Source
Start-Process -FilePath $node -ArgumentList "`"$serve`"" -WindowStyle Hidden

# Wait (up to ~5 s) for the port to open.
for ($i = 0; $i -lt 25; $i++) {
  if (Get-NetTCPConnection -LocalPort 8210 -State Listen -ErrorAction SilentlyContinue) {
    "Started: http://127.0.0.1:8210/"
    return
  }
  Start-Sleep -Milliseconds 200
}
Write-Warning "Server did not start listening on 8210. Run 'node scripts/serve.mjs' directly to see errors."
