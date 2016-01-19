<?php
    function getName($item) {
        return $item->name;
    }

    $result = $mysqli->query($query);
    
    // Print query as CSV
    if ($result) {
        // Set content type
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename=data.csv');
        
        $output = fopen('php://output', 'w');
               
        $headers = $result->fetch_fields();
        fputcsv($output, array_map("getName", $headers));
               
        while($row = $result->fetch_row()) { 
            fputcsv($output, $row);
        } 

        /* free result set */
        $result->close();
    } else {
        printf("Errormessage: %s <br>", $mysqli->error);
    }
     
    $mysqli->close();
?>