param(
  [ValidateSet('list','scan')][string]$Action,
  [string]$DeviceId,
  [string]$OutputDir,
  [int]$Dpi = 300,
  [string]$Source = 'Platen',
  [string]$ColorMode = 'RGB24',
  [string]$Duplex = 'False',
  [int]$MaxPages = 1
)
$ErrorActionPreference = 'Stop'

function Set-WiaProperty($properties, [int]$id, $value) {
  foreach ($property in $properties) {
    if ($property.PropertyID -eq $id) {
      $property.Value = $value
      return
    }
  }
}

$manager = New-Object -ComObject WIA.DeviceManager
$scanners = @($manager.DeviceInfos | Where-Object { $_.Type -eq 1 })
if ($Action -eq 'list') {
  @($scanners | ForEach-Object {
    [pscustomobject]@{ id = $_.DeviceID; name = [string]$_.Properties.Item('Name').Value }
  }) | ConvertTo-Json -Compress -Depth 3
  exit 0
}

$info = $scanners | Where-Object { $_.DeviceID -eq $DeviceId } | Select-Object -First 1
if (-not $info) { throw 'Scanner WIA não encontrado. Atualize a lista.' }
$device = $info.Connect()
if (-not $device.Items.Count) { throw 'O scanner não expõe uma área de digitalização WIA.' }
$item = $device.Items.Item(1)
Set-WiaProperty $item.Properties 6147 $Dpi
Set-WiaProperty $item.Properties 6148 $Dpi
Set-WiaProperty $item.Properties 6146 $(if ($ColorMode -eq 'BlackAndWhite1') { 4 } elseif ($ColorMode -eq 'Grayscale8') { 2 } else { 1 })
if ($Source -eq 'Feeder') {
  Set-WiaProperty $device.Properties 3088 $(if ($Duplex -eq 'True') { 5 } else { 1 })
  Set-WiaProperty $device.Properties 3096 $(if ($MaxPages -ge 100) { 0 } else { $MaxPages })
} else {
  Set-WiaProperty $device.Properties 3088 2
}
New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
$count = 0
while ($count -lt $MaxPages) {
  try {
    $image = $item.Transfer()
    $processor = New-Object -ComObject WIA.ImageProcess
    $processor.Filters.Add($processor.FilterInfos.Item('Convert').FilterID)
    $processor.Filters.Item(1).Properties.Item('FormatID').Value = '{B96B3CAE-0728-11D3-9D7B-0000F81EF32E}'
    $processor.Filters.Item(1).Properties.Item('Quality').Value = 85
    $image = $processor.Apply($image)
    $file = Join-Path $OutputDir ('page-' + $count + '.jpg')
    $image.SaveFile($file)
    $count++
    if ($Source -eq 'Platen') { break }
  } catch {
    if ($count -eq 0 -or $_.Exception.HResult -ne -2145320957) { throw }
    break
  }
}
Write-Output $count
