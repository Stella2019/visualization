<?php
    include '../connect.php';

    ini_set('max_execution_time', 300);

    # Get Variables
    if(!isset($_REQUEST['Collection']) or !isset($_REQUEST['ID'])) {
        die('<b>Error</b>: Need to provide collection and id.');
    }

    $collection = strtolower($_REQUEST['Collection']);
    $collection_id = $_REQUEST['ID'];
    $tweet_min = $_REQUEST['tweet_min'];
    $tweet_max = $_REQUEST['tweet_max'];

    # Validation
    assert_options(ASSERT_BAIL, 1);
    assert("in_array('$collection', array('event', 'subset'))");
    assert("is_numeric($collection_id)");
    assert("is_numeric($tweet_min)");
    assert("is_numeric($tweet_max)");

    // Execute Query
    $query = "CALL compute_users_in_$collection" . 
        "($collection_id, $tweet_min, $tweet_max);";

    include '../printJSON.php';
?>