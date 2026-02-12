<?php
include 'backend/includes/db_connection.php';
try {
    $pdo->exec("ALTER TABLE messages ADD COLUMN reply_to_message_id INT NULL AFTER conversation_id");
    echo "Successfully added reply_to_message_id column to messages table.\n";
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
