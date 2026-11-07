<#
  LeCAD-CXR: check, install and start the whole system on Windows.

  From the project folder, in a terminal:
      .\run.cmd

  The first run installs everything (about 10 minutes, 1.5 GB). Later runs
  start in under a minute. Press Ctrl+C to stop. See README.md, "Run it".

  Options:  -ApiPort 8000  -WebPort 3000  -Rebuild (rebuild the web app)
#>
param(
    [int]$ApiPort = 8000,
    [int]$WebPort = 3000,
    [switch]$Rebuild
)

$Root = $PSScriptRoot
Set-Location $Root
$Steps = 6

function Step($n, $text) { Write-Host ""; Write-Host "[$n/$Steps] $text" -ForegroundColor Cyan }
function Ok($text) { Write-Host "      ok  $text" -ForegroundColor Green }
function Info($text) { Write-Host "          $text" }
function Fail($problem, $fix) {
    Write-Host ""
    Write-Host "  PROBLEM: $problem" -ForegroundColor Red
    if ($fix) { Write-Host "  FIX:     $fix" -ForegroundColor Yellow }
    Write-Host ""
    exit 1
}
function Show-LogTail($path) {
    if (Test-Path $path) {
        Write-Host "  Last lines of $path :" -ForegroundColor DarkGray
        Get-Content $path -Tail 15 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
    }
}
function Test-PortBusy($port) {
    [bool](Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
}
function Test-Url($url) {
    try {
        $r = Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 5
        return $r.StatusCode -eq 200
    } catch { return $false }
}
function Get-TreeHash($paths) {
    $files = foreach ($p in $paths) {
        if (Test-Path $p -PathType Container) { Get-ChildItem $p -Recurse -File }
        elseif (Test-Path $p) { Get-Item $p }
    }
    $joined = ($files | Sort-Object FullName | Get-FileHash -Algorithm SHA256 |
               ForEach-Object { $_.Hash }) -join ""
    $sha = [Security.Cryptography.SHA256]::Create()
    [BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($joined))) -replace "-", ""
}
function Stop-Tree($proc) {
    if ($proc -and -not $proc.HasExited) { & taskkill.exe /T /F /PID $proc.Id 2>&1 | Out-Null }
}

Write-Host ""
Write-Host "LeCAD-CXR: chest X-ray decision support (research prototype)" -ForegroundColor White

# -- 1. Tools ----------------------------------------------------------------
Step 1 "Checking Python and Node.js"

# Through the Windows "py" launcher, prefer the newest version that every
# dependency publishes ready-made packages for (3.14 down to 3.10). A newer
# Python is tried last: some packages then need a C++ compiler to install.
$Known = @("3.14", "3.13", "3.12", "3.11", "3.10", "3.15")
$candidates = @()
if (Get-Command py -ErrorAction SilentlyContinue) {
    foreach ($s in $Known) { $candidates += , @("py", "-$s") }
}
$candidates += , @("python")
$candidates += , @("python3")

$Python = $null
foreach ($candidate in $candidates) {
    $exe = $candidate[0]
    $extra = @($candidate | Select-Object -Skip 1)
    if (-not (Get-Command $exe -ErrorAction SilentlyContinue)) { continue }
    # The Microsoft Store placeholder "python" prints nothing and fails: skipped.
    $v = & $exe @extra -c "import sys; print('%d.%d' % sys.version_info[:2])" 2>$null
    if ($LASTEXITCODE -eq 0 -and $v -and ([version]$v -ge [version]"3.10")) {
        $Python = @{ Exe = $exe; Args = $extra; Version = $v }
        break
    }
}
if (-not $Python) {
    Fail "Python 3.10 or newer was not found." `
         "Install Python 3.12 from https://www.python.org/downloads/ (tick 'Add python.exe to PATH'), close and reopen the terminal, then run .\run.cmd again."
}
Ok "Python $($Python.Version)"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Fail "Node.js was not found." `
         "Install the LTS version from https://nodejs.org, close and reopen the terminal, then run .\run.cmd again."
}
$nodeVersion = (& node --version).TrimStart("v")
if ([version]$nodeVersion -lt [version]"20.9") {
    Fail "Node.js $nodeVersion is too old (20.9 or newer is needed)." `
         "Install the LTS version from https://nodejs.org, then run .\run.cmd again."
}
Ok "Node.js $nodeVersion"

# -- 2. Configuration --------------------------------------------------------
Step 2 "Checking the configuration"

$Model = Join-Path $Root "ml\models\model_sens90.pt"
if (-not (Test-Path $Model)) {
    Fail "The trained model (ml\models\model_sens90.pt) is missing." `
         "Download the project again from GitHub; the model is part of it."
}
Ok "trained model found"

