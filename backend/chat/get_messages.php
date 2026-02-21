<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

include_once '../includes/db_connection.php';
include_once 'otv_cleanup.php';
include_once 'scheduled_message_service.php';

// Lazy Execution: Process scheduled messages whenever someone fetches messages
// This ensures messages are sent even if the CRON job is delayed or not set up
processScheduledMessages($pdo);

$me       = isset($_GET['sender_id']) ? (int)$_GET['sender_id'] : null;
$other_id = isset($_GET['receiver_id']) ? (int)$_GET['receiver_id'] : null;
$group_id = isset($_GET['group_id']) ? (int)$_GET['group_id'] : null;

if (!$me || (!$other_id && !$group_id)) {
    http_response_code(400);
    echo json_encode(["message" => "Incomplete parameters"]);
    exit;
}

try {
    $conv = null;

    if ($group_id) {
        // --- GROUP LOGIC ---
        // Verify membership? Optional for speed, but good for security.
        $fs = $pdo->prepare("SELECT status FROM group_members WHERE group_id = :gid AND user_id = :uid");
        $fs->execute([':gid' => $group_id, ':uid' => $me]);
        $status = $fs->fetchColumn();
        
        if (!$status || $status !== 'active') {
             http_response_code(403); echo json_encode(["message" => "Not a member"]); exit;
        }

        $convStmt = $pdo->prepare("SELECT id, is_group, group_id FROM conversations WHERE group_id = :gid LIMIT 1");
        $convStmt->execute([':gid' => $group_id]);
        $conv = $convStmt->fetch(PDO::FETCH_ASSOC);

        // Group messages don't have 'cleared_at' per user in conversation table usually (unless we add valid_from in group_members)
        // For now, assume history is visible to all active members or based on `joined_at`.
        // Let's use `joined_at` from group_members if we want to restrict history?
        // User didn't ask for that. Simple fetch for now.
        $clearedAt = null; // Show all history
        
    } else {
        // --- 1-ON-1 LOGIC ---
        $convStmt = $pdo->prepare("
            SELECT id, user1_id, user2_id, user1_cleared_at, user2_cleared_at, auto_delete_minutes
            FROM conversations
            WHERE (user1_id = :me AND user2_id = :other)
               OR (user1_id = :other AND user2_id = :me)
            LIMIT 1
        ");
        $convStmt->execute([':me' => $me, ':other'=> $other_id]);
        $conv = $convStmt->fetch(PDO::FETCH_ASSOC);
        
        if ($conv) {
             if ($conv['user1_id'] == $me) {
                $clearedAt = !empty($conv['user1_cleared_at']) ? $conv['user1_cleared_at'] : null;
            } else {
                $clearedAt = !empty($conv['user2_cleared_at']) ? $conv['user2_cleared_at'] : null;
            }
        }
    }

    if (!$conv) {
        echo json_encode([]);
        exit;
    }

    // 1.5️⃣ Auto-Delete Cleanup (Strictly for 1-on-1, non-self, non-official)
    if (!empty($conv['auto_delete_minutes']) && $conv['auto_delete_minutes'] > 0) {
        // Condition 1: Must NOT be a group (redundant if $conv fetch logic is correct, but safe)
        // Condition 2: Must NOT be self-chat
        // Condition 3: Must NOT be official account
        
        $canAutoDelete = true;
        
        if ($group_id) {
            $canAutoDelete = false;
        }
        
        if ($me == $other_id) {
             $canAutoDelete = false;
        }

        // Check verification status of OTHER user
        if ($canAutoDelete && $other_id) {
            $verifyStmt = $pdo->prepare("SELECT is_verified, is_official FROM users WHERE id = :uid");
            $verifyStmt->execute([':uid' => $other_id]);
            $targetUser = $verifyStmt->fetch(PDO::FETCH_ASSOC);
            if ($targetUser && ($targetUser['is_official'] == 1)) {
                $canAutoDelete = false;
            }
        }

        if ($canAutoDelete) {
            $minutes = (int)$conv['auto_delete_minutes'];
            $deleteSql = "DELETE FROM messages 
                          WHERE conversation_id = :cid 
                          AND created_at < (NOW() - INTERVAL :min MINUTE)";
            $delStmt = $pdo->prepare($deleteSql);
            $delStmt->execute([':cid' => $conv['id'], ':min' => $minutes]);
        }
    }

    // 3️⃣ Fetch Messages
    // Mark delivered only for 1-on-1? Or groups too?
    // For groups, we insert into message_status table usually (complex).
    // Simple 'delivered' for groups is hard because multiple receivers.
    // We skip marking delivered for groups in this simple endpoint for now, or update `messages` table but that implies EVERYONE received it.
    // Let's keep existing logic safe:
    if (!$group_id) {
        $deliverySql = "UPDATE messages 
                        SET status = 'delivered', 
                            delivered_at = NOW() 
                        WHERE conversation_id = :cid 
                        AND receiver_id = :me 
                        AND status = 'sent'";
        $deliveryStmt = $pdo->prepare($deliverySql);
        $deliveryStmt->execute([':cid' => $conv['id'], ':me' => $me]);
    }

    // 3.5️⃣ Fetch Group Member Logic (for cleared_at)
    $groupClearedAt = null;
    if ($group_id) {
        $gmStmt = $pdo->prepare("SELECT cleared_at FROM group_members WHERE group_id = :gid AND user_id = :uid");
        $gmStmt->execute([':gid' => $group_id, ':uid' => $me]);
        $groupClearedAt = $gmStmt->fetchColumn();
    }

    $msgSql = "
        SELECT 
            m.id, 
            m.sender_id, 
            m.receiver_id, 
            m.message_text, 
            m.media_url,
            m.thumbnail_url,
            m.file_size,
            m.duration,
            m.message_type,
            m.file_name,
            m.mime_type,
            m.status, 
            m.is_deleted,
            m.is_one_time,
            m.created_at,
            m.sent_at,
            m.delivered_at,
            m.read_at,
            m.is_edited,
            m.edited_at,
            m.reply_to_message_id,
            m.is_forwarded,
            rm.sender_id AS reply_sender_id,
            ru.username AS reply_username,
            rm.message_text AS reply_text,
            rm.media_url AS reply_media_url,
            rm.message_type AS reply_type,
            u.username AS sender_name,
            u.avatar_id AS sender_avatar_id,
            u.avatar_url AS sender_avatar_url,
            COALESCE(ur.privacy_read_receipts, 1) AS receiver_read_receipts
        FROM messages m
        JOIN users u ON u.id = m.sender_id
        LEFT JOIN users ur ON ur.id = m.receiver_id
        LEFT JOIN messages rm ON rm.id = m.reply_to_message_id
        LEFT JOIN users ru ON ru.id = rm.sender_id
        WHERE m.conversation_id = :cid
          AND (:clearedAt IS NULL OR m.created_at > :clearedAt)
          AND (:groupClearedAt IS NULL OR m.created_at > :groupClearedAt)
          AND (
            (m.sender_id = :me AND m.hidden_for_sender = 0)
            OR (
                (:is_group = 1 OR m.receiver_id = :me2) 
                AND m.hidden_for_receiver = 0
            ) 
          )
          AND m.status != 'scheduled'
        ORDER BY m.created_at ASC
    ";

    $msgStmt = $pdo->prepare($msgSql);
    $msgStmt->execute([
        ':cid'       => $conv['id'],
        ':clearedAt' => $clearedAt,
        ':groupClearedAt' => $groupClearedAt,
        ':me'        => $me,
        ':me2'       => $me,
        ':is_group'  => $group_id ? 1 : 0
    ]);

    $messages = $msgStmt->fetchAll(PDO::FETCH_ASSOC);
    
    // DEBUG: Log counts
    // file_put_contents('debug.txt', "Params: me=$me, other=$other_id, cid={$conv['id']}, cleared=$clearedAt, found=" . count($messages) . "\n", FILE_APPEND);

    // 4️⃣ Fetch reactions & Process Privacy & OTV Masking
    
    // Prepare statements outside loop
    $viewStmt = null;
    if ($group_id) {
        $viewStmt = $pdo->prepare("SELECT viewed_at FROM group_message_views WHERE message_id = :mid AND user_id = :uid");
    }

    $reactStmt = $pdo->prepare("
        SELECT r.emoji, r.user_id, u.username
        FROM reactions r
        JOIN users u ON u.id = r.user_id
        WHERE r.message_id = :mid
    ");

    foreach ($messages as &$msg) {
        // OTV Logic: Mask content for one-time messages
        // 1. If I am sender: I can't view it. Mask it.
        // 2. If I am receiver: I need to request it via mark_one_time_seen. Mask it here.
        
        $already_viewed = false;

        if ($msg['is_one_time']) {
            if ($group_id && $viewStmt) {
                // Check if I have viewed it
                $viewStmt->execute([':mid' => $msg['id'], ':uid' => $me]);
                if ($viewStmt->fetchColumn()) {
                    $already_viewed = true;
                    $msg['status'] = 'seen'; // Override status for this user
                }
            } else {
                // 1-on-1: strictly rely on status or read_at
                if ($msg['status'] === 'seen' || !empty($msg['read_at'])) {
                    $already_viewed = true;
                }
            }

            // Always mask content unless it's just being opened (which handled by separate endpoint)
            // or if we want to show "Opened" state.
            $msg['message_text'] = '🔒 One-Time Message';
            $msg['media_url'] = null; 
            $msg['thumbnail_url'] = null;

            // If already viewed, ensure status reflects it so UI shows "Opened"
            if ($already_viewed) {
                $msg['status'] = 'seen';
            }
        }

        // Privacy Logic: Mask 'seen' if receiver has read receipts disabled
        if ($msg['sender_id'] == $me) {
            // I sent this message. I want to know if they read it.
            // If they have privacy_read_receipts = 0, and status is 'seen', I only see 'delivered'.
            if ($msg['status'] === 'seen' && $msg['receiver_read_receipts'] == 0) {
                $msg['status'] = 'delivered';
            }
        }

        $reactStmt->execute([':mid' => $msg['id']]);
        $msg['reactions'] = $reactStmt->fetchAll(PDO::FETCH_ASSOC);
    }

    http_response_code(200);
    echo json_encode($messages);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "message" => "Database error",
        "error" => $e->getMessage()
    ]);
}
