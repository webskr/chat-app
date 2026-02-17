<?php
// backend/debug/test_broadcast.php
$url = 'http://localhost/chat-app/backend/chat/send_broadcast.php';

// Mock Data
$data = array(
    'sender_id' => 9993, // Assuming this is the admin ID from logs
    'message' => 'Test Broadcast from Script ' . date('H:i:s'),
    'image_path' => null,
    'scheduled_at' => gmdate('Y-m-d\TH:i:s\Z', time() + 120) // Schedule for 2 mins later
);

$options = array(
    'http' => array(
        'header'  => "Content-type: application/json\r\n",
        'method'  => 'POST',
        'content' => json_encode($data)
    )
);

$context  = stream_context_create($options);
$result = file_get_contents($url, false, $context);

if ($result === FALSE) { 
    echo "Error sending request.\n";
    print_r(error_get_last());
} else {
    echo "Response: " . $result . "\n";
}
?>
