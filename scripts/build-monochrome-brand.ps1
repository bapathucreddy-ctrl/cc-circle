# Produce monochrome variants of the existing code-drawn CC mark, preserving alpha.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$assetFolder = Join-Path (Split-Path $PSScriptRoot -Parent) 'mobile/assets/brand'
$source = [System.Drawing.Bitmap]::FromFile((Join-Path $assetFolder 'mark-minimal.png'))
$svg = [IO.File]::ReadAllText((Join-Path $assetFolder 'mark-minimal.svg'))
try {
  foreach ($variant in @(@{ Name = 'black'; Value = 0; Color = '#000000' }, @{ Name = 'white'; Value = 1; Color = '#ffffff' })) {
    $bitmap = New-Object System.Drawing.Bitmap($source.Width, $source.Height)
    try {
      $channel = 255 * $variant.Value
      for ($x = 0; $x -lt $source.Width; $x++) {
        for ($y = 0; $y -lt $source.Height; $y++) {
          $alpha = $source.GetPixel($x, $y).A
          $bitmap.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, $channel, $channel, $channel))
        }
      }
      $bitmap.Save((Join-Path $assetFolder ('mark-' + $variant.Name + '.png')), [System.Drawing.Imaging.ImageFormat]::Png)
      [IO.File]::WriteAllText((Join-Path $assetFolder ('mark-' + $variant.Name + '.svg')), $svg.Replace('#386ad7', $variant.Color))
    } finally { $bitmap.Dispose() }
  }
} finally { $source.Dispose() }
Write-Output 'Built black and white CC logo assets.'
