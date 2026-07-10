@echo off
REM Keep in sync with torzlink.ps1 — see docs/follow-ups-launchers.md
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0torzlink.ps1" %*
