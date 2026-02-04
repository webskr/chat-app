<?php
header("Content-Type: text/plain");
include_once '../includes/db_connection.php';

echo "Restoring Note to Self for all users...\n";

// Get all users
$stmt = $pdo->query("SELECT id, username FROM users");
$users = $stmt->fetchAll(PDO::FETCH_ASSOC);

foreach ($users as $u) {
    $uid = $u['id'];
    $uName = $u['username'];
    
    // Check if exists
    $stmt2 = $pdo->prepare("SELECT id FROM conversations WHERE user1_id = ? AND user2_id = ?");
    $stmt2->execute([$uid, $uid]);
    $exists = $stmt2->fetch();
    
    if (!$exists) {
        // Create it
        $stmt3 = $pdo->prepare("INSERT INTO conversations (user1_id, user2_id, last_message, last_message_time) VALUES (?, ?, ?, NOW())");
        if ($stmt3->execute([$uid, $uid, 'Note to Self'])) {
            echo "[$uid] $uName: Created self-chat.\n";
        } else {
            echo "[$uid] $uName: Failed to create.\n";
            print_r($stmt3->errorInfo());
        }
    } else {
        echo "[$uid] $uName: Already exists (ID " . $exists['id'] . "). Updating time/msg to ensure visibility.\n";
        // Update to make sure it's visible
        $stmt4 = $pdo->prepare("UPDATE conversations SET last_message = ?, last_message_time = NOW() WHERE id = ?");
        $stmt4->execute(['Note to Self', $exists['id']]);
        
        // Also reset cleared_at if it exists in users or conversations? 
        // Logic in get_conversations uses `user1_cleared_at` column in `conversations` table?
        // Let's check schema for `conversations`.
    }
}
?>
