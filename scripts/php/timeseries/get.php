<?php
    include '../connect.php';

    // Get input from user
    $event_id = $_POST["event_id"];

    // Execute Query
    $query = "SELECT ".
             "    `Time`, ".
             "    Found_In, ".
             "    Keyword, ".
             "    `Distinct`, ".
             "    SUM(`Original`) as 'original', ".
             "    SUM(Retweet) as 'retweet', ".
             "    SUM(Reply) as 'reply', ".
             "    SUM(Quote) as 'quote'".
             "FROM TweetCount " .
             "WHERE Event_ID = " . $event_id;

    if(isset($_POST["time_min"])) {
        $query = $query . " AND TweetCount.Time >= '" . $_POST["time_min"] . "'";
    }
    if(isset($_POST["time_max"])) {
        $query = $query . " AND TweetCount.Time < '" . $_POST["time_max"] . "'";
    }

    $query = $query .
        " GROUP BY TweetCount.Time, Found_In, Keyword, `Distinct` " .
        " ORDER BY TweetCount.Time; ";

    include '../printResults.php';
?>