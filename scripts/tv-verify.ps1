# TV playback verification (post-fix)
# ASCII-only comments to stay safe under Windows PowerShell 5.1
param(
  [string]$Device = "192.168.1.120:5555",
  [string]$Adb = "C:\Users\AnLin\AppData\Local\Android\Sdk\platform-tools\adb.exe",
  [string]$OutDir = "F:\Project\hongguoTV\outputs\debug",
  [int]$PlaySeconds = 20
)

New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
$stamp = Get-Date -Format 'HHmmss'
$tag = "verify-$stamp"

function Shot([string]$name) {
  & $Adb -s $Device shell screencap -p /sdcard/$name.png 2>&1 | Out-Null
  & $Adb -s $Device pull /sdcard/$name.png "$OutDir\tv-$tag-$name.png" 2>&1 | Out-Null
  & $Adb -s $Device shell rm /sdcard/$name.png 2>&1 | Out-Null
}

Write-Host "=== 1. clear log, cold start ===" -ForegroundColor Cyan
& $Adb -s $Device logcat -c
& $Adb -s $Device shell am force-stop com.hongguotv.tv
Start-Sleep -Seconds 2
& $Adb -s $Device shell am start -n com.hongguotv.tv/.MainActivity | Out-Null
Start-Sleep -Seconds 18
Shot "01-home"

Write-Host "=== 2. navigate to History tab ===" -ForegroundColor Cyan
for ($i = 0; $i -lt 5; $i++) {
  & $Adb -s $Device shell input keyevent 22 | Out-Null
  Start-Sleep -Milliseconds 500
}
& $Adb -s $Device shell input keyevent 23 | Out-Null
Start-Sleep -Seconds 6
Shot "02-history"

Write-Host "=== 3. open first item ===" -ForegroundColor Cyan
& $Adb -s $Device shell input keyevent 20 | Out-Null
Start-Sleep -Seconds 1
& $Adb -s $Device shell input keyevent 23 | Out-Null
Start-Sleep -Seconds 8
Shot "03-detail"

Write-Host "=== 4. press play ===" -ForegroundColor Cyan
& $Adb -s $Device shell input keyevent 23 | Out-Null
Start-Sleep -Seconds $PlaySeconds
Shot "04-playing"

Write-Host "=== 5. capture log ===" -ForegroundColor Cyan
& $Adb -s $Device logcat -d > "$OutDir\tv-$tag-logcat.txt" 2>&1

$log = Get-Content "$OutDir\tv-$tag-logcat.txt" -Raw
$lines = (Get-Content "$OutDir\tv-$tag-logcat.txt" | Measure-Object -Line).Lines

Write-Host ""
Write-Host "=== metrics ===" -ForegroundColor Green
Write-Host ("  logLines               {0}" -f $lines)
Write-Host ("  video_model_failed     {0}" -f ([regex]::Matches($log, 'video_model failed')).Count)
Write-Host ("  http_502               {0}" -f ([regex]::Matches($log, 'HTTP 502')).Count)
Write-Host ("  stream_calls           {0}" -f ([regex]::Matches($log, 'localContent.*stream')).Count)
Write-Host ("  hevc_csd_init          {0}" -f ([regex]::Matches($log, 'hevc csd size')).Count)
Write-Host ("  output_size_changed    {0}" -f ([regex]::Matches($log, 'output size changed')).Count)
Write-Host ("  format_exceeds         {0}" -f ([regex]::Matches($log, 'Format exceeds')).Count)
Write-Host ("  player_error           {0}" -f ([regex]::Matches($log, 'PlayerError|ERROR_CODE')).Count)
Write-Host ("  rendered_frames        {0}" -f ([regex]::Matches($log, 'rendered|dropped')).Count)

Write-Host ""
Write-Host "=== decoder evidence ===" -ForegroundColor Green
Get-Content "$OutDir\tv-$tag-logcat.txt" | Select-String -Pattern "hevc csd|output size|exceeds|delay=|rendered" | Select-Object -Last 10 | ForEach-Object {
  Write-Host ("  " + ($_.Line -replace '.*\(\s*\d+\):\s*',''))
}

Write-Host ""
Write-Host "artifacts: tv-$tag-*.png / tv-$tag-logcat.txt" -ForegroundColor Green
