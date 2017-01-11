<?php
    include '../connectDestination.php';

    # Get Variables
    $userID = $_REQUEST['userID'];
    $followers = split(',', $_REQUEST['followers']);

    # Run Query

    $query = "INSERT IGNORE INTO Follow (UserID, Follower)";
     
    if(isset($_REQUEST['following']) and $_REQUEST['following'] == 1) {
        $query .= " VALUES (" . join(", $userID), (", $followers) . ", $userID);";
    } else {
        $query .= " VALUES ($userID, " . join("), ($userID,", $followers) . ");";
    }

    #print($query);

    $result = $mysqli->query($query);
    
    // Print query as CSV
    if ($result) {
        print($result);
    } else {
        printf("Errormessage: %s <br>", $mysqli->error);
    }
     
    $mysqli->close();
?>