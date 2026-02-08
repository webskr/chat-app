<?php
include 'backend/includes/db_connection.php';
header('Content-Type: text/plain');

echo "--- DESCRIBE users ---\n";
$stmt = $pdo->query('DESCRIBE users');
while($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    echo json_encode($row) . "\n";
}
?>
