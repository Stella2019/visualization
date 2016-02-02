<?php
    include '../connect.php';

    ini_set('max_execution_time', 300);

    // Get input from user
    if(isset($_POST["rumor_id"])) {
        $collection_id = $_POST["rumor_id"];
        $collection_type = 'Rumor';               
    } else if(isset($_POST["event_id"])) {
        $collection_id = $_POST["event_id"];
        $collection_type = 'Event';
    }

    // Execute Query
    $query = "SELECT ";
        
    $project = array("Tweet.ID", "Tweet.Text", "Tweet.Distinct", "Tweet.Type", "Tweet.Username", "Tweet.Timestamp", "Tweet.Origin");
    if(isset($_POST["order_popular"])) {
        $project[] = "Count(*) as Count";
    }

    $query .= join(", " , $project);

            
    $query .= " FROM Tweet " .
        "JOIN TweetIn" . $collection_type . " TinC " .
        "    ON TinC.Tweet_ID = Tweet.ID " .
        "    AND TinC." . $collection_type . "_ID = " . $collection_id . " ";

    // Add conditionals
    $conds = array();
    if(isset($_POST["time_min"]))
        $conds[] = "Tweet.Timestamp >= '" . $_POST["time_min"] . "'";
    if(isset($_POST["time_max"]))
        $conds[] = "Tweet.Timestamp < '" . $_POST["time_max"] . "'";
    if(isset($_POST["type"]))
        $conds[] = "Tweet.Type IN ('" . $_POST["type"] . "')";
    if(isset($_POST["distinct"]))
        $conds[] = "Tweet.Distinct = '" . $_POST["distinct"];
    if(isset($_POST["search_text"])) {
        foreach(explode(',', $_POST["search_text"]) as $term) {
            $conds[] = "LOWER(Tweet.Text) REGEXP '" . $term . "'";
        }
    }

    if(!empty($conds))
        $query .= " WHERE " . join(" AND " , $conds);
    
    // Other conditions/limits
    if(isset($_POST["rand"])) {
        $query .= " ORDER BY RAND(3)";
    } else if(isset($_POST["order_popular"])) {
        $query .= " GROUP BY Tweet.Text";
        $query .= " ORDER BY COUNT(*) DESC";
    }

    $query .= " LIMIT ";
    if(isset($_POST["limit"])) {
        if(isset($_POST["offset"])) {
            $query .= $_POST["offset"] . ',';
        }
        $query .= $_POST["limit"];
    } else {
        $query .= "5";
    }

    $query .= ";";

    if(isset($_POST["csv"])) {
        include '../exportToCSV.php';
    } else {
        include '../printJSON.php';
    }
?>