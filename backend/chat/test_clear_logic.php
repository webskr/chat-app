<?php
include '../includes/db_connection.php';

// 1. Setup Dummy Data
$u1 = 9991;
$u2 = 9992;
$pdo->exec("DELETE FROM users WHERE id IN ($u1, $u2)");
$pdo->exec("INSERT INTO users (id, username, email, password) VALUES ($u1, 'test1', 't1@t.com', 'pass'), ($u2, 'test2', 't2@t.com', 'pass')");

// Create Conversation
$pdo->exec("DELETE FROM conversations WHERE (user1_id=$u1 AND user2_id=$u2) OR (user1_id=$u2 AND user2_id=$u1)");
$pdo->prepare("INSERT INTO conversations (user1_id, user2_id, last_message) VALUES (?, ?, 'initial msg')")->execute([$u1, $u2]);
$cid = $pdo->lastInsertId();

// Create Message
$pdo->prepare("INSERT INTO messages (conversation_id, sender_id, receiver_id, message_text) VALUES (?, ?, ?, 'test msg')")->execute([$cid, $u1, $u2]);

echo "Created Conv ID: $cid with 1 message.\n";

// 2. Call Clear API
$url = 'http://localhost/chat-app/backend/chat/clear_msgs.php';
$data = ['user_id' => $u1, 'target_id' => $u2];

$options = [
    'http' => [
        'header'  => "Content-type: application/json\r\n",
        'method'  => 'POST',
        'content' => json_encode($data),
    ],
];
$context  = stream_context_create($options);
$result = file_get_contents($url, false, $context);
echo "API Response: $result\n";

// 3. Verify DB State
$stmt = $pdo->prepare("SELECT * FROM conversations WHERE id = ?");
$stmt->execute([$cid]);
$conv = $stmt->fetch();

$msgCount = $pdo->query("SELECT COUNT(*) FROM messages WHERE conversation_id = $cid")->fetchColumn();

echo "Messages Count: $msgCount (Expected 0)\n";
echo "Last Message: " . var_export($conv['last_message'], true) . " (Expected NULL)\n";
echo "Last Message Time: " . var_export($conv['last_message_time'], true) . " (Expected NULL)\n";

// Cleanup
$pdo->exec("DELETE FROM users WHERE id IN ($u1, $u2)");
$pdo->exec("DELETE FROM conversations WHERE id = $cid");
?>
