<?php
include_once '../includes/db_connection.php';
$stmt = $pdo->query("SELECT COUNT(*) FROM users");
echo "Total Users: " . $stmt->fetchColumn();
?>
