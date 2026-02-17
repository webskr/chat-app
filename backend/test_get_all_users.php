<?php
// Simulate a non-existent requesting user to ensure no friendship exists
$_SERVER['REQUEST_METHOD'] = 'GET';
$_GET['user_id'] = 99999; 

// Capture output
ob_start();
include 'users/get_users.php';
$output = ob_get_clean();

$users = json_decode($output, true);

// Check if user 1 (deepaks) is present and has avatar_url
$found = false;
foreach ($users as $u) {
    if ($u['username'] === 'deepaks') {
        echo "User: " . $u['username'] . "\n";
        echo "Privacy Profile Visibility: " . ($u['privacy_profile_visibility'] ?? 'NULL') . "\n";
        echo "Avatar URL: " . ($u['avatar_url'] ? $u['avatar_url'] : 'NULL') . "\n";
        echo "Bio: " . ($u['bio'] ? $u['bio'] : 'NULL') . "\n"; // Bio should still be NULL if private
        $found = true;
        break;
    }
}

if (!$found) {
    echo "User 'deepaks' not found in the list.\n";
}
