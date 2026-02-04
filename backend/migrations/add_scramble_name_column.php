<?php
include_once '../includes/db_connection.php';

try {
    $sql = "SHOW COLUMNS FROM users LIKE 'scramble_name'";
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    
    if ($stmt->rowCount() == 0) {
        $alter = "ALTER TABLE users ADD COLUMN scramble_name TINYINT(1) DEFAULT 0 AFTER display_name";
        $pdo->exec($alter);
        echo "Successfully added 'scramble_name' column to users table.\n";
    } else {
        echo "'scramble_name' column already exists in users table.\n";
    }

} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
