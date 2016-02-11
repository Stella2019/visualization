
<?php
    include '../connect.php';

    $query = "" .
        "SELECT Rumor, Period, COUNT(*) as 'Count'" .
        "FROM Code " . 
        "GROUP BY Rumor, Period;";

    include '../printJSON.php';
?>