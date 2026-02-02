<?php
include_once '../includes/db_connection.php';

// 1. Create a dummy message
$sender_id = 1; 
$receiver_id = 1; // Self-chat
$text = "Message to be deleted " . rand(1000,9999);

$stmt = $pdo->prepare("INSERT INTO messages (conversation_id, sender_id, receiver_id, message_text) 
                       SELECT id, :sid, :rid, :msg FROM conversations LIMIT 1");
// Note: This relies on at least one conversation existing. 
// If insert fails (no conversation), we just skip.
// Let's force insert into conversation 1 if exists.
$stmt = $pdo->prepare("INSERT INTO messages (conversation_id, sender_id, receiver_id, message_text) VALUES (1, :sid, :rid, :msg)");
try {
    $stmt->execute([':sid' => $sender_id, ':rid' => $receiver_id, ':msg' => $text]);
    $msg_id = $pdo->lastInsertId();
    echo "Created message ID: $msg_id with text: '$text'\n";
    
    // 2. Call delete logic (simulation)
    // "Delete for Everyone"
    $del_sql = "UPDATE messages SET is_deleted = 1, message_text = '🚫 This message was deleted' WHERE id = :mid";
    $pdo->prepare($del_sql)->execute([':mid' => $msg_id]);
    echo "Executed delete for ID: $msg_id\n";
    
    // 3. Verify
    $check = $pdo->prepare("SELECT message_text, is_deleted FROM messages WHERE id = :mid");
    $check->execute([':mid' => $msg_id]);
    $row = $check->fetch(PDO::FETCH_ASSOC);
    
    echo "Verification Result:\n";
    echo "Text: " . $row['message_text'] . "\n";
    echo "Is Deleted: " . $row['is_deleted'] . "\n";
    
    if ($row['is_deleted'] == 1 && strpos($row['message_text'], "deleted") !== false) {
        echo "SUCCESS: Message marked as deleted correctly.\n";
    } else {
        echo "FAILURE: Message state incorrect.\n";
    }

} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
?>