$EnvFile = Join-Path $Root ".env"
if (-not (Test-Path $EnvFile)) {
    Write-Host ""
    Write-Host "      This laptop has no .env file yet. Paste the database connection string" -ForegroundColor Yellow
    Write-Host "      from the marking notes (it starts with postgresql://) and press Enter." -ForegroundColor Yellow
    $url = (Read-Host "      DATABASE_URL").Trim().Trim('"').Trim("'")
    if ($url -notmatch '^postgres(ql)?(\+psycopg)?://\S+@\S+') {
        Fail "That does not look like a database connection string." `
             "Copy the whole line starting with postgresql:// from the marking notes, then run .\run.cmd again."
    }
    # SQLAlchemy needs the driver named; Neon hands out plain postgresql://.
    $url = $url -replace '^postgres(ql)?(\+psycopg)?://', 'postgresql+psycopg://'
    # Signs this laptop's sign-in sessions; any long random value will do.
    $bytes = New-Object byte[] 48
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $jwt = [Convert]::ToBase64String($bytes) -replace '[+/=]', ''
    $lines = @(
        "# Written by run.ps1 on $(Get-Date -Format yyyy-MM-dd). Private: holds the database password.",
        "DATABASE_URL=$url",
        "JWT_SECRET=$jwt",
        "LECAD_MODEL_PATH=ml/models/model_sens90.pt",
        "# Plain http on localhost needs non-secure cookies.",
        "LECAD_COOKIE_SECURE=0"
    )
    [IO.File]::WriteAllLines($EnvFile, $lines)  # UTF-8 without BOM
    Ok ".env created"
} else {
    $envText = Get-Content $EnvFile -Raw
    if ($envText -notmatch '(?m)^DATABASE_URL=\S+') {
        Fail ".env has no DATABASE_URL line." `
             "Delete .env and run .\run.cmd again; it will ask for the connection string."
    }
    Ok ".env found"
}

# -- 3. API (Python) ---------------------------------------------------------
Step 3 "Installing the API (first run only: about 5 to 10 minutes)"

