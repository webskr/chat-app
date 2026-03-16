<?php
include_once 'backend/includes/db_connection.php';
$stmt = $pdo->prepare("DESCRIBE messages");
$stmt->execute();
$columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
echo "Field | Type | Null | Key | Default | Extra\n";
foreach ($columns as $col) {
    echo "{$col['Field']} | {$col['Type']} | {$col['Null']} | {$col['Key']} | {$col['Default']} | {$col['Extra']}\n";
}
?>
