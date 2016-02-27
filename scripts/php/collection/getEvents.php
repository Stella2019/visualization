<?php
    include '../connect.php';

    // Execute Query
    $query = "SELECT * " .
             "FROM Event " .
             "WHERE Active = 1;";

    include '../printJSON.php';
?>