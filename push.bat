@echo off
REM 一键同时推送 MermaidStepPlayer 到 gitee(origin) 与 github
REM 用法：先正常 git commit，再双击本文件即可同步两个远程
cd /d "%~dp0"

echo 当前分支：
git rev-parse --abbrev-ref HEAD
echo.

echo [1/2] 推送到 gitee (origin)...
git push origin HEAD
if errorlevel 1 goto :fail

echo [2/2] 推送到 github...
git push github HEAD
if errorlevel 1 goto :fail

echo.
echo 全部推送成功。
pause >nul
exit /b 0

:fail
echo.
echo 推送失败，请检查网络或远程配置。
pause >nul
exit /b 1
