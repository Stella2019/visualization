<?php
    include 'connect.php';

    // Execute Query
    $query = "SELECT ID, Name, Description, StartTime, StopTime, Keywords, OldKeywords, TweetsCollected FROM Event;";

//    $query = "SELECT ID, Name, StartTime, StopTime, TweetsCollected FROM Event;";

    function scrubHTML($strin) {
            $strout = null;

            for ($i = 0; $i < strlen($strin); $i++) {
                    $ord = ord($strin[$i]);

                    if ($ord == 10 || $ord == 13) {
                            $strout .= '<br \>';
                    } else if ($ord == 44) {
                            $strout .= '&#44;';
                    } else if (($ord > 0 && $ord < 32) || ($ord >= 127)) {
                            $strout .= "&amp;#{$ord};";
                    }
                    else {
                            switch ($strin[$i]) {
                                    case '<':
                                            $strout .= '&lt;';
                                            break;
                                    case '>':
                                            $strout .= '&gt;';
                                            break;
                                    case '&':
                                            $strout .= '&amp;';
                                            break;
                                    case '"':
                                            $strout .= '&quot;';
                                            break;
                                    default:
                                            $strout .= $strin[$i];
                            }
                    }
            }

            return $strout;
    }

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
            printf("%s\n", implode(',', array_map("scrubHTML", $row)));
            
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



//    include 'printResults.php';
?>