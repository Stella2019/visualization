<?php
    include '../connect.php';

    $query = "" .
        "CALL RumorCodes(" . $_POST['rumor_id']. ", 'primary')";

    include '../printJSON.php';
?>