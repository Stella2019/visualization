<?php
    include '../connect.php';

    ini_set('max_execution_time', 300);

    $query = "CALL transfer_tweets_from_old_to_new_table ";

    include '../printJSON.php';
?>