<?php
    include '../connect.php';

    // Execute Query
    $query = "" .
        "SELECT Counts.ID, " .
        " 	 Counts.Tweets, " .
        "    FirstTweet.TimeStamp as First, " .
        "    LastTweet.TimeStamp as Last " .
        "FROM (SELECT `Rumor_ID` as ID, " .
        "	 COUNT(*) as Tweets, " .
        "	 MIN(Tweet_ID) as First, " .
        "	 MAX(Tweet_ID) as Last " .
        "	 FROM TweetInRumor " .
        "	 GROUP BY `Rumor_ID`) Counts " .
        "JOIN Tweet as FirstTweet " .
        "	 ON FirstTweet.ID=Counts.First " .
        "JOIN Tweet as LastTweet " .
        "	 ON LastTweet.ID=Counts.Last; ";

    include '../printJSON.php';
?>