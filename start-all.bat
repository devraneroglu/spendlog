@echo off
title SpendLog V2 - Service Starter
color 0b
cls

echo ================================================================
echo          SPENDLOG V2 - FULL STACK SERVICE STARTER
echo ================================================================
:: Ensure SQL Server service is active
sc query MSSQLSERVER | find "RUNNING" >nul
if %ERRORLEVEL% neq 0 (
    echo [0/3] SQL Server servisi baslatiliyor...
    net start MSSQLSERVER >nul 2>&1
)

echo [1/3] Starting Backend API (.NET 10 - Port: 5007)...
start "SpendLog API (5007)" cmd /k "cd /d ""%~dp0backend\SpendLogV2.API"" && set ASPNETCORE_ENVIRONMENT=Development && dotnet run --urls http://localhost:5007"

ping 127.0.0.1 -n 3 >nul

echo [2/3] Starting Scraper Service (FastAPI - Port: 8000)...
start "SpendLog Scraper (8000)" cmd /k "cd /d ""%~dp0scraper-service"" && if exist .\venv\Scripts\activate (call .\venv\Scripts\activate) && python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

ping 127.0.0.1 -n 3 >nul

echo [3/3] Starting Frontend (Next.js 16 - Port: 3000)...
start "SpendLog Frontend (3000)" cmd /k "cd /d ""%~dp0frontend"" && npm run dev"

echo.
echo ================================================================
echo ALL SERVICES STARTED SUCCESSFULLY!
echo.
echo   Frontend : http://localhost:3000
echo   Backend  : http://localhost:5007/swagger
echo   Scraper  : http://localhost:8000/docs
echo ================================================================
echo.
echo You can run 'stop-all.bat' to stop all services.
ping 127.0.0.1 -n 4 >nul
