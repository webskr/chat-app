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
$target_id = isset($_GET['target_id']) ? $_GET['target_id'] : null;

if (!$user_id || !$target_id) {
    http_response_code(400);
    echo json_encode(["message" => "Missing parameters."]);
    exit();
}

try {
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM muted_chats WHERE user_id = :uid AND target_id = :tid AND mute_until > NOW()");
    $stmt->execute([':uid' => $user_id, ':tid' => $target_id]);
    $is_muted = $stmt->fetchColumn() > 0;
    
    echo json_encode(["is_muted" => $is_muted]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["message" => "Database error."]);
}
?>
