<?php
    include '../connect.php';

    // Values that can be submitted
    $keys = array('Event', 'Subset', 'ActiveUserID', 'SecondUserID',
                  'MentionCount', 'RetweetCount', 'ReplyCount', 'QuoteCount', 'JustMentionCount',
                  'Follower', 'Following', 
                  'MutualFollowers', 'MutualFollowing', 'MutualConnections');

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
    $query = "INSERT INTO UserSocial ";
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