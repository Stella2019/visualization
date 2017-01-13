<?php
    include '../connect.php';

    // Execute Query
    $query = "SELECT UserID ".
             "FROM UserDataQueue; ";
//    $query = "SELECT UserID ".
//             "FROM UserInSubset WHERE SubsetID=2637; ";

    include '../printResults.php';
?>