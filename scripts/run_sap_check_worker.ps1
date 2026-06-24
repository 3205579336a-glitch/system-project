param(
  [switch]$Once,
  [switch]$Serve,
  [string]$PythonPath
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$venv = Join-Path $root ".venv-sap"
$python = Join-Path $venv "Scripts\python.exe"
$envFile = Join-Path $PSScriptRoot "sap_check_worker.env"
$requiredMajor = 3
$supportedMinors = @(13, 12, 11)

if (-not (Test-Path $envFile)) {
  Write-Host "Missing env file: $envFile" -ForegroundColor Yellow
  Write-Host "Copy scripts\sap_check_worker.env.example to scripts\sap_check_worker.env and fill the values first."
  exit 1
}

function Get-PythonVersion($pythonPath) {
  try {
    $version = & $pythonPath -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"
    return [version]$version
  } catch {
    return $null
  }
}

function Find-SupportedPythonLauncher {
  if ($PythonPath) {
    if (-not (Test-Path $PythonPath)) {
      Write-Host "PythonPath does not exist: $PythonPath" -ForegroundColor Red
      exit 1
    }
    $version = Get-PythonVersion $PythonPath
    if (-not $version -or $version.Major -ne $requiredMajor -or -not ($supportedMinors -contains $version.Minor)) {
      Write-Host "PythonPath must point to Python 3.13, 3.12, or 3.11. Current: $version" -ForegroundColor Red
      exit 1
    }
    return @{ Command = $PythonPath; Args = @() }
  }

  foreach ($minor in $supportedMinors) {
    try {
      $candidate = & py "-3.$minor" -c "import sys; print(sys.executable)" 2>$null
      if ($LASTEXITCODE -eq 0 -and $candidate) {
        return @{ Command = "py"; Args = @("-3.$minor") }
      }
    } catch {}
  }
  return $null
}

$venvVersion = $null
if (Test-Path $python) {
  $venvVersion = Get-PythonVersion $python
  if ($venvVersion -and ($venvVersion.Major -ne $requiredMajor -or -not ($supportedMinors -contains $venvVersion.Minor))) {
    Write-Host "Existing .venv-sap uses Python $venvVersion, which is not recommended for Playwright/greenlet." -ForegroundColor Yellow
    Write-Host "Delete .venv-sap and install Python 3.13 or 3.12, then run this script again."
    Write-Host "Command: Remove-Item -Recurse -Force .venv-sap"
    exit 1
  }
}

if (-not (Test-Path $python)) {
  $launcher = Find-SupportedPythonLauncher
  if (-not $launcher) {
    Write-Host "No supported Python found. Please install Python 3.13 or 3.12 from python.org, then rerun this script." -ForegroundColor Red
    Write-Host "Recommended install command: winget install -e --id Python.Python.3.12"
    Write-Host "If Python is installed but not registered in py launcher, run:"
    Write-Host ".\scripts\run_sap_check_worker.ps1 -PythonPath `"C:\Path\To\Python312\python.exe`" -Once"
    Write-Host "Your current Python 3.14 may fail to install greenlet, which Playwright needs."
    exit 1
  }
  Write-Host "Creating Python virtual environment..."
  & $launcher.Command @($launcher.Args + @("-m", "venv", $venv))
}

Write-Host "Using Python: $(& $python --version)"
Write-Host "Upgrading packaging tools..."
& $python -m pip install --upgrade pip setuptools wheel

Write-Host "Installing worker dependencies..."
& $python -m pip install -r (Join-Path $PSScriptRoot "requirements-sap-worker.txt")

Write-Host "Installing Playwright Chromium..."
& $python -m playwright install chromium

$argsList = @((Join-Path $PSScriptRoot "sap_check_worker.py"))
if ($Once) {
  $argsList += "--once"
}
if ($Serve) {
  $argsList += "--serve"
}

Write-Host "Starting SAP Check Worker..."
& $python @argsList
