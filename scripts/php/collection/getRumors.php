<?php
    include '../connect.php';
    
    // Execute Query
    $query = "SELECT * FROM Rumor";
    if(ISSET($_POST["event_id"]))
        $query .= " WHERE Event_ID=" . $_POST["event_id"];

    include '../printJSON.php';
?>