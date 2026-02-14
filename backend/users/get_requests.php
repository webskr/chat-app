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
    // Fetch users who sent a friend request to the current user (Received)
    $queryReceived = "SELECT u.id, u.username, u.display_name, u.avatar_id, u.avatar_url, u.created_at, r.created_at as request_time
                      FROM users u
                      JOIN relationships r ON u.id = r.user_id
                      WHERE r.target_id = :uid AND r.status = 'pending'
                      ORDER BY r.created_at DESC";
    
    $stmtReceived = $pdo->prepare($queryReceived);
    $stmtReceived->execute([':uid' => $user_id]);
    $received = $stmtReceived->fetchAll(PDO::FETCH_ASSOC);

    // Fetch users to whom the current user sent a request (Sent)
    $querySent = "SELECT u.id, u.username, u.display_name, u.avatar_id, u.avatar_url, u.created_at, r.created_at as request_time
                  FROM users u
                  JOIN relationships r ON u.id = r.target_id
                  WHERE r.user_id = :uid AND r.status = 'pending'
                  ORDER BY r.created_at DESC";
    
    $stmtSent = $pdo->prepare($querySent);
    $stmtSent->execute([':uid' => $user_id]);
    $sent = $stmtSent->fetchAll(PDO::FETCH_ASSOC);
    
    http_response_code(200);
    echo json_encode(array(
        "received" => $received,
        "sent" => $sent
    ));
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(array("message" => "Database error: " . $e->getMessage()));
}
?>
