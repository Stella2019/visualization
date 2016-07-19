<?php
    include '../connect.php';

    $query = "" .
        "CALL get_codes_inrumor_inperiod(" . $_POST['rumor_id']. ", " . $_POST['period']. ")";

    include '../printJSON.php';
?>