#Requires -Version 5.1
# Startup.ps1 — list / disable user startup entries (safe)

function Get-OptiStartupItems {
    $items = @()
    $runKeys = @(
        'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run',
        'HKLM:\Software\Microsoft\Windows\CurrentVersion\Run'
    )
    $safe = @(Get-OptiListLines -RelativeName 'startup-safe.txt')
    foreach ($key in $runKeys) {
        if (-not (Test-Path -LiteralPath $key)) { continue }
        $props = Get-ItemProperty -Path $key -ErrorAction SilentlyContinue
        if (-not $props) { continue }
        $props.PSObject.Properties | Where-Object {
            $_.Name -notmatch '^PS' -and $_.Name -ne '(default)'
        } | ForEach-Object {
            $name = $_.Name
            $cmd = [string]$_.Value
            $protected = $false
            foreach ($s in $safe) {
                if ($name -like "*$s*" -or $cmd -like "*$s*") { $protected = $true; break }
            }
            $items += @{
                Name = $name
                Command = $cmd
                Hive = $key
                Protected = $protected
                Enabled = $true
            }
        }
    }
    # Startup folder
    $startupDir = [Environment]::GetFolderPath('Startup')
    if ($startupDir -and (Test-Path $startupDir)) {
        Get-ChildItem -LiteralPath $startupDir -ErrorAction SilentlyContinue | ForEach-Object {
            $items += @{
                Name = $_.BaseName
                Command = $_.FullName
                Hive = 'StartupFolder'
                Protected = $false
                Enabled = $true
            }
        }
    }
    return $items
}

function Disable-OptiStartupItems {
    param(
        [object[]]$Items,
        [string]$LogPath
    )
    $disabled = @()
    $skipped = @()
    foreach ($it in @($Items)) {
        $name = [string]$it.Name
        $hive = [string]$it.Hive
        if ($it.Protected) {
            $skipped += @{ Name = $name; Reason = 'protected' }
            continue
        }
        try {
            if ($hive -eq 'StartupFolder') {
                $path = [string]$it.Command
                if (Test-Path -LiteralPath $path) {
                    $bak = Join-Path (Get-OptiDataDir) 'startup-disabled'
                    if (-not (Test-Path $bak)) { New-Item -ItemType Directory -Path $bak -Force | Out-Null }
                    Move-Item -LiteralPath $path -Destination (Join-Path $bak ([IO.Path]::GetFileName($path))) -Force -ErrorAction Stop
                    $disabled += $name
                }
            } elseif ($hive -match 'HK') {
                $cmd = (Get-ItemProperty -Path $hive -Name $name -ErrorAction Stop).$name
                $null = New-OptiUndoSnapshot -Name ("startup-$name") -Data @{ hive = $hive; name = $name; command = $cmd }
                Remove-ItemProperty -Path $hive -Name $name -ErrorAction Stop
                $disabled += $name
                Write-OptiLog -Message "Startup disabled: $name" -LogPath $LogPath -Level OK
            }
        } catch {
            $skipped += @{ Name = $name; Reason = $_.Exception.Message }
        }
    }
    return @{ Success = $true; Message = ("{0} démarrages désactivés" -f $disabled.Count); disabled = $disabled; skipped = $skipped }
}
