
<?php
    include '../connect.php';

    $query = "" .
        "SELECT Rumor, Period, COUNT(*) as 'Count'" .
        "FROM TweetCode " . 
        "GROUP BY Rumor, Period;";

    include '../printJSON.php';
?>