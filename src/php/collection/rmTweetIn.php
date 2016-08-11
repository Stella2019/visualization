<?php
    include '../connect.php';

    ini_set('max_execution_time', 300);

    // Get input from user
    $event_id = $_POST["event_id"];
    $rumor_id = $_POST["rumor_id"];

    // First delete all of the TweetIn[Collection]
    $query = "" .
        "DELETE " .
        "FROM TweetInRumor " .
        "WHERE Rumor_ID=" . $rumor_id . " ; ";

    $result = $mysqli->query($query);
     
    print $query;

    $mysqli->close();
?>