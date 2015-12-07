<?php
    include 'connect.php';

    // Get input from user
    $event_id = $_GET["event_id"];

    // Execute Query
    $query = "SELECT * FROM EventTweetCount " .
             "WHERE Event_ID = " . $event_id . ";";

    include 'printResults.php';
?>