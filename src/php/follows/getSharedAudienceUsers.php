<?php
    include '../connect.php';

    // Execute Query
    $query = "SELECT * ".
             "FROM SharedAudienceUser; ";

    include '../printJSON.php';
?>