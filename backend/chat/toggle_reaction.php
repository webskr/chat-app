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

if (!empty($data->message_id) && !empty($data->user_id) && !empty($data->emoji)) {
    try {
        // Check if reaction already exists
        $check_query = "SELECT id FROM reactions WHERE message_id = :mid AND user_id = :uid AND emoji = :emoji";
        $stmt = $pdo->prepare($check_query);
        $stmt->execute([':mid' => $data->message_id, ':uid' => $data->user_id, ':emoji' => $data->emoji]);
        
        if ($stmt->rowCount() > 0) {
            // Remove reaction
            $delete_query = "DELETE FROM reactions WHERE message_id = :mid AND user_id = :uid AND emoji = :emoji";
            $stmt = $pdo->prepare($delete_query);
            $stmt->execute([':mid' => $data->message_id, ':uid' => $data->user_id, ':emoji' => $data->emoji]);
            echo json_encode(["message" => "Reaction removed.", "status" => "removed"]);
        } else {
            // Add reaction
            $insert_query = "INSERT INTO reactions (message_id, user_id, emoji) VALUES (:mid, :uid, :emoji)";
            $stmt = $pdo->prepare($insert_query);
            $stmt->execute([':mid' => $data->message_id, ':uid' => $data->user_id, ':emoji' => $data->emoji]);
            echo json_encode(["message" => "Reaction added.", "status" => "added"]);
        }
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
} else {
    http_response_code(400);
    echo json_encode(["message" => "Incomplete data."]);
}
?>
