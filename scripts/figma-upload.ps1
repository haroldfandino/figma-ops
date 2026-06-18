# Windows fallback for figma-upload.js.
# POST an image file to a Figma MCP upload submitUrl (from the upload_assets MCP tool).
# Prints the JSON response containing the imageHash to apply as a fill via use_figma.
#
# Auto-compression: Figma rejects assets over 10MB. If the file is larger, this script
# transparently re-encodes it as JPEG (lowering quality, then downscaling width) until it
# fits, and uploads that instead. The original is left untouched; the compressed copy is
# written next to it as <name>.upload.jpg.
#
# Usage:
#   .\figma-upload.ps1 -File captures\big.png -Url "https://mcp.figma.com/mcp/upload/.../submit?scaleMode=FILL"
#   .\figma-upload.ps1 -File ... -Url ... -MaxMB 10 -Keep
#
# Notes:
# - submitUrls are SINGLE-USE and expire after 10 minutes.
# - Apply the returned imageHash manually with use_figma (FigJam shapes do not auto-fill):
#     n.fills = [{ type: 'IMAGE', scaleMode: 'FILL', imageHash: '<hash>' }]

param(
  [Parameter(Mandatory)][string]$File,
  [Parameter(Mandatory)][string]$Url,
  [double]$MaxMB = 10,
  [switch]$Keep
)

Add-Type -AssemblyName System.Drawing

$maxBytes = [int]($MaxMB * 1MB)
$targetBytes = [int]($maxBytes * 0.95)
$uploadPath = $File
$cleanup = $false

if ((Get-Item $File).Length -gt $maxBytes) {
  Write-Host "[auto-jpeg] $([System.IO.Path]::GetFileName($File)) is $([Math]::Round((Get-Item $File).Length/1MB,2))MB (> $MaxMB MB); compressing..."
  $src = New-Object System.Drawing.Bitmap($File)
  $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
  $out = ($File -replace '\.(png|jpe?g|webp|gif)$', '') + '.upload.jpg'

  $widths = @($src.Width, 1512, 1200, 1000) | Select-Object -Unique | Where-Object { $_ -le $src.Width }
  $qualities = @(85, 80, 72, 65, 55)
  $done = $false
  foreach ($w in $widths) {
    foreach ($q in $qualities) {
      $h = [int]($src.Height * $w / $src.Width)
      $bmp = New-Object System.Drawing.Bitmap($w, $h)
      $g = [System.Drawing.Graphics]::FromImage($bmp)
      $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $g.DrawImage($src, 0, 0, $w, $h)
      $g.Dispose()
      $params = New-Object System.Drawing.Imaging.EncoderParameters(1)
      $params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]$q)
      $bmp.Save($out, $codec, $params)
      $bmp.Dispose()
      $sz = (Get-Item $out).Length
      if ($sz -le $targetBytes) {
        Write-Host "[auto-jpeg] -> $([System.IO.Path]::GetFileName($out)) ${w}px q$q = $([Math]::Round($sz/1MB,2))MB"
        $done = $true; break
      }
    }
    if ($done) { break }
  }
  $src.Dispose()
  if (-not $done) { Write-Host "[auto-jpeg] WARNING: still over the limit after max compression; upload may fail." }
  $uploadPath = $out
  $cleanup = -not $Keep
}

$type = if ($uploadPath -match '\.jpe?g$') { 'image/jpeg' } else { 'image/png' }
curl.exe -s -X POST -F "file=@$uploadPath;type=$type" $Url
if ($cleanup) { Remove-Item $uploadPath -ErrorAction SilentlyContinue }
