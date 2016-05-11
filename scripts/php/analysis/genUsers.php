<?php
    include '../connect.php';

    ini_set('max_execution_time', 240);

    // Get parameters
    $event = $_REQUEST['event'];
    $subset = $_REQUEST['subset'];
    $tweet_min = $_REQUEST['tweet_min'];
    $tweet_max = $_REQUEST['tweet_max'];


    $query = "INSERT INTO User " .
        "(`Event`, `Subset`, `UserID`, `Screenname`, `Tweets`, `FirstTweet`, `LastTweet`) " .
        "SELECT " .
        "	 $event as 'Event', " .
        "    $subset as 'Subset', " .
        "    TweetUser.`UserID` as 'UserID', " .
        "    TweetUser.`Screenname` as 'Screenname', " .
        "    1 as 'Tweets', " .
        "    TweetUser.`Tweet` as 'FirstTweet', " .
        "    TweetUser.`Tweet` as 'LastTweet' " .
        "FROM TweetUser ";

    
    if($subset != "0" and $subset != 0) {
        $query .= "JOIN InSubset " .
                "	ON TweetUser.`Tweet` = InSubset.Tweet " .
                "   AND InSubset.Subset = $subset ";
    } else {
        $query .= "JOIN InEvent " .
                "	ON TweetUser.`Tweet` = InEvent.Tweet " .
                "   AND InEvent.Event = $event ";
    }

    $query .= "WHERE TweetUser.`Tweet` >= $tweet_min " .
        "AND TweetUser.`Tweet` <  $tweet_max " .
        "ON DUPLICATE KEY UPDATE " .
        "User.`LastTweet` = TweetUser.`Tweet`, " .
        "User.`Tweets` = User.`Tweets` + 1; ";
    
    $result = $mysqli->query($query);
     
    if(!$result) {
        print ($query);
        print (mysqli_error($mysqli));
    } else {
        print ($result);
    }

    $mysqli->close();
?>