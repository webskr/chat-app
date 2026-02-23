<?php
$url = 'http://localhost/chat-app/backend/chat/upload_image.php';
$postFields = [
    'sender_id' => '1',
    'receiver_id' => '2',
];

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_POST, 1);
curl_setopt($ch, CURLOPT_POSTFIELDS, $postFields);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

$response = curl_exec($ch);
curl_close($ch);

echo "Response:\n";
echo $response;
?>
