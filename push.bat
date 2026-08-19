@echo off
cd /d "%~dp0"

git push origin HEAD
if errorlevel 1 goto fail

git push github HEAD
if errorlevel 1 goto fail

echo Push done for both gitee and github.
pause
exit /b 0

:fail
echo Push failed. Check network or remote config.
pause
exit /b 1
