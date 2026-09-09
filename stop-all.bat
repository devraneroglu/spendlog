@echo off
title SpendLog V2 - Service Stopper
color 0c
cls

echo ================================================================
echo          SPENDLOG V2 - STOPPING ALL SERVICES
echo ================================================================
echo.
echo Stopping services and freeing ports 5007, 8000, 3000...

taskkill /F /IM SpendLogV2.API.exe /T 2>nul

powershell -NoProfile -Command "$ports = @(5007, 8000, 3000); foreach ($port in $ports) { try { $pids = (Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue).OwningProcess | Select-Object -Unique; foreach ($p in $pids) { if ($p -and $p -ne 0) { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue; Write-Host \"[Port $port] PID $p stopped.\" -ForegroundColor Yellow } } } catch {} }"

echo.
echo ================================================================
echo ALL SPENDLOG V2 SERVICES STOPPED SUCCESSFULLY!
echo ================================================================
echo.
ping 127.0.0.1 -n 3 >nul
