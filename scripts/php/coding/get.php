<?php
    include '../connect.php';

    $query = "" .
        "CALL RumorCodes(" . $_POST['rumor_id']. ", " . $_POST['period']. ")";

    include '../printJSON.php';
?>