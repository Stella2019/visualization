<?php
    include 'connect.php';

    // Get input from user
    $event_id = $_GET["event_id"];

    // Execute Query
    $query = "SELECT * FROM EventTweetCount " .
             "WHERE Event_ID = " . $event_id;

    if(isset($_GET["time_min"])) {
        $query = $query . " AND EventTweetCount.Time >= " . $_GET["time_min"];
    }
    if(isset($_GET["time_max"])) {
        $query = $query . " AND EventTweetCount.Time < " . $_GET["time_max"];
    }

    $query = $query . ";";

echo $query;

    include 'printResults.php';
?>