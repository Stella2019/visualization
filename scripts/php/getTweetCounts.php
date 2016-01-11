<?php
    include 'connect.php';

    // Get input from user
    $event_id = $_GET["event_id"];

    // Execute Query
    $query = "SELECT ".
             "    `Time`, ".
             "    Found_In, ".
             "    Keyword, ".
             "    SUM(`Count`) as 'Count', ".
             "    SUM(`Distinct`) as 'Distinct', ".
             "    SUM(`Original`) as 'Original', ".
             "    SUM(Retweet) as 'Retweet', ".
             "    SUM(Reply) as 'Reply', ".
             "    SUM(Quote) as 'Quote'".
             "FROM TweetCount " .
             "WHERE Event_ID = " . $event_id;

    if(isset($_GET["time_min"])) {
        $query = $query . " AND TweetCount.Time >= " . $_GET["time_min"];
    }
    if(isset($_GET["time_max"])) {
        $query = $query . " AND TweetCount.Time < " . $_GET["time_max"];
    }

    $query = $query .
        " GROUP BY TweetCount.Time, Found_In, Keyword " .
        " ORDER BY TweetCount.Time; ";

    include 'printResults.php';
?>