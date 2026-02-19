<?php
include '../includes/db_connection.php';
try {
    echo "--- GROUPS ---\n";
    $stm = $pdo->query("SELECT id, name FROM groups LIMIT 5");
    echo json_encode($stm->fetchAll(PDO::FETCH_ASSOC));
    
    echo "\n\n--- MEMBERS ---\n";
    $stm = $pdo->query("SELECT * FROM group_members LIMIT 5");
    echo json_encode($stm->fetchAll(PDO::FETCH_ASSOC));
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage();
}
?>
