<?php
    include 'connect.php';

    ini_set('max_execution_time', 300);

    // Get input from user
    $event_id = $_POST["event_id"];
    $rumor_id = $_POST["rumor_id"];
    $search_text = $_POST["search_text"];
    $time_min = $_POST["time_min"];
    $time_max = $_POST["time_max"];

    // Execute Query
    $query = "" .
        "INSERT IGNORE INTO TweetInRumor " .
        "(Rumor_ID, Tweet_ID) " .
        "SELECT  " .
        "    " . $rumor_id . " AS Rumor_ID, " .
        "    Tweet.ID AS Tweet_ID " .
        "    FROM Tweet " .
        "    JOIN TweetInEvent TinE " .
        "        ON TinE.Tweet_ID = Tweet.ID " .
        "    WHERE TinE.Event_ID = " . $event_id . " " .
        "        AND Tweet.Timestamp >= '" . $time_min . "' " .
        "        AND Tweet.Timestamp < '" . $time_max . "' ";

    foreach(explode(',', $_POST["search_text"]) as $term) {
        $query = $query . "   AND LOWER(Tweet.Text) REGEXP '" . $term . "' ";
    }

    $query = $query . "; ";

    $result = $mysqli->query($query);
     
    print $query;

    $mysqli->close();
?>