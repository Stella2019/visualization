<?php
    include '../connect.php';

    ini_set('max_execution_time', 300);

    // Get input from user
    if(isset($_REQUEST["rumor_id"])) {
        $collection_id = $_REQUEST["rumor_id"];
        $collection_type = 'Rumor';               
    } else {
        $collection_id = $_REQUEST["event_id"];
        $collection_type = 'Event';
    }

    // Execute Query
    $query = "" .
        "SELECT " .
        "   TweetMetadata.TextNoURL " .
        "FROM TweetMetadata " .
        "JOIN TweetIn" . $collection_type . " TinC " .
        "    ON TinC.Tweet_ID = TweetMetadata.Tweet_ID " .
        "    AND TinC." . $collection_type . "_ID = " . $collection_id . " ";

    // Add conditionals
    $conds = array();
    if(isset($_REQUEST["time_min"]))
        $conds[] = "Tweet.Timestamp >= '" . $_REQUEST["time_min"] . "'";
    if(isset($_REQUEST["time_max"]))
        $conds[] = "Tweet.Timestamp < '" . $_REQUEST["time_max"] . "'";
    if(isset($_REQUEST["type"]))
        $conds[] = "Tweet.Type IN ('" . $_REQUEST["type"] . "')";
    if(isset($_REQUEST["distinct"]))
        $conds[] = "Tweet.Distinct = '" . $_REQUEST["distinct"];
    if(isset($_REQUEST["search_text"])) {
        foreach(explode(',', $_REQUEST["search_text"]) as $term) {
            $conds[] = "LOWER(Tweet.Text) REGEXP '" . $term;
        }
    }

    if(!empty($conds))
        $query .= "" .
            "JOIN Tweet " .
            "    ON TweetMetadata.Tweet_ID = Tweet.ID " .
            "WHERE " . join(" AND " , $conds);
    
    // Other conditions/limits
    if(isset($_REQUEST["rand"])) {
        $query .= " ORDER BY RAND()";
    }

    if(isset($_REQUEST["limit"])) {
        $query .= " LIMIT " . $_REQUEST["limit"] . ";";
    } else {
        $query .= " LIMIT 5;";
    }

    if(isset($_REQUEST["csv"])) {
        include '../exportToCSV.php';
    } else {
        include '../printJSON.php';
    }
?>