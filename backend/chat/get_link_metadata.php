<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

$url = isset($_GET['url']) ? $_GET['url'] : null;

if (!$url || !filter_var($url, FILTER_VALIDATE_URL)) {
    http_response_code(400);
    echo json_encode(["message" => "Valid URL is required."]);
    exit();
}

try {
    // Use cURL for better handling of redirects and timeouts
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_MAXREDIRS, 3);
    curl_setopt($ch, CURLOPT_TIMEOUT, 5);
    curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    $html = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($html === false || $httpCode >= 400) {
        throw new Exception("Unable to fetch URL (HTTP $httpCode)");
    }

    $doc = new DOMDocument();
    @$doc->loadHTML(mb_convert_encoding($html, 'HTML-ENTITIES', 'UTF-8'));
    $xpath = new DOMXPath($doc);

    $metadata = [
        "title" => "",
        "description" => "",
        "image" => "",
        "url" => $url
    ];

    // Priority 1: OpenGraph tags
    $metadata["title"] = $xpath->evaluate("string(//meta[@property='og:title']/@content)");
    $metadata["description"] = $xpath->evaluate("string(//meta[@property='og:description']/@content)");
    $metadata["image"] = $xpath->evaluate("string(//meta[@property='og:image']/@content)");

    // Priority 2: Standard meta tags / Title
    if (empty($metadata["title"])) {
        $metadata["title"] = $xpath->evaluate("string(//title)");
    }
    if (empty($metadata["description"])) {
        $metadata["description"] = $xpath->evaluate("string(//meta[@name='description']/@content)");
    }

    // Sanitize
    $metadata["title"] = trim(mb_substr($metadata["title"], 0, 200));
    $metadata["description"] = trim(mb_substr($metadata["description"], 0, 500));
    $metadata["image"] = trim($metadata["image"]);

    echo json_encode($metadata);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["message" => "Error fetching metadata: " . $e->getMessage()]);
}
?>
