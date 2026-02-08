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

if (!empty($data->user_id)) {
    $user_id = (int)$data->user_id;

    try {
        // Mark all messages sent TO me, that are currently 'sent', as 'delivered'.
        // This signifies the app has successfully connected and is polling/receiving data.
        $query = "UPDATE messages 
                  SET status = 'delivered', 
                      delivered_at = NOW() 
                  WHERE receiver_id = :me 
                  AND status = 'sent'";
        
        $stmt = $pdo->prepare($query);
        $stmt->execute([':me' => $user_id]);
        
        $count = $stmt->rowCount();

        echo json_encode([
            "message" => "Messages marked as delivered",
            "updated_count" => $count
        ]);

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["error" => $e->getMessage()]);
    }
} else {
    http_response_code(400);
    echo json_encode(["message" => "User ID required"]);
}
?>
