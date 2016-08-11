<?php

    function getName($item) {
        return $item->name;
    }

    $result = $mysqli->query($query);
    
    // Print query as CSV
    if ($result) {
        // Set content type (or saving)
        header("Content-Type: text/plain");
//        header("Content-Type: text/csv");
//        header('Content-Disposition: attachment; filename="time_keyword_freq_by.csv"');
//        header('Pragma: no-cache');
//        header('Expires: 0');
        
        $headers = $result->fetch_fields();
        printf("%s\n", implode(',', array_map("getName", $headers)));
        
        while($row = $result->fetch_row()) { 
            printf("%s\n", implode(',', $row));
            
//            printf("Object: %s\t%s\n", $obj[0], $obj[1]);
//            $line.=$obj->uid; 
//            $line.=$obj->role; 
//            $line.=$obj->roleid; 
        } 

        /* free result set */
        $result->close();
    } else {
        printf("Errormessage: %s <br>", $mysqli->error);
    }
     
    $mysqli->close();
?>