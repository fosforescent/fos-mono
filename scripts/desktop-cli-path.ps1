param([string]$InstallDirectory, [switch]$Remove)
$ErrorActionPreference = 'Stop'

if (-not $InstallDirectory) {
    $registration = Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Fosforescent' -ErrorAction SilentlyContinue
    $InstallDirectory = $registration.InstallLocation
    if (-not $InstallDirectory) { $InstallDirectory = Join-Path $env:LOCALAPPDATA 'Fosforescent' }
}
$InstallDirectory = (Resolve-Path -LiteralPath $InstallDirectory.Trim().Trim('"')).Path.TrimEnd('\')
$executable = Join-Path $InstallDirectory 'fos.exe'
if (-not $Remove -and -not (Test-Path -LiteralPath $executable -PathType Leaf)) { throw "No installed Fos CLI at $executable" }

# Read without expanding %VARIABLES%; never replace the user PATH with the process PATH.
$environment = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey('Environment')
try {
    $existing = [string]$environment.GetValue('Path', '', [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
    $entries = @($existing -split ';')
    $matchesDirectory = {
        [Environment]::ExpandEnvironmentVariables($_.Trim().Trim('"')).TrimEnd('\') -ieq $InstallDirectory
    }
    $present = @($entries | Where-Object $matchesDirectory).Count -gt 0
    if ($Remove) {
        if ($present) {
            $remaining = @($entries | Where-Object { -not (& $matchesDirectory) }) -join ';'
            $environment.SetValue('Path', $remaining, [Microsoft.Win32.RegistryValueKind]::ExpandString)
        }
        Write-Output "Removed $InstallDirectory from your user PATH."
    } elseif (-not $present) {
        $separator = if ($existing -and -not $existing.EndsWith(';')) { ';' } else { '' }
        $environment.SetValue('Path', "$existing$separator$InstallDirectory", [Microsoft.Win32.RegistryValueKind]::ExpandString)
        Write-Output "Added $InstallDirectory to your user PATH."
    } else { Write-Output 'Fos CLI is already on your user PATH.' }
} finally { $environment.Dispose() }

# Notify Explorer so new terminal windows inherit the updated environment.
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class FosEnvironmentChange {
    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern IntPtr SendMessageTimeout(IntPtr window, uint message, UIntPtr wParam,
        string lParam, uint flags, uint timeout, out UIntPtr result);
}
'@
$notificationResult = [UIntPtr]::Zero
[void][FosEnvironmentChange]::SendMessageTimeout([IntPtr]0xffff, 0x1a, [UIntPtr]::Zero, 'Environment', 2, 5000, [ref]$notificationResult)
if (-not $Remove) {
    Write-Output "Installed CLI: $executable"
    Write-Output 'Open a new terminal (or restart your IDE terminal host) to run fos.'
}
