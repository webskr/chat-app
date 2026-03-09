<?php
include_once 'backend/includes/db_connection.php';

function inspectTable($pdo, $tableName) {
    echo "--- $tableName ---\n";
    try {
        $stmt = $pdo->query("DESCRIBE $tableName");
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            echo str_pad($row['Field'], 30) . " " . str_pad($row['Type'], 30) . " " . ($row['Null'] == 'YES' ? 'NULL' : 'NOT NULL') . "\n";
        }
    } catch (Exception $e) {
        echo "Error: " . $e->getMessage() . "\n";
    }
    echo "\n";
}

inspectTable($pdo, 'groups');
inspectTable($pdo, 'group_members');
inspectTable($pdo, 'conversations');
?>
