<?php
    include '../connect.php';

    // Execute Query
    $query = "SELECT UserID ".
             "FROM UserDataQueue; ";

    include '../printResults.php';
?>