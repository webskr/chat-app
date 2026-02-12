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

if ($user_id) {
    try {
        // Fetch active invites
        $query = "SELECT invite_code, type, max_uses, used_count, expires_at, created_at, is_active 
                  FROM invites 
                  WHERE inviter_user_id = :uid 
                  ORDER BY created_at DESC";
        
        $stmt = $pdo->prepare($query);
        $stmt->execute([':uid' => $user_id]);
        $invites = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Fetch total stats
        $stats_query = "SELECT 
                        COUNT(*) as total_created,
                        SUM(used_count) as total_joined
                        FROM invites 
                        WHERE inviter_user_id = :uid";
        
        $stats_stmt = $pdo->prepare($stats_query);
        $stats_stmt->execute([':uid' => $user_id]);
        $stats = $stats_stmt->fetch(PDO::FETCH_ASSOC);

        echo json_encode([
            "success" => true,
            "invites" => $invites,
            "stats" => [
                "sent" => (int)$stats['total_created'],
                "joined" => (int)$stats['total_joined']
            ]
        ]);

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
} else {
    http_response_code(400);
    echo json_encode(["message" => "User ID is required."]);
}
?>
