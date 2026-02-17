<?php
// backend/debug/check_scheduled.php
include_once '../includes/db_connection.php';

header("Content-Type: text/plain");

echo "Server Time (Local): " . date('Y-m-d H:i:s') . "\n";
echo "Server Time (UTC): " . gmdate('Y-m-d H:i:s') . "\n";
echo "DB UTC_TIMESTAMP(): ";

$stmt = $pdo->query("SELECT UTC_TIMESTAMP()");
echo $stmt->fetchColumn() . "\n\n";

echo "--- Scheduled Messages ---\n";
$stmt = $pdo->query("SELECT id, scheduled_at, status, message_text FROM messages WHERE status = 'scheduled'");
$msgs = $stmt->fetchAll(PDO::FETCH_ASSOC);

if (count($msgs) === 0) {
    echo "No scheduled messages found.\n";
} else {
    foreach ($msgs as $msg) {
        echo "[ID: {$msg['id']}] Scheduled For (UTC): {$msg['scheduled_at']} | Status: {$msg['status']}\n";
        echo "Message: " . substr($msg['message_text'], 0, 50) . "...\n\n";
    }
}
?>
