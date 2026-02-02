<?php
include_once '../includes/db_connection.php';
$stmt = $pdo->query("DESCRIBE messages");
while($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    echo $row['Field'] . "\n";
}
?>
