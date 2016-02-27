<?php
    include '../connect.php';
    
    // Execute Query
    $query = "SELECT * FROM Rumor";
    if(ISSET($_POST["event_id"])) {
        $query .= " WHERE Event_ID = " . $_POST["event_id"] .
             " AND Active = 1;";
    } else {
        $query .= ' WHERE Active = 1;';
    }

    include '../printJSON.php';
?>