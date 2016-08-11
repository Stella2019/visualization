<?php
    include '../connect.php';


    $query = "INSERT IGNORE INTO TweetInEvent " .
        "(`Event`, `Tweet`, `Distinct`, `Type`) " .
        "SELECT " .
        "	 " . $_REQUEST['new_event'] . " as 'Event', " .
        "    Original.`Tweet`, " .
        "    Original.`Distinct`, " .
        "    Original.`Type` " .
        "FROM TweetInEvent Original " .
        "WHERE Original.Event = " . $_REQUEST['event'] . " " .
        "AND Tweet >= " . $_REQUEST['tweet_min'] . " " .
        "AND Tweet <    " . $_REQUEST['tweet_max'] . " " .
        "ON DUPLICATE KEY UPDATE " .
        "TweetInEvent.`Distinct` = LEAST(TweetInEvent.`Distinct`, Original.`Distinct`); ";
    
    $result = $mysqli->query($query);
    
    if(!$result) {
        print ($query);
        print (mysqli_error($mysqli));
    } else {
        print ($result);
    }

    $mysqli->close();
?>