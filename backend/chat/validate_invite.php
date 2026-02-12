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

$code = isset($_GET['code']) ? $_GET['code'] : null;

if ($code) {
    try {
        $query = "SELECT i.*, u.username as inviter_name 
                  FROM invites i
                  JOIN users u ON i.inviter_user_id = u.id
                  WHERE i.invite_code = :code AND i.is_active = 1";
        
        $stmt = $pdo->prepare($query);
        $stmt->execute([':code' => $code]);
        $invite = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$invite) {
            echo json_encode(["valid" => false, "message" => "Invalid or inactive invite code."]);
            exit();
        }

        // Check expiry
        if ($invite['expires_at'] && strtotime($invite['expires_at']) < time()) {
            echo json_encode(["valid" => false, "message" => "This invite has expired."]);
            exit();
        }

        // Check usage limit
        if ($invite['max_uses'] && $invite['used_count'] >= $invite['max_uses']) {
            echo json_encode(["valid" => false, "message" => "This invite has reached its usage limit."]);
            exit();
        }

        echo json_encode([
            "valid" => true,
            "inviter_name" => $invite['inviter_name'],
            "type" => $invite['type']
        ]);

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
} else {
    http_response_code(400);
    echo json_encode(["message" => "Invite code is required."]);
}
?>
