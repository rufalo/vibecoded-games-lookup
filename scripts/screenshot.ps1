# Takes a screenshot of a web page with headless Microsoft Edge (throwaway profile), e.g. a live
# browser game that has no og:image. WebGL falls back to software rendering if needed.
#
#   powershell -File scripts\screenshot.ps1 -Url https://example.com -Out site\media\example.png [-WaitMs 12000] [-ColorScheme dark]
#
# Then re-encode/resize with: powershell -File scripts\resize-image.ps1 -In <png> -Out site\media\<id>.jpg

param(
  [Parameter(Mandatory = $true)][string]$Url,
  [Parameter(Mandatory = $true)][string]$Out,
  [int]$WaitMs = 12000,
  [int]$Width = 1280,
  [int]$Height = 720,
  [ValidateSet('', 'dark', 'light')][string]$ColorScheme = ''
)

$ErrorActionPreference = 'Stop'
$edge = @(
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { throw 'Microsoft Edge not found.' }

$profileDir = Join-Path ([IO.Path]::GetTempPath()) ("vgl-edge-" + [guid]::NewGuid().ToString('N'))
$outFull = [IO.Path]::GetFullPath($Out)
try {
  $edgeArgs = @(
    '--headless=new', '--hide-scrollbars', '--mute-audio', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
    "--window-size=$Width,$Height", "--virtual-time-budget=$WaitMs",
    "--user-data-dir=$profileDir", "--screenshot=$outFull"
  )
  # Emulate the OS colour scheme (Blink: 0 = dark, 1 = light), e.g. to check a site's dark theme.
  if ($ColorScheme) { $edgeArgs += "--blink-settings=preferredColorScheme=$(if ($ColorScheme -eq 'dark') { 0 } else { 1 })" }
  $edgeArgs += $Url
  $p = Start-Process -FilePath $edge -ArgumentList $edgeArgs -PassThru -WindowStyle Hidden
  if (-not $p.WaitForExit([Math]::Max(60000, $WaitMs * 4))) { $p.Kill(); throw "Edge timed out on $Url" }
  if (-not (Test-Path $outFull)) { throw "No screenshot written for $Url" }
  "Saved $outFull ($((Get-Item $outFull).Length) bytes)"
}
finally {
  Start-Sleep -Milliseconds 500
  Remove-Item -Recurse -Force $profileDir -ErrorAction SilentlyContinue
}
