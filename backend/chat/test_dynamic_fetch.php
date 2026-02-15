<?php
include '../includes/db_connection.php';

// Setup
$u1 = 9991; $u2 = 9992;
$pdo->exec("DELETE FROM users WHERE id IN ($u1, $u2)");
$pdo->exec("INSERT INTO users (id, username, email, password) VALUES ($u1, 'test1', 't1', 'p'), ($u2, 'test2', 't2', 'p')");
$pdo->exec("DELETE FROM conversations WHERE (user1_id=$u1 AND user2_id=$u2) OR (user1_id=$u2 AND user2_id=$u1)");
$pdo->prepare("INSERT INTO conversations (user1_id, user2_id) VALUES (?, ?)")->execute([$u1, $u2]);
$cid = $pdo->lastInsertId();

function getLastMsg($user_id) {
    global $pdo;
    $_GET['user_id'] = $user_id;
    ob_start();
    include 'get_conversations.php';
    $json = ob_get_clean();
    $data = json_decode($json, true);
    return $data[0]['last_message'] ?? 'NULL';
}

// 1. Send Msg A
$pdo->prepare("INSERT INTO messages (conversation_id, sender_id, receiver_id, message_text, created_at) VALUES (?, ?, ?, 'Msg A', NOW() - INTERVAL 10 SECOND)")->execute([$cid, $u1, $u2]);
$idA = $pdo->lastInsertId();

// 2. Send Msg B
$pdo->prepare("INSERT INTO messages (conversation_id, sender_id, receiver_id, message_text, created_at) VALUES (?, ?, ?, 'Msg B', NOW())")->execute([$cid, $u1, $u2]);
$idB = $pdo->lastInsertId();

echo "Initial: " . getLastMsg($u1) . " (Expected: Msg B)\n";

// 3. Delete Msg B for U1
$pdo->exec("UPDATE messages SET hidden_for_sender = 1 WHERE id = $idB");
echo "After Delete B: " . getLastMsg($u1) . " (Expected: Msg A)\n";

// 4. Delete Msg A for U1
$pdo->exec("UPDATE messages SET hidden_for_sender = 1 WHERE id = $idA");
echo "After Delete A: " . getLastMsg($u1) . " (Expected: NULL)\n";

// Cleanup
$pdo->exec("DELETE FROM users WHERE id IN ($u1, $u2)");
$pdo->exec("DELETE FROM conversations WHERE id = $cid");
$pdo->exec("DELETE FROM messages WHERE conversation_id = $cid");
?>
