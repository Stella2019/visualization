
<?php
    include '../connect.php';

    $query = "" .
        "SELECT Rumor, " .
        "   COUNT(DISTINCT(`Tweet`)) as 'Count' " .
        "FROM Code " . 
        "WHERE Period == 0 " .
        "GROUP BY Rumor; ";

    include '../printJSON.php';
?>