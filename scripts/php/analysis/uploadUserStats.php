<?php
    include '../connect.php';

    // Parameters
    $keys = array('Event', 'Subset', 'UserID', 'Screenname', 'Tweets', 'FirstTweet', 'LastTweet', 'TweetsPerDay', 'MinutesInSet', 'MinuteStarted', 'MinuteEnded', 'StatusesAtStart', 'FollowersAtStart', 'FollowingAtStart', 'ListedAtStart', 'FavoritesAtStart', 'StatusesGainFirstToLast', 'FollowersGainFirstToLast', 'FollowingGainFirstToLast', 'ListedGainFirstToLast', 'FavoritesGainFirstToLast', 'StatusesGainPerDay', 'FollowersGainPerDay', 'FollowingGainPerDay', 'ListedGainPerDay', 'FavoritesGainPerDay', 'Originals', 'Retweets', 'Replies', 'Quotes', 'Distinct', 'FractionOriginals', 'FractionRetweets', 'FractionReplies', 'FractionQuotes', 'FractionDistinct', 'Age', 'MinMinutesBetweenTweets', 'MaxMinutesBetweenTweets', 'AveMinutesBetweenTweets', 'MedMinutesBetweenTweets', 'DevMinutesBetweenTweets', 'NormDevMinutesBetweenTweets', 'LexiconSize', 'LexiconSizePerTweet', 'LexiconSizePerLogTweet');

    // Get values
    $values = array();
    $update = array();
//    $kvpairs = (object) [];
    foreach($keys as $key) {
        if(isset($_REQUEST[$key])) {
            $values[] = $_REQUEST[$key];
            if($key <> 'Event' and $key <> 'Subset' and $key <> 'UserID') {
                $update[] = "`$key` = '$_REQUEST[$key]'";
            }
//            $kvpairs[$key] = $_REQUEST[$key];
        } else {
            die('Missing key: ' . $key);
        }
    }

    // require other programs: 'Bot', 'TRSBot', 'TruthyScore'
    //'OthersMentioned', 'OthersRetweeted', 'OthersRepliedTo', 'OthersQuoted',
    
    // Insert stats into user table
    $query = "INSERT INTO User ";
    $query .= " (`" . join("`, `", $keys) . "`) ";


    $query .= "VALUES ('" . join("', '", $values) . "') ";
    $query .= 'ON DUPLICATE KEY UPDATE ' . join(", ", $update) . ';';
        
//    foreach($kvpairs as $key -> $value) {
//        $query .= "$key = $value";
//    }
    // On duplicate key update all

    $result = $mysqli->query($query);
     
    print $result;

    $mysqli->close();
?>