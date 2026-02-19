<?php
include_once 'backend/includes/db_connection.php';

echo "--- group_members ---\n";
$stmt = $pdo->query("DESCRIBE group_members");
while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    echo $row['Field'] . " " . $row['Type'] . "\n";
}

echo "\n--- messages ---\n";
$stmt = $pdo->query("DESCRIBE messages");
while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    echo $row['Field'] . " " . $row['Type'] . "\n";
}
?>
