<?php
    include 'connect.php';

    // Execute Query
    $query = "SELECT * FROM Rumor";
    $query .= " WHERE Event_ID=" . $_GET["event_id"];

    include 'printJSON.php';
?>