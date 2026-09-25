@echo off
set PGPASSWORD=password
set PGBIN=C:\PROGRA~1\PostgreSQL\17\bin

echo === Checking PostgreSQL connection ===
%PGBIN%\psql.exe -U postgres -h 127.0.0.1 -c "SELECT version();"
if %ERRORLEVEL% NEQ 0 (
  echo ERROR: Could not connect to PostgreSQL
  exit /b 1
)

echo === Creating database arxion_dev ===
%PGBIN%\createdb.exe -U postgres -h 127.0.0.1 arxion_dev
if %ERRORLEVEL% NEQ 0 (
  echo WARNING: Database may already exist, continuing...
)

echo === Done ===
echo Connection string: postgresql://postgres:password@localhost:5432/arxion_dev
