<?php
    include '../connect.php';

    $offset = (isset($_REQUEST['offset']) ? $_REQUEST['offset'] : 0);
    $limit = (isset($_REQUEST['limit']) ? $_REQUEST['limit'] : 1000);

    // Assemble Query
    if(isset($_REQUEST['count'])) {
        $query = "SELECT COUNT(*) as 'nEdges' ".
                 "FROM SharedAudience100k; ";
    } else {
        $query = "SELECT UserID1, UserID2 ".
                 "FROM SharedAudience100k " .
                 "LIMIT $offset, $limit";
    }
    
    // Execute & print as JSON
    include '../printJSON.php';
?>