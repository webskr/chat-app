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

if (!empty($data->id) && !empty($data->current_password) && !empty($data->new_password)) {
    try {
        // First verify current password
        $query = "SELECT password FROM users WHERE id = :id LIMIT 0,1";
        $stmt = $pdo->prepare($query);
        $stmt->bindParam(':id', $data->id);
        $stmt->execute();
        
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row && password_verify($data->current_password, $row['password'])) {
            // Update to new password
            $new_password_hash = password_hash($data->new_password, PASSWORD_BCRYPT);
            $update_query = "UPDATE users SET password = :password WHERE id = :id";
            $update_stmt = $pdo->prepare($update_query);
            $update_stmt->bindParam(':password', $new_password_hash);
            $update_stmt->bindParam(':id', $data->id);

            if ($update_stmt->execute()) {
                http_response_code(200);
                echo json_encode(array("message" => "Password updated successfully."));
            } else {
                http_response_code(503);
                echo json_encode(array("message" => "Unable to update password."));
            }
        } else {
            http_response_code(401);
            echo json_encode(array("message" => "Invalid current password."));
        }
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(array("message" => "Database error: " . $e->getMessage()));
    }
} else {
    http_response_code(400);
    echo json_encode(array("message" => "Incomplete data."));
}
