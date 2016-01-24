<?php
    include 'connect.php';

    ini_set('max_execution_time', 300);

    // Get input from user
    $event_id = $_POST["event_id"];
    $time_min = $_POST["time_min"];
    $time_max = $_POST["time_max"];
    if(isset($_POST["rumor_id"])) {
        $collection_id = $_POST["rumor_id"];
        $collection_type = 'Rumor';                    
        $search_name = '_rumor_' . $collection_id;
    } else {
        $collection_id = $event_id;
        $collection_type = 'Event';
        $search_name = $_POST["search_name"];
        $search_text = $_POST["search_text"];
    }

    // Execute Query
    $query = "" .
        "REPLACE INTO TweetCount " .
        "(Event_ID, `Time`, Timesource, Found_In, Keyword, Count, `Distinct`, `Original`, Retweet, Reply, Quote) " .
        "SELECT " .
        "    " . $event_id . " as 'Event_ID', " .
        "    Tweets.Time as 'Time',  " .
        "    100 as 'Timesource',  " .
        "    'Text' as 'Found_In',  " .
        "    '" . $search_name . "'  as 'Keyword', " .
        "    SUM(Tweets.`all`) as 'Count',  " .
        "    SUM(Tweets.`distinct`) as 'Distinct',  " .
        "    SUM(Tweets.original) as 'Original',  " .
        "    SUM(Tweets.retweet) as 'Retweet', " . 
        "    SUM(Tweets.reply) as 'Reply', " .
        "    SUM(Tweets.quote) as 'Quote' " .
        "FROM (SELECT  " .
        "        Date_Format(Tweet.Timestamp, '%Y-%m-%d %H:%i') AS time, " .
        "        1 AS 'all', " .
        "        Tweet.`Distinct` AS 'distinct', " .
        "        Tweet.Type LIKE 'original' AS 'original', " .
        "        Tweet.Type LIKE 'retweet' AS 'retweet', " .
        "        Tweet.Type LIKE 'reply' AS 'reply', " .
        "        Tweet.Type LIKE 'quote' AS 'quote' " .
        "    FROM Tweet " .
        "    JOIN TweetIn" . $collection_type . " TinC " .
        "        ON TinC.Tweet_ID = Tweet.ID " .
        "        AND TinC." . $collection_type . "_ID = " . $collection_id . " " .
        "    WHERE Tweet.Timestamp >= '" . $time_min . "' " .
        "        AND Tweet.Timestamp < '" . $time_max . "' ";

    if($collection_type != 'Rumor') {
        foreach(explode(',', $search_text) as $term) {
            $query = $query . "   AND LOWER(Tweet.Text) REGEXP '" . $term . "' ";
        }
    }

    $query = $query . ") Tweets " .
        "GROUP BY Tweets.time " .
        "ORDER BY Tweets.time ";

    $result = $mysqli->query($query);
     
    print $query;

    $mysqli->close();
?>