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

if (!empty($data->invite_code) && !empty($data->user_id)) {
    try {
        $query = "UPDATE invites SET is_active = 0 
                  WHERE invite_code = :code AND inviter_user_id = :uid";
        
        $stmt = $pdo->prepare($query);
        $stmt->execute([
            ':code' => $data->invite_code,
            ':uid' => $data->user_id
        ]);

        if ($stmt->rowCount() > 0) {
            echo json_encode(["success" => true, "message" => "Invite revoked successfully."]);
        } else {
            echo json_encode(["success" => false, "message" => "Invite not found or already inactive."]);
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
