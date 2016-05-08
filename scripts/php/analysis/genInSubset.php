<?php
    include '../connect.php';

    ini_set('max_execution_time', 60);

    $subset = $_REQUEST["subset"];

    // Add a new subset
    if($subset == 'new') {
        // Defaults
        $event = 0;
        $rumor = 0;
        $superset = 0;
        $feature = '';
        $match = '';
        date_default_timezone_set('America/Los_Angeles');
        $notes = 'Created by genInSubset.php ' . date("Y-m-d");
        
        if(isset($_REQUEST["event"]))
            $event = $_REQUEST["event"];
        if(isset($_REQUEST["rumor"]))
            $rumor = $_REQUEST["rumor"];
        if(isset($_REQUEST["superset"]))
            $superset = $_REQUEST["superset"];
        if(isset($_REQUEST["url"])) {
            $feature = 'Expanded URL';
            $match = $_REQUEST["url"];
        } else if(isset($_REQUEST["source"])) {
            $feature = 'Source';
            $match = $_REQUEST["source"];
        } else if(isset($_REQUEST["lang"])) {
            $feature = 'Lang';
            $match = $_REQUEST["lang"];
        } else if(isset($_REQUEST["text_regex"])) {
            $feature = 'Text';
            $match = $_REQUEST["text_regex"];
        }
        
        // Build query
        $query = "" .
            "INSERT IGNORE INTO Subset " .
            "(`Event`, `Rumor`, `Superset`, `Feature`, `Match`, `Notes`) " .
            " VALUES ($event, $rumor, $superset, '$feature', '$match', '$notes'); ";
        
        $result = $mysqli->query($query);
        
        if (!$result) {
            $mysqli->close();
            die("Error creating new subset for $event, $rumor, $superset, $feature, $match: " . mysqli_error($mysqli) );
        }
        
        // Fetch ID query
        $query = "" .
            "SELECT `ID` " .
            "FROM Subset " .
            "WHERE " . 
            "    `Event`=$event AND " .
            "    `Rumor`=$rumor AND " .
            "    `Superset`=$superset AND " .
            "    `Feature`='$feature' AND " .
            "    `Match`='$match'; ";
        
        if ($result=$mysqli->query($query)) {
            $subset = mysqli_fetch_row($result)[0];
            echo $subset . ': ';
        } else {
            $mysqli->close();
            die("Error creating then fetching new subset for $event, $rumor, $superset, $feature, $match");
        }
    }

    // Setup query
    $query = "INSERT IGNORE INTO InSubset " .
        "SELECT " .
        "	 " . $subset . " as 'Subset', " .
        "    Tweet.`ID` as 'Tweet', " .
        "	 Tweet.`Distinct` as 'Distinct', " .
        "    Tweet.`Type` as 'Type' " .
        "FROM Tweet ";

    // Add conditionals
    $conds = array();
    if(isset($_REQUEST["tweet_min"]))
        $conds[] = "Tweet.ID >= " . $_REQUEST["tweet_min"];
    if(isset($_REQUEST["tweet_max"]))
        $conds[] = "Tweet.ID < " . $_REQUEST["tweet_max"];

    if(isset($_REQUEST["event"])) {
        $query .= "JOIN InEvent " .
                "	ON Tweet.`ID` = InEvent.Tweet ";
        
        $conds[] = "InEvent.Event = " . $_REQUEST["event"];
    }
    if(isset($_REQUEST["superset"])) {
        $query .= "JOIN InSubset " .
                "	ON Tweet.`ID` = InSubset.Tweet ";

        $conds[] = "InSubset.Subset = " . $_REQUEST["superset"];
    }
    if(isset($_REQUEST["excludeset"])) {
        $query .= "LEFT JOIN InSubset ExcludeSet " .
                "	ON Tweet.`ID` = ExcludeSet.Tweet " .
                "   AND ExcludeSet.Subset = " . $_REQUEST["excludeset"] . "  ";

        $conds[] = "ExcludeSet.Tweet IS NULL";
    }
    if(isset($_REQUEST["userbot"])) {
        $query .= "JOIN TweetUser " .
                  "    ON Tweet.`ID` = TweetUser.Tweet " .
                  "JOIN User " .
                  "    ON TweetUser.`UserID` = User.UserID ";

        $conds[] = "User.Bot = " . $_REQUEST["userbot"];
    }
    if(isset($_REQUEST["botnet"])) {
        $query .= "JOIN TweetUser " .
                  "    ON Tweet.`ID` = TweetUser.Tweet " .
                  "JOIN User " .
                  "    ON TweetUser.`UserID` = User.UserID ";
        
        $botnet = $_REQUEST["botnet"];
        if(substr($botnet, 0, 1) == '!') {
            $botnet = substr($botnet, 1);
            $conds[] = "User.Botnet NOT LIKE '%$botnet%'";
        } else {
            $conds[] = "User.Botnet LIKE '%$botnet%'";
        }
    }

    if(isset($_REQUEST["source"]))
        $conds[] = "LOWER(Tweet.Source) REGEXP '" . $_REQUEST["source"] . "'";
    if(isset($_REQUEST["url"]))
        $conds[] = "LOWER(Tweet.ExpandedURL) REGEXP '" . $_REQUEST["url"] . "'";
    if(isset($_REQUEST["lang"]))
        $conds[] = "Tweet.Lang = '" . $_REQUEST["lang"] . "'";
    if(isset($_REQUEST["text_regex"])) {
        foreach(explode(' & ', $_REQUEST["text_regex"]) as $term) {
            $conds[] = "LOWER(Tweet.Text) REGEXP '" . $term . "'";
        }
    }

    if(!empty($conds))
        $query .= " WHERE " . join(" AND " , $conds);

    $result = $mysqli->query($query);
     
    if(!$result) {
        print ($query);
        print (mysqli_error($mysqli));
    } else {
        print ($result);
    }

    $mysqli->close();
?>