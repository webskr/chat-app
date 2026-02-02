<?php
include_once '../includes/db_connection.php';

$user_id = 1; // Existing user
$target_id = 10; // Existing user

echo "--- Debugging Conversation State ---\n";
// 1. Get Conversation
$stmt = $pdo->prepare("SELECT * FROM conversations WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)");
$stmt->execute([$user_id, $target_id, $target_id, $user_id]);
$conv = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$conv) {
    echo "No conversation found between $user_id and $target_id\n";
    // Try to find ANY conversation to test
    $stmt = $pdo->query("SELECT * FROM conversations LIMIT 1");
    $conv = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($conv) {
        $user_id = $conv['user1_id'];
        $target_id = $conv['user2_id'];
        echo "Switched to debugging conversation ID: " . $conv['id'] . " (User $user_id & $target_id)\n";
    } else {
        die("No conversations in DB.\n");
    }
} else {
    echo "Conversation ID: " . $conv['id'] . "\n";
    echo "User1: " . $conv['user1_id'] . " | User2: " . $conv['user2_id'] . "\n";
    echo "User1 Cleared At: " . ($conv['user1_cleared_at'] ?? 'NULL') . "\n";
    echo "User2 Cleared At: " . ($conv['user2_cleared_at'] ?? 'NULL') . "\n";
}

// 2. Count Messages Total
$stmt = $pdo->prepare("SELECT COUNT(*) FROM messages WHERE conversation_id = ?");
$stmt->execute([$conv['id']]);
$total_msgs = $stmt->fetchColumn();
echo "Total Messages in DB: $total_msgs\n";

// 3. Simulate Get Messages for User1
$sender_id = $user_id;
$sql = "SELECT count(*) FROM messages m
        JOIN conversations c ON m.conversation_id = c.id
        WHERE c.id = :cid
        AND (
            CASE
                WHEN c.user1_id = c.user2_id THEN 
                     (c.user1_cleared_at IS NULL OR m.created_at > c.user1_cleared_at)
                WHEN c.user1_id = :me THEN 
                     (c.user1_cleared_at IS NULL OR m.created_at > c.user1_cleared_at)
                WHEN c.user2_id = :me THEN 
                     (c.user2_cleared_at IS NULL OR m.created_at > c.user2_cleared_at)
                ELSE 1
            END
        )";
$stmt = $pdo->prepare($sql);
$stmt->execute([':cid' => $conv['id'], ':me' => $sender_id]);
$visible_msgs = $stmt->fetchColumn();

echo "Messages visible to User $sender_id: $visible_msgs\n";

// 4. Test Clearing
echo "\n--- Simulating Clear for User $user_id ---\n";
// Update timestamp
if ($conv['user1_id'] == $conv['user2_id']) {
    // Self chat: update both to be safe
    $upd = "UPDATE conversations SET user1_cleared_at = NOW(), user2_cleared_at = NOW() WHERE id = ?";
} elseif ($conv['user1_id'] == $user_id) {
    $upd = "UPDATE conversations SET user1_cleared_at = NOW() WHERE id = ?";
} else {
    $upd = "UPDATE conversations SET user2_cleared_at = NOW() WHERE id = ?";
}
$pdo->prepare($upd)->execute([$conv['id']]);

// Check Timestamp again
$stmt = $pdo->prepare("SELECT user1_cleared_at, user2_cleared_at FROM conversations WHERE id = ?");
$stmt->execute([$conv['id']]);
$new_times = $stmt->fetch(PDO::FETCH_ASSOC);
echo "New User1 Cleared At: " . ($new_times['user1_cleared_at'] ?? 'NULL') . "\n";
echo "New User2 Cleared At: " . ($new_times['user2_cleared_at'] ?? 'NULL') . "\n";

// 5. Re-Check Visible Messages
$stmt = $pdo->prepare($sql);
$stmt->execute([':cid' => $conv['id'], ':me' => $sender_id]);
$visible_after = $stmt->fetchColumn();
echo "Messages visible to User $sender_id AFTER Clear: $visible_after\n";

if ($visible_after == 0) {
    echo "DEBUG RESULT: SUCCESS (Messages hidden)\n";
} else {
    echo "DEBUG RESULT: FAILURE (Messages still visible)\n";
    // Show why
    echo "Dumping first failing message dates vs cleared_at:\n";
    $debug_sql = "SELECT m.created_at, c.user1_cleared_at, c.user2_cleared_at 
                  FROM messages m JOIN conversations c ON m.conversation_id = c.id 
                  WHERE c.id = :cid LIMIT 3";
    $stmt = $pdo->prepare($debug_sql);
    $stmt->execute([':cid' => $conv['id']]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    print_r($rows);
}
?>
