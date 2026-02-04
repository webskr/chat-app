<?php
include_once '../includes/db_connection.php';

try {
    $sql = "SHOW COLUMNS FROM messages LIKE 'image_path'";
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    
    if ($stmt->rowCount() == 0) {
        $alter = "ALTER TABLE messages ADD COLUMN image_path VARCHAR(255) DEFAULT NULL AFTER message_text";
        $pdo->exec($alter);
        echo "Successfully added 'image_path' column to messages table.\n";
    } else {
        echo "'image_path' column already exists in messages table.\n";
    }

} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
