<?php
include_once '../includes/db_connection.php';

try {
    $sql = "SHOW COLUMNS FROM users LIKE 'global_auto_delete_minutes'";
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    
    if ($stmt->rowCount() == 0) {
        $alter = "ALTER TABLE users ADD COLUMN global_auto_delete_minutes INT DEFAULT 0 AFTER bio";
        $pdo->exec($alter);
        echo "Successfully added 'global_auto_delete_minutes' column to users table.\n";
    } else {
        echo "'global_auto_delete_minutes' column already exists in users table.\n";
    }

} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
