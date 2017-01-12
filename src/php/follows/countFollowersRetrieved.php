<?php
    include '../connect.php';

    $userID = $_REQUEST['userID'];

    // Execute Query
    $query = "SELECT COUNT(*) as 'FollowersRetrieved' " .
             "FROM Follow " .
             "WHERE UserID = $userID";

    $result = $mysqli->query($query);
    
    // Print query as CSV
    if ($result) {
        $FollowersRetrieved = $result->fetch_row()[0];
        
        $query = "UPDATE SharedAudienceUser " .
                 "SET FollowersRetrieved = $FollowersRetrieved " .
                 "WHERE UserID = $userID;";
        $result = $mysqli->query($query);
        
        if ($result) {
            print($FollowersRetrieved);
        } else {
            printf("Errormessage: %s <br>", $mysqli->error);
        }
        
    } else {
        printf("Errormessage: %s <br>", $mysqli->error);
    }
     
    $mysqli->close();
?>