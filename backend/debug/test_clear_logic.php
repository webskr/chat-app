<?php
// Test clear_msgs.php via local request simulation or just include it with mock data
$_SERVER['REQUEST_METHOD'] = 'POST';
$mock_data = json_encode(['user_id' => 1, 'target_id' => 2]);
// We can't easily use php://input in a script, so we will modify clear_msgs.php temporarily to debug or use a different way.

// Actually, let's just make a script that checks the logic of clear_msgs.php
include_once '../includes/db_connection.php';

$user_id = 1;
$target_id = 4; // Change to a valid combination from your DB

echo "Testing clear for user $user_id with target $target_id\n";

$find_query = "SELECT id, user1_id, user2_id FROM conversations 
               WHERE (user1_id = :u1 AND user2_id = :u2) 
                  OR (user1_id = :u2 AND user2_id = :u1) LIMIT 1";
$stmt = $pdo->prepare($find_query);
$stmt->execute([':u1' => $user_id, ':u2' => $target_id]);
$conversation = $stmt->fetch(PDO::FETCH_ASSOC);

if ($conversation) {
    echo "Found conversation ID: " . $conversation['id'] . "\n";
    echo "User1: " . $conversation['user1_id'] . " | User2: " . $conversation['user2_id'] . "\n";
    
    $u1 = $conversation['user1_id'];
    $u2 = $conversation['user2_id'];

    if ($u1 == $user_id) {
        echo "User is user1. Updating user1_cleared_at\n";
    } elseif ($u2 == $user_id) {
        echo "User is user2. Updating user2_cleared_at\n";
    } else {
        echo "ERROR: User $user_id not found in participant list!\n";
    }
} else {
    echo "No conversation found.\n";
}
?>
