<?php
    include 'connect.php';

    // Execute Query
    $query = "SELECT * FROM Event;";

    include 'printJSON.php';
?>