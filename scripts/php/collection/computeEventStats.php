<?php
    include '../connect.php';

    // Get parameters
    $event = $_REQUEST['event'];

    // Execute Query
    $query = "" .
        "UPDATE Event " .
        "SELECT `Event_ID` as ID, " .
        "   COUNT(*) as Tweets, " .
        "   MIN(`Tweet`) as FirstTweet, " .
        "   MAX(`Tweet`) as LastTweet " .
        "FROM InEvent " .
        "WHERE `Event` is " .  $event;

    // Execute query & print
    include '../printJSON.php';
?>