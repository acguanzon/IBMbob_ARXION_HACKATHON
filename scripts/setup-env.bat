@echo off
echo DATABASE_URL="postgresql://postgres:password@localhost:5432/arxion_dev" > .env
echo PORT=3001 >> .env
echo NODE_ENV=development >> .env
echo CORS_ORIGIN=http://localhost:3000 >> .env
echo INTERNAL_API_KEY="dev-internal-key" >> .env
echo NEXT_PUBLIC_API_URL="http://localhost:3001" >> .env
echo NEXT_PUBLIC_WS_URL="ws://localhost:3001" >> .env
echo MCP_API_BASE_URL="http://localhost:3001" >> .env
echo MCP_API_KEY="dev-internal-key" >> .env
echo .env written successfully
