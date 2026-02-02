<?php
include_once '../includes/db_connection.php';

try {
    $stmt = $pdo->query("SELECT 1");
    echo json_encode(["status" => "success", "message" => "Database connection successful."]);
} catch (PDOException $e) {
    echo json_encode(["status" => "error", "message" => "Database connection failed: " . $e->getMessage()]);
}
?>
