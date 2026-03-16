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
        // Check if message is one-time
        $check_query = "SELECT m.id, m.receiver_id, m.is_one_time, m.seen_at, m.status, m.media_url, m.message_text, m.conversation_id, c.group_id 
                        FROM messages m 
                        LEFT JOIN conversations c ON m.conversation_id = c.id
                        WHERE m.id = :mid";
        $check_stmt = $pdo->prepare($check_query);
        $check_stmt->execute([':mid' => $data->message_id]);
        $message = $check_stmt->fetch(PDO::FETCH_ASSOC);

        if (!$message) {
            http_response_code(404);
            echo json_encode(array("message" => "Message not found."));
            exit();
        }

        if (!$message['is_one_time']) {
            http_response_code(400);
            echo json_encode(array("message" => "Not a one-time message."));
            exit();
        }

        $group_id = $message['group_id'];

        if ($group_id) {
            // --- GROUP LOGIC ---
            
            // 1. Verify Membership
            $mem_stmt = $pdo->prepare("SELECT status FROM group_members WHERE group_id = :gid AND user_id = :uid");
            $mem_stmt->execute([':gid' => $group_id, ':uid' => $data->user_id]);
            $status = $mem_stmt->fetchColumn();

            if (!$status || $status !== 'active') {
                http_response_code(403);
                echo json_encode(array("message" => "Not a member."));
                exit();
            }

            // 2. Check if already seen by THIS user
            $view_check = $pdo->prepare("SELECT viewed_at FROM group_message_views WHERE message_id = :mid AND user_id = :uid");
            $view_check->execute([':mid' => $data->message_id, ':uid' => $data->user_id]);
            $existing_view = $view_check->fetchColumn();

            if ($existing_view) {
                http_response_code(200);
                echo json_encode(array("message" => "Already seen.", "seen_at" => $existing_view));
                exit();
            }

            // 3. Mark as seen for THIS user
            $insert_view = $pdo->prepare("INSERT INTO group_message_views (message_id, user_id, group_id) VALUES (:mid, :uid, :gid)");
            $insert_view->execute([':mid' => $data->message_id, ':uid' => $data->user_id, ':gid' => $group_id]);

        } else {
            // --- 1-ON-1 LOGIC ---

            if ($message['receiver_id'] != $data->user_id) {
                http_response_code(403);
                echo json_encode(array("message" => "Unauthorized."));
                exit();
            }

            // If already seen, return success but DO NOT return content (security)
            if ($message['seen_at'] || $message['status'] === 'seen') {
                 http_response_code(200);
                 echo json_encode(array("message" => "Already seen.", "seen_at" => $message['seen_at']));
                 exit();
            }
    
            // Mark as seen and NULLIFY content for privacy
            $update_query = "UPDATE messages SET seen_at = NOW(), status = 'seen', media_url = NULL, message_text = NULL WHERE id = :mid";
            $update_stmt = $pdo->prepare($update_query);
            $update_stmt->execute([':mid' => $data->message_id]);
        }
        
        http_response_code(200);
        
        // Return the content involved so client can display it one last time
        // The client must cache this in local state as next fetch will mask it.
        echo json_encode(array(
            "message" => "Message marked as seen.", 
            "seen_at" => date('Y-m-d H:i:s'),
            "data" => array(
                "message_text" => $message['message_text'],
                "media_url" => $message['media_url']
            )
        ));

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(array("message" => "Database error: " . $e->getMessage()));
    }
} else {
    http_response_code(400);
    echo json_encode(array("message" => "Incomplete data."));
}
?>
