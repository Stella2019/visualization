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
            $_GET["name"] . ", " . 
            $_GET["definition"] . ", " . 
            $_GET["query"] . ", " . 
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
        
    } elseif(isset($_GET["update"])) {
        // Update the entire rumor, right now presuming you have given every field
        $query = "" .
            "UPDATE Rumor " .
            " SET Event_ID = " . $_GET["event_id"] .
            ", Name = " . $_GET["name"] .
            ", Definition = " . $_GET["definition"] .
            ", Query = " . $_GET["query"] .
            ", StartTime = " . $_GET["time_min"] .
            ", StopTime = " . $_GET["time_max"] .
            " WHERE ID = " . $_GET["rumor_id"];

        $result = $mysqli->query($query);
        if (!$result) {
            printf("Error: %s <br>", $mysqli->error);
        } else {
            print("Success!");
    } else {
            
        // Get the last inserted rumor, so we get the rumor ID
        $query = "" .
            "SELECT * FROM Rumor" .
            " WHERE ID = " . $_GET["rumor_id"];
 
        include 'printJSON.php';
    }

?>