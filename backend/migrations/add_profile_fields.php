<?php
include_once '../includes/db_connection.php';

try {
    // Add display_name column
    $sql = "SHOW COLUMNS FROM users LIKE 'display_name'";
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    
    if ($stmt->rowCount() == 0) {
        $alter = "ALTER TABLE users ADD COLUMN display_name VARCHAR(50) DEFAULT NULL AFTER username";
        $pdo->exec($alter);
        echo "Successfully added 'display_name' column.\n";
    } else {
        echo "'display_name' column already exists.\n";
    }

    // Add username_last_updated column
    $sql = "SHOW COLUMNS FROM users LIKE 'username_last_updated'";
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    
    if ($stmt->rowCount() == 0) {
        $alter = "ALTER TABLE users ADD COLUMN username_last_updated TIMESTAMP NULL DEFAULT NULL AFTER display_name";
        $pdo->exec($alter);
        echo "Successfully added 'username_last_updated' column.\n";
    } else {
        echo "'username_last_updated' column already exists.\n";
    }

} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
