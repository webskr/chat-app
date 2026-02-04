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

if (!empty($data->conversation_id) && isset($data->auto_delete_minutes)) {
    try {
        // Optional: Add logic to verify user is part of the conversation
        // For now, assuming client side validation + knowing conversation_id is enough context
        
        $query = "UPDATE conversations SET auto_delete_minutes = :minutes WHERE id = :id";
        $stmt = $pdo->prepare($query);
        
        if ($stmt->execute([
            ':minutes' => $data->auto_delete_minutes, 
            ':id' => $data->conversation_id
        ])) {
            http_response_code(200);
            echo json_encode(array("message" => "Chat settings updated."));
        } else {
            http_response_code(503);
            echo json_encode(array("message" => "Unable to update settings."));
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
