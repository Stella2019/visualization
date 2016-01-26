<?php
    include '../connect.php';

    // Get input from user
    $keyword = $_POST["keyword"];
    $event_id = $_POST["event_id"];

    // First delete all of the TweetIn[Collection]
    $query = "" .
        "DELETE " .
        "FROM TweetCount " .
        "WHERE Keyword=" . $keyword . " ";
        "AND Event_ID=" . $event_id . " ; ";

    $result = $mysqli->query($query);
     
    print $query;

    $mysqli->close();
?>