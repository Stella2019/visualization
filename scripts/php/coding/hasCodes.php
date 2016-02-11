
<?php
    include '../connect.php';

    $query = "" .
        "SELECT COUNT(*) as 'Count'" .
        "FROM Code " . 
        "WHERE Rumor = " . $_POST['rumor_id'] . ";";

    include '../printJSON.php';
?>