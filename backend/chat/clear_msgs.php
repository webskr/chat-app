<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

include_once '../includes/db_connection.php';

$data = json_decode(file_get_contents("php://input"), true);

if (
    (empty($data['user_id']) && empty($data['sender_id'])) ||
    (empty($data['target_id']) && empty($data['receiver_id']))
) {
    http_response_code(400);
    echo json_encode(["message" => "Incomplete data"]);
    exit;
}

$user_id   = isset($data['user_id']) ? (int)$data['user_id'] : (int)$data['sender_id'];
$target_id = isset($data['target_id']) ? (int)$data['target_id'] : (int)$data['receiver_id'];

try {
    $pdo->beginTransaction();

    // 1️⃣ Find conversation
    $find = $pdo->prepare("
        SELECT id
        FROM conversations
        WHERE (user1_id = :u1 AND user2_id = :u2)
           OR (user1_id = :u2 AND user2_id = :u1)
        LIMIT 1
    ");

    $find->execute([':u1' => $user_id, ':u2' => $target_id]);
    $conversation = $find->fetch(PDO::FETCH_ASSOC);

    if (!$conversation) {
        $pdo->rollBack();
        http_response_code(404);
        echo json_encode(["message" => "Conversation not found"]);
        exit;
    }

    $cid = $conversation['id'];

    // 2️⃣ Physically DELETE all messages for this conversation
    $del_stmt = $pdo->prepare("DELETE FROM messages WHERE conversation_id = :cid");
    $del_stmt->execute([':cid' => $cid]);
    $msg_count = $del_stmt->rowCount();

    // 3️⃣ Reset the conversation markers
    $update_conv = $pdo->prepare("
        UPDATE conversations 
        SET last_message = NULL, 
            last_message_time = NULL 
        WHERE id = :cid
    ");
    $update_conv->execute([':cid' => $cid]);

    $pdo->commit();

    http_response_code(200);
    echo json_encode([
        "message" => "Chat and messages cleared successfully",
        "conversation_id" => $cid,
        "deleted_count" => $msg_count
    ]);

} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode([
        "message" => "Database error",
        "error" => $e->getMessage()
    ]);
}
