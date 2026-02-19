<?php
ini_set('display_errors', 1);
error_reporting(E_ALL);

echo "Starting debug...<br>";

if (file_exists('includes/db_connection.php')) {
    echo "Files exists: includes/db_connection.php<br>";
    include_once 'includes/db_connection.php';
    echo "Included db_connection.php<br>";
} else {
    echo "ERROR: includes/db_connection.php NOT FOUND<br>";
    exit();
}

if (isset($pdo)) {
    echo "PDO Object exists.<br>";
} else {
    echo "PDO Object is NULL.<br>";
    exit();
}

try {
    echo "Querying database name...<br>";
    $stmt = $pdo->query("SELECT DATABASE()");
    $current_db = $stmt->fetchColumn();
    echo "Connected to Database: <strong>$current_db</strong><br>";

    echo "Querying groups schema...<br>";
    $stmt = $pdo->query("DESCRIBE groups");
    $columns = $stmt->fetchAll(PDO::FETCH_COLUMN);
    
    echo "Existing Columns: " . implode(", ", $columns) . "<br><br>";

    $missing = [];
    $required = ['allow_member_edit_info', 'allow_member_send_messages', 'allow_member_add_members', 'admin_approve_new_members'];

    foreach ($required as $col) {
        if (!in_array($col, $columns)) {
            $missing[] = $col;
        }
    }

    if (empty($missing)) {
        echo "All required columns are PRESENT.<br>";
    } else {
        echo "Missing columns: " . implode(", ", $missing) . "<br>";
        echo "Attempting to add missing columns...<br>";

        foreach ($missing as $col) {
            try {
                // Default logic
                $default = ($col === 'allow_member_edit_info' || $col === 'admin_approve_new_members') ? 0 : 1;
                $sql = "ALTER TABLE groups ADD COLUMN $col TINYINT(1) DEFAULT $default";
                $pdo->exec($sql);
                echo "Added $col (Default: $default) - SUCCESS<br>";
            } catch (PDOException $e) {
                echo "Failed to add $col: " . $e->getMessage() . "<br>";
            }
        }
    }

} catch (PDOException $e) {
    echo "Critical Error: " . $e->getMessage();
} catch (Exception $e) {
    echo "General Error: " . $e->getMessage();
}
?>