$VenvPy = Join-Path $Root ".venv\Scripts\python.exe"
if (-not (Test-Path $VenvPy)) {
    Info "creating a private Python environment in .venv"
    & $Python.Exe @($Python.Args) -m venv .venv
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $VenvPy)) {
        Fail "Could not create the Python environment." "Delete the .venv folder if it exists, then run .\run.cmd again."
    }
}
$pyStamp = Join-Path $Root ".venv\.lecad-installed"
$pyWant = (Get-FileHash (Join-Path $Root "ml\pyproject.toml")).Hash
if (-not (Test-Path $pyStamp) -or (Get-Content $pyStamp) -ne $pyWant) {
    Info "installing PyTorch, FastAPI and the rest (the download is about 250 MB)"
    $pipLog = Join-Path $env:TEMP "lecad-pip.log"
    Remove-Item $pipLog -ErrorAction SilentlyContinue
    & $VenvPy -m pip install --upgrade pip --quiet --disable-pip-version-check
    & $VenvPy -m pip install -e "ml[serve]" --disable-pip-version-check --progress-bar on --log $pipLog
    if ($LASTEXITCODE -ne 0) {
        $pyNow = & $VenvPy -c "import sys; print('%d.%d' % sys.version_info[:2])"
        if ((Test-Path $pipLog) -and (Select-String -Path $pipLog -Pattern "Microsoft Visual C\+\+" -Quiet)) {
            Remove-Item (Join-Path $Root ".venv") -Recurse -Force -ErrorAction SilentlyContinue
            Fail "Python $pyNow is too new: some packages have no ready-made version for it yet and would need a C++ compiler." `
                 "Install Python 3.12 from https://www.python.org/downloads/ (tick 'Add python.exe to PATH'), close and reopen the terminal, then run .\run.cmd again."
        }
        Fail "Installing the Python packages failed (see the messages above)." `
             "Check the internet connection, then run .\run.cmd again. It continues where it stopped."
    }
    Set-Content $pyStamp $pyWant
    Ok "API installed"
} else {
    Ok "API already installed"
}

# -- 4. Web app (Node.js) ----------------------------------------------------
Step 4 "Installing and building the web app (first run only: about 3 minutes)"

$Web = Join-Path $Root "web"
$nodeStamp = Join-Path $Web "node_modules\.lecad-installed"
$nodeWant = (Get-FileHash (Join-Path $Web "package-lock.json")).Hash
Push-Location $Web
try {
    if (-not (Test-Path $nodeStamp) -or (Get-Content $nodeStamp) -ne $nodeWant) {
        Info "installing packages"
        & npm.cmd ci --no-audit --no-fund --loglevel=error
        if ($LASTEXITCODE -ne 0) {
            Fail "Installing the web app's packages failed (see the messages above)." `
                 "Close any other terminal running the web app, then run .\run.cmd again."
        }
        Set-Content $nodeStamp $nodeWant
    }
    Ok "packages installed"

    # The web app forwards /api/* to the API (next.config.ts); fixed at build.
    $envLocal = "API_URL=http://localhost:$ApiPort"
    $envLocalPath = Join-Path $Web ".env.local"
    if (-not (Test-Path $envLocalPath) -or (Get-Content $envLocalPath -Raw).Trim() -ne $envLocal) {
        [IO.File]::WriteAllLines($envLocalPath, @($envLocal))
    }

    $buildStamp = Join-Path $Web ".next\.lecad-built"
    $buildWant = Get-TreeHash @("src", "public", "next.config.ts", "package-lock.json", ".env.local")
    $built = (Test-Path (Join-Path $Web ".next\BUILD_ID")) -and (Test-Path $buildStamp) -and
             ((Get-Content $buildStamp) -eq $buildWant)
    if ($Rebuild -or -not $built) {
        Info "building (about a minute)"
        # A NODE_ENV left set to "development" breaks a production build.
        Remove-Item Env:NODE_ENV -ErrorAction SilentlyContinue
        & npm.cmd run build --silent
        if ($LASTEXITCODE -ne 0) {
            Fail "Building the web app failed (see the messages above)." "Run .\run.cmd -Rebuild to try again."
        }
        Set-Content $buildStamp $buildWant
    }
    Ok "web app built"
} finally {
    Pop-Location
}

# -- 5. Start ----------------------------------------------------------------
Step 5 "Starting the API and the web app"

foreach ($p in @($ApiPort, $WebPort)) {
    # Right after a stop, Windows keeps the old socket for a few seconds.
    $waitUntil = (Get-Date).AddSeconds(15)
    while ((Test-PortBusy $p) -and (Get-Date) -lt $waitUntil) { Start-Sleep -Seconds 1 }
    if (Test-PortBusy $p) {
        Fail "Port $p is already in use, probably by an earlier run that is still open." `
             "Close the other terminal running LeCAD-CXR (or restart the laptop), then run .\run.cmd again."
    }
}

$Logs = Join-Path $Root "ml\artifacts\logs"
New-Item -ItemType Directory -Force $Logs | Out-Null
$apiLog = Join-Path $Logs "api.log"
$webLog = Join-Path $Logs "web.log"

$api = $null
$webProc = $null
try {
    $api = Start-Process -FilePath $VenvPy -PassThru -NoNewWindow -WorkingDirectory $Root `
        -ArgumentList @("-m", "uvicorn", "lecad.serving.app:app", "--host", "127.0.0.1", "--port", "$ApiPort") `
        -RedirectStandardError $apiLog -RedirectStandardOutput (Join-Path $Logs "api.out.log")

    Info "loading the model and waking the database (up to a minute)"
    $deadline = (Get-Date).AddSeconds(120)
    while (-not (Test-Url "http://127.0.0.1:$ApiPort/health")) {
        if ($api.HasExited) {
            Show-LogTail $apiLog
            Fail "The API stopped while starting (details above)." `
                 "If it mentions DATABASE_URL or the database, check the connection string in .env against the marking notes."
        }
        if ((Get-Date) -gt $deadline) {
            Show-LogTail $apiLog
            Fail "The API did not become ready within 2 minutes." "Check the internet connection, then run .\run.cmd again."
        }
        Start-Sleep -Seconds 2
    }
    Ok "API ready on http://localhost:$ApiPort"

    $webProc = Start-Process -FilePath "npm.cmd" -PassThru -NoNewWindow -WorkingDirectory $Web `
        -ArgumentList @("run", "start", "--", "--port", "$WebPort") `
        -RedirectStandardOutput $webLog -RedirectStandardError (Join-Path $Logs "web.err.log")
    $deadline = (Get-Date).AddSeconds(60)
    while (-not (Test-Url "http://localhost:$WebPort/login")) {
        if ($webProc.HasExited -or (Get-Date) -gt $deadline) {
            Show-LogTail (Join-Path $Logs "web.err.log")
            Fail "The web app did not start (details above)." "Run .\run.cmd -Rebuild."
        }
        Start-Sleep -Seconds 1
    }
    Ok "web app ready on http://localhost:$WebPort"

    # -- 6. Open -------------------------------------------------------------
    Step 6 "Opening the browser"
    Start-Process "http://localhost:$WebPort"
    Write-Host ""
    Write-Host "  LeCAD-CXR is running at http://localhost:$WebPort" -ForegroundColor Green
    Write-Host "  Sign in with the account in the marking notes."
    Write-Host "  Keep this window open. Press Ctrl+C here to stop." -ForegroundColor Yellow
    Write-Host "  Logs: $Logs"
    Write-Host ""

    while (-not $api.HasExited -and -not $webProc.HasExited) { Start-Sleep -Seconds 1 }
    if ($api.HasExited) { Show-LogTail $apiLog; Write-Host "  The API stopped." -ForegroundColor Red }
    if ($webProc.HasExited) { Show-LogTail $webLog; Write-Host "  The web app stopped." -ForegroundColor Red }
} finally {
    # Runs on Ctrl+C too: nothing is left running in the background.
    Stop-Tree $webProc
    Stop-Tree $api
    Write-Host "  Stopped LeCAD-CXR." -ForegroundColor DarkGray
}
