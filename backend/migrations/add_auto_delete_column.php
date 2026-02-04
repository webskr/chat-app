<?php
include_once '../includes/db_connection.php';

try {
    $sql = "SHOW COLUMNS FROM conversations LIKE 'auto_delete_minutes'";
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    
    if ($stmt->rowCount() == 0) {
        // Default 0 means "Off" (no auto-delete)
        $alter = "ALTER TABLE conversations ADD COLUMN auto_delete_minutes INT DEFAULT 0 AFTER last_message_time";
        $pdo->exec($alter);
        echo "Successfully added 'auto_delete_minutes' column.\n";
    } else {
        echo "'auto_delete_minutes' column already exists.\n";
    }

} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
