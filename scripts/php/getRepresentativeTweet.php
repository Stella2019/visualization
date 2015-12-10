<?php
    include 'connect.php';

    // Get input from user
    $event_id = $_GET["event_id"];
    $time_min = $_GET["time_min"];
    $time_max = $_GET["time_max"];

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
        "   AND Tweet.Timestamp > " . $time_min . " " .
        "   AND Tweet.Timestamp < " . $time_max . " ";

    if(isset($_GET["type"])) {
        $query = $query . "   AND Tweet.Type = '" . $_GET["type"] . "'  ";
    }
    if(isset($_GET["redun"])) {
        $query = $query . "   AND Tweet.Redundant = '" . $_GET["redun"] . "'  ";
    }
    if(isset($_GET["text_search"])) {
        $query = $query . "   AND MATCH(Tweet.Text) AGAINST ('" . $_GET["text_search"] . "' in BOOLEAN MODE) > 0  ";
    }

    $query = $query . "LIMIT 5;";

    include 'printJSON.php';
?>