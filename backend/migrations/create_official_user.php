<?php
include_once '../includes/db_connection.php';

try {
    // Check if user exists
    $stmt = $pdo->prepare("SELECT id FROM users WHERE username = 'VegarmOfficial'");
    $stmt->execute();
    $user = $stmt->fetch();

    if ($user) {
        // Update existing
        $update = $pdo->prepare("UPDATE users SET is_official = 1, display_name = 'Vegarm Official', show_in_world = 0, privacy_profile_visibility = 'public' WHERE id = :id");
        $update->execute([':id' => $user['id']]);
        echo "Updated Vegarm Official user (ID: " . $user['id'] . ")";
    } else {
        // Create new
        // Note: Password hash is dummy as this account shouldn't be logged into normally, or set a strong random one.
        // We'll use a dummy hash.
        $passwordHash = password_hash('VegarmOfficialSuperSecretKey' . time(), PASSWORD_DEFAULT);
        
        $insert = $pdo->prepare("INSERT INTO users (username, display_name, email, password, is_official, show_in_world, privacy_profile_visibility, bio) VALUES ('VegarmOfficial', 'Vegarm Official', 'official@vegarm.app', :pass, 1, 0, 'public', 'Official System Account')");
        $insert->execute([':pass' => $passwordHash]);
        echo "Created Vegarm Official user.";
    }

} catch (PDOException $e) {
    echo "Error: " . $e->getMessage();
}
?>
