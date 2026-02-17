<?php
// backend/debug/check_recent.php
include_once '../includes/db_connection.php';

header("Content-Type: text/plain");

echo "--- Last 5 Messages ---\n";
$stmt = $pdo->query("SELECT id, scheduled_at, status, created_at, sent_at, message_text FROM messages ORDER BY id DESC LIMIT 5");
$msgs = $stmt->fetchAll(PDO::FETCH_ASSOC);

foreach ($msgs as $msg) {
    echo "[ID: {$msg['id']}]\n";
    echo "Status: {$msg['status']}\n";
    echo "Created: {$msg['created_at']} | Scheduled: {$msg['scheduled_at']} | Sent: {$msg['sent_at']}\n";
    echo "Text: " . substr($msg['message_text'], 0, 50) . "...\n";
    echo "--------------------------\n";
}
?>
