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

if (!empty($data->user_id) && !empty($data->target_id)) {
    try {
        $user_id = $data->user_id;
        $target_id = $data->target_id;
        $duration = isset($data->duration) ? $data->duration : null; // '8h', '1w', 'always', 'none'

        if ($duration == 'none') {
            $query = "DELETE FROM muted_chats WHERE user_id = :uid AND target_id = :tid";
        } else {
            $mute_until = '';
            if ($duration == '8h') {
                $mute_until = date('Y-m-d H:i:s', strtotime('+8 hours'));
            } elseif ($duration == '1w') {
                $mute_until = date('Y-m-d H:i:s', strtotime('+1 week'));
            } elseif ($duration == 'always') {
                $mute_until = '2099-12-31 23:59:59';
            } else {
                http_response_code(400);
                echo json_encode(array("message" => "Invalid duration."));
                exit();
            }

            $query = "INSERT INTO muted_chats (user_id, target_id, mute_until) VALUES (:uid, :tid, :mute_until) 
                      ON DUPLICATE KEY UPDATE mute_until = :mute_until";
        }

        $stmt = $pdo->prepare($query);
        $stmt->bindParam(':uid', $user_id);
        $stmt->bindParam(':tid', $target_id);
        if ($duration != 'none') {
            $stmt->bindParam(':mute_until', $mute_until);
        }

        if ($stmt->execute()) {
            http_response_code(200);
            echo json_encode(array("message" => "Mute status updated successfully."));
        } else {
            http_response_code(500);
            echo json_encode(array("message" => "Unable to update mute status."));
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
