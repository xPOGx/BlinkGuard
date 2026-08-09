@echo off
setlocal

REM Build and install blink detector binary (Windows).
REM Avoid enabledelayedexpansion and ||/(&& chains — they break on CI cmd.exe.

echo Building and installing blink detector standalone binary...

set "SCRIPT_DIR=%~dp0"

if not exist "%SCRIPT_DIR%venv\" (
	echo ERROR: Virtual environment not found. Please run setup.bat first.
	exit /b 1
)

echo Activating virtual environment...
call "%SCRIPT_DIR%venv\Scripts\activate.bat"

echo Verifying virtual environment...
python -c "import sys; print('Python executable:', sys.executable)"
if errorlevel 1 (
	echo ERROR: Python failed after activating virtual environment
	exit /b 1
)
echo OK: Virtual environment activated successfully

echo Checking PyInstaller installation...
python -c "import PyInstaller" 2>nul
if errorlevel 1 (
	echo Installing PyInstaller...
	pip install pyinstaller
	if errorlevel 1 (
		echo ERROR: Failed to install PyInstaller
		exit /b 1
	)
)

echo Testing build environment...
python "%SCRIPT_DIR%test_build.py"
if errorlevel 1 (
	echo ERROR: Build environment test failed
	exit /b 1
)

echo Building binary...
python "%SCRIPT_DIR%build_binary.py"
if errorlevel 1 (
	echo ERROR: Binary build failed
	exit /b 1
)

if not exist "%SCRIPT_DIR%dist\blink_detector.exe" (
	echo ERROR: Binary build failed - blink_detector.exe not found
	echo.
	echo Checking dist directory contents:
	if exist "%SCRIPT_DIR%dist\" (
		dir "%SCRIPT_DIR%dist"
	) else (
		echo Dist directory does not exist
	)
	echo.
	echo Checking build directory contents:
	if exist "%SCRIPT_DIR%build\" (
		dir "%SCRIPT_DIR%build"
	) else (
		echo Build directory does not exist
	)
	exit /b 1
)

echo OK: Binary built successfully

echo Testing binary...
python "%SCRIPT_DIR%test_binary.py"
if errorlevel 1 (
	echo ERROR: Binary test failed
	exit /b 1
)

echo Installing binary to Electron resources...
python "%SCRIPT_DIR%install_binary.py"
if errorlevel 1 (
	echo ERROR: Binary installation failed
	exit /b 1
)

echo SUCCESS: Build and installation complete
echo.
echo Summary:
echo - Standalone binary created: python/dist/blink_detector.exe
echo - Binary installed to: electron/resources/blink_detector.exe
echo - Binary size: ~117MB includes Python and dependencies

endlocal
exit /b 0
