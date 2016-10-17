<?php
    include '../connect.php';

    ini_set('max_execution_time', 300);

    // Execute Query
    if(!isset($_REQUEST['Collection']) or !isset($_REQUEST['ID'])) {
        die('<b>Error</b>: Need to provide collection and id.');
    }

    $query = "CALL compute_" . $_REQUEST['Collection'] . "_users" . 
        "(" . $_REQUEST['ID'] . ", " . $_REQUEST['tweet_min'] . ", " . $_REQUEST['tweet_max'] . ");";

    include '../printJSON.php';
?>