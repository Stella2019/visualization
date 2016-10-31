<?php
    include '../connect.php';

    ini_set('max_execution_time', 300);

    // Get input from user
    $event_id = $_REQUEST["event_id"];
    $rumor_id = $_REQUEST["rumor_id"];
    $search_text = $_REQUEST["search_text"];
    $time_min = $_REQUEST["time_min"];
    $time_max = $_REQUEST["time_max"];
    $lt = (isset($_REQUEST["inclusive_max"]) ? '<=' : '<');

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
        "        AND Tweet.Timestamp $lt '" . $time_max . "' ";

    foreach(explode(',', $_POST["search_text"]) as $term) {
        $query = $query . "   AND LOWER(Tweet.Text) REGEXP '" . $term . "' ";
    }

    $query = $query . "; ";

    $result = $mysqli->query($query);
     
    print $query;

    $mysqli->close();
?>