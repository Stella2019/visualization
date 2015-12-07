<?php
    include 'connect.php';

    // Get input from user
    $event_id = $_GET["event_id"];

    // Execute Query
    $query = "" .
        "SELECT " .
        "   Tweet.ID, " .
        "   Tweet.Text, " .
        "   not Tweet.Redundant as 'Distinct', " .
        "   Tweet.Type, " .
        "   Tweet.Username, " .
        "   Tweet.Timestamp, " .
        "   Tweet.Origin " .
        "FROM Tweet " .
        "JOIN TweetInEvent " .
        "	ON TweetInEvent.Tweet_ID = Tweet.ID " .
        "WHERE TweetInEvent.Event_ID = " . $event_id . " " .
            Timestamp LIKE '2015-11-13 21:40%' " .
        "   AND Tweet.Type LIKE '%' " .
        "	AND Tweet.Redundant LIKE '0' " .
        "LIMIT 1;"


    include 'printResults.php';
?>