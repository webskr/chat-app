<?php
include_once 'backend/includes/db_connection.php';
$stmt = $pdo->prepare("SELECT id, username, is_online, last_active FROM users WHERE id = 5");
$stmt->execute();
$user = $stmt->fetch(PDO::FETCH_ASSOC);
echo json_encode($user);
?>
