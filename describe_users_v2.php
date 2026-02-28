<?php
include_once 'backend/includes/db_connection.php';

echo "\n--- users ---\n";
$stmt = $pdo->query("DESCRIBE users");
while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    echo $row['Field'] . " " . $row['Type'] . "\n";
}
?>
