<?php
include_once 'includes/db_connection.php';

try {
    $sql = "ALTER TABLE groups 
            ADD COLUMN allow_member_edit_info TINYINT(1) DEFAULT 0,
            ADD COLUMN allow_member_send_messages TINYINT(1) DEFAULT 1,
            ADD COLUMN allow_member_add_members TINYINT(1) DEFAULT 1,
            ADD COLUMN admin_approve_new_members TINYINT(1) DEFAULT 0";
    
    $pdo->exec($sql);
    echo "Migration successful: Columns added.";
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage();
}
?>
