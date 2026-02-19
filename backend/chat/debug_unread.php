<?php
// debug_unread.php
header("Content-Type: text/plain");
include_once '../includes/db_connection.php';

$user_id = isset($_GET['user_id']) ? $_GET['user_id'] : 23; // Default to user 23 if not provided

echo "Checking unread counts for User ID: $user_id\n\n";

// Check 1-on-1 unread
$sql1 = "SELECT c.id, 
         (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id 
            AND m.receiver_id = :uid 
            AND m.status != 'read'
         ) as unread_count
         FROM conversations c
         WHERE (c.user1_id = :uid OR c.user2_id = :uid)
         AND (c.is_group = 0 OR c.is_group IS NULL)";

$stmt1 = $pdo->prepare($sql1);
$stmt1->execute([':uid' => $user_id]);
$res1 = $stmt1->fetchAll(PDO::FETCH_ASSOC);

echo "--- 1-on-1 Chats ---\n";
foreach($res1 as $row) {
    echo "Conv ID {$row['id']}: {$row['unread_count']} unread\n";
}

// Check Group unread
$sql2 = "SELECT c.id, c.group_id,
         (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id 
            AND m.sender_id != :uid
            AND m.created_at > (SELECT joined_at FROM group_members gm2 WHERE gm2.group_id = c.group_id AND gm2.user_id = :uid)
         ) as total_msgs_since_join,
         (SELECT COUNT(*) FROM group_message_views gmv WHERE gmv.group_id = c.group_id AND gmv.user_id = :uid) as viewed_count
         FROM conversations c
         JOIN group_members gm ON c.group_id = gm.group_id
         WHERE gm.user_id = :uid
         AND c.is_group = 1";

// Note: The logic in get_conversations.php for group unread is simpler:
// COUNT(*) WHERE sender != me AND created_at > joined_at
// AND... wait, get_conversations.php DOES NOT check for 'read' status in groups?
// Let's re-read get_conversations.php logic for groups.

// get_conversations.php logic:
// (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id 
//    AND m.sender_id != :me_group_unread
//    AND m.created_at > (SELECT joined_at FROM group_members gm2 WHERE gm2.group_id = c.group_id AND gm2.user_id = :me_group_member_check)
// ) as unread_count_raw

// It seems get_conversations.php counts ALL messages since join as unread?
// It does NOT appear to subtract viewed messages or check a 'read' status for the user in the group context?
// Groups usually don't have per-user 'read' status on the message row itself (it's 1-to-many).
// Usually there's a `last_read_at` timestamp for the user in the group.
// IF `last_read_at` is missing, then `unread_count` might be high.

$stmt2 = $pdo->prepare($sql2);
$stmt2->execute([':uid' => $user_id]);
$res2 = $stmt2->fetchAll(PDO::FETCH_ASSOC);

echo "\n--- Group Chats ---\n";
foreach($res2 as $row) {
    echo "Group Conv ID {$row['id']} (Group {$row['group_id']}): Raw Count {$row['total_msgs_since_join']} (Viewed: {$row['viewed_count']})\n";
}
