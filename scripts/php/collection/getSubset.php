<?php
    include '../connect.php';

    // Setup Query
    $query = "SELECT * " .
             "FROM Subset ";

    // Query Conditions
    $conds = array();
    if(isset($_REQUEST["event"]))
        $conds[] = "`Event` = " . $_REQUEST["event"] . " ";
    if(isset($_REQUEST["subset"]))
        $conds[] = "`ID` = '" . $_REQUEST["subset"] . "' ";
    if(isset($_REQUEST["active"]))
        $conds[] = "`Active` = '" . $_REQUEST["active"] . "' ";

    if(!empty($conds))
        $query .= " WHERE " . join(" AND " , $conds);

    // Execute and print as JSON
    include '../printJSON.php';
?>