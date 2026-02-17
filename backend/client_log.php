<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit();

$data = json_decode(file_get_contents("php://input"), true);
$log = date('Y-m-d H:i:s') . " [CLIENT] " . print_r($data, true) . "\n";
file_put_contents('client_debug.log', $log, FILE_APPEND);

echo json_encode(['success' => true]);
?>
