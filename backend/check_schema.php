<?php
include_once 'includes/db_connection.php';
$stmt = $pdo->prepare("DESCRIBE messages");
$stmt->execute();
$columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
print_r($columns);
?>
