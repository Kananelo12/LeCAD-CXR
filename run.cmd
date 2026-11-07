@echo off
rem Starts LeCAD-CXR on Windows. Runs run.ps1 without changing the
rem laptop's PowerShell script policy. See README.md, "Run it".
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0run.ps1" %*
