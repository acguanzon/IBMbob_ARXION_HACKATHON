@echo off
set DATABASE_URL=postgresql://postgres:password@localhost:5432/arxion_dev
set PORT=3001
set NODE_ENV=development

echo.
echo === Starting API server ===
start /b node apps\api\dist\index.js > scripts\api.log 2>&1
timeout /t 3 /nobreak > nul

echo === GET /health ===
curl -s http://localhost:3001/health

echo.
echo === GET /projects ===
curl -s http://localhost:3001/projects

echo.
echo === GET /projects/seed-project-collabai-demo/tasks ===
curl -s http://localhost:3001/projects/seed-project-collabai-demo/tasks

echo.
echo === GET /tasks/T-102 ===
curl -s http://localhost:3001/tasks/T-102

echo.
echo === Done ===
taskkill /f /im node.exe > nul 2>&1
