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

$me       = isset($_GET['sender_id']) ? (int)$_GET['sender_id'] : null;
$other_id = isset($_GET['receiver_id']) ? (int)$_GET['receiver_id'] : null;

if (!$me || !$other_id) {
    http_response_code(400);
    echo json_encode(["message" => "Incomplete parameters"]);
    exit;
}

try {
    // 1️⃣ Find conversation
    $convStmt = $pdo->prepare("
        SELECT id, user1_id, user2_id, user1_cleared_at, user2_cleared_at, auto_delete_minutes
        FROM conversations
        WHERE (user1_id = :me AND user2_id = :other)
           OR (user1_id = :other AND user2_id = :me)
        LIMIT 1
    ");

    $convStmt->execute([
        ':me'    => $me,
        ':other'=> $other_id
    ]);

    $conv = $convStmt->fetch(PDO::FETCH_ASSOC);

    if (!$conv) {
        echo json_encode([]);
        exit;
    }

    // 1.5️⃣ Auto-Delete Cleanup (DISABLED TEMPORARILY FOR DEBUGGING)
    /*
    if (!empty($conv['auto_delete_minutes']) && $conv['auto_delete_minutes'] > 0) {
        $minutes = (int)$conv['auto_delete_minutes'];
        $deleteSql = "DELETE FROM messages 
                      WHERE conversation_id = :cid 
                      AND created_at < (NOW() - INTERVAL :min MINUTE)";
        $delStmt = $pdo->prepare($deleteSql);
        $delStmt->execute([':cid' => $conv['id'], ':min' => $minutes]);
    }
    */

    // 2️⃣ Determine cleared_at for current user
    if ($conv['user1_id'] == $me) {
        $clearedAt = !empty($conv['user1_cleared_at']) ? $conv['user1_cleared_at'] : null;
    } else {
        $clearedAt = !empty($conv['user2_cleared_at']) ? $conv['user2_cleared_at'] : null;
    }

    // 3️⃣ Fetch Messages
    // ... mark delivered ...
    $deliverySql = "UPDATE messages 
                    SET status = 'delivered', 
                        delivered_at = NOW() 
                    WHERE conversation_id = :cid 
                    AND receiver_id = :me 
                    AND status = 'sent'";
    $deliveryStmt = $pdo->prepare($deliverySql);
    $deliveryStmt->execute([':cid' => $conv['id'], ':me' => $me]);

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
            m.created_at,
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
            ur.privacy_read_receipts AS receiver_read_receipts
        FROM messages m
        JOIN users u ON u.id = m.sender_id
        JOIN users ur ON ur.id = m.receiver_id
        LEFT JOIN messages rm ON rm.id = m.reply_to_message_id
        LEFT JOIN users ru ON ru.id = rm.sender_id
        WHERE m.conversation_id = :cid
          AND (:clearedAt IS NULL OR :clearedAt2 = '' OR m.created_at > :clearedAt3)
          AND (
            (m.sender_id = :me AND m.hidden_for_sender = 0)
            OR (m.receiver_id = :me2 AND m.hidden_for_receiver = 0)
          )
        ORDER BY m.created_at ASC
    ";

    $msgStmt = $pdo->prepare($msgSql);
    $msgStmt->execute([
        ':cid'       => $conv['id'],
        ':clearedAt' => $clearedAt,
        ':clearedAt2' => $clearedAt,
        ':clearedAt3' => $clearedAt,
        ':me'        => $me,
        ':me2'       => $me
    ]);

    $messages = $msgStmt->fetchAll(PDO::FETCH_ASSOC);
    
    // DEBUG: Log counts
    // file_put_contents('debug.txt', "Params: me=$me, other=$other_id, cid={$conv['id']}, cleared=$clearedAt, found=" . count($messages) . "\n", FILE_APPEND);

    // 4️⃣ Fetch reactions & Process Privacy
    foreach ($messages as &$msg) {
        // Privacy Logic: Mask 'seen' if receiver has read receipts disabled
        if ($msg['sender_id'] == $me) {
            // I sent this message. I want to know if they read it.
            // If they have privacy_read_receipts = 0, and status is 'seen', I only see 'delivered'.
            if ($msg['status'] === 'seen' && $msg['receiver_read_receipts'] == 0) {
                $msg['status'] = 'delivered';
            }
        }

        $reactStmt = $pdo->prepare("
            SELECT r.emoji, r.user_id, u.username
            FROM reactions r
            JOIN users u ON u.id = r.user_id
            WHERE r.message_id = :mid
        ");
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
