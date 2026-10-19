$ErrorActionPreference='Stop'
$projectRoot=Split-Path -Parent $PSScriptRoot
$outputFolder=Join-Path $projectRoot 'handoff'
[System.IO.Directory]::CreateDirectory($outputFolder) | Out-Null
$zipPath=Join-Path $outputFolder 'cc-circle-source.zip'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$folders=@('prototype-assets','prototype-previews','scripts','mobile\src','mobile\scripts','supabase\functions','supabase\migrations','supabase\tests')
$rootFiles=@('HANDOFF.md','README.md','prototype.html','prototype-demo.js','prototype-demo.css')
$mobileFiles=@('App.tsx','index.ts','app.config.ts','eas.json','tsconfig.json','package.json','package-lock.json','.gitignore','.env.example','.env.local.example')
$backendFiles=@('config.toml','deno.json','deno.lock','package.json','package-lock.json','.gitignore','.env.example','manual-deployment.sql')
$files=@()
foreach($name in $rootFiles) { $files+=Get-Item -LiteralPath (Join-Path $projectRoot $name) }
foreach($name in $mobileFiles) { $files+=Get-Item -LiteralPath (Join-Path $projectRoot ('mobile\'+$name)) }
foreach($name in $backendFiles) { $files+=Get-Item -LiteralPath (Join-Path $projectRoot ('supabase\'+$name)) }
foreach($folder in $folders) { $files+=Get-ChildItem -LiteralPath (Join-Path $projectRoot $folder) -File -Recurse }
$stream=[System.IO.File]::Open($zipPath,[System.IO.FileMode]::Create)
$archive=[System.IO.Compression.ZipArchive]::new($stream,[System.IO.Compression.ZipArchiveMode]::Create)
try {
  foreach($file in $files) {
    $relative=[System.IO.Path]::GetRelativePath($projectRoot,$file.FullName).Replace('\','/')
    if ($file.Name -match '^\.env' -and $file.Name -notin @('.env.example','.env.local.example')) { throw 'An actual environment file was selected unexpectedly.' }
    if ($relative -match '(^|/)(node_modules|\.temp|\.expo|\.local-build)(/|$)' -or $file.Extension -in @('.jks','.p8','.p12','.mobileprovision')) { throw 'A private or generated file was selected unexpectedly.' }
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive,$file.FullName,$relative,[System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
  }
} finally { $archive.Dispose(); $stream.Dispose() }
Copy-Item -LiteralPath (Join-Path $projectRoot 'HANDOFF.md') -Destination (Join-Path $outputFolder 'HANDOFF.md')
Copy-Item -LiteralPath (Join-Path $projectRoot 'supabase\manual-deployment.sql') -Destination (Join-Path $outputFolder 'manual-deployment.sql')
$zipHash=Get-FileHash -LiteralPath $zipPath -Algorithm SHA256
[System.IO.File]::WriteAllText((Join-Path $outputFolder 'SHA256SUMS.txt'),$zipHash.Hash.ToLower()+'  cc-circle-source.zip'+[Environment]::NewLine)
Get-Item -LiteralPath $zipPath | Select-Object Name,Length
