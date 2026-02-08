<?php
include 'backend/includes/db_connection.php';
$stmt = $pdo->query('DESCRIBE messages');
while($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    echo json_encode($row) . PHP_EOL;
}
?>
