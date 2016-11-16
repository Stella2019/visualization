<?php
    include '../connect.php';
    
    $eventfields_updatable = array('Type', 'DisplayName', 'Description',
                         'StartTime', 'StopTime', 'UTCOffset',
                         'Active', 'TweetSource');
    $eventfields = array('ID', 'Name', 'Keywords', 
                         'Type', 'DisplayName', 'Description',
                         'StartTime', 'StopTime', 'UTCOffset',
                         'Active', 'TweetSource');
    $subsetfields = array('Name', 'Query', 'Definition',
                         'StartTime', 'StopTime');
    $query = "";

    if($_REQUEST["type"] == 'event') {
        // Start Insert statement
        $query .= " INSERT INTO Event ";
        
        // Add all eventfields (if this is a new event)
        $fields_provided = array();
        $fields = array();
        foreach($eventfields as $field) {
            if(isset($_REQUEST[$field])) {
                array_push($fields_provided, $field);
                array_push($field_values, "'$_REQUEST[$field]'");
            }
        }
        $query .= " (`" . join('`, `', $fields_provided) . "`)";
        $query .= " VALUES (" .join(',', $field_values). ")";
        
        // Update existing event if that's the case
        $query .= " ON DUPLICATE KEY UPDATE ";
        $changed = array();
        foreach($eventfields_updatable as $field) {
            if(isset($_REQUEST[$field])) {
                 array_push($changed, " `$field`='$_REQUEST[$field]'");
            }
        }
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
        
        $query .= " WHERE ID=" . $_REQUEST["ID"];
    }

    echo $query;

    $result = $mysqli->query($query);
    if (!$result) {
        printf("\n Error: %s <br>", $mysqli->error);
    } else {
        print("\n Success!");
    }
?>