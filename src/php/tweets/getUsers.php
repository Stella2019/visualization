<?php
    include '../connect.php';

    ini_set('max_execution_time', 300);

    $collection = $_REQUEST["collection"];
    $collection_id = $_REQUEST["collection_id"];

    $query = "SELECT ";
        
    $projection = array();
    $projection[] = "TweetSet.UserID";
    $projection[] = "TweetSet.Tweets";
    $projection[] = "tweetID_2_date(TweetSet.FirstTweetID) as 'FirstTweetDate'";
    $projection[] = "tweetID_2_date(TweetSet.LastTweetID) as 'LastTweetDate'";
    if(isset($_REQUEST["extradata"]) and strpos($_REQUEST["extradata"], 'u') !== false) {
        $projection[] = "TweetUser.Username";
        $projection[] = "TweetUser.Screenname";
        $projection[] = "TweetUser.CreatedAt";
        $projection[] = "TweetUser.Description";
        $projection[] = "TweetUser.Location";
        $projection[] = "TweetUser.UTCOffset";
        $projection[] = "TweetUser.Timezone";
        $projection[] = "TweetUser.Lang";
        $projection[] = "TweetUser.StatusesCount";
        $projection[] = "TweetUser.FollowersCount";
        $projection[] = "TweetUser.FriendsCount";
        $projection[] = "TweetUser.ListedCount";
        $projection[] = "TweetUser.FavouritesCount";
        $projection[] = "TweetUser.Verified";
    }

    $query .= join(", " , $projection);

    // Joins
    $query .= " FROM UserIn$collection TweetSet " ;//.
//        "LEFT JOIN Tweet ON Tweet.ID = TweetSet.LastTweetTweetID ";
    if(isset($_REQUEST["extradata"]) and strpos($_REQUEST["extradata"], 'u') !== false) {
        $query .= " LEFT JOIN TweetUser ON TweetUser.Tweet = TweetSet.LastTweetID ";
    }

    // Add conditionals
    $conds = array();
    $conds[] = "TweetSet.${collection}ID=$collection_id ";
    if(isset($_REQUEST["tweet_min"]))
        $conds[] = "TweetSet.TweetID >= " . $_REQUEST["tweet_min"] . " ";
    if(isset($_REQUEST["tweet_max"]))
        $conds[] = "TweetSet.TweetID < " . $_REQUEST["tweet_max"] . " ";
    if(isset($_REQUEST["time_min"]))
        $conds[] = "tweetID_2_date(TweetSet.Tweet) >= '" . $_REQUEST["time_min"] . "'";
    if(isset($_REQUEST["time_max"]))
        $conds[] = "tweetID_2_date(TweetSet.Tweet) < '" . $_REQUEST["time_max"] . "'";

    if(!empty($conds))
        $query .= " WHERE " . join(" AND " , $conds);
    
    // Other conditions/limits
    if(isset($_REQUEST["rand"])) {
        $query .= " ORDER BY RAND(3)";
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