<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

include_once '../includes/db_connection.php';

$conversation_id = isset($_GET['conversation_id']) ? $_GET['conversation_id'] : null;

if (!$conversation_id) {
    http_response_code(400);
    echo json_encode(array("message" => "Missing conversation_id"));
    exit();
}

try {
    $query = "SELECT id, auto_delete_minutes FROM conversations WHERE id = :id";
    $stmt = $pdo->prepare($query);
    $stmt->execute([':id' => $conversation_id]);
    
    $settings = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($settings) {
        http_response_code(200);
        echo json_encode($settings);
    } else {
        http_response_code(404);
        echo json_encode(array("message" => "Conversation not found."));
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(array("message" => "Database error: " . $e->getMessage()));
}
?>
