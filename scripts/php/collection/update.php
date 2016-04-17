<?php
    include '../connect.php';
    
    $query = "";

    if($_REQUEST["type"] == 'event') {
        $query .= " UPDATE Event";
        $query .= " SET";
            
        $changed = array();
        if(isset($_REQUEST["Type"]) and !empty($_REQUEST["Type"]))
            array_push($changed, " `Type`='" . $_REQUEST["Type"] . "'");
        if(isset($_REQUEST["DisplayName"]) and !empty($_REQUEST["DisplayName"]))
            array_push($changed, " `DisplayName`='" . $_REQUEST["DisplayName"] . "'");
        if(isset($_REQUEST["Description"]) and !empty($_REQUEST["Description"]))
            array_push($changed, " `Description`='" . $_REQUEST["Description"] . "'");
        if(isset($_REQUEST["StartTime"]) and !empty($_REQUEST["StartTime"]))
            array_push($changed, " `StartTime`='" . $_REQUEST["StartTime"] . "'");
        if(isset($_REQUEST["StopTime"]) and !empty($_REQUEST["StopTime"]))
            array_push($changed, " `StopTime`='" . $_REQUEST["StopTime"] . "'");
        if(isset($_REQUEST["Active"]) and !empty($_REQUEST["Active"]))
            array_push($changed, " `Active`=" . $_REQUEST["Active"] . " ");
        
        $query .= join(',', $changed);
    } else if($_REQUEST["type"] == 'rumor') {
        $query .= " UPDATE Rumor";
        $query .= " SET";
            
        $changed = array();
        if(isset($_REQUEST["Name"]) and !empty($_REQUEST["Name"]))
            array_push($changed, " `Name`='" . $_REQUEST["Name"] . "'");
        if(isset($_REQUEST["Query"]) and !empty($_REQUEST["Query"]))
            array_push($changed, " `Query`='" . $_REQUEST["Query"] . "'");
        if(isset($_REQUEST["Definition"]) and !empty($_REQUEST["Definition"]))
            array_push($changed, " `Definition`='" . $_REQUEST["Definition"] . "'");
        if(isset($_REQUEST["StartTime"]) and !empty($_REQUEST["StartTime"]))
            array_push($changed, " `StartTime`='" . $_REQUEST["StartTime"] . "'");
        if(isset($_REQUEST["StopTime"]) and !empty($_REQUEST["StopTime"]))
            array_push($changed, " `StopTime`='" . $_REQUEST["StopTime"] . "'");
        
        $query .= join(',', $changed);
    }
    
    $query .= " WHERE ID=" . $_REQUEST["id"];

    echo $query;

    $result = $mysqli->query($query);
    if (!$result) {
        printf("\n Error: %s <br>", $mysqli->error);
    } else {
        print("\n Success!");
    }
?>