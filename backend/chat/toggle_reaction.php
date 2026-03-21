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
        // Check if user already has ANY reaction on this message
        $check_query = "SELECT id, emoji FROM reactions WHERE message_id = :mid AND user_id = :uid LIMIT 1";
        $stmt = $pdo->prepare($check_query);
        $stmt->execute([':mid' => $data->message_id, ':uid' => $data->user_id]);
        $existing = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($existing) {
            if ($existing['emoji'] === $data->emoji) {
                // Same emoji tapped again → remove (toggle off)
                $delete_query = "DELETE FROM reactions WHERE id = :id";
                $stmt = $pdo->prepare($delete_query);
                $stmt->execute([':id' => $existing['id']]);
                echo json_encode(["message" => "Reaction removed.", "status" => "removed"]);
            } else {
                // Different emoji → update (overwrite)
                $update_query = "UPDATE reactions SET emoji = :emoji WHERE id = :id";
                $stmt = $pdo->prepare($update_query);
                $stmt->execute([':emoji' => $data->emoji, ':id' => $existing['id']]);
                echo json_encode(["message" => "Reaction updated.", "status" => "updated"]);
            }
        } else {
            // No existing reaction → insert new
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
