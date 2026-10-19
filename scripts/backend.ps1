param(
  [Parameter(Mandatory=$true)]
  [ValidateSet('Login', 'Link', 'Database', 'Functions', 'Secrets')]
  [string]$Step
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$certificateFile = Join-Path $projectRoot 'mobile\.local-build\system-ca.pem'
if (Test-Path -LiteralPath $certificateFile) {
  $env:NODE_EXTRA_CA_CERTS = $certificateFile
}

function Invoke-Supabase {
  param([string[]]$Arguments)
  & npx.cmd --yes supabase@2.120.0 @Arguments
  if ($LASTEXITCODE -ne 0) { throw 'Supabase command failed. Resolve the reported error before continuing.' }
}

if ($Step -eq 'Login') {
  Invoke-Supabase -Arguments @('login')
  return
}

$mobileEnv = Join-Path $projectRoot 'mobile\.env'
if (!(Test-Path -LiteralPath $mobileEnv)) { throw 'Configure mobile/.env first.' }
$urlLine = Get-Content -LiteralPath $mobileEnv | Where-Object { $_ -match '^EXPO_PUBLIC_SUPABASE_URL=' } | Select-Object -First 1
if (!$urlLine) { throw 'The Supabase project URL is missing.' }
$projectUrl = ($urlLine -split '=', 2)[1].Trim().Trim('"').Trim("'")
$projectHost = ([Uri]$projectUrl).Host
if ($projectHost -notmatch '^([a-z0-9]{20})\.supabase\.co$') {
  throw 'Expected a hosted Supabase project URL in mobile/.env.'
}
$projectRef = $Matches[1]
Write-Host "Target Supabase project: $projectRef"

switch ($Step) {
  'Link' {
    Invoke-Supabase -Arguments @('link', '--project-ref', $projectRef)
  }
  'Database' {
    $linkedFile = Join-Path $projectRoot 'supabase\.temp\project-ref'
    if (!(Test-Path -LiteralPath $linkedFile) -or (Get-Content -LiteralPath $linkedFile -Raw).Trim() -ne $projectRef) {
      throw 'Run the Link step first. The linked project must match mobile/.env.'
    }
    Invoke-Supabase -Arguments @('db', 'push', '--dry-run')
    Invoke-Supabase -Arguments @('db', 'push')
  }
  'Functions' {
    Invoke-Supabase -Arguments @('functions', 'deploy', '--project-ref', $projectRef, '--use-api')
  }
  'Secrets' {
    $secretFile = Join-Path $projectRoot 'supabase\.env'
    if (!(Test-Path -LiteralPath $secretFile)) { throw 'Fill supabase/.env with Cashfree sandbox credentials first.' }
    $settings = @{}
    foreach ($line in Get-Content -LiteralPath $secretFile) {
      if ($line -match '^([A-Z_]+)=(.*)$') { $settings[$Matches[1]] = $Matches[2].Trim().Trim('"').Trim("'") }
    }
    if ($settings['CASHFREE_ENVIRONMENT'] -ne 'sandbox') { throw 'This development setup requires sandbox credentials.' }
    foreach ($name in @('CASHFREE_CLIENT_ID', 'CASHFREE_CLIENT_SECRET', 'CASHFREE_PAYOUT_CLIENT_ID', 'CASHFREE_PAYOUT_CLIENT_SECRET')) {
      if ([string]::IsNullOrWhiteSpace($settings[$name])) { throw "Fill $name in supabase/.env first." }
    }
    if ($settings['CASHFREE_WORKER_SECRET'].Length -lt 32) { throw 'The worker secret must contain at least 32 characters.' }
    Invoke-Supabase -Arguments @('secrets', 'set', '--project-ref', $projectRef, '--env-file', $secretFile)
  }
}
