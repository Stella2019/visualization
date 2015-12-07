<?php
    include 'connect.php';

    // Execute Query
    $query = "SELECT ID, Name, StartTime, StopTime FROM Event;";

    include 'printResults.php';
?>