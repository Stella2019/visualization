<?php
    include '../connect.php';

    ini_set('max_execution_time', 60);

    $query = "INSERT IGNORE INTO InSubset " .
        "SELECT " .
        "	 " . $_REQUEST["subset"] . " as 'Subset', " .
        "    Tweet.`ID` as 'Tweet', " .
        "	 Tweet.`Distinct` as 'Distinct', " .
        "    Tweet.`Type` as 'Type' " .
        "FROM Tweet ";


    // Add conditionals
    $conds = array();
    if(isset($_REQUEST["tweet_min"]))
        $conds[] = "Tweet.ID >= " . $_REQUEST["tweet_min"];
    if(isset($_REQUEST["tweet_max"]))
        $conds[] = "Tweet.ID < " . $_REQUEST["tweet_max"];
    if(isset($_REQUEST["event"])) {
        $query .= "JOIN InEvent " .
                "	ON Tweet.`ID` = InEvent.Tweet ";
        
        $conds[] = "InEvent.Event = " . $_REQUEST["event"];
    }
    if(isset($_REQUEST["superset"])) {
        $query .= "JOIN InSubset " .
                "	ON Tweet.`ID` = InSubset.Tweet ";

        $conds[] = "InSubset.Subset = " . $_REQUEST["superset"];
    }
    if(isset($_REQUEST["source"]))
        $conds[] = "LOWER(Tweet.Source) REGEXP " . $_REQUEST["source"];
    if(isset($_REQUEST["lang"]))
        $conds[] = "Tweet.Lang = '" . $_REQUEST["lang"] . "'";
    if(isset($_REQUEST["text_regex"])) {
        foreach(explode(' & ', $_REQUEST["text_regex"]) as $term) {
            $conds[] = "LOWER(Tweet.Text) REGEXP '" . $term . "'";
        }
    }

    if(!empty($conds))
        $query .= " WHERE " . join(" AND " , $conds);

    $result = $mysqli->query($query);
     
    print $result;

    $mysqli->close();
?>