<?php
include_once '../includes/db_connection.php';

try {
    // Add website column if it doesn't exist
    $sql = "SHOW COLUMNS FROM users LIKE 'website'";
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    if ($stmt->rowCount() == 0) {
        $pdo->exec("ALTER TABLE users ADD COLUMN website VARCHAR(255) DEFAULT NULL");
        echo "Added 'website' column.<br>";
    } else {
        echo "'website' column already exists.<br>";
    }

    // Add website_label column if it doesn't exist
    $sql = "SHOW COLUMNS FROM users LIKE 'website_label'";
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    if ($stmt->rowCount() == 0) {
        $pdo->exec("ALTER TABLE users ADD COLUMN website_label VARCHAR(50) DEFAULT NULL");
        echo "Added 'website_label' column.<br>";
    } else {
        echo "'website_label' column already exists.<br>";
    }

    echo "Migration completed successfully.";

} catch (PDOException $e) {
    echo "Error: " . $e->getMessage();
}
?>
