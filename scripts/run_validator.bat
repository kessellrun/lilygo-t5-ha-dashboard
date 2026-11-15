@echo off
setlocal
set PATH=C:\Users\Server\AppData\Local\Programs\Python\Python313;C:\Users\Server\AppData\Local\Programs\Python\Python312;%PATH%
python "%~dp0validate_project.py" %*
exit /b %ERRORLEVEL%
