<?php
include_once '../includes/db_connection.php';

try {
    $sql = "SHOW COLUMNS FROM users LIKE 'bio'";
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    
    if ($stmt->rowCount() == 0) {
        $alter = "ALTER TABLE users ADD COLUMN bio VARCHAR(120) DEFAULT NULL AFTER avatar_id";
        $pdo->exec($alter);
        echo "Successfully added 'bio' column to users table.\n";
    } else {
        echo "'bio' column already exists.\n";
    }

} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
