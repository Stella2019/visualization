<?php
    include '../connect.php';

    # Get Variables
    if(!isset($_REQUEST['collection']) or !isset($_REQUEST['collection_id'])) {
        die('<b>Error</b>: Need to provide collection and id.');
    }

    $collection = $_REQUEST['collection'];
    $collection_id = $_REQUEST['collection_id'];

    # Validation
    assert_options(ASSERT_BAIL, 1);
    assert("in_array('$collection', array('Event', 'Subset'))");
    assert("is_numeric($collection_id)");

    // Execute Query
    $query = "SELECT * ".
             "FROM ${collection}Timeseries " .
             "WHERE ${collection} = ${collection_id}";

    $lt = (isset($_REQUEST["inclusive_max"]) ? '<=' : '<');
    if(isset($_REQUEST["time_min"])) {
        $query = $query . " AND Time >= '" . $_REQUEST["time_min"] . "'";
    }
    if(isset($_REQUEST["time_max"])) {
        $query .= " AND Time $lt '" . $_REQUEST["time_max"] . "'";
    }

    if(isset($_REQUEST["limit"])) {
        // Add ORDER BY Time?
        $query .= " LIMIT " . $_REQUEST["limit"];
    }
//    $query = $query .
//        " ORDER BY Time; ";

    if(isset($_REQUEST["csv"])) {
        include '../exportToCSV.php';
    } else if(isset($_REQUEST["json"])) {
        include '../printJSON.php';
    } else {
        include '../printResults.php';
    }
?>