<?php
    include '../connect.php';

    $query = "" .
        "CALL RumorCodesTweets(" . $_POST['rumor_id']. ", " . $_POST['period']. ")";

    include '../printJSON.php';
?>