<?php
include_once '../includes/db_connection.php';

$sql = file_get_contents('create_muted_chats_table.sql');

try {
    $pdo->exec($sql);
    echo "Migration successful: muted_chats table created/verified.\n";
} catch (PDOException $e) {
    echo "Migration failed: " . $e->getMessage() . "\n";
}
?>
