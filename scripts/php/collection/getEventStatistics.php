<?php
    include '../connect.php';

    // Execute Query
    $query = "" .
        "SELECT `Event_ID` as ID, " .
        "   COUNT(*) as Tweets, " .
        "   MIN(Tweet_ID) as First, " .
        "   MAX(Tweet_ID) as Last " .
		"FROM TweetInEvent " .
		"GROUP BY `Event_ID`; ";

    include '../printJSON.php';
?>