<?php
    include '../connect.php';

    // Execute Query
    if(!isset($_REQUEST['Collection']) or !isset($_REQUEST['Quantity']) or !isset($_REQUEST['ID'])) {
        die('Need to provide collection and quantity.');
    }

    $query = "CALL count_" . $_REQUEST['Collection'] . "_" . $_REQUEST['Quantity'] . "(" . $_REQUEST['ID'] . ");";

    include '../printJSON.php';
?>