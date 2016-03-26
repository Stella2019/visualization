<?php
    include '../connect.php';

    // Setup Query
    $query = "SELECT * " .
             "FROM Event ";

    // Query Conditions
    $conds = array();
    if(isset($_REQUEST["event"]))
        $conds[] = "`ID` IS '" . $_REQUEST["event"] . "' ";
    if(isset($_REQUEST["active"]))
        $conds[] = "`Active` IS '" . $_REQUEST["active"] . "' ";

    if(!empty($conds))
        $query .= " WHERE " . join(" AND " , $conds);

    // Execute and print as JSON
    include '../printJSON.php';
?>