<?php
include 'backend/includes/db_connection.php';
$stmt = $pdo->query('SELECT id, username, is_official FROM users WHERE is_official = 1');
echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
