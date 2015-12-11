<?php
    include 'connect.php';

    // Get Fields
    $event_id = $_GET["event_id"];
    $keyword = $_GET["keyword"];

    // Execute Query
    $query = "" .
        "SELECT COUNT(*), MAX(TC.Time) " .
        "FROM EventTweetCount TC " .
        "WHERE TC.Event_ID = " . $event_id .
        "    AND TC.Keyword = '" . $keyword . "' " .
        "GROUP BY TC.Keyword";

    include 'printJSON.php';
?>