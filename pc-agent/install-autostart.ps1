$ErrorActionPreference = "Stop"

$agentDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$server = Join-Path $agentDir "server.js"
$node = (Get-Command node -ErrorAction Stop).Source

$action = New-ScheduledTaskAction -Execute $node -Argument "`"$server`"" -WorkingDirectory $agentDir
$trigger = New-ScheduledTaskTrigger -AtLogOn
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask -TaskName "JARVIS PC Agent" -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null

Write-Host ""
Write-Host "JARVIS PC Agent will now start automatically when you sign in to Windows." -ForegroundColor Green
Write-Host "You can test it with: Get-ScheduledTask -TaskName 'JARVIS PC Agent'"
Write-Host "To remove auto-start: Unregister-ScheduledTask -TaskName 'JARVIS PC Agent' -Confirm:$false"
