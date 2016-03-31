<?php
    include '../connect.php';

    // Execute Query
    if(!isset($_REQUEST['Collection']) or !isset($_REQUEST['ID'])) {
        die('Need to provide collection and id.');
    }

    $query = "CALL count_tweets_in_" . $_REQUEST['Collection'] . "(" . $_REQUEST['ID'] . ");";

    include '../printJSON.php';
?>