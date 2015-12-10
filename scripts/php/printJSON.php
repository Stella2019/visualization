<?php

    function getName($item) {
        return $item->name;
    }

    $result = $mysqli->query($query);
    
    // Print query as CSV
    if ($result) {
        $rows = array();
        while($r = mysqli_fetch_array($result)) {
            $rows[] = $r;
        }
        print json_encode($rows);
        
        /* free result set */
        $result->close();
    } else {
        printf("Errormessage: %s <br>", $mysqli->error);
    }
     
    $mysqli->close();
?>