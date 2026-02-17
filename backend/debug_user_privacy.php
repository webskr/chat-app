<?php
header("Content-Type: application/json");
include_once 'includes/db_connection.php';

$username = isset($_GET['username']) ? $_GET['username'] : null;

if (!$username) {
    // Get the most recently updated user
    $stmt = $pdo->query("SELECT * FROM users ORDER BY username_last_updated DESC, id DESC LIMIT 1");
} else {
    $stmt = $pdo->prepare("SELECT * FROM users WHERE username = :username");
    $stmt->execute([':username' => $username]);
}

$user = $stmt->fetch(PDO::FETCH_ASSOC);

if ($user) {
    echo json_encode([
        'id' => $user['id'],
        'username' => $user['username'],
        'privacy_profile_visibility' => $user['privacy_profile_visibility'] ?? 'NULL (default public?)',
        'show_in_world' => $user['show_in_world'] ?? 'NULL',
        'relationship_status_check_needed' => 'Check if viewer is friend',
        'avatar_url' => $user['avatar_url']
    ], JSON_PRETTY_PRINT);
} else {
    echo json_encode(['message' => 'User not found']);
}
