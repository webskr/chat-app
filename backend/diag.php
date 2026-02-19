<?php
// backend/diag.php
error_reporting(E_ALL);
ini_set('display_errors', 1);

include_once 'includes/db_connection.php';

echo "=== TABLES ===\n";
try {
    $stmt = $pdo->query("SHOW TABLES");
    $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
    print_r($tables);
} catch (Exception $e) {
    echo "Error showing tables: " . $e->getMessage() . "\n";
}

echo "\n=== SIMULATING get_conversations.php ===\n";
// Set GET param
$_GET['user_id'] = 1; // Assuming ID 1 for now, or we can fetch a real user
try {
    $stmt = $pdo->query("SELECT id FROM users LIMIT 1");
    if ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $_GET['user_id'] = $row['id'];
        echo "Using User ID: " . $row['id'] . "\n";
    }
} catch (Exception $e) { 
    echo "Error fetching user: " . $e->getMessage(); 
}

// Check for relationships table specifically
$hasRelationships = false;
if (in_array('relationships', $tables)) {
    $hasRelationships = true;
    echo "relationships table EXISTS.\n";
} else {
    echo "relationships table MISSING.\n";
}

// Run the query logic from get_conversations.php MANUALLY to catch exception
// I won't include the file because of header() calls. I'll paste the logic.

$user_id = $_GET['user_id'];
try {
    // 1-on-1 Query
    // Note: I am intentionally excluding the 'relationships' check if table is missing to verify if that's the cause
    
    // FULL QUERY FROM get_conversations.php
    $oneOnOneQuery = "SELECT c.id, 
                     c.user1_id, c.user2_id,
                     c.is_group, c.group_id,
                     (SELECT message_text FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC, m.id DESC LIMIT 1) as latest_msg_text,
                     (SELECT message_type FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC, m.id DESC LIMIT 1) as latest_msg_type,
                     (SELECT created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC, m.id DESC LIMIT 1) as latest_msg_time,
                     (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id 
                        AND m.receiver_id = :me_unread 
                        AND m.status != 'read'
                     ) as unread_count_raw,
                     u.id as other_user_id, u.username as other_username, u.avatar_id as other_avatar_id, u.avatar_url as other_avatar_url,
                     u.last_seen, u.privacy_last_seen, u.privacy_profile_visibility, u.is_official as other_is_official,
                     NULL as group_name, NULL as group_icon
              FROM conversations c
              JOIN users u ON (c.user1_id = u.id OR c.user2_id = u.id)
              WHERE (c.user1_id = :uid1 OR c.user2_id = :uid2) 
              AND ( (c.user1_id != c.user2_id AND u.id != :uid3) OR (c.user1_id = c.user2_id AND u.id = :uid4) )
              AND u.id NOT IN (SELECT target_id FROM relationships WHERE user_id = :uid5 AND status = 'blocked')
              AND (c.is_group = 0 OR c.is_group IS NULL)";

    // 2. Fetch Group Conversations
    $groupQuery = "SELECT c.id,
                    NULL as user1_id, NULL as user2_id,
                    c.is_group, c.group_id,
                    (SELECT message_text FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC, m.id DESC LIMIT 1) as latest_msg_text,
                    (SELECT message_type FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC, m.id DESC LIMIT 1) as latest_msg_type,
                    (SELECT created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC, m.id DESC LIMIT 1) as latest_msg_time,
                    
                    (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id 
                       AND m.sender_id != :me_group_unread
                       AND m.created_at > (SELECT joined_at FROM group_members gm2 WHERE gm2.group_id = c.group_id AND gm2.user_id = :me_group_member_check)
                    ) as unread_count_raw,
                    
                    0 as other_user_id, g.name as other_username, 0 as other_avatar_id, g.icon_path as other_avatar_url,
                    NULL as last_seen, 0 as privacy_last_seen, 'nobody' as privacy_profile_visibility, 0 as other_is_official,
                    g.name as group_name, g.icon_path as group_icon
             FROM conversations c
             JOIN group_members gm ON c.group_id = gm.group_id
             JOIN groups g ON c.group_id = g.id
             WHERE gm.user_id = :uid_group
             AND c.is_group = 1";

    $finalQuery = "($oneOnOneQuery) UNION ($groupQuery) ORDER BY COALESCE(latest_msg_time, '1970-01-01') DESC";
    
    echo "Preparing FULL Query...\n";
    $stmt = $pdo->prepare($finalQuery);
    
    $params = [
        ':me_unread' => $user_id,
        ':uid1' => $user_id, ':uid2' => $user_id, 
        ':uid3' => $user_id, ':uid4' => $user_id, 
        ':uid5' => $user_id,
        ':me_group_unread' => $user_id,
        ':me_group_member_check' => $user_id,
        ':uid_group' => $user_id
    ];

    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo "Rows found: " . count($rows) . "\n";
    print_r($rows);

} catch (PDOException $e) {
    echo "SQL ERROR: " . $e->getMessage() . "\n";
}

?>
