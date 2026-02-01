<?php
$host = 'localhost';
$user = 'root';
$pass = '';

try {
    // Connect without a specific database first
    $pdo = new PDO("mysql:host=$host", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Create database if not exists
    $pdo->exec("CREATE DATABASE IF NOT EXISTS chat_app");
    echo "Database 'chat_app' created or already exists.\n";

    // Connect to the new database
    $pdo->exec("USE chat_app");

    // Create users table
    $sql = "CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        email VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )";
    $pdo->exec($sql);
    echo "Table 'users' created or already exists.\n";

    echo "Initialization successful!\n";
} catch (PDOException $e) {
    die("Initialization failed: " . $e->getMessage() . "\n");
}
?>
