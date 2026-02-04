<?php
$target_url = 'http://localhost/chat-app/backend/chat/upload_image.php';
$file_name_with_full_path = 'test_image.txt'; // Create a dummy file

file_put_contents($file_name_with_full_path, 'This is a test image content');

$cFile = new CURLFile($file_name_with_full_path, 'text/plain', 'test_image.txt');
$post = array('image'=> $cFile);

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $target_url);
curl_setopt($ch, CURLOPT_POST,1);
curl_setopt($ch, CURLOPT_POSTFIELDS, $post);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
$result = curl_exec($ch);
curl_close($ch);

echo $result;
?>
