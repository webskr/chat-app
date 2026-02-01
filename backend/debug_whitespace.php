<?php
include_once 'db_connection.php';

try {
    $stmt = $pdo->query("SELECT id, username, email FROM users");
    while ($row = $stmt->fetch()) {
        echo "ID: [" . $row['id'] . "], Username: [" . $row['username'] . "], Email: [" . $row['email'] . "]\n";
    }
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
