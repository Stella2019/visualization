<?php
    include '../connect.php';

    ini_set('max_execution_time', 300);

    $collection = $_REQUEST["collection"];
    $collection_id = $_REQUEST["collection_id"];

    $query = "SELECT ";
        
    $projection = array("Tweet.*");
    if(isset($_REQUEST["extradata"]) and strpos($_REQUEST["extradata"], 'u') !== false) {
        $projection[] = "TweetUser.UserID";
        $projection[] = "TweetUser.Username";
        $projection[] = "TweetUser.Screenname";
        $projection[] = "TweetUser.CreatedAt as 'UserCreatedAt'";
        $projection[] = "TweetUser.Description as 'UserDescription'";
        $projection[] = "TweetUser.Location as 'UserLocation'";
        $projection[] = "TweetUser.UTCOffset as 'UserUTCOffset'";
        $projection[] = "TweetUser.Timezone as 'UserTimezone'";
        $projection[] = "TweetUser.Lang as 'UserLang'";
        $projection[] = "TweetUser.StatusesCount as 'UserStatusesCount'";
        $projection[] = "TweetUser.FollowersCount as 'UserFollowersCount'";
        $projection[] = "TweetUser.FriendsCount as 'UserFriendsCount'";
        $projection[] = "TweetUser.ListedCount as 'UserListedCount'";
        $projection[] = "TweetUser.FavouritesCount as 'UserFavouritesCount'";
        $projection[] = "TweetUser.Verified as 'UserVerified'";
    }
    if(isset($_REQUEST["extradata"]) and strpos($_REQUEST["extradata"], 'p') !== false) {
        // Leaving out ID, Timestamp, Text, ExpandedURL, Type
        $projection[] = "ParentTweet.UserID as 'ParentUserID'";
        $projection[] = "ParentTweet.Screenname as 'ParentScreenname'";
        $projection[] = "ParentTweet.UserVerified as 'ParentVerified'";
    }
    if(isset($_REQUEST["order_prevalence"])) {
        $projection[] = "Count(*) as Count";
    }

    $query .= join(", " , $projection);

    // Joins
    $query .= " FROM In$collection TweetSet " .
        "LEFT JOIN Tweet ON Tweet.ID = TweetSet.Tweet ";
    if(isset($_REQUEST["extradata"]) and strpos($_REQUEST["extradata"], 'u') !== false) {
        $query .= "LEFT JOIN TweetUser ON TweetUser.Tweet = TweetSet.Tweet ";
    }
    if(isset($_REQUEST["extradata"]) and strpos($_REQUEST["extradata"], 'p') !== false) {
        $query .= "LEFT JOIN ParentTweet ON ParentTweet.ID = Tweet.ParentID ";
    }

    // Add conditionals
    $conds = array();
    $conds[] = "TweetSet.$collection=$collection_id ";
    if(isset($_REQUEST["tweet_min"]))
        $conds[] = "Tweet.ID >= " . $_REQUEST["tweet_min"] . " ";
    if(isset($_REQUEST["tweet_max"]))
        $conds[] = "Tweet.ID < " . $_REQUEST["tweet_max"] . " ";
    if(isset($_REQUEST["time_min"]))
        $conds[] = "Tweet.Timestamp >= '" . $_REQUEST["time_min"] . "'";
    if(isset($_REQUEST["time_max"]))
        $conds[] = "Tweet.Timestamp < '" . $_REQUEST["time_max"] . "'";
    if(isset($_REQUEST["type"]))
        $conds[] = "Tweet.Type IN ('" . $_REQUEST["type"] . "')";
    if(isset($_REQUEST["distinct"]))
        $conds[] = "Tweet.Distinct = '" . $_REQUEST["distinct"] . "'";
    if(isset($_REQUEST["search_text"])) {
        foreach(explode(',', $_REQUEST["search_text"]) as $term) {
            $conds[] = "LOWER(Tweet.Text) REGEXP '" . $term . "'";
        }
    }

    if(!empty($conds))
        $query .= " WHERE " . join(" AND " , $conds);
    
    // Other conditions/limits
    if(isset($_REQUEST["rand"])) {
        $query .= " ORDER BY RAND(3)";
    } else if(isset($_REQUEST["order_prevalence"])) {
        $query .= " GROUP BY Tweet.TextStripped";
        $query .= " ORDER BY COUNT(*) DESC";
    }

    $query .= " LIMIT ";
    if(isset($_REQUEST["limit"])) {
        if(isset($_REQUEST["offset"])) {
            $query .= $_REQUEST["offset"] . ',';
        }
        $query .= $_REQUEST["limit"];
    } else {
        $query .= "5";
    }

    $query .= ";";

    if(isset($_REQUEST["csv"])) {
        include '../exportToCSV.php';
    } else {
        include '../printJSON.php';
    }
?>