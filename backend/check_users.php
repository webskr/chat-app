<?php
include_once 'db_connection.php';

try {
    $stmt = $pdo->query("SELECT id, username, email, created_at FROM users");
    $users = $stmt->fetchAll();
    echo json_encode(["status" => "success", "users" => $users]);
} catch (PDOException $e) {
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}
?>
