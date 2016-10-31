<?php
    include '../connect.php';

    // Execute Query
    if(!isset($_REQUEST['Collection']) or !isset($_REQUEST['ID'])) {
        die('<b>Error</b>: Need to provide collection and id.');
    }
    $collection = $_REQUEST['Collection'];
    $collection_id = $_REQUEST['ID'];
    $tweet_min = $_REQUEST['tweet_min'];
    $tweet_max = $_REQUEST['tweet_max'];

    $query = "CALL compute_${collection}_timeseries" . 
        "($collection_id, $tweet_min, $tweet_max);";

    include '../printJSON.php';
?>