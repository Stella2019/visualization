<?php
    include 'connect.php';

    // Get input from user
    $event_id = $_GET["event_id"];
    $time_min = $_GET["time_min"];
    $time_max = $_GET["time_max"];

    // Execute Query
    $query = "" .
        "INSERT INTO EventTweetCount " .
        "(Event_ID, `Time`, Keyword, count, `Distinct`, `Original`, Retweet, Reply) " .
        "SELECT " .
        "    " . $event_id . " as 'Event_ID', " .
        "    Tweets.Time as 'Time',  " .
        "    '" . $_GET["text_search"] . "'  as 'Keyword', " .
        "    SUM(Tweets.`all`) as 'Count',  " .
        "    SUM(Tweets.`distinct`) as 'Distinct',  " .
        "    SUM(Tweets.original) as 'Original',  " .
        "    SUM(Tweets.retweet) as 'Retweet', " . 
        "    SUM(Tweets.reply) as 'Reply' " .
        "FROM (SELECT  " .
        "        Date_Format(Tweet.Timestamp, '%Y-%m-%d %H:%i') AS time, " .
        "        1 AS 'all', " .
        "        Tweet.`Distinct` AS 'distinct', " .
        "        Tweet.Type LIKE 'original' AS 'original', " .
        "        Tweet.Type LIKE 'retweet' AS 'retweet', " .
        "        Tweet.Type LIKE 'reply' AS 'reply' " .
        "    FROM Tweet " .
        "    JOIN TweetInEvent TinE " .
        "        ON TinE.Tweet_ID = Tweet.ID " .
        "    WHERE TinE.Event_ID = " . $event_id . " " .
        "        AND Tweet.Timestamp >= " . $time_min . " " .
        "        AND Tweet.Timestamp <= " . $time_max . " ";

    foreach(explode(' ', $_GET["text_search"]) as $term) {
        $query = $query . "   AND LOWER(Tweet.Text) REGEXP '" . $term . "' ";
    }

    $query = $query . ") Tweets " .
        "GROUP BY Tweets.time " .
        "ORDER BY Tweets.time ";

print $query;

    $result = $mysqli->query($query);
     
    $mysqli->close();
?>