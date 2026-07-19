$ErrorActionPreference = "Stop"

function Stop-PortListener {
    param([int]$Port)

    $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    foreach ($conn in $conns) {
        try {
            Write-Host "[stop-dev] Arret du process sur le port $Port (PID $($conn.OwningProcess))"
            Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
        }
        catch {}
    }
}

Stop-PortListener -Port 3000
Stop-PortListener -Port 4000

Write-Host "[stop-dev] Arret des conteneurs docker..."
docker compose down

Write-Host "[stop-dev] Stack arretee."
