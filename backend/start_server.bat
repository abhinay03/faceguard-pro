@echo off
echo Starting Face Recognition Server...
:start
python app.py
echo.
echo Server stopped. Restarting in 5 seconds...
timeout /t 5 /nobreak
goto start 