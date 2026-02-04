<?php
header("Content-Type: text/plain");
include_once '../includes/db_connection.php';

echo "Checking self-chats for all users...\n";

$stmt = $pdo->query("SELECT id, username FROM users");
$users = $stmt->fetchAll(PDO::FETCH_ASSOC);

foreach ($users as $u) {
    $uid = $u['id'];
    $uName = $u['username'];
    
    $stmt2 = $pdo->prepare("SELECT * FROM conversations WHERE user1_id = ? AND user2_id = ?");
    $stmt2->execute([$uid, $uid]);
    $chat = $stmt2->fetch(PDO::FETCH_ASSOC);
    
    if ($chat) {
        echo "[$uid] $uName: FOUND (ID " . $chat['id'] . ")\n";
    } else {
        echo "[$uid] $uName: MISSING\n";
    }
}
?>
