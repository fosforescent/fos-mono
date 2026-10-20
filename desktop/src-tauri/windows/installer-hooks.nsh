; Both GUI and CLI are fos.exe. Update only this user's PATH, using the actual
; chosen install directory. nsExec keeps PowerShell hidden during silent installs.
!macro NSIS_HOOK_POSTINSTALL
  nsExec::ExecToStack '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$INSTDIR\desktop-cli-path.ps1" -InstallDirectory "$INSTDIR"'
  Pop $0
  Pop $1
  DetailPrint "$1"
  ${If} $0 != 0
    MessageBox MB_OK|MB_ICONEXCLAMATION "Fos was installed, but its CLI could not be added to PATH. $1" /SD IDOK
  ${EndIf}
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  nsExec::ExecToStack '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$INSTDIR\desktop-cli-path.ps1" -InstallDirectory "$INSTDIR" -Remove'
  Pop $0
  Pop $1
  DetailPrint "$1"
!macroend
