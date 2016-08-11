<?php
    include '../connect.php';

    // Values that can be submitted
    $keys = array('Event', 'Subset', 'ActiveUserID', 'MentionedUserID',
                  'Mentions', 'Retweets', 'Replies', 'Quotes', 
                  'Follower', 'Following', 
                  'MutualFollowers', 'MutualFollowing', 'MutualConnections',
                  'CombinedFollowers', 'CombinedFollowing', 'CombinedConnections',
                  'FractionMutualFollowers', 'FractionMutualFollowing', 'FractionsMutualConnections',
                  'MutualWords', 'CombinedWords', 'FractionMutualWords', 
                  'MutualDescWords', 'CombinedDescWords', 'FractionMutualDescWords');

    // Get values
    $keys_used = array();
    $values = array();
    $update = array();
    foreach($keys as $key) {
        if(isset($_REQUEST[$key])) {
            $keys_used[] = $key;
            $values[] = $_REQUEST[$key];
            if($key <> 'Event' and $key <> 'Subset' and $key <> 'UserID') {
                $update[] = "`$key` = '$_REQUEST[$key]'";
            }
        }
    }
    
    // Insert stats into user table
    $query = "INSERT INTO UserConnection ";
    $query .= " (`" . join("`, `", $keys_used) . "`) ";


    $query .= "VALUES ('" . join("', '", $values) . "') ";
    $query .= 'ON DUPLICATE KEY UPDATE ' . join(", ", $update) . ';';

    $result = $mysqli->query($query);

    if(!$result) {
        print ($query);
        print (mysqli_error($mysqli));
    } else {
        print ($result);
    }

    $mysqli->close();
?>