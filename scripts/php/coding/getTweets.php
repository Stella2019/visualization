<?php
    include '../connect.php';

    ini_set('max_execution_time', 300);

    $query = "" .
        "CALL RumorCodesTweets(" . $_POST['rumor_id']. ", " . $_POST['period']. ")";

    include '../printJSON.php';
?>