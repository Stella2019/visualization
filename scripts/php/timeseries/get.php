<?php
    include '../connect.php';

    // Execute Query
    $query = "SELECT * ".
             "FROM " . $_REQUEST["collection"] . "Timeseries " .
             "WHERE " . $_REQUEST["collection"] . " = " . $_REQUEST["id"];

    if(isset($_REQUEST["min"])) {
        $query = $query . " AND Time >= '" . $_REQUEST["min"] . "'";
    }
    if(isset($_REQUEST["max"])) {
        $query = $query . " AND Time < '" . $_REQUEST["max"] . "'";
    }

//    $query = $query .
//        " ORDER BY Time; ";

    include '../printResults.php';
?>