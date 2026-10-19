# Replace vivid blue accents in the existing icon artwork with white.
# Keep source assets, photographs, dark outlines and the red destination marker.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$assetFolder = Join-Path (Split-Path $PSScriptRoot -Parent) 'mobile/assets'
$sources = @((Get-ChildItem -LiteralPath (Join-Path $assetFolder 'crafts') -Filter '*.png'))
$sources += @(Get-ChildItem -LiteralPath (Join-Path $assetFolder 'brand') -Filter 'rider-*.png')
foreach ($source in $sources | Where-Object { $_.BaseName -notlike '*-neutral' }) {
  $image = [System.Drawing.Bitmap]::FromFile($source.FullName)
  $output = New-Object System.Drawing.Bitmap($image.Width, $image.Height)
  try {
    for ($x = 0; $x -lt $image.Width; $x++) {
      for ($y = 0; $y -lt $image.Height; $y++) {
        $pixel = $image.GetPixel($x, $y)
        $hue = $pixel.GetHue()
        if ($pixel.A -gt 0 -and $hue -ge 190 -and $hue -le 250 -and $pixel.GetSaturation() -gt .3 -and $pixel.B -gt 100) {
          $pixel = [System.Drawing.Color]::FromArgb($pixel.A, 255, 255, 255)
        }
        $output.SetPixel($x, $y, $pixel)
      }
    }
    $target = Join-Path $source.DirectoryName ($source.BaseName + '-neutral.png')
    $output.Save($target, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Output ('Built ' + $source.BaseName + '-neutral.png')
  } finally { $output.Dispose(); $image.Dispose() }
}
