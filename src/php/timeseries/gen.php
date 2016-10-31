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
        "(Event_ID, `Time`, Timesource, Found_In, Keyword, `Distinct`, `Original`, Retweet, Reply, Quote) " .
        "SELECT " .
        "    " . $event_id . " as 'Event_ID', " .
        "    Tweets.Time as 'Time',  " .
        "    100 as 'Timesource',  " .
        "    'Text' as 'Found_In',  " .
        "    '" . $search_name . "'  as 'Keyword', " .
        "    Tweets.`Distinct` as 'Distinct',  " .
        "    SUM(Tweets.Original) as 'Original',  " .
        "    SUM(Tweets.Retweet) as 'Retweet', " . 
        "    SUM(Tweets.Reply) as 'Reply', " .
        "    SUM(Tweets.Quote) as 'Quote' " .
        "FROM (SELECT  " .
        "        Date_Format(Tweet.Timestamp, '%Y-%m-%d %H:%i') AS Time, " .
        "        Tweet.`Distinct` AS 'Distinct', " .
        "        Tweet.Type LIKE 'original' AS 'Original', " .
        "        Tweet.Type LIKE 'retweet' AS 'Retweet', " .
        "        Tweet.Type LIKE 'reply' AS 'Reply', " .
        "        Tweet.Type LIKE 'quote' AS 'Quote' " .
        "    FROM Tweet " .
        "    JOIN TweetIn" . $collection_type . " TinC " .
        "        ON TinC.Tweet_ID = Tweet.ID " .
        "        AND TinC." . $collection_type . "_ID = " . $collection_id . " " .
        "    WHERE Tweet.Timestamp >= '" . $time_min . "' " .
        "        AND Tweet.Timestamp $lt '" . $time_max . "' ";

    if($collection_type != 'Rumor') {
        foreach(explode(',', $search_text) as $term) {
            $query = $query . "   AND LOWER(Tweet.Text) REGEXP '" . $term . "' ";
        }
    }

    $query = $query . ") Tweets " .
        "GROUP BY Tweets.Time, Tweets.`Distinct` " .
        "ORDER BY Tweets.Time, Tweets.`Distinct` ";

    $result = $mysqli->query($query);
     
    print $query;

    $mysqli->close();
?>