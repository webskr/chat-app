<?php
include_once '../includes/db_connection.php';

try {
    $pdo->exec("ALTER TABLE users ADD COLUMN auto_delete_otv TINYINT(1) DEFAULT 0");
    echo "Column 'auto_delete_otv' added successfully.";
} catch (PDOException $e) {
    if (strpos($e->getMessage(), "Duplicate column") !== false) {
        echo "Column 'auto_delete_otv' already exists.";
    } else {
        echo "Error: " . $e->getMessage();
    }
}
?>
