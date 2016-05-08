<?php
    include '../connect.php';

    // Execute Query
    $query = "SELECT * ".
             "FROM " . $_REQUEST["collection"] . "Timeseries " .
             "WHERE " . $_REQUEST["collection"] . " = " . $_REQUEST["id"];

    if(isset($_REQUEST["time_min"])) {
        $query = $query . " AND Time >= '" . $_REQUEST["time_min"] . "'";
    }
    if(isset($_REQUEST["time_max"])) {
        $query = $query . " AND Time < '" . $_REQUEST["time_max"] . "'";
    }

//    $query = $query .
//        " ORDER BY Time; ";

    include '../printResults.php';
?>