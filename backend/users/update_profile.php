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

if (!empty($data->id) && (!empty($data->username) || !empty($data->avatar_id))) {
    try {
        $update_fields = [];
        $params = [':id' => $data->id];

        if (!empty($data->username)) {
            $update_fields[] = "username = :username";
            $params[':username'] = trim($data->username);
        }

        if (!empty($data->avatar_id)) {
            $update_fields[] = "avatar_id = :avatar_id";
            $params[':avatar_id'] = $data->avatar_id;
        }

        $query = "UPDATE users SET " . implode(", ", $update_fields) . " WHERE id = :id";
        $stmt = $pdo->prepare($query);

        if ($stmt->execute($params)) {
            http_response_code(200);
            echo json_encode(array("message" => "Profile updated successfully."));
        } else {
            http_response_code(503);
            echo json_encode(array("message" => "Unable to update profile."));
        }
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(array("message" => "Database error: " . $e->getMessage()));
    }
} else {
    http_response_code(400);
    echo json_encode(array("message" => "Incomplete data."));
}
