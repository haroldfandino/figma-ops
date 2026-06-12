# Windows fallback for figma-upload.js.
# POST an image file to a Figma MCP upload submitUrl (from the upload_assets MCP tool).
# Prints the JSON response containing the imageHash to apply as a fill via use_figma.
#
# Usage:
#   .\figma-upload.ps1 -File captures\linear_p1.png -Url "https://mcp.figma.com/mcp/upload/.../submit?scaleMode=FILL"
#
# Notes:
# - submitUrls are SINGLE-USE and expire after 10 minutes.
# - Apply the returned imageHash manually with use_figma (FigJam shapes do not auto-fill):
#     n.fills = [{ type: 'IMAGE', scaleMode: 'FILL', imageHash: '<hash>' }]

param(
  [Parameter(Mandatory)][string]$File,
  [Parameter(Mandatory)][string]$Url
)

$type = if ($File -match '\.jpe?g$') { 'image/jpeg' } else { 'image/png' }
curl.exe -s -X POST -F "file=@$File;type=$type" $Url
