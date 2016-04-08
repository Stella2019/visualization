<?php
    include '../connect.php';
    
    $query = "";

    if($_POST["type"] == 'event') {
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
        
        $query .= join(',', $changed);
    } else if($_POST["type"] == 'rumor') {
        $query .= " UPDATE Rumor";
        $query .= " SET";
            
        $changed = array();
        if(isset($_POST["Name"]) and !empty($_POST["Name"]))
            array_push($changed, " `Name`='" . $_POST["Name"] . "'");
        if(isset($_POST["Query"]) and !empty($_POST["Query"]))
            array_push($changed, " `Query`='" . $_POST["Query"] . "'");
        if(isset($_POST["Definition"]) and !empty($_POST["Definition"]))
            array_push($changed, " `Definition`='" . $_POST["Definition"] . "'");
        if(isset($_POST["StartTime"]) and !empty($_POST["StartTime"]))
            array_push($changed, " `StartTime`='" . $_POST["StartTime"] . "'");
        if(isset($_POST["StopTime"]) and !empty($_POST["StopTime"]))
            array_push($changed, " `StopTime`='" . $_POST["StopTime"] . "'");
        
        $query .= join(',', $changed);
    }
    
    $query .= " WHERE ID=" . $_POST["id"];

    echo $query;

    $result = $mysqli->query($query);
    if (!$result) {
        printf("\n Error: %s <br>", $mysqli->error);
    } else {
        print("\n Success!");
    }
?>