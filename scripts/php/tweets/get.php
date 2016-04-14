<?php
    include '../connect.php';

    ini_set('max_execution_time', 300);

    $collection = $_REQUEST["collection"];
    $collection_id = $_REQUEST["collection_id"];

    $query = "SELECT ";
    
        
    $projection = array("Tweet.*");
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
    if(isset($_POST["order_prevalence"])) {
        $projection[] = "Count(*) as Count";
    }

    $query .= join(", " , $projection);

            
    $query .= " FROM In$collection TweetSet " .
        "LEFT JOIN Tweet ON Tweet.ID = TweetSet.Tweet " .
        "LEFT JOIN TweetUser ON TweetUser.Tweet = TweetSet.Tweet ";

    // Add conditionals
    $conds = array();
    $conds[] = "TweetSet.$collection=$collection_id ";
    if(isset($_POST["time_min"]))
        $conds[] = "Tweet.Timestamp >= '" . $_REQUEST["time_min"] . "'";
    if(isset($_POST["time_max"]))
        $conds[] = "Tweet.Timestamp < '" . $_REQUEST["time_max"] . "'";
    if(isset($_POST["type"]))
        $conds[] = "Tweet.Type IN ('" . $_REQUEST["type"] . "')";
    if(isset($_POST["distinct"]))
        $conds[] = "Tweet.Distinct = '" . $_REQUEST["distinct"] . "'";
    if(isset($_POST["search_text"])) {
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
        $query .= " GROUP BY Tweet.Text";
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