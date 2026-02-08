<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

include_once '../includes/db_connection.php';

$data = json_decode(file_get_contents("php://input"));

if (
    !isset($data->message_id) ||
    !isset($data->user_id) || 
    !isset($data->new_text)
) {
    http_response_code(400);
    echo json_encode(["message" => "Missing parameters"]);
    exit();
}

$message_id = (int)$data->message_id;
$user_id = (int)$data->user_id;
$new_text = trim($data->new_text);

if (empty($new_text)) {
    http_response_code(400);
    echo json_encode(["message" => "Message cannot be empty"]);
    exit();
}

try {
    // 1. Verify message ownership and type
    $stmt = $pdo->prepare("SELECT sender_id, media_url, is_deleted FROM messages WHERE id = :id LIMIT 1");
    $stmt->execute([':id' => $message_id]);
    $msg = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$msg) {
        http_response_code(404);
        echo json_encode(["message" => "Message not found"]);
        exit();
    }

    if ($msg['sender_id'] != $user_id) {
        http_response_code(403);
        echo json_encode(["message" => "Unauthorized"]);
        exit();
    }

    if (!empty($msg['media_url'])) {
        http_response_code(400);
        echo json_encode(["message" => "Cannot edit media messages"]);
        exit();
    }

    if ($msg['is_deleted']) {
        http_response_code(400);
        echo json_encode(["message" => "Cannot edit deleted messages"]);
        exit();
    }

    // 2. Update message
    $updateStmt = $pdo->prepare("
        UPDATE messages 
        SET message_text = :text, 
            is_edited = 1, 
            edited_at = NOW() 
        WHERE id = :id
    ");

    $updateStmt->execute([
        ':text' => $new_text,
        ':id'   => $message_id
    ]);

    // 3. Fetch updated timestamp to return
    $timeStmt = $pdo->prepare("SELECT edited_at FROM messages WHERE id = :id");
    $timeStmt->execute([':id' => $message_id]);
    $updatedTime = $timeStmt->fetchColumn();

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Message edited",
        "edited_at" => $updatedTime
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["message" => "Database error", "error" => $e->getMessage()]);
}
?>
