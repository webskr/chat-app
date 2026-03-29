<?php
// otv_cleanup.php
// Deletes One-Time View messages that have been seen more than 5 minutes ago
// IF the sender has enabled auto-delete for OTV messages.

// Include DB connection if not already included
if (!isset($pdo)) {
    include_once '../includes/db_connection.php';
}

try {
    global $pdo;
    // Logic:
    // 1. Find messages that are:
    //    - is_one_time = 1
    //    - status = 'seen'
    //    - seen_at < (NOW() - 5 minutes)
    //    - is_deleted = 0
    //    - Sender has auto_delete_otv = 1
    
    // We update them to:
    //    - is_deleted = 1
    //    - message_text = 'Message Deleted'
    //    - media_url = NULL (remove reference to file)
    
    // Note: In a real production app, we should also unlink() the file from storage.
    // For now, we will just nullify the reference in DB.
    
    $cleanupQuery = "
        UPDATE messages m
        JOIN users u ON m.sender_id = u.id
        SET 
            m.is_deleted = 1,
            m.message_text = 'This message was viewed and deleted',
            m.media_url = NULL,
            m.thumbnail_url = NULL
        WHERE 
            m.is_one_time = 1 
            AND m.status = 'seen' 
            AND m.seen_at < (NOW() - INTERVAL 5 MINUTE) 
            AND m.is_deleted = 0 
            AND u.auto_delete_otv = 1
    ";
    
    $stmt = $pdo->prepare($cleanupQuery);
    $stmt->execute();
    
    // Optional: Log how many rows were affected if running manually
    // echo "Deleted " . $stmt->rowCount() . " OTV messages.";
    
} catch (PDOException $e) {
    // Log error silently or handle as needed
    error_log("OTV Cleanup Error: " . $e->getMessage());
}
?>
