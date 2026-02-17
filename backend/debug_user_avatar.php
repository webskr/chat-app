<?php
header("Content-Type: application/json");
include_once 'includes/db_connection.php';

$username = isset($_GET['username']) ? $_GET['username'] : null;

if (!$username) {
    // Get the most recently updated user with an avatar_url
    $stmt = $pdo->query("SELECT * FROM users WHERE avatar_url IS NOT NULL ORDER BY username_last_updated DESC, id DESC LIMIT 1");
} else {
    $stmt = $pdo->prepare("SELECT * FROM users WHERE username = :username");
    $stmt->execute([':username' => $username]);
}

$user = $stmt->fetch(PDO::FETCH_ASSOC);

if ($user) {
    $filePath = __DIR__ . '/' . $user['avatar_url'];
    $fileExists = file_exists($filePath);
    
    echo json_encode([
        'user' => $user,
        'file_check' => [
            'absolute_path' => $filePath,
            'exists' => $fileExists,
            'readable' => is_readable($filePath)
        ]
    ], JSON_PRETTY_PRINT);
} else {
    echo json_encode(['message' => 'No user found with avatar_url']);
}
