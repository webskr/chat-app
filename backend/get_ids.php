<?php
include_once 'includes/db_connection.php';

try {
    $g = $pdo->query("SELECT id FROM groups LIMIT 1")->fetchColumn();
    $u = $pdo->query("SELECT id FROM users LIMIT 1")->fetchColumn();
    echo "Group ID: $g <br> User ID: $u";
} catch (PDOException $e) {
    echo $e->getMessage();
}
?>
