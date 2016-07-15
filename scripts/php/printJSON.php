<?php

    function getName($item) {
        return $item->name;
    }
    
    $mysqli->query("SET CHARACTER SET utf8;");
    $result = $mysqli->query($query);
    
    // Print query as CSV
    if ($result) {
        $rows = array();
        while($r = mysqli_fetch_assoc($result)) {
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