<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

include_once 'db_connection.php';

$data = json_decode(file_get_contents("php://input"));

if (!empty($data->message_id) && !empty($data->user_id)) {
    try {
        $message_id = $data->message_id;
        $user_id = $data->user_id;

        // Verify ownership (can only delete own messages)
        // Or if you want admin delete, add logic here.
        // For "Delete for Everyone", usually only the sender can do it.
        $check_sql = "SELECT sender_id FROM messages WHERE id = :mid";
        $stmt = $pdo->prepare($check_sql);
        $stmt->execute([':mid' => $message_id]);
        $msg = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($msg && $msg['sender_id'] == $user_id) {
            // Soft delete: Mark as deleted
            // Option: "UPDATE messages SET is_deleted = 1, message_text = '🚫 This message was deleted' WHERE id = :mid"
            // Keeping text effectively removes it from view but keeps record.
            // If user wants "permanently removed", we could do DELETE, but 'is_deleted' is safer for sync.
            // Let's do the "This message was deleted" replacement standard.
            
            $update_sql = "UPDATE messages SET is_deleted = 1, message_text = '🚫 This message was deleted' WHERE id = :mid";
            $upd_stmt = $pdo->prepare($update_sql);
            
            if ($upd_stmt->execute([':mid' => $message_id])) {
                http_response_code(200);
                echo json_encode(array("message" => "Message deleted for everyone."));
            } else {
                http_response_code(500);
                echo json_encode(array("message" => "Failed to delete message."));
            }
        } else {
            http_response_code(403);
            echo json_encode(array("message" => "You can only delete your own messages."));
        }

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(array("message" => "Database error: " . $e->getMessage()));
    }
} else {
    http_response_code(400);
    echo json_encode(array("message" => "Incomplete data."));
}
?>
