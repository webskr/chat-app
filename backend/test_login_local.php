<?php
include_once 'db_connection.php';

$email = "raju@gmail.com";
$password = "your_actual_password_here"; // I don't know the password, but I can check if ANY password works or if the hash is valid.

try {
    $query = "SELECT password FROM users WHERE email = :email LIMIT 0,1";
    $stmt = $pdo->prepare($query);
    $stmt->bindParam(':email', $email);
    $stmt->execute();
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($row) {
        $hash = $row['password'];
        echo "User found. Hash: " . $hash . "\n";
        // Since I don't know the password, I can't verify it here without the user's input.
        // But I can check if the hash looks like a valid BCRYPT hash.
        if (password_get_info($hash)['algoName'] === 'bcrypt') {
            echo "Hash algorithm is bcrypt.\n";
        } else {
            echo "Hash algorithm is NOT bcrypt!\n";
        }
    } else {
        echo "User not found.\n";
    }
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
