<?php
    include '../connect.php';

    ini_set('max_execution_time', 1200);

    // Get parameters
    $event = $_REQUEST['event'];
    $subset = $_REQUEST['subset'];
    $tweet_min = $_REQUEST['tweet_min'];
    $tweet_max = $_REQUEST['tweet_max'];


    $query = "INSERT INTO UserSimple " .
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
        $query .= "JOIN InSubset TweetInCollection " .
                "	ON TweetUser.`Tweet` = TweetInCollection.Tweet " .
                "   AND TweetInCollection.Subset = $subset ";
    } else {
        $query .= "JOIN InEvent TweetInCollection " .
                "	ON TweetUser.`Tweet` = TweetInCollection.Tweet " .
                "   AND TweetInCollection.Event = $event ";
    }

    $query .= "WHERE TweetUser.`Tweet` >= $tweet_min " .
        "AND TweetUser.`Tweet` <  $tweet_max " .
        "ON DUPLICATE KEY UPDATE " .
        "UserSimple.`LastTweet` = TweetUser.`Tweet`, " .
        "UserSimple.`Tweets` = UserSimple.`Tweets` + 1; ";
    
    $result = $mysqli->query($query);
     
    if(!$result) {
        print ($query);
        print (mysqli_error($mysqli));
    } else {
        print ($result . ' ' . $tweet_max);
    }

    $mysqli->close();
?>