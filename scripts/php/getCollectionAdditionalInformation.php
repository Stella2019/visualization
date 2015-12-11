<?php
    include 'connect.php';

    // Get input from user
    $table_id = $_GET["table_id"];

    // Execute Query
    $query = "SELECT COUNT(*) as Count, TweetInEvent.Event_ID as ID " .
	         "FROM TweetInEvent " .
	         "GROUP BY TweetInEvent.Event_ID";

    include 'printJSON.php';
?>