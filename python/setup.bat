@echo off
setlocal

REM Setup script for blink detector Python environment (Windows)
REM Creates a virtual environment and installs dependencies.
REM Avoid enabledelayedexpansion and ||/(&& chains — they break on CI cmd.exe.

echo Setting up blink detector Python environment...

set "SCRIPT_DIR=%~dp0"

python --version >nul 2>&1
if errorlevel 1 (
	echo ERROR: Python is not installed or not in PATH
	echo Please install Python 3.8+ and try again
	exit /b 1
)

if exist "%SCRIPT_DIR%venv\" (
	echo Virtual environment already exists, checking if it's complete...
	call "%SCRIPT_DIR%venv\Scripts\activate.bat"
	python -c "import cv2, numpy, dlib, PyInstaller" 2>nul
	if not errorlevel 1 (
		echo OK: Virtual environment is complete and ready to use
		echo SUCCESS: Setup complete using cached environment
		goto end
	)
	echo Virtual environment exists but packages are missing, reinstalling...
	call deactivate 2>nul
	rmdir /s /q "%SCRIPT_DIR%venv"
)

echo Creating virtual environment...
python -m venv "%SCRIPT_DIR%venv"
if errorlevel 1 (
	echo ERROR: Failed to create virtual environment
	exit /b 1
)

echo Activating virtual environment...
call "%SCRIPT_DIR%venv\Scripts\activate.bat"

echo Upgrading pip...
python -m pip install --upgrade pip
if errorlevel 1 (
	echo ERROR: Failed to upgrade pip
	exit /b 1
)

echo Installing dependencies...
pip install -r "%SCRIPT_DIR%requirements.txt"
if errorlevel 1 (
	echo ERROR: Failed to install requirements
	exit /b 1
)

echo SUCCESS: Setup complete
echo.
echo Next steps:
echo 1. Run build_and_install.bat to build the standalone binary
echo 2. Test the binary with test_binary.py
echo 3. The binary will be installed to electron/resources/
echo.
echo To activate the environment manually:
echo    call python\venv\Scripts\activate.bat

:end
endlocal
exit /b 0
