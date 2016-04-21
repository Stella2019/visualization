<?php
    include '../connect.php';

    // Execute Query
    if(isset($_REQUEST["rumor"]) and $_REQUEST["rumor"] == '_new_') {
        // Insert values (presuming they all exist)
        // otherwise the PHP will terminate with the error
        $query = "" .
            "INSERT INTO Rumor " .
            "(Event_ID, `Name`) " .
            " VALUES (" . 
            $_REQUEST["event"] . ", " . 
            "'New Rumor') ";

        $result = $mysqli->query($query);
        if (!$result) {
            printf("Error: %s <br>", $mysqli->error);
        }

        // Get the last inserted rumor, so we get the rumor ID
        $query = "" .
            "SELECT * FROM Rumor" .
            " WHERE ID = LAST_INSERT_ID()";

        include '../printJSON.php';
        
    } else {
            
        // Get the last inserted rumor, so we get the rumor ID
        $query = "" .
            "SELECT * FROM Rumor" .
            " WHERE ID = " . $_REQUEST["rumor"];
        
        // Setup Query
        $query = "SELECT * " .
                 "FROM Rumor ";

        // Query Conditions
        $conds = array();
        if(isset($_REQUEST["event"]))
            $conds[] = "`Event` = " . $_REQUEST["event"] . " ";
        if(isset($_REQUEST["rumor"]))
            $conds[] = "`ID` = '" . $_REQUEST["rumor"] . "' ";
        if(isset($_REQUEST["active"]))
            $conds[] = "`Active` = '" . $_REQUEST["active"] . "' ";

        if(!empty($conds))
            $query .= " WHERE " . join(" AND " , $conds);
 
        include '../printJSON.php';
    }

?>