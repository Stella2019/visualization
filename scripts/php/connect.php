<?php
    // Get Configuration Data
    $file = '../../local.conf';
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
?>