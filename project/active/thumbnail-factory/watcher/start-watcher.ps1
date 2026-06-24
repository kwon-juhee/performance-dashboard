# 썸네일 워처 실행/등록 스크립트 (PowerShell)
#
# 즉시 실행(포그라운드, 테스트용):
#   powershell -ExecutionPolicy Bypass -File watcher\start-watcher.ps1
#
# 평일 지정 시각 자동 시작 등록(상시 운영, 창 없이 백그라운드):
#   powershell -ExecutionPolicy Bypass -File watcher\start-watcher.ps1 -Register -At 09:00
#
# 등록 해제:
#   schtasks /Delete /TN "ThumbnailWatcher" /F
# 지금 바로 시작:
#   schtasks /Run /TN "ThumbnailWatcher"

param([switch]$Register, [string]$At = "09:00")

$ErrorActionPreference = "Stop"
$proj = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)  # ...\thumbnail-factory
$node = (Get-Command node).Source
$watcher = Join-Path $proj "watcher\watcher.js"
$log = Join-Path $proj "watcher\watcher.log"

if ($Register) {
  # 창 없이 node 워처를 실행하고 로그를 파일로. 평일(월~금) $At 에 시작.
  $inner = "Set-Location '$proj'; & '$node' '$watcher' *>> '$log'"
  $bytes = [System.Text.Encoding]::Unicode.GetBytes($inner)
  $enc = [Convert]::ToBase64String($bytes)
  $action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-WindowStyle Hidden -ExecutionPolicy Bypass -EncodedCommand $enc"
  $trigger = New-ScheduledTaskTrigger -Weekly `
    -DaysOfWeek Monday, Tuesday, Wednesday, Thursday, Friday -At $At
  $settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew `
    -StartWhenAvailable -DontStopOnIdleEnd
  Register-ScheduledTask -TaskName "ThumbnailWatcher" -Action $action -Trigger $trigger `
    -Settings $settings -Description "썸네일 팩토리 워처 (평일 $At 자동 시작)" -Force | Out-Null
  Write-Host "등록 완료: 평일 $At 자동 시작. 지금 바로 시작하려면  schtasks /Run /TN ThumbnailWatcher"
} else {
  Write-Host "워처 실행 (Ctrl+C 로 종료). 로그: $log"
  Set-Location $proj
  & $node $watcher
}
