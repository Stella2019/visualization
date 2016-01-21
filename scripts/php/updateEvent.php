<?php
    include 'connect.php';
    
    $query = "";

    if($_POST["type"] == 'collection') {
        $query .= " UPDATE Event";
        $query .= " SET";
            
        $changed = array();
        if(isset($_POST["Type"]) and !empty($_POST["Type"]))
            array_push($changed, " `Type`='" . $_POST["Type"] . "'");
        if(isset($_POST["DisplayName"]) and !empty($_POST["DisplayName"]))
            array_push($changed, " `DisplayName`='" . $_POST["DisplayName"] . "'");
        if(isset($_POST["Description"]) and !empty($_POST["Description"]))
            array_push($changed, " `Description`='" . $_POST["Description"] . "'");
        if(isset($_POST["StartTime"]) and !empty($_POST["StartTime"]))
            array_push($changed, " `StartTime`='" . $_POST["StartTime"] . "'");
        if(isset($_POST["StopTime"]) and !empty($_POST["StopTime"]))
            array_push($changed, " `StopTime`='" . $_POST["StopTime"] . "'");
        if(isset($_POST["TweetsCollected"]) and !empty($_POST["TweetsCollected"]))
            array_push($changed, " `TweetsCollected`=" . $_POST["TweetsCollected"] . "'");
        
        $query .= join(',', $changed);
    } else if($_POST["type"] == 'rumor') {
        $query .= " UPDATE Rumor";
        $query .= " SET";
            
        $changed = array();
        if(isset($_POST["Name"]) and !empty($_POST["Name"]))
            array_push($changed, " `Name`='" . $_POST["Name"] . "'");
        if(isset($_POST["Query"]) and !empty($_POST["Query"]))
            array_push($changed, " `Query`='" . $_POST["Query"] . "'");
        if(isset($_POST["StartTime"]) and !empty($_POST["StartTime"]))
            array_push($changed, " `StartTime`='" . $_POST["StartTime"] . "'");
        if(isset($_POST["StopTime"]) and !empty($_POST["StopTime"]))
            array_push($changed, " `StopTime`='" . $_POST["StopTime"] . "'");
        
        $query .= join(',', $changed);
    }
    
    $query .= " WHERE ID=" . $_POST["id"];

    $result = $mysqli->query($query);
    if (!$result) {
        printf("Error: %s <br>", $mysqli->error);
    } else {
        print("Success!");
    }

    // Get input from user
//    $event_id = $_GET["event_id"];
//    $time_min = $_GET["time_min"];
//    $time_max = $_GET["time_max"];

//    // Execute Query
//    if($_GET["rumor_id"] == '_new_') {
//        // Insert values (presuming they all exist)
//        // otherwise the PHP will terminate with the error
//        $query = "" .
//            "INSERT INTO Rumor " .
//            "(Event_ID, `Name`, Definition, `Query`, StartTime, StopTime) " .
//            " VALUES (" . 
//            $_GET["event_id"] . ", " . 
//            $_GET["name"] . ", " . 
//            $_GET["definition"] . ", " . 
//            $_GET["query"] . ", " . 
//            $_GET["time_min"] . ", " . 
//            $_GET["time_max"] . ") ";
//
//        $result = $mysqli->query($query);
//        if (!$result) {
//            printf("Error: %s <br>", $mysqli->error);
//        }
//
//        // Get the last inserted rumor, so we get the rumor ID
//        $query = "" .
//            "SELECT * FROM Rumor" .
//            " WHERE ID = LAST_INSERT_ID()";
//
//        include 'printJSON.php';
//        
//    } elseif(isset($_GET["update"])) {
//        // Update the entire rumor, right now presuming you have given every field
//        $query = "" .
//            "UPDATE Rumor " .
//            " SET Event_ID = " . $_GET["event_id"] .
//            ", Name = " . $_GET["name"] .
//            ", Definition = " . $_GET["definition"] .
//            ", Query = " . $_GET["query"] .
//            ", StartTime = " . $_GET["time_min"] .
//            ", StopTime = " . $_GET["time_max"] .
//            " WHERE ID = " . $_GET["rumor_id"];
//
//        $result = $mysqli->query($query);
//        if (!$result) {
//            printf("Error: %s <br>", $mysqli->error);
//        } else {
//            print("Success!");
//    } else {
//            
//        // Get the last inserted rumor, so we get the rumor ID
//        $query = "" .
//            "SELECT * FROM Rumor" .
//            " WHERE ID = " . $_GET["rumor_id"];
// 
//        include 'printJSON.php';
//    }

?>