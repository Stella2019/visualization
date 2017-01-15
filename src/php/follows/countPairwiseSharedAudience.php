<?php
    include '../connect.php';

    $userID1 = $_REQUEST['userID1'];
    $userID2 = $_REQUEST['userID2'];
    $SumOfAudiences_Observed = intval($_REQUEST['SumOfAudiences_Observed']);
    $userID1_Audience_Actual = intval($_REQUEST['userID1_Audience_Actual']);
    $userID2_Audience_Actual = intval($_REQUEST['userID2_Audience_Actual']);
    $SumOfAudiences_Actual = $userID1_Audience_Actual + $userID2_Audience_Actual;
    $correction1 = floatval($_REQUEST['correction1']);
    $correction2 = floatval($_REQUEST['correction2']);
    $existingEdge = $_REQUEST['existingEdge'];

    // Execute Query
    $query = "SELECT COUNT(*) as 'SharedAudience' " .
             "FROM Follow A " .
             "JOIN Follow B " .
	         "    ON A.Follower = B.Follower " .
             "    AND A.UserID = $userID1 " .
             "    AND B.UserID = $userID2 ";

    $result = $mysqli->query($query);
    
    // Print query as CSV
    if ($result) {
        // Compute shared and total audience of the followers we were able to retrieve
        $SharedAudience_Observed = intval($result->fetch_row()[0]);
        $TotalAudience_Observed = $SumOfAudiences_Observed - $SharedAudience_Observed;
        $Weight_Observed = $SharedAudience_Observed / $TotalAudience_Observed;
        
        // Compute shared audience (using overcorrection)
        $Correction = $correction1 * $correction2;
        $SharedAudience_Predicted = min($userID1_Audience_Actual, $userID2_Audience_Actual, $SharedAudience_Observed * $Correction);
        
        // Compute predicted weight & total audience from these numbers
        $TotalAudience_Predicted = max($TotalAudience_Observed, $SumOfAudiences_Actual - $SharedAudience_Predicted);
        $Weight_Predicted = min(1, $SharedAudience_Predicted / $TotalAudience_Predicted);
        
        // If the predicted weight is above threshold or already in the table, record it
        $AboveThreshold = $Weight_Predicted > 0.05;
        if (!$existingEdge and !$AboveThreshold) {
            print('"Below Threshold"');
            exit();
        }
        
        // Record this in database
        $query = " INSERT INTO SharedAudience100k " .
                " (UserID1, UserID2, SumOfAudiences_Actual, " .
                "    SharedAudience_Observed, TotalAudience_Observed, " .
                "    Weight_Observed, Correction, " . 
                "    SharedAudience_Predicted, TotalAudience_Predicted, " .
                "    Weight_Predicted, Status) " .
                " VALUES ($userID1, $userID2, $SumOfAudiences_Actual, " .
                "     $SharedAudience_Observed, $TotalAudience_Observed, " .
                "     $Weight_Observed, $Correction, " .
                "     $SharedAudience_Predicted, $TotalAudience_Predicted, " .
                "     $Weight_Predicted, 'New')" .
                " ON DUPLICATE KEY UPDATE " .
                "     SumOfAudiences_Actual = $SumOfAudiences_Actual, " .
                "     SharedAudience_Observed = $SharedAudience_Observed, " .
                "     TotalAudience_Observed = $TotalAudience_Observed, " .
                "     Weight_Observed = $Weight_Observed, " .
                "     Correction = $Correction, " .
                "     SharedAudience_Predicted = $SharedAudience_Predicted, " .
                "     TotalAudience_Predicted = $TotalAudience_Predicted, " .
                "     Weight_Predicted = $Weight_Predicted;";
        $result = $mysqli->query($query);
        
        if ($result) {
            print($Weight_Predicted);
        } else {
            printf("Errormessage: %s <br>", $mysqli->error);
        }
        
    } else {
        printf("Errormessage: %s <br>", $mysqli->error);
    }
     
    $mysqli->close();
?>