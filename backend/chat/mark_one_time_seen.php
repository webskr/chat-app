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
        // Check if message is one-time and if current user is the receiver
        $check_query = "SELECT id, receiver_id, is_one_time, seen_at, delete_after_seconds, media_url, message_text FROM messages WHERE id = :mid";
        $check_stmt = $pdo->prepare($check_query);
        $check_stmt->execute([':mid' => $data->message_id]);
        $message = $check_stmt->fetch(PDO::FETCH_ASSOC);

        if (!$message) {
            http_response_code(404);
            echo json_encode(array("message" => "Message not found."));
            exit();
        }

        if ($message['receiver_id'] != $data->user_id) {
            http_response_code(403);
            echo json_encode(array("message" => "Unauthorized."));
            exit();
        }

        if (!$message['is_one_time']) {
            http_response_code(400);
            echo json_encode(array("message" => "Not a one-time message."));
            exit();
        }
        
        // If already seen, return success but DO NOT return content (security)
        if ($message['seen_at']) {
             http_response_code(200);
             echo json_encode(array("message" => "Already seen.", "seen_at" => $message['seen_at']));
             exit();
        }

        // Mark as seen
        $update_query = "UPDATE messages SET seen_at = NOW(), status = 'seen' WHERE id = :mid";
        $update_stmt = $pdo->prepare($update_query);
        $update_stmt->execute([':mid' => $data->message_id]);

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
