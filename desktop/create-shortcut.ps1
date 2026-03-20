# Creates a Desktop shortcut for the Allocation Estimator app
$WshShell = New-Object -ComObject WScript.Shell

$ShortcutPath = [System.IO.Path]::Combine([Environment]::GetFolderPath('Desktop'), 'Allocation Estimator.lnk')
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = [System.IO.Path]::Combine($PSScriptRoot, 'dist', 'win-unpacked', 'Allocation Estimator.exe')
$Shortcut.WorkingDirectory = [System.IO.Path]::Combine($PSScriptRoot, 'dist', 'win-unpacked')
$Shortcut.IconLocation = [System.IO.Path]::Combine($PSScriptRoot, 'icon.ico')
$Shortcut.Description = 'Allocation Estimator - Resource Planning'
$Shortcut.Save()

Write-Host "Desktop shortcut created at: $ShortcutPath"

# Also pin to taskbar via Start Menu
$StartMenuPath = [System.IO.Path]::Combine([Environment]::GetFolderPath('Programs'), 'Allocation Estimator.lnk')
$Shortcut2 = $WshShell.CreateShortcut($StartMenuPath)
$Shortcut2.TargetPath = [System.IO.Path]::Combine($PSScriptRoot, 'dist', 'win-unpacked', 'Allocation Estimator.exe')
$Shortcut2.WorkingDirectory = [System.IO.Path]::Combine($PSScriptRoot, 'dist', 'win-unpacked')
$Shortcut2.IconLocation = [System.IO.Path]::Combine($PSScriptRoot, 'icon.ico')
$Shortcut2.Description = 'Allocation Estimator - Resource Planning'
$Shortcut2.Save()

Write-Host "Start Menu shortcut created at: $StartMenuPath"
Write-Host ""
Write-Host "To pin to taskbar: Right-click the Desktop shortcut > 'Show more options' > 'Pin to taskbar'"
