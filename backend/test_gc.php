<?php
include_once 'includes/db_connection.php';

$user_id = 9; // Assuming user ID 9 based on previous logs or just a guess. Let's try 9 or 10. 
// Or better, let's fetch a valid user ID first.
$stmt = $pdo->query("SELECT id FROM users LIMIT 1");
$u = $stmt->fetch(PDO::FETCH_ASSOC);
if ($u) {
    $user_id = $u['id'];
    echo "Testing with User ID: " . $user_id . "\n";
} else {
    die("No users found.");
}

// Simulate get_conversations.php exactly
error_reporting(E_ALL);
ini_set('display_errors', 1);

$user_id = 9; // Default fallback
$stmt = $pdo->query("SELECT id FROM users LIMIT 1");
$u = $stmt->fetch(PDO::FETCH_ASSOC);
if ($u) $user_id = $u['id'];

// 1. Fetch 1-on-1 Conversations
$oneOnOneQuery = "SELECT c.id, 
                 c.user1_id, c.user2_id,
                 c.is_group, c.group_id,
                 (SELECT message_text FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC, m.id DESC LIMIT 1) as latest_msg_text,
                 (SELECT message_type FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC, m.id DESC LIMIT 1) as latest_msg_type,
                 (SELECT created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC, m.id DESC LIMIT 1) as latest_msg_time,
                 0 as unread_count_raw,
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
                0 as unread_count_raw,
                0 as other_user_id, g.name as other_username, 0 as other_avatar_id, g.icon_path as other_avatar_url,
                NULL as last_seen, 0 as privacy_last_seen, 'nobody' as privacy_profile_visibility, 0 as other_is_official,
                g.name as group_name, g.icon_path as group_icon
         FROM conversations c
         JOIN group_members gm ON c.group_id = gm.group_id
         JOIN groups g ON c.group_id = g.id
         WHERE gm.user_id = :uid_group
         AND c.is_group = 1";

$finalQuery = "($oneOnOneQuery) UNION ($groupQuery) ORDER BY COALESCE(latest_msg_time, '1970-01-01') DESC";

try {
    $stmt = $pdo->prepare($finalQuery);
    $stmt->execute([
        ':uid1' => $user_id, ':uid2' => $user_id, 
        ':uid3' => $user_id, ':uid4' => $user_id, 
        ':uid5' => $user_id,
        ':uid_group' => $user_id
    ]);
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($results);
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage();
}
?>
