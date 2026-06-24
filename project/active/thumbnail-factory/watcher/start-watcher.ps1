# 썸네일 워처 실행/등록 스크립트 (PowerShell)
#
# 즉시 실행(포그라운드, 테스트용):
#   powershell -ExecutionPolicy Bypass -File watcher\start-watcher.ps1
#
# 로그온 시 자동 시작 등록(상시 운영):
#   powershell -ExecutionPolicy Bypass -File watcher\start-watcher.ps1 -Register
#
# 등록 해제:
#   schtasks /Delete /TN "ThumbnailWatcher" /F

param([switch]$Register)

$ErrorActionPreference = "Stop"
$proj = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)  # ...\thumbnail-factory
$node = (Get-Command node).Source
$watcher = Join-Path $proj "watcher\watcher.js"
$log = Join-Path $proj "watcher\watcher.log"

if ($Register) {
  # 로그온 시 백그라운드로 워처 시작 (창 숨김, 로그는 watcher.log)
  $action = "powershell -WindowStyle Hidden -Command `"cd '$proj'; & '$node' '$watcher' *>> '$log'`""
  schtasks /Create /TN "ThumbnailWatcher" /TR $action /SC ONLOGON /RL LIMITED /F
  Write-Host "등록 완료: 다음 로그온부터 자동 시작. 지금 바로 시작하려면 schtasks /Run /TN ThumbnailWatcher"
} else {
  Write-Host "워처 실행 (Ctrl+C 로 종료). 로그: $log"
  Set-Location $proj
  & $node $watcher
}
