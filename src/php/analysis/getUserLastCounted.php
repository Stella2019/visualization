<?php
    include '../connect.php';

    // Execute Query
    if(!isset($_REQUEST['Collection']) or !isset($_REQUEST['ID'])) {
        die('<b>Error</b>: Need to provide collection and id.');
    }

    $collection = $_REQUEST['Collection'];
    $id = $_REQUEST['ID'];
    
    $query = "SELECT MAX(LastTweetID) FROM UserIn$collection WHERE ${collection}ID=$id;";

    include '../printJSON.php';
?>