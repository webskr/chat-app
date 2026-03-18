<?php
include 'backend/includes/db_connection.php';
$stmt = $pdo->query('SELECT id, username, avatar_id, avatar_url, is_official FROM users');
$users = $stmt->fetchAll(PDO::FETCH_ASSOC);
echo "Total Users: " . count($users) . "\n";
echo json_encode($users, JSON_PRETTY_PRINT);
