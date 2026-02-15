<?php
include '../includes/db_connection.php';
try {
    $stmt = $pdo->query("DESCRIBE conversations");
    $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($result);
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage();
}
?>
