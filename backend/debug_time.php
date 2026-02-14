<?php
include_once 'includes/db_connection.php';

// Verify what the DB thinks "scheduled <= UTC_TIMESTAMP()" would match
// This assumes we have a scheduled message in the future (e.g. 13:30 IST -> 08:00 UTC)
// Current UTC is 08:00 (approx).

echo "DB UTC: " . $pdo->query("SELECT UTC_TIMESTAMP()")->fetchColumn() . "\n";
echo "DB Local: " . $pdo->query("SELECT NOW()")->fetchColumn() . "\n";

?>
