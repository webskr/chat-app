# start-ip.ps1
# This script starts the local services (Expo and Socket) using the local IP address
# without Cloudflare tunnels.

$IP = "10.130.145.5"

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "STSRTING CHAT APP SERVICES (IP WORK ONLY)" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "Local IP: $IP" -ForegroundColor Green

Write-Host "`n1. Starting Socket Server on Port 8082..." -ForegroundColor Cyan
$env:PORT = 8082
# Start in a new window so logs are visible
Start-Process powershell -ArgumentList "-NoExit", "-Command", "node backend\socket\server.js"

Write-Host "2. Starting Expo on Port 8081..." -ForegroundColor Cyan
# Start in a new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npx expo start --port 8081"

Write-Host "`n===============================================" -ForegroundColor Green
Write-Host "SERVICES ARE STARTING" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Green
Write-Host "Backend API: http://$IP/chat-app/backend" -ForegroundColor Cyan
Write-Host "Socket URL:  http://$IP:8082" -ForegroundColor Cyan
Write-Host "Expo Metro:  http://$IP:8081" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Green
Write-Host "Check the newly opened terminal windows for logs." -ForegroundColor Yellow
