<?php
include_once __DIR__ . '/../includes/db_connection.php';

try {
    $check = $pdo->query("SHOW COLUMNS FROM users LIKE 'device_token'");
    if ($check->rowCount() == 0) {
        $sql = "ALTER TABLE users ADD COLUMN device_token VARCHAR(255) DEFAULT NULL";
        $pdo->exec($sql);
        echo "Column 'device_token' added successfully to 'users' table.\n";
    } else {
        echo "Column 'device_token' already exists in 'users' table.\n";
    }
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
