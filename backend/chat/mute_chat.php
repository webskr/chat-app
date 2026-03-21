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

if (!empty($data->user_id) && !empty($data->target_id) && !empty($data->action)) {
    try {
        $user_id = $data->user_id;
        $target_id = $data->target_id;
        $is_group = !empty($data->is_group) ? (int)$data->is_group : 0;
        
        if ($data->action === 'mute') {
            // Default mute duration: 8 hours if not specified, or 'forever' logic if needed.
            // For now, let's say 'mute' means mute until a far future date or specific duration.
            // If duration is provided in minutes.
            $minutes = !empty($data->duration) ? (int)$data->duration : 525600; // Default ~1 year
            
            $stmt = $pdo->prepare("INSERT INTO muted_chats (user_id, target_id, is_group, mute_until) VALUES (:uid, :tid, :isg, DATE_ADD(NOW(), INTERVAL :min MINUTE)) ON DUPLICATE KEY UPDATE mute_until = DATE_ADD(NOW(), INTERVAL :min MINUTE)");
            $stmt->execute([':uid' => $user_id, ':tid' => $target_id, ':isg' => $is_group, ':min' => $minutes]);
            
            echo json_encode(["message" => "Chat muted successfully.", "success" => true]);
        } elseif ($data->action === 'unmute') {
            $stmt = $pdo->prepare("DELETE FROM muted_chats WHERE user_id = :uid AND target_id = :tid AND is_group = :isg");
            $stmt->execute([':uid' => $user_id, ':tid' => $target_id, ':isg' => $is_group]);
            
            echo json_encode(["message" => "Chat unmuted successfully.", "success" => true]);
        } else {
             http_response_code(400);
             echo json_encode(["message" => "Invalid action."]);
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
