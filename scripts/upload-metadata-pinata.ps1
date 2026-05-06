param(
  [string]$MetadataDir = "metadata",
  [string]$EnvPath = "contracts/.env"
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Net.Http

function Read-DotEnvValue {
  param([string]$Path, [string]$Key)

  if (-not (Test-Path $Path)) {
    return $null
  }

  $line = Get-Content $Path | Where-Object { $_ -match "^$([regex]::Escape($Key))=" } | Select-Object -First 1
  if (-not $line) {
    return $null
  }

  return (($line -split "=", 2)[1]).Trim().Trim('"')
}

function Set-DotEnvValue {
  param([string]$Path, [string]$Key, [string]$Value)

  $lines = @()
  if (Test-Path $Path) {
    $lines = @(Get-Content $Path)
  }

  $found = $false
  $updated = foreach ($line in $lines) {
    if ($line -match "^$([regex]::Escape($Key))=") {
      $found = $true
      "$Key=$Value"
    } else {
      $line
    }
  }

  if (-not $found) {
    $updated += "$Key=$Value"
  }

  Set-Content -Path $Path -Value $updated -Encoding utf8
}

$jwt = $env:PINATA_JWT
if ([string]::IsNullOrWhiteSpace($jwt)) {
  $jwt = Read-DotEnvValue -Path $EnvPath -Key "PINATA_JWT"
}

if ([string]::IsNullOrWhiteSpace($jwt)) {
  throw "PINATA_JWT is missing. Put a temporary Pinata JWT in the environment or $EnvPath."
}

if (-not (Test-Path $MetadataDir)) {
  throw "Metadata folder not found: $MetadataDir"
}

$files = Get-ChildItem $MetadataDir -File | Sort-Object { [int]$_.Name }
if ($files.Count -ne 100) {
  throw "Expected 100 metadata files, found $($files.Count)."
}

$content = [System.Net.Http.MultipartFormDataContent]::new()
$metadata = '{"name":"Ritual Identity SBT Metadata"}'
$options = '{"cidVersion":1}'
$content.Add([System.Net.Http.StringContent]::new($metadata), "pinataMetadata")
$content.Add([System.Net.Http.StringContent]::new($options), "pinataOptions")

foreach ($file in $files) {
  $bytes = [System.IO.File]::ReadAllBytes($file.FullName)
  $fileContent = [System.Net.Http.ByteArrayContent]::new($bytes)
  $fileContent.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse("application/json")
  $relativePath = "$MetadataDir/$($file.Name)"
  $content.Add($fileContent, "file", $relativePath)
}

$client = [System.Net.Http.HttpClient]::new()
$client.DefaultRequestHeaders.Authorization = [System.Net.Http.Headers.AuthenticationHeaderValue]::new("Bearer", $jwt)

try {
  $response = $client.PostAsync("https://api.pinata.cloud/pinning/pinFileToIPFS", $content).GetAwaiter().GetResult()
  $body = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()

  if (-not $response.IsSuccessStatusCode) {
    throw "Pinata upload failed: HTTP $([int]$response.StatusCode) $body"
  }

  $result = $body | ConvertFrom-Json
  if ([string]::IsNullOrWhiteSpace($result.IpfsHash)) {
    throw "Pinata response did not include IpfsHash: $body"
  }

  $baseUri = "ipfs://$($result.IpfsHash)/"
  Set-DotEnvValue -Path $EnvPath -Key "SBT_BASE_URI" -Value $baseUri

  Write-Output "Metadata folder uploaded to Pinata."
  Write-Output "CID: $($result.IpfsHash)"
  Write-Output "SBT_BASE_URI=$baseUri"
  Write-Output "Updated $EnvPath"
} finally {
  $client.Dispose()
  $content.Dispose()
}
