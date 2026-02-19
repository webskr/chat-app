<?php
include_once 'includes/db_connection.php';

try {
    $stmt = $pdo->query("DESCRIBE groups");
    $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($columns, JSON_PRETTY_PRINT);
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage();
}
?>
