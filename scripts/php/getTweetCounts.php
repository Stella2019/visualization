<?php
    include 'connect.php';

    // Get input from user
    $event_id = $_GET["event_id"];

    // Execute Query
    $query = "SELECT ".
             "    `Time`, ".
             "    Found_In, ".
             "    Keyword, ".
             "    SUM(`Count`) as 'all', ".
             "    SUM(`Distinct`) as 'distinct', ".
             "    SUM(`Original`) as 'original', ".
             "    SUM(Retweet) as 'retweet', ".
             "    SUM(Reply) as 'reply', ".
             "    SUM(Quote) as 'quote'".
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