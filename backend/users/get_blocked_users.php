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

$user_id = isset($_GET['user_id']) ? $_GET['user_id'] : null;

if (!empty($user_id)) {
    try {
        $query = "SELECT u.id, u.username, u.email, u.avatar_id
                  FROM relationships r
                  JOIN users u ON r.target_id = u.id
                  WHERE r.user_id = :uid AND r.status = 'blocked'";
        
        $stmt = $pdo->prepare($query);
        $stmt->execute([':uid' => $user_id]);
        
        $blocked_users = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        http_response_code(200);
        echo json_encode($blocked_users);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(array("message" => "Database error: " . $e->getMessage()));
    }
} else {
    http_response_code(400);
    echo json_encode(array("message" => "User ID required."));
}
?>
