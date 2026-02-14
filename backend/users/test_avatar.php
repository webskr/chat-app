<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");

$logFile = 'upload_debug.log';
$logEntry = "Time: " . date('Y-m-d H:i:s') . "\n";
$logEntry .= "POST: " . print_r($_POST, true) . "\n";
$logEntry .= "FILES: " . print_r($_FILES, true) . "\n";
file_put_contents($logFile, $logEntry, FILE_APPEND);

echo json_encode([
    "message" => "Debug info logged",
    "post" => $_POST,
    "files" => $_FILES
]);
?>
