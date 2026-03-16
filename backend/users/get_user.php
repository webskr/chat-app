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

if (!$user_id) {
    http_response_code(400);
    echo json_encode(array("message" => "User ID is required."));
    exit();
}

try {
    $stmt = $pdo->prepare("SELECT * FROM users WHERE id = :id");
    $stmt->execute([':id' => $user_id]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($user) {
        // Handle scramble name privacy
        // Requirement: Only scramble if: 1. Scramble is enabled, 2. Requester is NOT the user themselves
        $requester_id = isset($_GET['requester_id']) ? $_GET['requester_id'] : null;

        if ($requester_id && (string)$requester_id !== (string)$user['id'] && !empty($user['scramble_enabled']) && !empty($user['scramble_value'])) {
             $user['display_name'] = $user['scramble_value'];
             // UPDATED: Use the scrambled value directly as the username
             $user['username'] = $user['scramble_value'];
        }

        // Remove sensitive data
        if (isset($user['password_hash'])) unset($user['password_hash']);
        if (isset($user['password'])) unset($user['password']);
        if (isset($user['scramble_value'])) unset($user['scramble_value']); // Never expose the raw scramble value
        
        http_response_code(200);
        echo json_encode($user);
    } else {
        http_response_code(404);
        echo json_encode(array("message" => "User not found."));
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(array("message" => "Database error: " . $e->getMessage()));
}
?>
