@echo off
(
echo # Dependencies
echo node_modules/
echo.
echo # Build outputs
echo dist/
echo .next/
echo out/
echo build/
echo.
echo # Environment variables — never commit real credentials
echo .env
echo .env.local
echo .env.*.local
echo.
echo # Logs
echo *.log
echo npm-debug.log*
echo pnpm-debug.log*
echo scripts/*.log
echo.
echo # IDE and OS
echo .DS_Store
echo Thumbs.db
echo .vscode/settings.json
echo.
echo # Bob workspace config — contains machine-specific absolute paths
echo .bob/
echo.
echo # TypeScript incremental build cache
echo *.tsbuildinfo
echo.
echo # Prisma generated client ^(regenerated via pnpm db:generate^)
echo node_modules/.prisma/
echo.
echo # pnpm virtual store
echo .pnpm-store/
) > .gitignore
echo .gitignore written
type .gitignore
