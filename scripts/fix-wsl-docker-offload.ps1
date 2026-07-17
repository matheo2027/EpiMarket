$ErrorActionPreference = "Stop"

try {
    $adapter = Get-NetAdapter | Where-Object { $_.Name -like "*WSL*" -and $_.Status -eq "Up" } | Select-Object -First 1
    if (-not $adapter) {
        exit 0
    }

    $props = Get-NetAdapterAdvancedProperty -Name $adapter.Name -ErrorAction SilentlyContinue |
        Where-Object { $_.DisplayName -match "Large Send Offload|Checksum Offload" }

    $needsFix = $props | Where-Object { $_.DisplayValue -ne "Disabled" }
    if (-not $needsFix) {
        exit 0
    }

    Write-Host "[fix-wsl-docker-offload] Offload TCP encore actif sur '$($adapter.Name)' - correction (elevation requise)..."

    $adapterName = $adapter.Name
    $inner = "Disable-NetAdapterLso -Name '$adapterName' -Confirm:`$false; " +
             "Disable-NetAdapterChecksumOffload -Name '$adapterName' -Confirm:`$false"

    Start-Process powershell -Verb RunAs -Wait -ArgumentList @(
        "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $inner
    )

    wsl --shutdown

    Write-Host "[fix-wsl-docker-offload] Correction appliquee, WSL2 redemarre."
}
catch {
    Write-Host "[fix-wsl-docker-offload] Verification ignoree (erreur non bloquante) : $($_.Exception.Message)"
}

exit 0
