<?php
include_once '../includes/db_connection.php';

try {
    $username = 'VegarmOfficial';
    $password = 'VegarmAdmin2026!'; // The password to set
    $hash = password_hash($password, PASSWORD_DEFAULT);

    $stmt = $pdo->prepare("UPDATE users SET password = :hash WHERE username = :username");
    $stmt->execute([':hash' => $hash, ':username' => $username]);

    if ($stmt->rowCount() > 0) {
        echo "Password updated successfully for user: $username<br>";
        echo "New Password: $password";
    } else {
        echo "User '$username' not found or password is same.";
    }

} catch (PDOException $e) {
    echo "Error: " . $e->getMessage();
}
?>
