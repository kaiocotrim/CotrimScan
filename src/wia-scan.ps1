param(
  [Parameter(Mandatory=$true)][string]$OutputDirectory,
  [Parameter(Mandatory=$true)][int]$Dpi,
  [Parameter(Mandatory=$true)][string]$Source,
  [Parameter(Mandatory=$true)][string]$Duplex,
  [Parameter(Mandatory=$true)][int]$MaxPages
)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$manager = New-Object -ComObject WIA.DeviceManager
$scanner = @($manager.DeviceInfos | Where-Object { $_.Type -eq 1 }) | Select-Object -First 1
if (-not $scanner) { throw 'Nenhum scanner WIA foi reconhecido pelo Windows.' }
$device = $scanner.Connect()
$handling = $device.Properties.Item('Document Handling Select')
if ($Source -eq 'Platen') { $handling.Value = 2 }
elseif ($Duplex -eq 'true') { $handling.Value = 5 }
else { $handling.Value = 1 }
$item = $device.Items.Item(1)
$item.Properties.Item('Horizontal Resolution').Value = $Dpi
$item.Properties.Item('Vertical Resolution').Value = $Dpi
Add-Type -AssemblyName System.Drawing
$format = '{B96B3CAB-0728-11D3-9D7B-0000F81EF32E}'
$files = New-Object System.Collections.Generic.List[string]
for ($page = 1; $page -le $MaxPages; $page++) {
  try {
    $image = $item.Transfer($format)
    $bmp = Join-Path $OutputDirectory ('page-{0:D3}.bmp' -f $page)
    $file = Join-Path $OutputDirectory ('page-{0:D3}.jpg' -f $page)
    $image.SaveFile($bmp)
    $bitmap = [System.Drawing.Image]::FromFile($bmp)
    try { $bitmap.Save($file, [System.Drawing.Imaging.ImageFormat]::Jpeg) }
    finally { $bitmap.Dispose(); Remove-Item -LiteralPath $bmp -Force }
    $files.Add($file)
    if ($Source -eq 'Platen') { break }
  } catch {
    $paperEmpty = $_.Exception.Message -match '80210003|alimentador de documentos|document feeder'
    if ($paperEmpty -and $files.Count -gt 0) { break }
    if ($paperEmpty) { throw 'WIA_PAPER_EMPTY' }
    throw
  }
}
if ($files.Count -eq 0) { throw 'Nenhuma pagina foi recebida do scanner.' }
ConvertTo-Json -InputObject @($files.ToArray()) -Compress
