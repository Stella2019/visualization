<?php
    include 'connect.php';

    // Execute Query
    $query = "" .
        "SELECT Event.ID, Event.name, E.datapoints, E.last as 'LastRecord', Event.StartTime, Event.StopTime " .
        "FROM (SELECT Event_ID, count(*) as datapoints, min(`Time`) as last FROM twitter_rumors.eventtweetcount " .
        "GROUP BY Event_ID) E " .
        "RIGHT JOIN `Event` " .
        "ON E.Event_ID = `Event`.ID; ";

    include 'printJSON.php';
?>