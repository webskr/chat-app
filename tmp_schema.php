<?php
include_once 'backend/includes/db_connection.php';

function dump_table($pdo, $table) {
    echo "\n--- Schema for $table ---\n";
    try {
        $stmt = $pdo->prepare("DESCRIBE $table");
        $stmt->execute();
        $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($columns as $col) {
            echo "{$col['Field']} - {$col['Type']} - {$col['Null']} - {$col['Key']} - {$col['Default']}\n";
        }
    } catch (Exception $e) {
        echo "Error: " . $e->getMessage() . "\n";
    }
}

dump_table($pdo, 'users');
dump_table($pdo, 'messages');
dump_table($pdo, 'muted_chats');
dump_table($pdo, 'relationships');
?>
