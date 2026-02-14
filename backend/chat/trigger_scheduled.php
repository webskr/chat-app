<?php
// backend/chat/trigger_scheduled.php

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

include_once '../includes/db_connection.php';
include_once 'scheduled_message_service.php';

$result = processScheduledMessages($pdo);

echo json_encode([
    'success' => true,
    'processed_count' => $result['count'],
    'errors' => $result['errors']
]);
?>
