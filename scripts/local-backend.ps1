param(
  [ValidateSet('Start', 'Stop', 'Functions', 'Connect')][string]$Step='Start',
  [string]$BackendHost='127.0.0.1'
)
$ErrorActionPreference='Stop'
$projectRoot=Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$dockerCommand=Get-Command docker -ErrorAction SilentlyContinue
if (!$dockerCommand) {
  $dockerFolders=@('C:\Program Files\Docker\Docker\resources\bin',
    (Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\resources\bin'))
  $dockerFolder=$dockerFolders | Where-Object { Test-Path -LiteralPath (Join-Path $_ 'docker.exe') } | Select-Object -First 1
  if ($dockerFolder) { $env:PATH=$dockerFolder+';'+$env:PATH }
  else { throw 'Install and start an approved Docker-compatible runtime before running local Supabase.' }
}
& docker info --format '{{.ServerVersion}}'
if ($LASTEXITCODE -ne 0) { throw 'Start your Docker runtime and wait for its engine to be ready.' }
$certificateFile=Join-Path $projectRoot 'mobile\.local-build\system-ca.pem'
if (Test-Path -LiteralPath $certificateFile) { $env:NODE_EXTRA_CA_CERTS=$certificateFile }
switch ($Step) {
  'Connect' {
    if ($BackendHost -notmatch '^(localhost|127\.0\.0\.1|10\.(\d{1,3}\.){2}\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})$') {
      throw 'Use localhost, the Android emulator address, or the private LAN IP of the local Supabase computer.'
    }
    # Capture output so neither public nor server keys are printed in the handoff logs.
    $statusLines=& npx.cmd --yes supabase@2.120.0 status -o env
    if ($LASTEXITCODE -ne 0) { throw 'Start local Supabase before configuring the app.' }
    $statusValues=@{}
    foreach($line in $statusLines) {
      if($line -match '^([A-Z_]+)=(.*)$') { $statusValues[$Matches[1]]=$Matches[2].Trim().Trim('"').Trim("'") }
    }
    $localPublicKey=$statusValues['ANON_KEY']
    if (!$localPublicKey) { $localPublicKey=$statusValues['PUBLISHABLE_KEY'] }
    if (!$localPublicKey -or $localPublicKey.StartsWith('sb_secret_')) { throw 'Local Supabase did not return a public client key.' }
    $newSettings=@{
      EXPO_PUBLIC_SUPABASE_ONLINE='false'
      EXPO_PUBLIC_LOCAL_SUPABASE_URL=('http://'+$BackendHost+':54321')
      EXPO_PUBLIC_LOCAL_SUPABASE_KEY=$localPublicKey
    }
    $envTargets=@((Join-Path $projectRoot 'mobile\.env'))
    $overrideFile=Join-Path $projectRoot 'mobile\.env.local'
    if(Test-Path -LiteralPath $overrideFile) { $envTargets+=$overrideFile }
    foreach($envTarget in $envTargets) {
      $content=if(Test-Path -LiteralPath $envTarget) { [System.IO.File]::ReadAllText($envTarget) } else { '' }
      foreach($settingName in $newSettings.Keys) {
        $settingValue=$newSettings[$settingName]
        $pattern='(?m)^'+[regex]::Escape($settingName)+'=.*$'
        if([regex]::IsMatch($content,$pattern)) {
          $replacement=[System.Text.RegularExpressions.MatchEvaluator]{ param($match) $settingName+'='+$settingValue }
          $content=[regex]::Replace($content,$pattern,$replacement)
        } else { $content=$content.TrimEnd()+[Environment]::NewLine+$settingName+'='+$settingValue+[Environment]::NewLine }
      }
      [System.IO.File]::WriteAllText($envTarget,$content)
    }
    Write-Output 'Configured the app for local Supabase. Hosted settings are preserved. Restart Metro after this change.'
  }
  'Start' {
    & npx.cmd --yes supabase@2.120.0 start 2>&1 | ForEach-Object {
      $_.ToString() -replace '\b(?:sb_(?:publishable|secret)_[A-Za-z0-9._-]+|eyJ[A-Za-z0-9_.-]+)', '[redacted key]'
    }
  }
  'Stop' { & npx.cmd --yes supabase@2.120.0 stop }
  'Functions' {
    $secretFile=Join-Path $projectRoot 'supabase\.env'
    if (!(Test-Path -LiteralPath $secretFile)) { throw 'Configure the local server .env first.' }
    $sandboxLine=Get-Content -LiteralPath $secretFile | Where-Object { $_ -match '^CASHFREE_ENVIRONMENT=sandbox\s*$' }
    if (!$sandboxLine) { throw 'Local development requires Cashfree sandbox configuration.' }
    & npx.cmd --yes supabase@2.120.0 functions serve --env-file $secretFile
  }
}
if ($LASTEXITCODE -ne 0) { throw 'Local Supabase command failed; resolve the reported error before continuing.' }
