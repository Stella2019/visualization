<?php

    // Get Configuration Data
    $file = 'local.conf';
    $conf = json_decode(file_get_contents($file), true);

    if (!isset($_SERVER['PHP_AUTH_USER'])) {
        header('WWW-Authenticate: Basic realm="Benson Store Database"');
        header('HTTP/1.0 401 Unauthorized');
        echo 'Authentication Cancelled';
        exit;
    }
    if($_SERVER['PHP_AUTH_USER'] != $conf['authentication']['username'] ||
       $_SERVER['PHP_AUTH_PW'] != $conf['authentication']['password']) {
        die("Invalid Username/Password");
    }

    // Initiate connection
    $mysqli = mysqli_init();
    if(!$mysqli) {
        die('mysqli_init failed');
    }
//    if (!$mysqli->options(MYSQLI_INIT_COMMAND, 'SET AUTOCOMMIT = 0')) {
//        die('Setting MYSQLI_INIT_COMMAND failed');
//    }
    if (!$mysqli->options(MYSQLI_OPT_CONNECT_TIMEOUT, 300)) {
        die('Setting MYSQLI_OPT_CONNECT_TIMEOUT failed');
    }
    if (!$mysqli->real_connect(
            $conf['storage']['host'],
            $conf['storage']['user'],
            $conf['storage']['password'],
            $conf['storage']['database'])) {
        die('Connect Error (' . mysqli_connect_errno() . ') '
                . mysqli_connect_error());
    }

    // Get input from user
    $search_term = $_GET["search_term"];
    $table_id = $_GET["table_id"];

    // Execute Query
    $query = "CALL getTimeKeywordByTypeFreq('" . $search_term . "', " . $table_id . ");";

    $result = $mysqli->query($query);
    
    // Print query as CSV
    if ($result) {
        // Set content type (or saving)
        header("Content-Type: text");
//        header("Content-Type: text/csv");
//        header('Content-Disposition: attachment; filename="time_keyword_freq_by.csv"');
//        header('Pragma: no-cache');
//        header('Expires: 0');
        
        $headers = $result->fetch_fields();
        foreach($headers as $header) {
            printf('%s, ', $header->name);
        }
        printf("\n");
        
        while($row = $result->fetch_row()) { 
            foreach($row as $value) {
                printf('%s, ', $value);
            }
            printf("\n");
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