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
        "   Tweet.Distinct, " .
        "   Tweet.Type, " .
        "   Tweet.Username, " .
        "   Tweet.Timestamp, " .
        "   Tweet.Origin " .
        "FROM Tweet " .
        "JOIN TweetInEvent " .
        "	ON TweetInEvent.Tweet_ID = Tweet.ID " .
        "WHERE TweetInEvent.Event_ID = " . $event_id . " " .
        "   AND Tweet.Timestamp >= " . $time_min . " " .
        "   AND Tweet.Timestamp < " . $time_max . " ";

    if(isset($_GET["type"])) {
        $query = $query . "   AND Tweet.Type = '" . $_GET["type"] . "'  ";
    }
    if(isset($_GET["redun"])) {
        $query = $query . "   AND Tweet.Distinct = '" . $_GET["distinct"] . "'  ";
    }
    if(isset($_GET["text_search"])) {
        foreach(explode(',', $_GET["text_search"]) as $term) {
            $query = $query . "   AND LOWER(Tweet.Text) REGEXP '" . $term . "' ";
        }
    }

    if(isset($_GET["rand"])) {
        $query = $query . " ORDER BY RAND()";
    }

    if(isset($_GET["limit"])) {
        $query = $query . " LIMIT " . $_GET["limit"] . ";";
    } else {
        $query = $query . " LIMIT 5;";
    }


    if(isset($_GET["csv"])) {
        include 'exportToCSV.php';
    } else {
        include 'printJSON.php';
    }
?>