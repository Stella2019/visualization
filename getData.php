<?php

    // Get Configuration Data
    $file = 'local.conf';
    $conf = json_decode(file_get_contents($file), true);

    $conn = new mysqli($conf['storage']['host'], $conf['storage']['user'], $conf['storage']['password'], $conf['storage']['database']);

    if($conn->connect_error) {
        die("Connect failed: " . $conn->connect_error);
    }

    $query = "
    SELECT
        DATE_FORMAT(twt.Timestamp, '%Y%m%d_%H%i') as timestamp,
        COUNT(*) as count
    FROM tweet twt
    GROUP BY timestamp";

    // Get event with name & count of tweets
    $query = "
    SELECT ev.Name, twtev_count.Count
    FROM Event ev
    LEFT JOIN 
        (SELECT
            twtev.Event_ID AS ID,
            COUNT(*) AS Count
        FROM TweetInEvent twtev
        GROUP BY twtev.Event_ID) twtev_count
        ON twtev_count.ID = ev.ID
    LIMIT 50";

    // $_GET["field"]

    $result = $conn->query($query);
        
    if ($result) {
//        printf("Select returned %d rows.\n", $result->num_rows);
        
        $headers = $result->fetch_fields();
        foreach($headers as $header) {
                printf('%s,', $header->name);
        }
            printf('\n');
        
        while($row = $result->fetch_row()) { 
            foreach($row as $value) {
                printf('%s,', $value);
            }
            printf('\n');
//            printf("Object: %s\t%s\n", $obj[0], $obj[1]);
//            $line.=$obj->uid; 
//            $line.=$obj->role; 
//            $line.=$obj->roleid; 
        } 

        /* free result set */
        $result->close();
    } else {
        printf("Errormessage: %s <br>", $conn->error);
    }

//////////// Export to CSV
//    if (!$result) die('Couldn\'t fetch records');
//    $headers = $result->fetch_fields();
//    foreach($headers as $header) {
//        $head[] = $header->name;
//    }
//    $fp = fopen('php://output', 'w');
//
//    if ($fp && $result) {
//        header('Content-Type: text/csv');
//        header('Content-Disposition: attachment; filename="export.csv"');
//        header('Pragma: no-cache');
//        header('Expires: 0');
//        fputcsv($fp, array_values($head)); 
//        while ($row = $result->fetch_array(MYSQLI_NUM)) {
//            fputcsv($fp, array_values($row));
//        }
//        die;
//    }

////////////////////////////////
//    $result = $conn->query($query);
//        
//    // Parse Results
//    echo $result;
//
//    if(mysql_num_rows($result)) {
//        while($value = mysql_fetch_assoc($result)) {
//            $line = $line.$value["height"];
//            $i = $i + 1;
//            if ($i == 52) {
//                $i = 0;
//                echo $line."\n";
//                $line = "";
//            }else {
//                $line = $line . ",";
//            }
//        }
//    }

//    while($row = mysqli_fetch_assoc($result)) {
//        echo $row;
////        echo "id: " . $row["id"]. " - Name: " . $row["firstname"]. " " . $row["lastname"]. "<br>";
//    }

//    $fields = mysql_num_fields ( $result );
//
//    for ( $i = 0; $i < $fields; $i++ )
//    {
//        $header .= mysql_field_name( $result , $i ) . "\t";
//    }
//
//    while( $row = mysql_fetch_row( $result ) )
//    {
//        $line = '';
//        foreach( $row as $value )
//        {                                            
//            if ( ( !isset( $value ) ) || ( $value == "" ) )
//            {
//                $value = "\t";
//            }
//            else
//            {
//                $value = str_replace( '"' , '""' , $value );
//                $value = '"' . $value . '"' . "\t";
//            }
//            $line .= $value;
//        }
//        $data .= trim( $line ) . "\n";
//    }
//    $data = str_replace( "\r" , "" , $data );
//
//    if ( $data == "" )
//    {
//        $data = "\n(0) Records Found!\n";                        
//    }
//
//    header("Content-type: application/octet-stream");
//    header("Content-Disposition: attachment; filename=your_desired_name.xls");
//    header("Pragma: no-cache");
//    header("Expires: 0");
//    print "$header\n$data";
        
?>