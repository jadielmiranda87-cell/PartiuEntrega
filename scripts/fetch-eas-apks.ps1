# Descarrega os APKs dos builds EAS para builds/apks/
# Uso: .\scripts\fetch-eas-apks.ps1
# Opcional: -MaxWaitMinutes 90 (espera até todos terminarem)

param(
  [int] $MaxWaitMinutes = 180
)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $root.Path

$outDir = Join-Path $root.Path 'builds\apks'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

# IDs dos últimos builds (client / comercio / entregador) — atualize se gerar novos builds
$targets = @(
  @{ Id = '7cd45d95-429c-4be0-b3a4-11d2028796d6'; Name = 'partiuentrega-client.apk'; Profile = 'client' },
  @{ Id = '34def57b-1be0-42ab-b733-4d6c3582b25c'; Name = 'partiuentrega-comercio.apk'; Profile = 'comercio' },
  @{ Id = '36151ef4-fbb8-4a22-ae0c-503e31d23fb4'; Name = 'partiuentrega-entregador.apk'; Profile = 'entregador' }
)

function Get-BuildJson($buildId) {
  # cmd junta stdout+stderr; Out-String garante uma unica string (evita .IndexOf em array)
  $raw = cmd /c "cd /d `"$($root.Path)`" && npx --yes eas-cli@latest build:view $buildId --json 2>&1"
  $all = if ($null -eq $raw) { '' } elseif ($raw -is [array]) { ($raw | ForEach-Object { "$_" }) -join "`n" } else { "$raw" }
  $start = $all.IndexOf([char]'{')
  if ($start -lt 0) { throw "Sem JSON na saida do EAS (build $buildId): $all" }
  $jsonText = $all.Substring($start).Trim()
  return $jsonText | ConvertFrom-Json
}

$deadline = (Get-Date).AddMinutes($MaxWaitMinutes)
$pending = $targets | ForEach-Object { $_ }

Write-Host "Pasta de saida: $outDir"
Write-Host "A aguardar builds (max $MaxWaitMinutes min)..."

while ($true) {
  $still = @()
  foreach ($t in $pending) {
    $j = Get-BuildJson $t.Id
    $st = $j.status
    Write-Host "[$($t.Profile)] $($t.Id.Substring(0,8))... status=$st"
    if ($st -eq 'FINISHED') {
      $url = $j.artifacts.applicationArchiveUrl
      if (-not $url) { $url = $j.artifacts.buildUrl }
      if ($url) {
        $dest = Join-Path $outDir $t.Name
        Write-Host "  -> Download: $dest"
        Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing
        Write-Host "  OK ($([math]::Round((Get-Item $dest).Length / 1MB, 2)) MB)"
      } else {
        Write-Warning "  Build FINISHED mas sem applicationArchiveUrl"
      }
    } elseif ($st -in @('ERRORED', 'CANCELED')) {
      Write-Warning "[$($t.Profile)] build falhou ou foi cancelado."
    } else {
      $still += $t
    }
  }

  if ($still.Count -eq 0) { break }
  if ((Get-Date) -gt $deadline) {
    Write-Warning "Tempo esgotado. Ainda em fila/compilacao: $($still.Profile -join ', '). Volta a correr este script mais tarde."
    exit 1
  }
  $pending = $still
  Start-Sleep -Seconds 45
}

Write-Host "Concluido. APKs em: $outDir"
