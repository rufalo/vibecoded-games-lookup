# Re-encodes an image (PNG/JPEG/GIF/BMP) as a JPEG no wider than -MaxWidth.
# Transparent areas are filled with the site's dark background colour.
# Used by scripts/fetch-images.mjs; needs Windows PowerShell (System.Drawing).

param(
  [Parameter(Mandatory = $true)][string]$In,
  [Parameter(Mandatory = $true)][string]$Out,
  [int]$MaxWidth = 1280,
  [int]$Quality = 82
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$img = [System.Drawing.Image]::FromFile($In)
$bmp = $null
$g = $null
try {
  $w = $img.Width
  $h = $img.Height
  if ($w -gt $MaxWidth) { $nw = $MaxWidth; $nh = [int][Math]::Round($h * $MaxWidth / $w) } else { $nw = $w; $nh = $h }

  $bmp = New-Object System.Drawing.Bitmap $nw, $nh
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear([System.Drawing.Color]::FromArgb(255, 14, 17, 26))
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.DrawImage($img, 0, 0, $nw, $nh)

  $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
  $params = New-Object System.Drawing.Imaging.EncoderParameters 1
  $params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality, [long]$Quality)
  $bmp.Save($Out, $codec, $params)
  "${nw}x${nh}"
}
finally {
  if ($g) { $g.Dispose() }
  if ($bmp) { $bmp.Dispose() }
  $img.Dispose()
}
