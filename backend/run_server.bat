@echo off
echo Starting FaceGuard Pro Server...
powershell -Command "Start-Process python -ArgumentList 'app.py' -Verb RunAs" 