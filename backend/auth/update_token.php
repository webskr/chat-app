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

if (!empty($data->user_id) && !empty($data->token)) {
    try {
        // Validate token format (Expo push token starts with ExponentPushToken[...] or similar)
        // We won't strictly validate the format here to allow flexibility, but we update it.
        
        $query = "UPDATE users SET device_token = :token WHERE id = :id";
        $stmt = $pdo->prepare($query);
        $stmt->bindParam(':token', $data->token);
        $stmt->bindParam(':id', $data->user_id);
        
        if ($stmt->execute()) {
            http_response_code(200);
            echo json_encode(array("message" => "Device token updated successfully."));
        } else {
            http_response_code(503);
            echo json_encode(array("message" => "Unable to update device token."));
        }
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(array("message" => "Database error: " . $e->getMessage()));
    }
} else {
    http_response_code(400);
    echo json_encode(array("message" => "Incomplete data. user_id and token are required."));
}
