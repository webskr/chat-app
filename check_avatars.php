<?php
include 'backend/includes/db_connection.php';
$stmt = $pdo->query('SELECT id, username, avatar_id, avatar_url, is_official FROM users');
echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
