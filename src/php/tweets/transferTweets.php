<?php
    include '../connect.php';

    $query = "CALL transfer_tweets_from_old_to_new_table ";

    include '../printJSON.php';
?>