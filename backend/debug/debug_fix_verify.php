<?php
include_once '../includes/db_connection.php';

$user_id = 1; 
$target_id = 1; // Testing Self Chat first, then try 2

echo "--- Debugging Conversation State (User $user_id -> $target_id) ---\n";
// 1. Get Conversation
$stmt = $pdo->prepare("SELECT * FROM conversations WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)");
$stmt->execute([$user_id, $target_id, $target_id, $user_id]);
$conv = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$conv) {
    die("No conversation found.\n");
}
echo "Conversation ID: " . $conv['id'] . "\n";
echo "User1: " . $conv['user1_id'] . " | User2: " . $conv['user2_id'] . "\n";

// 2. Count Total
$stmt = $pdo->prepare("SELECT COUNT(*) FROM messages WHERE conversation_id = ?");
$stmt->execute([$conv['id']]);
$total = $stmt->fetchColumn();
echo "Total Messages: $total\n";

// 3. Check Filtering Logic (Simulating get_messages.php)
$sender_id = $user_id;

// Logic copied from get_messages.php ...
$sql = "SELECT count(*) FROM messages m
        JOIN conversations c ON m.conversation_id = c.id
        WHERE (
            (c.user1_id = :u1 AND c.user2_id = :u2) OR 
            (c.user1_id = :u2 AND c.user2_id = :u1)
        )
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

// Note: params used in get_messages were u1/u2 min/max, but here we just need to match the WHERE clause
// The WHERE clause accepts either order now.
$u1 = $conv['user1_id'];
$u2 = $conv['user2_id'];

$stmt = $pdo->prepare($sql);
$stmt->execute([':u1' => $u1, ':u2' => $u2, ':me' => $sender_id]);
$visible = $stmt->fetchColumn();

echo "Visible Messages: $visible\n";

// 4. Force Update to NOW()
echo "Clearing chat...\n";
if ($conv['user1_id'] == $conv['user2_id']) {
    $upd = "UPDATE conversations SET user1_cleared_at = NOW(), user2_cleared_at = NOW() WHERE id = ?";
} elseif ($conv['user1_id'] == $user_id) {
    $upd = "UPDATE conversations SET user1_cleared_at = NOW() WHERE id = ?";
} else {
    $upd = "UPDATE conversations SET user2_cleared_at = NOW() WHERE id = ?";
}
$pdo->prepare($upd)->execute([$conv['id']]);

// 5. Check Visible Again
$stmt = $pdo->prepare($sql);
$stmt->execute([':u1' => $u1, ':u2' => $u2, ':me' => $sender_id]);
$visible_after = $stmt->fetchColumn();
echo "Visible After Clear: $visible_after\n";

if ($visible_after == 0) echo "SUCCESS\n";
else echo "FAILURE (Count: $visible_after)\n";
?>
