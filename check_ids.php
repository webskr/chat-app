<?php
include 'backend/includes/db_connection.php';
$stmt = $pdo->prepare('SELECT id, username, avatar_id, avatar_url, is_official FROM users WHERE id IN (1, 9993)');
$stmt->execute();
echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC), JSON_PRETTY_PRINT);
