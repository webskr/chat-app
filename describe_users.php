<?php
include_once 'backend/db_connection.php';
$stmt = $pdo->query('DESCRIBE users');
print_r($stmt->fetchAll());
?>
