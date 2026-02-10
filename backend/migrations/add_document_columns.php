<?php
// backend/migrations/add_document_columns.php

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

include_once __DIR__ . '/../includes/db_connection.php';
global $pdo;

try {
    // 1. Add file_name column
    $sql = "SHOW COLUMNS FROM `messages` LIKE 'file_name'";
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    
    if ($stmt->rowCount() == 0) {
        $sql = "ALTER TABLE `messages` ADD COLUMN `file_name` VARCHAR(255) NULL AFTER `media_url`";
        $pdo->exec($sql);
        echo "Added column 'file_name'.\n";
    } else {
        echo "Column 'file_name' already exists.\n";
    }

    // 2. Add mime_type column
    $sql = "SHOW COLUMNS FROM `messages` LIKE 'mime_type'";
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    
    if ($stmt->rowCount() == 0) {
        $sql = "ALTER TABLE `messages` ADD COLUMN `mime_type` VARCHAR(100) NULL AFTER `file_name`";
        $pdo->exec($sql);
        echo "Added column 'mime_type'.\n";
    } else {
        echo "Column 'mime_type' already exists.\n";
    }

    echo "Migration completed successfully.";

} catch (PDOException $e) {
    echo "Error: " . $e->getMessage();
}
?>
