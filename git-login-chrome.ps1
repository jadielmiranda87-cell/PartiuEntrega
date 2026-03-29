# Login no GitHub via Chrome
# Execute: .\git-login-chrome.ps1

# Garante que Chrome sera usado
$env:BROWSER = "C:\Program Files\Google\Chrome\Application\chrome.exe"

Write-Host "Abrindo login do GitHub no Chrome..." -ForegroundColor Cyan
& "C:\Program Files\Git\mingw64\bin\git-credential-manager.exe" github login

Write-Host ""
Write-Host "Login concluido. Agora execute: git push" -ForegroundColor Green
