# Script para fazer push usando seu token do GitHub
# Execute no PowerShell: .\git-push-with-token.ps1

$token = Read-Host "Cole seu token do GitHub (ghp_...)" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($token)
$plainToken = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)

$tempCredFile = Join-Path $env:TEMP "git-cred-$(Get-Random).txt"
"https://jadielmiranda87-cell:$plainToken@github.com" | Out-File -FilePath $tempCredFile -Encoding ascii

try {
    git -c "credential.helper=store --file `"$tempCredFile`"" push
} finally {
    Remove-Item $tempCredFile -Force -ErrorAction SilentlyContinue
}
