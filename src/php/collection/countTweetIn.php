<?php
    include '../connect.php';

    // Get input from user
    $event_id = $_POST["event_id"];
    $time_min = $_POST["time_min"];
    $time_max = $_POST["time_max"];
    if(isset($_POST["rumor_id"])) {
        $collection_id = $_POST["rumor_id"];
        $collection_type = 'Rumor';
    } else {
        $collection_id = $event_id;
        $collection_type = 'Event';
    }

    // Prepare query
    if(isset($_POST["total"])) {
        $query = "" .
            "SELECT " .
            "   COUNT(*) as count " .
            "FROM TweetIn" . $collection_type . " TinC " .
            "WHERE TinC." . $collection_type . "_ID = " . $collection_id;
    } else {
        $query = "" .
            "SELECT " .
            "   COUNT(*) as count " .
            "FROM Tweet " .
            "JOIN TweetIn" . $collection_type . " TinC " .
            "    ON TinC.Tweet_ID = Tweet.ID " .
            "    AND TinC." . $collection_type . "_ID = " . $collection_id . " " .
            "WHERE Tweet.Timestamp >= '" . $time_min . "' " .
            "   AND Tweet.Timestamp < '" . $time_max . "' ";

        if(isset($_POST["type"])) {
            $query = $query . "   AND Tweet.Type = '" . $_POST["type"] . "'  ";
        }
        if(isset($_POST["distinct"])) {
            $query = $query . "   AND Tweet.Distinct = '" . $_POST["distinct"] . "'  ";
        }
        if(isset($_POST["search_text"])) {
            foreach(explode(',', $_POST["search_text"]) as $term) {
                $query = $query . "   AND LOWER(Tweet.Text) REGEXP '" . $term . "' ";
            }
        }
    }

    // Execute Query and print as JSON
    include '../printJSON.php';
?>