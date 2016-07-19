<?php
    include '../connect.php';

    ini_set('max_execution_time', 300);

    $query = "" .
        "CALL get_tweets_inrumor_inperiod(" . $_REQUEST['rumor_id']. ", " . $_REQUEST['period']. ")";

    include '../printJSON.php';
?>