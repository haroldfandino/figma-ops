# Windows zero-dependency fallback for split-image.js (uses System.Drawing).
# Split a tall screenshot into vertical parts that render reliably in Figma clients
# (Figma breaks above ~8000px; empirically 7811 OK, 10203 broken).
#
# Usage:
#   .\split-image.ps1 -Path captures\linear_full.png                # split if needed
#   .\split-image.ps1 -Path captures\big.png -JpegQuality 85        # JPEG-encode parts
#   .\split-image.ps1 -Path captures\x.png -MaxHeight 6000          # custom threshold

param(
  [Parameter(Mandatory)][string]$Path,
  [int]$MaxHeight = 8000,
  [int]$JpegQuality = 0,
  [string]$OutDir = ""
)

Add-Type -AssemblyName System.Drawing

$bmp = New-Object System.Drawing.Bitmap($Path)
$w = $bmp.Width; $h = $bmp.Height
$base = [System.IO.Path]::GetFileNameWithoutExtension($Path) -replace '_full$', ''
if ($OutDir -eq "") { $OutDir = [System.IO.Path]::GetDirectoryName($Path) }

if ($h -le $MaxHeight -and $JpegQuality -eq 0) {
  Write-Output "$base : $w x $h - no split needed (display: 720 x $([Math]::Round($h * 720 / $w)))"
  $bmp.Dispose()
  exit 0
}

$parts = [Math]::Max(1, [Math]::Ceiling($h / $MaxHeight))
$partH = [Math]::Ceiling($h / $parts)

$codec = $null; $params = $null
if ($JpegQuality -gt 0) {
  $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
  $params = New-Object System.Drawing.Imaging.EncoderParameters(1)
  $params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]$JpegQuality)
}

for ($i = 0; $i -lt $parts; $i++) {
  $y = $i * $partH
  $thisH = [Math]::Min($partH, $h - $y)
  $rect = New-Object System.Drawing.Rectangle(0, $y, $w, $thisH)
  $piece = $bmp.Clone($rect, $bmp.PixelFormat)
  $n = $i + 1
  if ($JpegQuality -gt 0) {
    $out = Join-Path $OutDir "$($base)_p$n.jpg"
    $piece.Save($out, $codec, $params)
  } else {
    $out = Join-Path $OutDir "$($base)_p$n.png"
    $piece.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
  }
  $piece.Dispose()
  Write-Output "$out : $w x $thisH (display: 720 x $([Math]::Round($thisH * 720 / $w)))"
}
$bmp.Dispose()
