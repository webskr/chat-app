<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

include_once '../includes/db_connection.php';

$tables = ['users', 'conversations', 'messages', 'reactions', 'relationships', 'muted_chats', 'reports', 'messages_deleted'];
$status = [];

foreach ($tables as $table) {
    try {
        $stmt = $pdo->query("DESCRIBE $table");
        $status[$table] = "OK";
    } catch (PDOException $e) {
        $status[$table] = "MISSING: " . $e->getMessage();
    }
}

echo json_encode($status);
?>
