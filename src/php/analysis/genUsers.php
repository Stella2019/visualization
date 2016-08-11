<?php
    include '../connect.php';

    ini_set('max_execution_time', 600);

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
        "    TweetUser.`Tweet` as 'LastTweet', " .
        "    TweetUser.`StatusesCount` as 'StatusesAtStart', " .
        "    TweetUser.`FollowersCount` as 'FollowersAtStart', " .
        "    TweetUser.`FriendsCount` as 'FollowingAtStart', " .
        "    TweetUser.`ListedCount` as 'ListedAtStart', " .
        "    TweetUser.`FavouritesCount` as 'FavoritesAtStart', " .
        "    IF(InCollection.`Type` = 'original', 1, 0) as 'Originals', " .
        "    IF(InCollection.`Type` = 'retweet', 1, 0) as 'Retweets', " .
        "    IF(InCollection.`Type` = 'reply', 1, 0) as 'Replies', " .
        "    IF(InCollection.`Type` = 'quote', 1, 0) as 'Quotes', " .
        "    TweetInCollection.`Distinct` as 'Distinct', " .
        "FROM TweetUser ";

    
    if($subset != "0" and $subset != 0) {
        $query .= "JOIN TweetInSubset TweetInCollection " .
                "	ON TweetUser.`Tweet` = TweetInCollection.Tweet " .
                "   AND TweetInCollection.Subset = $subset ";
    } else {
        $query .= "JOIN TweetInEvent TweetInCollection " .
                "	ON TweetUser.`Tweet` = TweetInCollection.Tweet " .
                "   AND TweetInCollection.Event = $event ";
    }

    $query .= "WHERE TweetUser.`Tweet` >= $tweet_min " .
        "AND TweetUser.`Tweet` <  $tweet_max " .
        "ON DUPLICATE KEY UPDATE " .
        "User.`LastTweet` = TweetUser.`Tweet`, " .
        "User.`Tweets` = User.`Tweets` + 1, " .
        "User.`StatusesGainFirstToLast` = TweetUser.`StatusesCount` - User.'StatusesAtStart', " .
        "User.`FollowersGainFirstToLast` = TweetUser.`FollowersCount` - User.'FollowersAtStart', " .
        "User.`FollowingGainFirstToLast` = TweetUser.`FriendsCount` - User.'FollowingAtStart', " .
        "User.`ListedGainFirstToLast` = TweetUser.`ListedCount` - User.'ListedAtStart', " .
        "User.`FavoritesGainFirstToLast` = TweetUser.`FavoritesCount` as 'FavoritesAtStart', " .
        "User.`Originals` = User.`Tweets` + IF(TweetInCollection.`Type` = 'original', 1, 0), " .
        "User.`Retweets` = User.`Tweets` + IF(TweetInCollection.`Type` = 'retweet', 1, 0), " .
        "User.`Replies` = User.`Tweets` + IF(TweetInCollection.`Type` = 'reply', 1, 0), " .
        "User.`Quotes` = User.`Tweets` + IF(TweetInCollection.`Type` = 'quote', 1, 0), " .
        "User.`Distinct` = User.`Tweets` + TweetInCollection.`Distinct`; ";
    
    $result = $mysqli->query($query);
     
    if(!$result) {
        print ($query);
        print (mysqli_error($mysqli));
    } else {
        print ($result . ' ' . $tweet_max);
    }

    $mysqli->close();
?>