<?php
include_once __DIR__ . '/../includes/db_connection.php';

try {
    // 1. Create groups table
    $sql_groups = "CREATE TABLE IF NOT EXISTS groups (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        icon_path VARCHAR(255),
        created_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    )";
    $pdo->exec($sql_groups);
    echo "Groups table checked/created.\n";

    // 2. Create group_members table
    $sql_members = "CREATE TABLE IF NOT EXISTS group_members (
        id INT AUTO_INCREMENT PRIMARY KEY,
        group_id INT NOT NULL,
        user_id INT NOT NULL,
        role ENUM('owner', 'admin', 'member') DEFAULT 'member',
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status ENUM('active', 'left', 'removed') DEFAULT 'active',
        UNIQUE KEY unique_member (group_id, user_id),
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )";
    $pdo->exec($sql_members);
    echo "Group_members table checked/created.\n";

    // 3. Modify conversations table
    // Add is_group column
    try {
        $pdo->exec("ALTER TABLE conversations ADD COLUMN is_group BOOLEAN DEFAULT 0");
        echo "Added is_group column to conversations.\n";
    } catch (PDOException $e) {
        // Column likely exists
        echo "Column is_group likely exists in conversations.\n";
    }

    // Add group_id column
    try {
        $pdo->exec("ALTER TABLE conversations ADD COLUMN group_id INT DEFAULT NULL");
        $pdo->exec("ALTER TABLE conversations ADD CONSTRAINT fk_conversations_group FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE");
        echo "Added group_id column to conversations.\n";
    } catch (PDOException $e) {
        echo "Column group_id likely exists in conversations.\n";
    }

    // Make user1_id and user2_id nullable
    try {
        $pdo->exec("ALTER TABLE conversations MODIFY COLUMN user1_id INT NULL");
        $pdo->exec("ALTER TABLE conversations MODIFY COLUMN user2_id INT NULL");
        echo "Made user1_id and user2_id nullable in conversations.\n";
    } catch (PDOException $e) {
        echo "Failed to modify user_id columns in conversations: " . $e->getMessage() . "\n";
    }

    // 4. Modify messages table
    // Make receiver_id nullable
    try {
        $pdo->exec("ALTER TABLE messages MODIFY COLUMN receiver_id INT NULL");
        echo "Made receiver_id nullable in messages.\n";
    } catch (PDOException $e) {
        echo "Failed to modify receiver_id in messages: " . $e->getMessage() . "\n";
    }

    echo "Migration completed successfully.\n";

} catch (PDOException $e) {
    echo "Global Migration Error: " . $e->getMessage() . "\n";
}
?>
