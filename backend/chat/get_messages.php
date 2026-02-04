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

    // 1.5️⃣ Auto-Delete Cleanup
    if (!empty($conv['auto_delete_minutes']) && $conv['auto_delete_minutes'] > 0) {
        $minutes = (int)$conv['auto_delete_minutes'];
        $deleteSql = "DELETE FROM messages 
                      WHERE conversation_id = :cid 
                      AND created_at < (NOW() - INTERVAL :min MINUTE)";
        $delStmt = $pdo->prepare($deleteSql);
        $delStmt->execute([':cid' => $conv['id'], ':min' => $minutes]);
        // Note: This physically deletes messages for both users.
    }

    // 2️⃣ Determine cleared_at for current user
    if ($conv['user1_id'] == $me) {
        $clearedAt = $conv['user1_cleared_at'];
    } else {
        $clearedAt = $conv['user2_cleared_at'];
    }

    // 3️⃣ Fetch messages (clean + predictable)
    $msgSql = "
        SELECT 
            m.id,
            m.message_text,
            m.media_url,
            m.sender_id,
            m.created_at,
            m.is_deleted,
            u.username AS sender_name,
            u.avatar_id AS sender_avatar_id
        FROM messages m
        JOIN users u ON u.id = m.sender_id
        WHERE m.conversation_id = :cid
          AND (:clearedAt IS NULL OR m.created_at > :clearedAt)
        ORDER BY m.created_at ASC
    ";

    $msgStmt = $pdo->prepare($msgSql);
    $msgStmt->execute([
        ':cid'       => $conv['id'],
        ':clearedAt' => $clearedAt
    ]);

    $messages = $msgStmt->fetchAll(PDO::FETCH_ASSOC);

    // 4️⃣ Fetch reactions
    foreach ($messages as &$msg) {
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
