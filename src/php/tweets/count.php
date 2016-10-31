<?php
    include '../connect.php';

    ini_set('max_execution_time', 300);

    // Get input from user
    $event_id = $_POST["event_id"];
    $time_min = $_POST["time_min"];
    $time_max = $_POST["time_max"];
    $lt = (isset($_REQUEST["inclusive_max"]) ? '<=' : '<');
    if(isset($_POST["rumor_id"])) {
        $collection_id = $_POST["rumor_id"];
        $collection_type = 'Rumor';               
    } else {
        $collection_id = $event_id;
        $collection_type = 'Event';
    }

    // Execute Query
    $query = "" .
        "SELECT " .
        "   COUNT(*) as count " .
        "FROM Tweet " .
        "JOIN TweetIn" . $collection_type . " TinC " .
        "    ON TinC.Tweet_ID = Tweet.ID " .
        "    AND TinC." . $collection_type . "_ID = " . $collection_id . " " .
        "WHERE  Tweet.Timestamp >= '" . $time_min . "' " .
        "   AND Tweet.Timestamp $lt '" . $time_max . "' ";

    if(isset($_POST["type"])) {
        $query = $query . "   AND Tweet.Type IN ('" . $_POST["type"] . "')  ";
    }
    if(isset($_POST["distinct"])) {
        $query = $query . "   AND Tweet.Distinct = '" . $_POST["distinct"] . "'  ";
    }
    if(isset($_POST["search_text"])) {
        foreach(explode(',', $_POST["search_text"]) as $term) {
            $query = $query . "   AND LOWER(Tweet.Text) REGEXP '" . $term . "' ";
        }
    }

    if(isset($_POST["csv"])) {
        include '../exportToCSV.php';
    } else {
        include '../printJSON.php';
    }
?>