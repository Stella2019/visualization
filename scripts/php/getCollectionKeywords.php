<?php
    include 'connect.php';

    // Get input from user
    $table_id = $_GET["table_id"];

    // Execute Query
    $query = "SELECT Keywords FROM Event " .
             "WHERE Event.ID = " . $table_id . ";";

    include 'printResults.php';
?>