<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

include_once '../includes/db_connection.php';

$data = json_decode(file_get_contents("php://input"));

if (!empty($data->message_id) && !empty($data->user_id)) {
    try {
        $message_id = $data->message_id;
        $user_id = $data->user_id;

        $delete_type = !empty($data->delete_type) ? $data->delete_type : 'everyone';

        $check_sql = "SELECT sender_id, receiver_id FROM messages WHERE id = :mid";
        $stmt = $pdo->prepare($check_sql);
        $stmt->execute([':mid' => $message_id]);
        $msg = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$msg) {
            http_response_code(404);
            echo json_encode(array("message" => "Message not found."));
            exit();
        }

        // --- Note to Self Restriction ---
        if ($msg['sender_id'] == $msg['receiver_id']) {
            http_response_code(403);
            echo json_encode(array("message" => "Note to Self messages cannot be deleted."));
            exit();
        }

        if ($delete_type === 'everyone') {
            if ($msg['sender_id'] == $user_id) {
                // Update to include deleted_at and ensure clear text for previews
                $update_sql = "UPDATE messages 
                               SET is_deleted = 1, 
                                   message_text = '🚫 This message was deleted', 
                                   media_id = NULL,
                                   deleted_at = NOW() 
                               WHERE id = :mid";
                $upd_stmt = $pdo->prepare($update_sql);
                if ($upd_stmt->execute([':mid' => $message_id])) {
                    // Also clear media tracking if any
                    $pdo->prepare("DELETE FROM media_tracking WHERE message_id = :mid")->execute([':mid' => $message_id]);
                    
                    http_response_code(200);
                    echo json_encode(array("message" => "Message deleted for everyone."));
                } else {
                    http_response_code(500);
                    echo json_encode(array("message" => "Failed to delete message."));
                }
            } else {
                http_response_code(403);
                echo json_encode(array("message" => "Only the sender can delete a message for everyone."));
            }
        } else if ($delete_type === 'for_me') {
            // "Delete for me" logic
            if ($msg['sender_id'] == $user_id) {
                $update_sql = "UPDATE messages SET hidden_for_sender = 1 WHERE id = :mid";
            } else if ($msg['receiver_id'] == $user_id) {
                $update_sql = "UPDATE messages SET hidden_for_receiver = 1 WHERE id = :mid";
            } else {
                // If it's a group message, we might need a separate table for "hidden for user" 
                // but usually "Delete for me" in groups is handled locally or via a group_message_hidden table.
                // For now, let's assume 1-on-1 or simple group hiding.
                http_response_code(200);
                echo json_encode(array("message" => "Message hidden locally."));
                exit();
            }

            $upd_stmt = $pdo->prepare($update_sql);
            if ($upd_stmt->execute([':mid' => $message_id])) {
                http_response_code(200);
                echo json_encode(array("message" => "Message hidden for you."));
            } else {
                http_response_code(500);
                echo json_encode(array("message" => "Failed to hide message."));
            }
        } else {
            http_response_code(400);
            echo json_encode(array("message" => "Invalid delete type."));
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
