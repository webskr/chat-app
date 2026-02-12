<?php
include 'backend/includes/db_connection.php';
$tables = ['relationships', 'users'];
foreach ($tables as $table) {
    echo "--- $table ---\n";
    $stmt = $pdo->query("DESCRIBE $table");
    $data = $stmt->fetchAll(PDO::FETCH_ASSOC);
    print_r($data);
}
?>
