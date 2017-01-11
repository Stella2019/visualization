<?php
    include '../connect.php';

    # Get Variables
    $userID = $_REQUEST['userID'];

    # Run Query
    $query = "SELECT Follower FROM Follow ";
    
    if(isset($_REQUEST['following']) and $_REQUEST['following'] == 1) {
        $query .= "WHERE Follower = $userID;";
    } else {
        $query .= "WHERE UserID = $userID;";
    }

    include '../printResults.php';
?>