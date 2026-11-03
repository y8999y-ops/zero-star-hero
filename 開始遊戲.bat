@echo off
chcp 65001 >nul
title 零星勇者
cd /d "%~dp0"
"C:\Program Files\nodejs\node.exe" server.mjs --open
if errorlevel 1 pause
