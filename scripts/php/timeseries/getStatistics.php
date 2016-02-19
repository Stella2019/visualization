<?php
    include '../connect.php';

    // Execute Query
    $query = "SELECT ".
             "    Event_ID as ID, ".
             "    COUNT(DISTINCT(`Time`)) as Count, ".
             "    MIN(`Time`) as First, ".
             "    MAX(`Time`) as Last ".
             "FROM TweetCount " .
             "GROUP BY Event_ID;";

    include '../printJSON.php';
?>