<?php
include '../includes/db_connection.php';
try {
    echo "--- CHECKING GROUP 1 ---\n";
    
    // Check Group
    $g = $pdo->query("SELECT * FROM groups WHERE id = 1")->fetch();
    echo "Group: " . json_encode($g) . "\n";
    
    // Check Members
    $m = $pdo->query("SELECT * FROM group_members WHERE group_id = 1 AND user_id = 1")->fetch();
    echo "Member: " . json_encode($m) . "\n";
    
    // Check Conversation
    $c = $pdo->query("SELECT * FROM conversations WHERE group_id = 1")->fetch();
    echo "Conversation: " . json_encode($c) . "\n";
    
    if ($c) {
        // Check Messages
        $cid = $c['id'];
        $msgs = $pdo->query("SELECT COUNT(*) FROM messages WHERE conversation_id = $cid")->fetchColumn();
        echo "Message Count: $msgs\n";
        
        $sample = $pdo->query("SELECT id, is_one_time, message_text FROM messages WHERE conversation_id = $cid LIMIT 5")->fetchAll(PDO::FETCH_ASSOC);
        echo "Sample Messages: " . json_encode($sample) . "\n";
    }
    
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage();
}
?>
