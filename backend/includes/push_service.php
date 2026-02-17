<?php
function sendPushNotification($to_token, $title, $body, $data = null, $sound = 'default') {
    if (empty($to_token)) {
        return false;
    }

    $url = "https://exp.host/--/api/v2/push/send";
    
    $postData = [
        'to' => $to_token,
        'title' => $title,
        'body' => $body,
        'sound' => $sound,
        'priority' => 'high',
        'channelId' => 'default',
        'color' => '#000000', // Tint color for the small icon
    ];

    if ($data) {
        $postData['data'] = $data;
    }

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($postData));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Accept: application/json'
    ]);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return $httpCode === 200;
}
?>
