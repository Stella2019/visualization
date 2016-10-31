<?php
    include '../connect.php';

    $collection = $_REQUEST["collection"];
    $collection_id = $_REQUEST["collection_id"];

    // Execute Query
    $query = "SELECT * ".
             "FROM ${collection}Timeseries " .
             "WHERE ${collection} = ${collection_id}";

    $lt = (isset($_REQUEST["inclusive_max"]) ? '<=' : '<');
    if(isset($_REQUEST["time_min"])) {
        $query = $query . " AND Time >= '" . $_REQUEST["time_min"] . "'";
    }
    if(isset($_REQUEST["time_max"])) {
        $query = $query . " AND Time $lt '" . $_REQUEST["time_max"] . "'";
    }

//    $query = $query .
//        " ORDER BY Time; ";

    include '../printResults.php';
?>