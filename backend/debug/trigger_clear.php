<?php
$url = 'http://localhost/chat-app/backend/chat/clear_msgs.php';
$data = ['user_id' => 1, 'target_id' => 10];

$options = [
    'http' => [
        'header'  => "Content-type: application/json\r\n",
        'method'  => 'POST',
        'content' => json_encode($data),
    ],
];

$context  = stream_context_create($options);
$result = file_get_contents($url, false, $context);

if ($result === FALSE) {
    echo "ERROR: Request failed.\n";
} else {
    echo "RESPONSE: " . $result . "\n";
}
?>
