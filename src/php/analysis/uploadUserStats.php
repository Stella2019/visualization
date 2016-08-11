<?php
    include '../connect.php';

    // Parameters
//    $keys = array('Event', 'Subset', 'UserID', 'Screenname', 'Tweets', 'FirstTweet', 'LastTweet', 'TweetsPerDay', 'MinutesInSet', 'MinuteStarted', 'MinuteEnded', 'StatusesAtStart', 'FollowersAtStart', 'FollowingAtStart', 'ListedAtStart', 'FavoritesAtStart', 'StatusesGainFirstToLast', 'FollowersGainFirstToLast', 'FollowingGainFirstToLast', 'ListedGainFirstToLast', 'FavoritesGainFirstToLast', 'StatusesGainPerDay', 'FollowersGainPerDay', 'FollowingGainPerDay', 'ListedGainPerDay', 'FavoritesGainPerDay', 'Originals', 'Retweets', 'Replies', 'Quotes', 'Distinct', 'FractionOriginals', 'FractionRetweets', 'FractionReplies', 'FractionQuotes', 'FractionDistinct', 'Age', 'MinMinutesBetweenTweets', 'MaxMinutesBetweenTweets', 'AveMinutesBetweenTweets', 'MedMinutesBetweenTweets', 'DevMinutesBetweenTweets', 'NormDevMinutesBetweenTweets', 'LexiconSize', 'LexiconSizePerTweet', 'LexiconSizePerLogTweet');
    $keys = array('Event', 'Subset', 'UserID', 'Screenname', 'Tweets', 'FirstTweet', 'LastTweet', 'TweetsPerDay', 'MinutesInSet', 'MinuteStarted', 'MinuteEnded', 'StatusesAtStart', 'FollowersAtStart', 'FollowingAtStart', 'ListedAtStart', 'FavoritesAtStart', 'StatusesGainFirstToLast', 'FollowersGainFirstToLast', 'FollowingGainFirstToLast', 'ListedGainFirstToLast', 'FavoritesGainFirstToLast', 'StatusesGainPerDay', 'FollowersGainPerDay', 'FollowingGainPerDay', 'ListedGainPerDay', 'FavoritesGainPerDay', 'Originals', 'Retweets', 'Replies', 'Quotes', 'Distinct', 'Age', 'MinMinutesBetweenTweets', 'MaxMinutesBetweenTweets', 'AveMinutesBetweenTweets', 'MedMinutesBetweenTweets', 'DevMinutesBetweenTweets', 'NormDevMinutesBetweenTweets', 'Words', 'DistinctWords', 'WordsPerTweet', 'DistinctWordsPerTweet', 'Mentions', 'URLs', 'URLsPerTweet', 'DistinctDomains', 'DistinctDomainsPerURL', 'SimpleMentions', 'MentionsOfUser', 'RetweetsOfUser', 'RepliesOfUser', 'QuotesOfUser', 'SimpleMentionsOfUser');

    // Get values
    $values = array();
    $update = array();
    foreach($keys as $key) {
        if(isset($_REQUEST[$key])) {
            $values[] = $_REQUEST[$key];
            if($key <> 'Event' and $key <> 'Subset' and $key <> 'UserID') {
                $update[] = "`$key` = '$_REQUEST[$key]'";
            }
        } else {
            die('Missing key: ' . $key);
        }
    }
    
    // Insert stats into user table
    $query = "INSERT INTO User ";
    $query .= " (`" . join("`, `", $keys) . "`) ";
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