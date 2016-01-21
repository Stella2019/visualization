<?php
    include 'connect.php';

    // Get input from user
//    $event_id = $_GET["event_id"];
//    $time_min = $_GET["time_min"];
//    $time_max = $_GET["time_max"];

    // Execute Query
    if($_GET["rumor_id"] == '_new_') {
        // Insert values (presuming they all exist)
        // otherwise the PHP will terminate with the error
        $query = "" .
            "INSERT INTO Rumor " .
            "(Event_ID, `Name`, Definition, `Query`, StartTime, StopTime) " .
            " VALUES (" . 
            $_GET["event_id"] . ", " . 
            "'New Rumor'" . ", " . 
            "''" . ", " . 
            "''" . ", " . 
            $_GET["time_min"] . ", " . 
            $_GET["time_max"] . ") ";

        $result = $mysqli->query($query);
        if (!$result) {
            printf("Error: %s <br>", $mysqli->error);
        }

        // Get the last inserted rumor, so we get the rumor ID
        $query = "" .
            "SELECT * FROM Rumor" .
            " WHERE ID = LAST_INSERT_ID()";

        include 'printJSON.php';
        
    } else {
            
        // Get the last inserted rumor, so we get the rumor ID
        $query = "" .
            "SELECT * FROM Rumor" .
            " WHERE ID = " . $_GET["rumor_id"];
 
        include 'printJSON.php';
    }

?>