<?php
include_once '../includes/db_connection.php';

try {
    // Add thumbnail_url column
    $sql = "SHOW COLUMNS FROM `messages` LIKE 'thumbnail_url'";
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    if ($stmt->rowCount() == 0) {
        $sql = "ALTER TABLE `messages` ADD COLUMN `thumbnail_url` VARCHAR(255) DEFAULT NULL AFTER `media_url`";
        $pdo->exec($sql);
        echo "Added column 'thumbnail_url'.\n";
    } else {
        echo "Column 'thumbnail_url' already exists.\n";
    }

    // Add file_size column
    $sql = "SHOW COLUMNS FROM `messages` LIKE 'file_size'";
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    if ($stmt->rowCount() == 0) {
        $sql = "ALTER TABLE `messages` ADD COLUMN `file_size` INT DEFAULT 0 AFTER `duration`";
        $pdo->exec($sql);
        echo "Added column 'file_size'.\n";
    } else {
        echo "Column 'file_size' already exists.\n";
    }

    echo "Migration completed successfully.";

} catch (PDOException $e) {
    echo "Migration failed: " . $e->getMessage();
}
?>
