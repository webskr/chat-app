<?php
include 'backend/includes/db_connection.php';

$queries = [
    "CREATE TABLE IF NOT EXISTS invites (
        id INT AUTO_INCREMENT PRIMARY KEY,
        inviter_user_id INT NOT NULL,
        invite_code VARCHAR(50) UNIQUE NOT NULL,
        type ENUM('permanent', 'limited') DEFAULT 'permanent',
        max_uses INT NULL,
        used_count INT DEFAULT 0,
        expires_at DATETIME NULL,
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (inviter_user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;",
    
    "CREATE TABLE IF NOT EXISTS invite_uses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        invite_id INT NOT NULL,
        invited_user_id INT NOT NULL,
        used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (invite_id) REFERENCES invites(id) ON DELETE CASCADE,
        FOREIGN KEY (invited_user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;"
];

foreach ($queries as $query) {
    try {
        $pdo->exec($query);
        echo "Success: " . substr($query, 0, 50) . "...\n";
    } catch (PDOException $e) {
        echo "Error: " . $e->getMessage() . "\n";
    }
}
?>
