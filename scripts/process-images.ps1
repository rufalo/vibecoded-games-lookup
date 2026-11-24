# Batch image processor used by scripts/fetch-gallery.mjs.
# Reads a JSON manifest [{ "in": "...", "out": "...", "thumb": "..." }] and for each image:
#   - writes a <=1280px-wide JPEG to "out" and a <=480px-wide JPEG to "thumb"
#   - computes an 8x8 average hash (16 hex chars) so near-duplicates can be dropped
# Prints a JSON array [{ in, ok, w, h, hash, error }]. Needs Windows PowerShell (System.Drawing).
# PNG/JPEG/GIF/BMP via System.Drawing; WebP via the Windows Imaging Component. Failures return ok=false.

param([Parameter(Mandatory = $true)][string]$Manifest)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }

function Save-Resized($img, [string]$path, [int]$maxW, [long]$quality) {
  $w = $img.Width; $h = $img.Height
  if ($w -gt $maxW) { $nw = $maxW; $nh = [int][Math]::Round($h * $maxW / $w) } else { $nw = $w; $nh = $h }
  $bmp = New-Object System.Drawing.Bitmap $nw, $nh
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  try {
    $g.Clear([System.Drawing.Color]::FromArgb(255, 14, 17, 26))
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($img, 0, 0, $nw, $nh)
    $p = New-Object System.Drawing.Imaging.EncoderParameters 1
    $p.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality, $quality)
    $bmp.Save($path, $codec, $p)
  } finally { $g.Dispose(); $bmp.Dispose() }
}

function Get-AHash($img) {
  $small = New-Object System.Drawing.Bitmap 8, 8
  $g = [System.Drawing.Graphics]::FromImage($small)
  try {
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBilinear
    $g.DrawImage($img, 0, 0, 8, 8)
    $vals = New-Object 'double[]' 64
    for ($y = 0; $y -lt 8; $y++) { for ($x = 0; $x -lt 8; $x++) {
      $c = $small.GetPixel($x, $y); $vals[$y * 8 + $x] = 0.299 * $c.R + 0.587 * $c.G + 0.114 * $c.B } }
    $avg = ($vals | Measure-Object -Average).Average
    [UInt64]$bits = 0
    for ($i = 0; $i -lt 64; $i++) { if ($vals[$i] -ge $avg) { $bits = $bits -bor ([UInt64]1 -shl $i) } }
    return $bits.ToString('x16')
  } finally { $g.Dispose(); $small.Dispose() }
}

# System.Drawing can't read WebP; Windows Imaging Component (via WPF) can, using the
# built-in WebP codec. Convert to a temporary PNG and continue from there.
Add-Type -AssemblyName PresentationCore, WindowsBase
function Open-Image([string]$path) {
  try { return [System.Drawing.Image]::FromFile($path) } catch { }
  $fs = [IO.File]::OpenRead($path)
  try {
    $dec = [System.Windows.Media.Imaging.BitmapDecoder]::Create($fs, [System.Windows.Media.Imaging.BitmapCreateOptions]::None, [System.Windows.Media.Imaging.BitmapCacheOption]::OnLoad)
    $enc = New-Object System.Windows.Media.Imaging.PngBitmapEncoder
    $enc.Frames.Add([System.Windows.Media.Imaging.BitmapFrame]::Create($dec.Frames[0]))
    $png = "$path.decoded.png"
    $out = [IO.File]::Create($png)
    try { $enc.Save($out) } finally { $out.Close() }
  } finally { $fs.Close() }
  return [System.Drawing.Image]::FromFile($png)
}

$items = Get-Content -Raw -Encoding UTF8 $Manifest | ConvertFrom-Json
$results = foreach ($it in $items) {
  try {
    $img = Open-Image $it.in
    try {
      $hash = Get-AHash $img
      if ($it.out) { Save-Resized $img $it.out 1280 80 }
      if ($it.thumb) { Save-Resized $img $it.thumb 480 74 }
      [pscustomobject]@{ in = $it.in; ok = $true; w = $img.Width; h = $img.Height; hash = $hash; error = $null }
    } finally { $img.Dispose() }
  } catch {
    [pscustomobject]@{ in = $it.in; ok = $false; w = 0; h = 0; hash = $null; error = $_.Exception.Message }
  }
}
ConvertTo-Json -InputObject @($results) -Depth 3 -Compress
