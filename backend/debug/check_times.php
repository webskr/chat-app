<?php
include_once '../includes/db_connection.php';
$cid = 13; // Example conversation ID from debug_output.json
echo "--- Timestamps for Conversation $cid ---\n";
$stmt = $pdo->prepare("SELECT m.id, m.created_at, c.user1_cleared_at, c.user2_cleared_at 
                       FROM messages m 
                       JOIN conversations c ON m.conversation_id = c.id 
                       WHERE c.id = ? 
                       LIMIT 5");
$stmt->execute([$cid]);
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode($rows, JSON_PRETTY_PRINT);

echo "\n\n--- Current Server Time (DB) ---\n";
$stmt = $pdo->query("SELECT NOW() as db_now");
echo json_encode($stmt->fetch(PDO::FETCH_ASSOC), JSON_PRETTY_PRINT);
?>
