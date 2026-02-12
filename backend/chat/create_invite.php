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

if (!empty($data->user_id) && !empty($data->type)) {
    try {
        $user_id = $data->user_id;
        $type = $data->type; // 'permanent' or 'limited'
        $max_uses = isset($data->max_uses) ? $data->max_uses : null;
        $expires_in_hours = isset($data->expires_in_hours) ? $data->expires_in_hours : null;
        
        $expires_at = null;
        if ($expires_in_hours) {
            $expires_at = date('Y-m-d H:i:s', strtotime("+$expires_in_hours hours"));
        }

        // Generate a 12-char unique random code (alphanumeric, uppercase)
        $invite_code = strtoupper(substr(bin2hex(random_bytes(6)), 0, 12));

        $query = "INSERT INTO invites (inviter_user_id, invite_code, type, max_uses, expires_at) 
                  VALUES (:uid, :code, :type, :max, :exp)";
        
        $stmt = $pdo->prepare($query);
        $stmt->execute([
            ':uid' => $user_id,
            ':code' => $invite_code,
            ':type' => $type,
            ':max' => $max_uses,
            ':exp' => $expires_at
        ]);

        echo json_encode([
            "success" => true,
            "invite" => [
                "code" => $invite_code,
                "type" => $type,
                "max_uses" => $max_uses,
                "expires_at" => $expires_at
            ]
        ]);

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
} else {
    http_response_code(400);
    echo json_encode(["message" => "Incomplete data."]);
}
?>
