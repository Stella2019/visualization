<?php
    include '../connect.php';

    # Correct Timezone
    $query = "SET time_zone = '+00:00'";
    $result = $mysqli->query($query);

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

    // Assemble Query
    $query = "SELECT $collection, ";

    if(isset($_REQUEST['time_resolution']) and $_REQUEST['time_resolution'] <> 1) {
        $time_resolution = $_REQUEST['time_resolution'];
        $query .= " FROM_UNIXTIME((UNIX_TIMESTAMP(`Time`) div ($time_resolution*60))*($time_resolution*60)) as 'Time', ";
    } else {
        $query .= " Time, ";
    }

    $query .= " Original, Retweet, Reply, Quote, " .
             " OriginalDistinct, RetweetDistinct, ReplyDistinct, QuoteDistinct, " .
             " OriginalExposure, RetweetExposure, ReplyExposure, QuoteExposure " .
             "FROM ${collection}Timeseries " .
             "WHERE ${collection} = ${collection_id}";

    $lt = (isset($_REQUEST["inclusive_max"]) ? '<=' : '<');
    if(isset($_REQUEST["time_min"])) {
        $query .= " AND `Time` >= '" . $_REQUEST["time_min"] . "'";
    }
    if(isset($_REQUEST["time_max"])) {
        $query .= " AND `Time` $lt '" . $_REQUEST["time_max"] . "'";
    }
    
    if(isset($_REQUEST['time_resolution']) and $_REQUEST['time_resolution'] <> 1) {
        $query .= " GROUP BY 2 ";
    }

    if(isset($_REQUEST["limit"])) {
        $query .= " LIMIT " . $_REQUEST["limit"];
    }

    if(isset($_REQUEST["csv"])) {
        include '../exportToCSV.php';
    } else if(isset($_REQUEST["json"])) {
        include '../printJSON.php';
    } else {
        include '../printResults.php';
    }
?>