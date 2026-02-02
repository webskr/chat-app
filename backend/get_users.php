<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

include_once 'db_connection.php';

$user_id = isset($_GET['user_id']) ? $_GET['user_id'] : null;

try {
    $query = "SELECT u.id, u.username, u.email, u.avatar_id, 
              (SELECT status FROM relationships WHERE user_id = :uid1 AND target_id = u.id) as relationship_status
              FROM users u WHERE u.id != :uid2";
    $stmt = $pdo->prepare($query);
    $stmt->execute([':uid1' => $user_id, ':uid2' => $user_id]);
    
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    http_response_code(200);
    echo json_encode($users);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(array("message" => "Database error: " . $e->getMessage()));
}
